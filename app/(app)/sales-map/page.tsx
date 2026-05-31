'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useData } from '@/contexts/DataContext';
import { useSales } from '@/contexts/SalesContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PageTransition } from '@/components/common/PageTransition';
import { EmptyState } from '@/components/common/EmptyState';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/format';
import {
  getDistanceKm,
  farmersInRadiusResolved,
  circleGeoJSON,
  type ResolvedFarmer,
} from '@/lib/geo';
import Link from 'next/link';
import {
  Map as MapIcon,
  Users,
  MapPin,
  Navigation,
  Layers,
  IndianRupee,
  TrendingUp,
  Newspaper,
  ExternalLink,
  ChevronRight,
  Phone,
  Route,
} from 'lucide-react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { cn } from '@/lib/utils';
import type { Farmer } from '@/constants/types';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? '';

async function geocodeVillage(
  village: string,
  taluka: string,
  district: string
): Promise<[number, number] | null> {
  const query = encodeURIComponent(`${village}, ${taluka}, ${district}, India`);
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${query}.json?key=${MAPTILER_KEY}&country=in&limit=1`
    );
    const data = await res.json();
    const feature = data?.features?.[0];
    if (feature?.geometry?.coordinates) {
      const [lng, lat] = feature.geometry.coordinates;
      return [lat, lng];
    }
  } catch {
    /* silent fail */
  }
  return null;
}

function hasStoredGps(f: Farmer): boolean {
  return (
    f.latitude !== undefined &&
    f.longitude !== undefined &&
    f.latitude !== 0 &&
    f.longitude !== 0 &&
    !isNaN(f.latitude!) &&
    !isNaN(f.longitude!)
  );
}

const RADIUS_OPTIONS = [1, 5, 10, 25, 50] as const;
type RadiusKm = (typeof RADIUS_OPTIONS)[number];

interface CropAlert {
  title: string;
  snippet: string;
  url: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function SalesMapPage() {
  const { farmers, visits, isLoading } = useData();
  const { getCreditFarmers, sales } = useSales();
  const { dealer } = useAuth();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maptilersdk.Map | null>(null);
  const markersRef = useRef<maptilersdk.Marker[]>([]);
  const geocacheRef = useRef<Map<string, [number, number] | null>>(new Map());

  const [resolvedFarmers, setResolvedFarmers] = useState<ResolvedFarmer[]>([]);
  const [geocodingProgress, setGeocodingProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [mapLoaded, setMapLoaded] = useState(false);

  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(10);
  const [dealerLocation, setDealerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [cropAlerts, setCropAlerts] = useState<CropAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [routeMode, setRouteMode] = useState(false);
  const [selectedFarmerIds, setSelectedFarmerIds] = useState<Set<string>>(() => new Set());

  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || '';

  const toggleRouteMode = useCallback(() => {
    setRouteMode((prev) => {
      if (prev) setSelectedFarmerIds(new Set());
      return !prev;
    });
  }, []);

  const toggleFarmerRouteSelection = useCallback((farmerId: string) => {
    setSelectedFarmerIds((prev) => {
      const next = new Set(prev);
      if (next.has(farmerId)) next.delete(farmerId);
      else next.add(farmerId);
      return next;
    });
  }, []);

  // Credit data map: farmerId -> totalDue
  const creditMap = useMemo(() => {
    const map = new Map<string, number>();
    getCreditFarmers().forEach((cf) => {
      map.set(cf.farmerId, cf.totalDue);
    });
    return map;
  }, [getCreditFarmers]);

  // Resolve GPS + geocoded coordinates (in-memory only; not persisted)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const exact: ResolvedFarmer[] = [];
      const pending: Farmer[] = [];
      for (const f of farmers) {
        if (hasStoredGps(f)) {
          exact.push({
            ...f,
            resolvedLat: f.latitude!,
            resolvedLng: f.longitude!,
            isApproximate: false,
          });
        } else {
          pending.push(f);
        }
      }

      if (pending.length === 0) {
        if (!cancelled) {
          setResolvedFarmers(exact);
          setGeocodingProgress(null);
        }
        return;
      }

      if (!cancelled) setGeocodingProgress({ done: 0, total: pending.length });

      const geocoded: ResolvedFarmer[] = [];
      const BATCH = 3;
      for (let i = 0; i < pending.length; i += BATCH) {
        if (cancelled) return;
        const batch = pending.slice(i, i + BATCH);
        const batchResults = await Promise.all(
          batch.map(async (f) => {
            const key = `${f.village}|${f.taluka}|${f.district}`;
            let coords = geocacheRef.current.get(key);
            if (coords === undefined) {
              const result = await geocodeVillage(f.village, f.taluka, f.district);
              geocacheRef.current.set(key, result);
              coords = result;
            }
            if (!coords) return null;
            return {
              ...f,
              resolvedLat: coords[0],
              resolvedLng: coords[1],
              isApproximate: true,
            } as ResolvedFarmer;
          })
        );
        for (const r of batchResults) {
          if (r) geocoded.push(r);
        }
        if (!cancelled) {
          setGeocodingProgress({
            done: Math.min(i + batch.length, pending.length),
            total: pending.length,
          });
        }
      }

      if (!cancelled) {
        setResolvedFarmers([...exact, ...geocoded]);
        setGeocodingProgress(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [farmers]);

  // Farmers within selected radius (uses GPS or geocoded coordinates)
  const farmersInRange = useMemo(() => {
    if (!dealerLocation) return [];
    return farmersInRadiusResolved(resolvedFarmers, dealerLocation.lat, dealerLocation.lng, radiusKm);
  }, [resolvedFarmers, dealerLocation, radiusKm]);

  const exactCount = resolvedFarmers.filter((f) => !f.isApproximate).length;
  const approxCount = resolvedFarmers.filter((f) => f.isApproximate).length;
  const noLocationCount = farmers.length - exactCount - approxCount;
  const locationCoveragePct =
    farmers.length > 0 ? ((exactCount + approxCount) / farmers.length) * 100 : 0;

  // Total sales & credit for farmers in range
  const rangeStats = useMemo(() => {
    const farmerIds = new Set(farmersInRange.map((f) => f.id));
    const rangeSales = sales.filter((s) => farmerIds.has(s.farmerId));
    const totalSales = rangeSales.reduce((s, sale) => s + sale.finalAmount, 0);
    const totalCredit = farmersInRange.reduce((s, f) => s + (creditMap.get(f.id) ?? 0), 0);
    const saleCount = rangeSales.length;
    const inRangeCount = farmersInRange.length;
    const avgSalesPerFarmer = inRangeCount > 0 ? totalSales / inRangeCount : 0;
    const visitedInRange = new Set(
      visits.filter((v) => farmerIds.has(v.farmerId)).map((v) => v.farmerId)
    );
    const visitCoveragePct = inRangeCount > 0 ? (visitedInRange.size / inRangeCount) * 100 : 0;
    return { totalSales, totalCredit, saleCount, avgSalesPerFarmer, visitCoveragePct };
  }, [farmersInRange, sales, creditMap, visits]);

  const visitCountByFarmer = useMemo(() => {
    const m = new Map<string, number>();
    visits.forEach((v) => m.set(v.farmerId, (m.get(v.farmerId) ?? 0) + 1));
    return m;
  }, [visits]);

  const salesCountByFarmer = useMemo(() => {
    const m = new Map<string, number>();
    sales.forEach((s) => m.set(s.farmerId, (m.get(s.farmerId) ?? 0) + 1));
    return m;
  }, [sales]);

  const selectedFarmersOrdered = useMemo(
    () =>
      Array.from(selectedFarmerIds)
        .map((id) => resolvedFarmers.find((f) => f.id === id))
        .filter((f): f is ResolvedFarmer => Boolean(f)),
    [selectedFarmerIds, resolvedFarmers]
  );

  const googleMapsRouteUrl = useMemo(() => {
    if (!dealerLocation || selectedFarmersOrdered.length < 2) return null;
    const enc = (lat: number, lng: number) => `${lat},${lng}`;
    const origin = enc(dealerLocation.lat, dealerLocation.lng);
    const coords = selectedFarmersOrdered.map((f) => ({ lat: f.resolvedLat, lng: f.resolvedLng }));
    const destination = coords[coords.length - 1]!;
    const waypoints = coords.slice(0, -1);
    const params = new URLSearchParams();
    params.set('api', '1');
    params.set('origin', origin);
    params.set('destination', enc(destination.lat, destination.lng));
    if (waypoints.length > 0) {
      params.set('waypoints', waypoints.map((p) => enc(p.lat, p.lng)).join('|'));
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [dealerLocation, selectedFarmersOrdered]);

  const handleFitAll = useCallback(() => {
    const m = map.current;
    if (!m || resolvedFarmers.length === 0) return;
    const bounds = new maptilersdk.LngLatBounds();
    if (dealerLocation) bounds.extend([dealerLocation.lng, dealerLocation.lat]);
    resolvedFarmers.forEach((f) => bounds.extend([f.resolvedLng, f.resolvedLat]));
    m.fitBounds(bounds, { padding: 60, maxZoom: 13 });
  }, [dealerLocation, resolvedFarmers]);

  // Pin color by credit
  const getPinColor = useCallback(
    (farmer: Farmer) => {
      const credit = creditMap.get(farmer.id) ?? 0;
      if (credit === 0) return { bg: '#22c55e', glow: 'rgba(34,197,94,0.4)' }; // green
      if (credit <= 5000) return { bg: '#f59e0b', glow: 'rgba(245,158,11,0.4)' }; // yellow
      return { bg: '#ef4444', glow: 'rgba(239,68,68,0.4)' }; // red
    },
    [creditMap]
  );

  // Get dealer location on mount; refine fallback once resolved farmers exist
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setDealerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setDealerLocation({ lat: 20.5937, lng: 78.9629 });
      }
    );
  }, []);

  useEffect(() => {
    if (resolvedFarmers.length === 0) return;
    setDealerLocation((prev) => {
      if (!prev) {
        const lat =
          resolvedFarmers.reduce((s, f) => s + f.resolvedLat, 0) / resolvedFarmers.length;
        const lng =
          resolvedFarmers.reduce((s, f) => s + f.resolvedLng, 0) / resolvedFarmers.length;
        return { lat, lng };
      }
      const isDefaultIndia =
        Math.abs(prev.lat - 20.5937) < 0.0001 && Math.abs(prev.lng - 78.9629) < 0.0001;
      if (isDefaultIndia) {
        return {
          lat: resolvedFarmers.reduce((s, f) => s + f.resolvedLat, 0) / resolvedFarmers.length,
          lng: resolvedFarmers.reduce((s, f) => s + f.resolvedLng, 0) / resolvedFarmers.length,
        };
      }
      return prev;
    });
  }, [resolvedFarmers]);

  // Fetch crop alerts when dealer district changes
  useEffect(() => {
    if (!dealer?.district) return;
    setAlertsLoading(true);
    const month = new Date().toLocaleString('en-IN', { month: 'long' });
    fetch(`/api/crop-alerts?region=${encodeURIComponent(dealer.district)}&month=${month}`)
      .then((r) => r.json())
      .then((d: { alerts: CropAlert[] }) => setCropAlerts(d.alerts ?? []))
      .catch(() => setCropAlerts([]))
      .finally(() => setAlertsLoading(false));
  }, [dealer?.district]);

  // Initialize map (once per API key)
  useEffect(() => {
    if (!apiKey || !mapContainer.current || map.current) return;

    maptilersdk.config.apiKey = apiKey;

    const m = new maptilersdk.Map({
      container: mapContainer.current,
      style:
        mapStyle === 'streets' ? maptilersdk.MapStyle.STREETS : maptilersdk.MapStyle.SATELLITE,
      center: [78.9629, 20.5937],
      zoom: 10,
    });

    map.current = m;

    m.on('load', () => {
      m.addSource('radius-circle', {
        type: 'geojson',
        data: dealerLocation
          ? circleGeoJSON(dealerLocation.lat, dealerLocation.lng, radiusKm)
          : { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius-circle',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.08 },
      });
      m.addLayer({
        id: 'radius-outline',
        type: 'line',
        source: 'radius-circle',
        paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-opacity': 0.6 },
      });

      if (dealerLocation) {
        const el = document.createElement('div');
        el.style.cssText = `
          width: 14px; height: 14px;
          background: #3b82f6;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.35), 0 4px 12px rgba(59,130,246,0.5);
        `;
        new maptilersdk.Marker({ element: el })
          .setLngLat([dealerLocation.lng, dealerLocation.lat])
          .addTo(m);
      }

      setMapLoaded(true);
    });

    return () => {
      setMapLoaded(false);
      m.remove();
      map.current = null;
      markersRef.current = [];
    };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps -- mount once; style toggled via setStyle

  // Farmer markers (updates when resolved coordinates or related data changes)
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;

    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    resolvedFarmers.forEach((farmer) => {
      const { bg, glow } = getPinColor(farmer);
      const el = document.createElement('div');
      if (farmer.isApproximate) {
        el.title = '~ Approximate location (village)';
        el.style.cssText = `
          width: 28px; height: 28px;
          background: ${bg}80;
          border-radius: 50%;
          border: 2px dashed ${bg};
          box-shadow: 0 2px 10px ${glow};
          cursor: pointer;
          transition: transform 150ms;
        `;
        el.onmouseenter = () => (el.style.transform = 'scale(1.12)');
        el.onmouseleave = () => (el.style.transform = 'scale(1)');
      } else {
        el.title = farmer.fullName;
        el.style.cssText = `
          width: 28px; height: 28px;
          background: ${bg};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid white;
          box-shadow: 0 4px 12px ${glow};
          cursor: pointer;
          transition: transform 150ms;
        `;
        el.onmouseenter = () => (el.style.transform = 'rotate(-45deg) scale(1.15)');
        el.onmouseleave = () => (el.style.transform = 'rotate(-45deg) scale(1)');
      }

      const credit = creditMap.get(farmer.id) ?? 0;
      const farmerSales = sales.filter((s) => s.farmerId === farmer.id);
      const totalRevenue = farmerSales.reduce((s, x) => s + x.finalAmount, 0);
      const lastSaleRec = [...farmerSales].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      const lastSale = lastSaleRec
        ? new Date(lastSaleRec.createdAt).toLocaleDateString('en-IN')
        : '—';
      const farmerVisits = visits.filter((v) => v.farmerId === farmer.id);
      const lastVisitRec = [...farmerVisits].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      const lastVisit = lastVisitRec
        ? new Date(lastVisitRec.createdAt).toLocaleDateString('en-IN')
        : '—';
      const cropBadges =
        farmer.cropCycle?.length && farmer.cropCycle.length > 0
          ? farmer.cropCycle
              .map(
                (c) =>
                  `<span style="display:inline-block;padding:1px 5px;margin:0 2px 2px 0;border-radius:4px;font-size:9px;background:#f3f4f6;color:#374151">${escapeHtml(c)}</span>`
              )
              .join('')
          : '<span style="font-size:10px;color:#999">—</span>';
      const distKm = dealerLocation
        ? getDistanceKm(
            dealerLocation.lat,
            dealerLocation.lng,
            farmer.resolvedLat,
            farmer.resolvedLng
          ).toFixed(1)
        : '—';
      const safeName = escapeHtml(farmer.fullName);
      const safeMobile = escapeHtml(farmer.mobile);
      const safeVillage = escapeHtml(farmer.village || '—');
      const safeDistrict = escapeHtml(farmer.district || '');
      const approxNote = farmer.isApproximate
        ? '<p style="font-size:10px;color:#888;margin-top:4px">📍 Approximate location (village centroid)</p>'
        : '';
      const popup = new maptilersdk.Popup({ offset: 28, closeButton: false }).setHTML(`
        <div style="padding:8px;min-width:190px;font-family:system-ui">
          <p style="font-weight:600;font-size:13px;margin-bottom:3px;color:#111">${safeName}</p>
          ${approxNote}
          <p style="font-size:11px;color:#666;margin-bottom:1px">📱 ${safeMobile}</p>
          <p style="font-size:11px;color:#666;margin-bottom:4px">📍 ${safeVillage}, ${safeDistrict}</p>
          <p style="font-size:10px;color:#666;margin-bottom:2px">~${distKm} km • Visits: ${farmerVisits.length} • Sales: ${farmerSales.length}</p>
          <p style="font-size:10px;color:#666;margin-bottom:2px">Revenue: ₹${totalRevenue.toLocaleString('en-IN')} • Last sale: ${lastSale}</p>
          <p style="font-size:10px;color:#666;margin-bottom:4px">Last visit: ${lastVisit}</p>
          <div style="margin-bottom:4px">${cropBadges}</div>
          ${credit > 0 ? `<p style="font-size:11px;color:#ef4444;font-weight:500">₹${credit.toLocaleString('en-IN')} pending</p>` : '<p style="font-size:11px;color:#22c55e;font-weight:500">No pending credit ✓</p>'}
        </div>
      `);

      const marker = new maptilersdk.Marker({ element: el })
        .setLngLat([farmer.resolvedLng, farmer.resolvedLat])
        .setPopup(popup)
        .addTo(m);

      el.onclick = () => marker.togglePopup();
      markersRef.current.push(marker);
    });
  }, [
    mapLoaded,
    resolvedFarmers,
    dealerLocation,
    creditMap,
    sales,
    visits,
    getPinColor,
  ]);

  // Update radius circle when radius or dealer location changes
  useEffect(() => {
    if (!map.current || !dealerLocation) return;
    const src = map.current.getSource('radius-circle') as maptilersdk.GeoJSONSource | undefined;
    if (src) {
      src.setData(circleGeoJSON(dealerLocation.lat, dealerLocation.lng, radiusKm));
    }
  }, [radiusKm, dealerLocation]);

  // Change map style
  const handleStyleChange = (style: 'streets' | 'satellite') => {
    if (map.current) {
      map.current.setStyle(
        style === 'streets' ? maptilersdk.MapStyle.STREETS : maptilersdk.MapStyle.SATELLITE
      );
      setMapStyle(style);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <PageTransition>
        <div className="space-y-6 p-4 md:p-6">
          <h1 className="text-xl font-semibold tracking-tight">Sales Territory Map</h1>
          <EmptyState
            icon={MapIcon}
            title="MapTiler API Key Required"
            description="Add NEXT_PUBLIC_MAPTILER_API_KEY to your .env.local file to enable the map."
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sales Territory Map</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Map uses GPS when saved, otherwise village geocoding (no GPS required at registration)
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative flex flex-col gap-1 overflow-hidden rounded-lg border border-border bg-card p-3">
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-info to-transparent" />
            <div className="flex items-center justify-between">
              <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">Total Farmers</span>
              <div className="flex h-5 w-5 items-center justify-center rounded bg-info/10">
                <Users className="h-3 w-3 text-info" />
              </div>
            </div>
            <AnimatedNumber value={farmers.length} className="text-xl font-semibold tabular-nums" />
          </div>
          <div className="relative flex flex-col gap-1 overflow-hidden rounded-lg border border-border bg-card p-3">
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-success to-transparent" />
            <div className="flex items-center justify-between">
              <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">In Radius</span>
              <div className="flex h-5 w-5 items-center justify-center rounded bg-success/10">
                <MapPin className="h-3 w-3 text-success" />
              </div>
            </div>
            <AnimatedNumber value={farmersInRange.length} className="text-xl font-semibold tabular-nums" />
            <span className="text-2xs text-muted-foreground">within {radiusKm} km</span>
          </div>
          <div className="relative flex flex-col gap-1 overflow-hidden rounded-lg border border-border bg-card p-3">
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="flex items-center justify-between">
              <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">Range Sales</span>
              <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10">
                <TrendingUp className="h-3 w-3 text-primary" />
              </div>
            </div>
            <span className="text-xl font-semibold tabular-nums">{formatINR(rangeStats.totalSales)}</span>
            <span className="text-2xs text-muted-foreground">{rangeStats.saleCount} transactions</span>
          </div>
        </div>

        {/* Main layout: map + panel */}
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* MAP */}
          <Card className="overflow-hidden">
            {/* Map toolbar */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Radius:</span>
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadiusKm(r)}
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                      radiusKm === r
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {r}km
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={handleFitAll} className="h-7">
                  Fit All
                </Button>
                <Button
                  variant={mapStyle === 'streets' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleStyleChange('streets')}
                  className="h-7 gap-1"
                >
                  <MapIcon className="h-3 w-3" />
                  Streets
                </Button>
                <Button
                  variant={mapStyle === 'satellite' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleStyleChange('satellite')}
                  className="h-7 gap-1"
                >
                  <Layers className="h-3 w-3" />
                  Satellite
                </Button>
              </div>
            </div>

            {farmers.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={MapPin}
                  title="No Farmers"
                  description="Add farmers to see them on the territory map."
                />
              </div>
            ) : (
              <div className="relative h-[520px] w-full">
                <div className="absolute left-0 right-0 top-0 z-10 border-b border-border/60 bg-background/90 px-3 py-2 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-muted-foreground">
                    <span>
                      📍 GPS coverage:{' '}
                      <span className="font-medium text-foreground">{exactCount} exact</span>
                      {' · '}
                      <span className="font-medium text-foreground">{approxCount} approximate</span>
                      {' · '}
                      <span className="font-medium text-foreground">{noLocationCount} no location</span>
                    </span>
                    <span className="tabular-nums">{Math.round(locationCoveragePct)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{
                        width: farmers.length > 0 ? `${locationCoveragePct}%` : '0%',
                      }}
                    />
                  </div>
                </div>
                {geocodingProgress && (
                  <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md">
                    ⏳ Locating farmers on map... ({geocodingProgress.done} / {geocodingProgress.total})
                  </div>
                )}
                <div ref={mapContainer} className="h-full w-full" />
              </div>
            )}

            {/* Pin legend */}
            <div className="flex items-center gap-4 border-t border-border px-4 py-2">
              <span className="text-2xs text-muted-foreground">Pin colour:</span>
              {[
                { color: '#22c55e', label: 'No credit' },
                { color: '#f59e0b', label: '≤ ₹5k pending' },
                { color: '#ef4444', label: '> ₹5k pending' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span className="text-2xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-amber-500 bg-amber-500/50"
                />
                <span className="text-2xs text-muted-foreground">Approx. (village)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-2xs text-muted-foreground">Your location</span>
              </div>
            </div>
          </Card>

          {/* INTELLIGENCE PANEL */}
          <div className="space-y-3">
            {/* Farmers in range */}
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-info" />
                  <span className="text-xs font-semibold">Farmers in {radiusKm}km</span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant={routeMode ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 gap-1"
                    onClick={toggleRouteMode}
                  >
                    <Route className="h-3 w-3" />
                    Plan Route
                  </Button>
                  <Badge variant="secondary" className="text-2xs">
                    {farmersInRange.length}
                  </Badge>
                </div>
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                {farmersInRange.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No farmers within {radiusKm}km
                  </p>
                ) : (
                  farmersInRange.map((farmer) => {
                    const credit = creditMap.get(farmer.id) ?? 0;
                    const vCount = visitCountByFarmer.get(farmer.id) ?? 0;
                    const sCount = salesCountByFarmer.get(farmer.id) ?? 0;
                    const dist = dealerLocation
                      ? getDistanceKm(
                          dealerLocation.lat,
                          dealerLocation.lng,
                          farmer.resolvedLat,
                          farmer.resolvedLng
                        ).toFixed(1)
                      : '—';
                    const waDigits = farmer.mobile.replace(/\D/g, '');
                    const waHref = waDigits ? `https://wa.me/91${waDigits}` : '#';
                    return (
                      <div
                        key={farmer.id}
                        className="flex items-stretch gap-2 border-b border-border/50 px-3 py-2 last:border-0 hover:bg-muted/50"
                      >
                        {routeMode && (
                          <div className="flex items-center pt-0.5">
                            <Checkbox
                              checked={selectedFarmerIds.has(farmer.id)}
                              onCheckedChange={() => toggleFarmerRouteSelection(farmer.id)}
                              aria-label={`Include ${farmer.fullName} in route`}
                            />
                          </div>
                        )}
                        <Link
                          href={`/farmers/${farmer.id}`}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-1 truncate text-xs font-medium">
                              {farmer.fullName}
                              {farmer.isApproximate && (
                                <span
                                  className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-dashed border-muted-foreground/50 px-0.5 text-[10px] font-semibold text-muted-foreground"
                                  title="Location based on village name"
                                >
                                  ~
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 text-2xs text-muted-foreground">
                              {vCount} visits · {sCount} sales · {dist} km
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-2xs text-muted-foreground">
                              <Phone className="h-2.5 w-2.5 shrink-0" />
                              {farmer.mobile}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {credit > 0 && (
                              <span className="text-2xs font-medium text-destructive">
                                {formatINR(credit)}
                              </span>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </Link>
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-2xs font-medium text-success hover:underline"
                          onClick={(e) => !waDigits && e.preventDefault()}
                        >
                          WhatsApp
                        </a>
                      </div>
                    );
                  })
                )}
              </div>
              {routeMode && selectedFarmerIds.size >= 2 && googleMapsRouteUrl && (
                <div className="border-t border-border px-3 py-2">
                  <Button variant="default" size="sm" className="h-auto w-full gap-2 py-2" asChild>
                    <a
                      href={googleMapsRouteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      <Route className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex flex-col items-start text-left leading-tight">
                        <span className="text-xs font-medium">Generate Route</span>
                        <span className="text-2xs font-normal opacity-90">Open in Google Maps</span>
                      </span>
                    </a>
                  </Button>
                </div>
              )}
            </Card>

            {/* Sales + Credit summary */}
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-semibold">Range Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted/50 p-2.5">
                  <p className="text-2xs text-muted-foreground">Total Sales</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatINR(rangeStats.totalSales)}</p>
                  <p className="text-2xs text-muted-foreground">{rangeStats.saleCount} orders</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2.5">
                  <p className="text-2xs text-muted-foreground">Pending Credit</p>
                  <p className={cn('mt-0.5 text-sm font-semibold tabular-nums', rangeStats.totalCredit > 0 ? 'text-destructive' : 'text-success')}>
                    {formatINR(rangeStats.totalCredit)}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    {farmersInRange.filter((f) => (creditMap.get(f.id) ?? 0) > 0).length} farmers
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-2.5">
                  <p className="text-2xs text-muted-foreground">Avg / farmer</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatINR(rangeStats.avgSalesPerFarmer)}</p>
                  <p className="text-2xs text-muted-foreground">in-range revenue</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2.5">
                  <p className="text-2xs text-muted-foreground">Visit coverage</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">
                    {rangeStats.visitCoveragePct.toFixed(0)}%
                  </p>
                  <p className="text-2xs text-muted-foreground">visited at least once</p>
                </div>
              </div>
            </Card>

            {/* Crop Disease Alerts */}
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <Newspaper className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs font-semibold">Crop Alerts — {dealer?.district || 'Your Region'}</span>
              </div>
              <div className="divide-y divide-border/50">
                {alertsLoading ? (
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                ) : cropAlerts.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No alerts found. Add SERPER_API_KEY to enable.
                  </p>
                ) : (
                  cropAlerts.map((alert, idx) => (
                    <a
                      key={idx}
                      href={alert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-3 py-2.5 hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-xs font-medium leading-snug">{alert.title}</p>
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">{alert.snippet}</p>
                    </a>
                  ))
                )}
              </div>
            </Card>

            {/* GPS coverage */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Navigation className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">Location on map</p>
                    <p className="text-2xs text-muted-foreground">
                      {exactCount} exact GPS · {approxCount} village geocode · {noLocationCount} not on map (of{' '}
                      {farmers.length})
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{
                        width: farmers.length > 0 ? `${locationCoveragePct}%` : '0%',
                      }}
                    />
                  </div>
                  <Link
                    href="/farmers"
                    className="inline-flex text-2xs font-medium text-primary hover:underline"
                  >
                    Manage farmers → add GPS for exact pins
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
