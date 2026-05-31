'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  format,
  parseISO,
  isBefore,
  startOfDay,
} from 'date-fns';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { useSales } from '@/contexts/SalesContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatINR } from '@/lib/format';
import { listEnrollmentsForFarmer } from '@/lib/supabase/schemes';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LoyaltyTier, Sale, Visit } from '@/constants/types';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  Leaf,
  CreditCard,
  ChevronRight,
  Edit2,
  TrendingUp,
  IndianRupee,
  Clock,
  MessageCircle,
  Plus,
} from 'lucide-react';

const TIER_TEXT: Record<LoyaltyTier, string> = {
  bronze: '#8D6E63',
  silver: '#546E7A',
  gold: '#F57F17',
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function StatusBadge({ status, t }: { status: Sale['status']; t: (key: string) => string }) {
  if (status === 'paid') {
    return (
      <Badge variant="secondary" className="bg-primary/10 text-primary">
        {t('sales.statusPaid')}
      </Badge>
    );
  }
  if (status === 'partial') {
    return (
      <Badge variant="secondary" className="bg-warning/10 text-warning">
        {t('sales.statusPartial')}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-destructive/10 text-destructive">
      {t('sales.statusPending')}
    </Badge>
  );
}

export default function FarmerDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const farmerId = resolvedParams.id;
  const router = useRouter();
  const { t } = useLanguage();
  const { farmers, visits, isLoading } = useData();
  const {
    getSalesForFarmer,
    getFarmerMetrics,
    recordPayment,
    isRecordingPayment,
  } = useSales();

  const [visitSlice, setVisitSlice] = useState(5);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<'cash' | 'upi'>('cash');
  const [farmerSchemes, setFarmerSchemes] = useState<
    Awaited<ReturnType<typeof listEnrollmentsForFarmer>>
  >([]);
  const [farmerSchemesLoading, setFarmerSchemesLoading] = useState(true);

  const farmer = farmers.find((f) => f.id === farmerId);

  const farmerVisits = useMemo(() => {
    return visits
      .filter((v) => v.farmerId === farmerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [visits, farmerId]);

  const farmerSales = useMemo(() => getSalesForFarmer(farmerId), [getSalesForFarmer, farmerId]);

  const metrics = useMemo(
    () => getFarmerMetrics(farmerId, farmerVisits.length),
    [getFarmerMetrics, farmerId, farmerVisits.length]
  );

  const oldestUnpaidSale = useMemo(() => {
    const unpaid = farmerSales
      .filter((s) => s.status !== 'paid')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return unpaid[0] ?? null;
  }, [farmerSales]);

  const nextFollowUpVisit = useMemo(() => {
    const t = startOfDay(new Date());
    const future = farmerVisits
      .filter((v) => v.followUpDate)
      .map((v) => ({ v, d: startOfDay(parseISO(v.followUpDate!)) }))
      .filter(({ d }) => !isBefore(d, t))
      .sort((a, b) => a.d.getTime() - b.d.getTime());
    return future[0]?.v ?? null;
  }, [farmerVisits]);

  const visitRowsVisible = farmerVisits.slice(0, visitSlice);

  const logVisitHref = `/log-visit?farmerId=${encodeURIComponent(farmerId)}`;

  const handleRecordPayment = async () => {
    if (!oldestUnpaidSale || !farmer) return;
    const raw = parseFloat(payAmount);
    if (!Number.isFinite(raw) || raw <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const cap = Math.min(raw, oldestUnpaidSale.balanceDue, metrics.outstandingCredit);
    if (cap <= 0) {
      toast.error('Nothing to pay on the oldest open bill');
      return;
    }
    try {
      await recordPayment({
        saleId: oldestUnpaidSale.id,
        farmerId: farmer.id,
        amount: cap,
        paymentMode: payMode,
      });
      toast.success('Payment recorded');
      setPayAmount('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed');
    }
  };

  useEffect(() => {
    let cancelled = false;
    setFarmerSchemesLoading(true);
    listEnrollmentsForFarmer(farmerId)
      .then((rows) => {
        if (!cancelled) setFarmerSchemes(rows);
      })
      .catch(() => {
        if (!cancelled) setFarmerSchemes([]);
      })
      .finally(() => {
        if (!cancelled) setFarmerSchemesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [farmerId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="min-w-0 flex-1 space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="w-full shrink-0 space-y-4 lg:w-80">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="p-4 lg:p-6">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-semibold text-foreground">{t('farmers.notFound')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('farmers.notFoundDesc')}
            </p>
            <Button className="mt-6" onClick={() => router.push('/farmers')}>
              {t('farmers.backToFarmers')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const mapsHref =
    typeof farmer.latitude === 'number' && typeof farmer.longitude === 'number'
      ? `https://www.google.com/maps?q=${farmer.latitude},${farmer.longitude}`
      : null;

  const aadhaarMask =
    farmer.aadhaar && farmer.aadhaar.length >= 4
      ? `••••••••${farmer.aadhaar.slice(-4)}`
      : farmer.aadhaar;

  const lastVisit = farmerVisits[0] ?? null;

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Back + breadcrumb */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('common.back')} onClick={() => router.push('/farmers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link href="/farmers" className="hover:text-foreground">
              {t('farmers.title')}
            </Link>
            <ChevronRight className="h-4 w-4" aria-hidden />
            <span className="truncate font-medium text-foreground">{farmer.fullName}</span>
          </nav>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* LEFT COLUMN */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* Section 1: Profile header */}
            <Card className="p-4 lg:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">{farmer.fullName}</h1>
                  <p className="mt-1 text-xs text-muted-foreground">ID: {farmer.id}</p>
                  <div className="mt-2">
                    <span
                      className="inline-flex rounded-md border border-border px-2 py-0.5 text-xs font-semibold"
                      style={{ color: TIER_TEXT[metrics.loyaltyTier] }}
                    >
                      {metrics.loyaltyTier.charAt(0).toUpperCase() + metrics.loyaltyTier.slice(1)}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                      {t('farmers.visitsCountBadge').replace('{n}', String(farmerVisits.length))}
                    </span>
                    <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                      {t('farmers.lifetimePurchase').replace('{amount}', formatINR(metrics.lifetimePurchase))}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">{t('farmers.cropCycles')}:</span>
                    {farmer.cropCycle.map((c) => (
                      <Badge key={c} variant="outline" className="capitalize">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Link href={`/farmers/${farmer.id}/edit`}>
                  <Button variant="outline" size="sm" className="gap-2 shrink-0">
                    <Edit2 className="h-4 w-4" />
                    {t('common.edit')}
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Section 2: Information grid */}
            <Card className="p-4 lg:p-6">
              <h2 className="mb-4 text-sm font-semibold text-foreground">{t('farmers.basicInfo')}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('farmers.mobile')}</p>
                    <a href={`tel:${farmer.mobile}`} className="text-sm font-medium text-primary">
                      {farmer.mobile}
                    </a>
                  </div>
                </div>
                <div className="flex gap-3 sm:col-span-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('farmers.location')}</p>
                    <p className="text-sm text-foreground">
                      {[farmer.village, farmer.taluka, farmer.district].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('farmers.registeredLabel')}</p>
                    <p className="text-sm text-foreground">
                      {format(new Date(farmer.createdAt), 'd MMM yyyy')}
                    </p>
                  </div>
                </div>
                {farmer.aadhaar && (
                  <div className="flex gap-3">
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('farmers.aadhaarField')}</p>
                      <p className="text-sm text-foreground">{aadhaarMask}</p>
                    </div>
                  </div>
                )}
                {mapsHref && (
                  <div className="flex gap-3 sm:col-span-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('farmers.gps')}</p>
                      <p className="text-sm tabular-nums text-foreground">
                        {farmer.latitude?.toFixed(4)}, {farmer.longitude?.toFixed(4)}{' '}
                        <a
                          href={mapsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {t('farmers.openInMaps')}
                        </a>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Tabs defaultValue="activity" className="w-full">
              <TabsList className="mb-4 w-full justify-start sm:w-auto">
                <TabsTrigger value="activity">{t('farmers.tabActivity')}</TabsTrigger>
                <TabsTrigger value="schemes">{t('farmers.tabSchemes')}</TabsTrigger>
              </TabsList>
              <TabsContent value="activity" className="mt-0 space-y-6 focus-visible:outline-none">
                {/* Visit history */}
                <Card className="p-4 lg:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-foreground">
                      {t('farmers.visitHistory')} ({farmerVisits.length})
                    </h2>
                    <Button asChild size="sm" className="gap-1">
                      <Link href={logVisitHref}>
                        <Plus className="h-3.5 w-3.5" />
                        {t('farmers.logVisit')}
                      </Link>
                    </Button>
                  </div>
                  {farmerVisits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('farmers.noVisitsYet')}</p>
                  ) : (
                    <>
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {visitRowsVisible.map((visit) => (
                          <VisitRow key={visit.id} visit={visit} t={t} />
                        ))}
                      </div>
                      {farmerVisits.length > visitSlice && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="mt-3 w-full text-sm"
                          onClick={() => setVisitSlice(farmerVisits.length)}
                        >
                          {t('farmers.loadMore')}
                        </Button>
                      )}
                    </>
                  )}
                </Card>

                {/* Sales */}
                <Card className="p-4 lg:p-6">
                  <h2 className="mb-4 text-base font-semibold text-foreground">
                    {t('farmers.purchaseHistory')} (
                    {t('farmers.salesCount').replace('{n}', String(farmerSales.length))})
                  </h2>
                  {farmerSales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('farmers.noPurchases')}</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[400px] text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
                            <th className="px-3 py-2">{t('common.date')}</th>
                            <th className="px-3 py-2">{t('sales.colItems')}</th>
                            <th className="px-3 py-2 text-right">{t('common.amount')}</th>
                            <th className="px-3 py-2">{t('common.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {farmerSales.map((sale) => {
                            const first = sale.items[0];
                            const itemsLabel = first
                              ? `${first.itemName.length > 48 ? `${first.itemName.slice(0, 48)}…` : first.itemName}${
                                  sale.items.length > 1 ? ` +${sale.items.length - 1}` : ''
                                }`
                              : '—';
                            return (
                              <tr key={sale.id} className="border-b border-border last:border-0">
                                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                  {format(new Date(sale.createdAt), 'd MMM yy')}
                                </td>
                                <td className="max-w-[200px] truncate px-3 py-2 text-foreground" title={itemsLabel}>
                                  {itemsLabel}
                                </td>
                                <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                                  {formatINR(sale.finalAmount)}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-col gap-1">
                                    <StatusBadge status={sale.status} t={t} />
                                    {sale.status !== 'paid' && sale.balanceDue > 0 && (
                                      <span className="text-xs text-destructive">
                                        {t('farmers.balanceDue').replace('{amount}', formatINR(sale.balanceDue))}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="schemes" className="mt-0 focus-visible:outline-none">
                <Card className="p-4 lg:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-foreground">{t('farmers.schemesHeading')}</h2>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/schemes">{t('farmers.schemesBrowse')}</Link>
                    </Button>
                  </div>
                  {farmerSchemesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : farmerSchemes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('farmers.schemesEmpty')}</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-[360px] text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
                            <th className="px-3 py-2">{t('farmers.schemesColScheme')}</th>
                            <th className="px-3 py-2">{t('farmers.schemesColType')}</th>
                            <th className="px-3 py-2">{t('farmers.schemesColStatus')}</th>
                            <th className="px-3 py-2">{t('farmers.schemesColEnrolled')}</th>
                            <th className="px-3 py-2 text-right">{t('farmers.schemesColAction')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {farmerSchemes.map((row) => {
                            const name = row.agri_schemes?.scheme_name ?? '—';
                            const typ = row.agri_schemes?.scheme_type ?? '—';
                            const enrolled =
                              row.enrollment_date != null && row.enrollment_date !== ''
                                ? format(parseISO(row.enrollment_date), 'd MMM yyyy')
                                : '—';
                            return (
                              <tr key={row.id} className="border-b border-border last:border-0">
                                <td className="px-3 py-2 font-medium text-foreground">{name}</td>
                                <td className="px-3 py-2 text-muted-foreground">{typ}</td>
                                <td className="px-3 py-2">
                                  <Badge variant="outline" className="font-normal">
                                    {row.status}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 tabular-nums text-muted-foreground">{enrolled}</td>
                                <td className="px-3 py-2 text-right">
                                  <Button asChild variant="ghost" size="sm" className="h-8">
                                    <Link href={`/schemes/${row.scheme_id}/enroll`}>{t('farmers.schemesOpenRoster')}</Link>
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-20 lg:w-80 lg:self-start">
            <Card className="p-4 lg:p-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                {t('farmers.quickStats')}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-border bg-muted/30 p-2.5">
                  <p className="text-2xs uppercase text-muted-foreground">{t('farmers.statTotalVisits')}</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-foreground">{farmerVisits.length}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-2.5">
                  <p className="text-2xs uppercase text-muted-foreground">{t('farmers.statLifetime')}</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                    {formatINR(metrics.lifetimePurchase)}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-2.5">
                  <p className="text-2xs uppercase text-muted-foreground">{t('farmers.statOutstanding')}</p>
                  <p
                    className={cn(
                      'mt-0.5 font-semibold tabular-nums',
                      metrics.outstandingCredit > 0 ? 'text-destructive' : 'text-primary'
                    )}
                  >
                    {metrics.outstandingCredit > 0 ? formatINR(metrics.outstandingCredit) : t('farmers.statClear')}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-2.5">
                  <p className="text-2xs uppercase text-muted-foreground">{t('farmers.statLastVisit')}</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">
                    {lastVisit ? format(new Date(lastVisit.createdAt), 'd MMM yyyy') : t('farmers.never')}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 lg:p-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {t('farmers.upcomingFollowUp')}
              </h3>
              {nextFollowUpVisit ? (
                <div className="space-y-2 text-sm">
                  <p className="text-lg font-semibold text-foreground">
                    {format(parseISO(nextFollowUpVisit.followUpDate!), 'EEE d MMM yyyy')}
                  </p>
                  <Badge variant="outline" className="capitalize">
                    {nextFollowUpVisit.cropStage}
                  </Badge>
                  {nextFollowUpVisit.notes?.trim() && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {nextFollowUpVisit.notes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('farmers.noFollowUpsScheduled')}</p>
              )}
            </Card>

            {metrics.outstandingCredit > 0 && oldestUnpaidSale && (
              <Card className="p-4 lg:p-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                  {t('farmers.recordPaymentHeading')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('farmers.outstandingPrefix')}{' '}
                  <span className="font-semibold text-destructive tabular-nums">
                    {formatINR(metrics.outstandingCredit)}
                  </span>
                </p>
                <p className="mt-1 text-2xs text-muted-foreground">
                  {t('farmers.appliedOldestBill').replace(
                    '{date}',
                    format(new Date(oldestUnpaidSale.createdAt), 'd MMM yy')
                  )}
                </p>
                <div className="mt-3 space-y-2">
                  <Label htmlFor="pay-amt" className="text-xs">
                    {t('farmers.paymentAmount')}
                  </Label>
                  <Input
                    id="pay-amt"
                    type="number"
                    min={1}
                    max={Math.min(oldestUnpaidSale.balanceDue, metrics.outstandingCredit)}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="tabular-nums"
                    placeholder="0"
                  />
                </div>
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('sales.paymentMode')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={payMode === 'cash' ? 'default' : 'outline'}
                      onClick={() => setPayMode('cash')}
                    >
                      {t('sales.cash')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={payMode === 'upi' ? 'default' : 'outline'}
                      onClick={() => setPayMode('upi')}
                    >
                      {t('sales.upi')}
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  className="mt-4 w-full"
                  disabled={isRecordingPayment}
                  onClick={handleRecordPayment}
                >
                  {isRecordingPayment ? t('farmers.recording') : t('udhaar.recordPayment')}
                </Button>
              </Card>
            )}

            <Card className="p-4 lg:p-6">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{t('farmers.quickActions')}</h3>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm" className="justify-start gap-2">
                  <Link href={logVisitHref}>
                    <Leaf className="h-4 w-4" />
                    {t('farmers.logVisit')}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start gap-2">
                  <Link href={logVisitHref}>
                    <IndianRupee className="h-4 w-4" />
                    {t('farmers.newSale')}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start gap-2">
                  <a href={`tel:${farmer.mobile}`}>
                    <Phone className="h-4 w-4" />
                    {t('farmers.call')}
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start gap-2">
                  <a href={`https://wa.me/91${farmer.mobile.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    {t('farmers.whatsappHint')}
                  </a>
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

function VisitRow({ visit, t }: { visit: Visit; t: (key: string) => string }) {
  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline" className="capitalize">
          {t(`sales.stage.${visit.cropStage}`)}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(visit.createdAt), 'd MMM yyyy')}
        </span>
      </div>
      {visit.issues.length > 0 && (
        <p className="mt-2 text-sm text-foreground">{visit.issues.map((i) => t(i)).join(', ')}</p>
      )}
      {visit.notes?.trim() && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{visit.notes}</p>
      )}
      {visit.followUpDate && (
        <p className="mt-2 text-sm text-warning">
          {t('farmers.followUpOn')} {format(parseISO(visit.followUpDate), 'd MMM yyyy')}
        </p>
      )}
      {visit.saleId && (
        <Badge variant="secondary" className="mt-2 bg-muted text-foreground">
          {t('farmers.saleAttached')}
        </Badge>
      )}
    </div>
  );
}
