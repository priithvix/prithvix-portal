import type { Farmer } from '@/constants/types';

/** Farmer with map coordinates (GPS or geocoded). */
export type ResolvedFarmer = Farmer & {
  resolvedLat: number;
  resolvedLng: number;
  isApproximate: boolean;
};

/**
 * Haversine formula — returns distance in kilometres between two lat/lng points.
 */
export function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Returns all farmers within `radiusKm` of the given centre point.
 * Only considers farmers that have valid lat/lng.
 */
export function farmersInRadius(
  farmers: Farmer[],
  centerLat: number,
  centerLng: number,
  radiusKm: number
): Farmer[] {
  return farmers.filter((f) => {
    if (!f.latitude || !f.longitude) return false;
    return getDistanceKm(centerLat, centerLng, f.latitude, f.longitude) <= radiusKm;
  });
}

/**
 * Farmers within radius using pre-resolved coordinates (GPS or geocoded).
 */
export function farmersInRadiusResolved(
  resolved: ResolvedFarmer[],
  centerLat: number,
  centerLng: number,
  radiusKm: number
): ResolvedFarmer[] {
  return resolved.filter(
    (f) => getDistanceKm(centerLat, centerLng, f.resolvedLat, f.resolvedLng) <= radiusKm
  );
}

/**
 * Generates a GeoJSON Polygon approximating a circle.
 * Used to draw the radius overlay on MapTiler.
 */
export function circleGeoJSON(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  points = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    // Convert km offsets to degrees (approximate)
    const latOffset = (radiusKm / 111.32) * Math.cos(angle);
    const lngOffset =
      (radiusKm / (111.32 * Math.cos((centerLat * Math.PI) / 180))) * Math.sin(angle);
    coords.push([centerLng + lngOffset, centerLat + latOffset]);
  }
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    properties: {},
  };
}
