'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
  parseISO,
  isSameDay,
} from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Search,
} from 'lucide-react';
import { useSales } from '@/contexts/SalesContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { CreditPayment, Farmer, PaymentMode, Sale, SaleItem } from '@/constants/types';
import { cn } from '@/lib/utils';

type DateFilter = 'today' | 'week' | 'month' | 'lastMonth' | 'all';
type StatusFilter = 'all' | Sale['status'];
type PaymentFilter = 'all' | PaymentMode;
type SortKey = 'date' | 'amount' | 'profit';

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function saleInDateRange(sale: Sale, dateFilter: DateFilter, now: Date): boolean {
  const d = parseISO(sale.createdAt);
  switch (dateFilter) {
    case 'all':
      return true;
    case 'today':
      return isSameDay(d, now);
    case 'week': {
      const ws = startOfWeek(now, { weekStartsOn: 1 });
      const we = endOfWeek(now, { weekStartsOn: 1 });
      return d >= ws && d <= we;
    }
    case 'month':
      return d >= startOfMonth(now) && d <= endOfMonth(now);
    case 'lastMonth': {
      const lm = subMonths(now, 1);
      return d >= startOfMonth(lm) && d <= endOfMonth(lm);
    }
    default:
      return true;
  }
}

function getPeriodLabel(dateFilter: DateFilter): string {
  const now = new Date();
  switch (dateFilter) {
    case 'today':
      return format(now, 'dd MMM yyyy');
    case 'week':
      return `${format(startOfWeek(now, { weekStartsOn: 1 }), 'dd MMM')} – ${format(endOfWeek(now, { weekStartsOn: 1 }), 'dd MMM yyyy')}`;
    case 'month':
      return format(now, 'MMMM yyyy');
    case 'lastMonth':
      return format(subMonths(startOfMonth(now), 1), 'MMMM yyyy');
    case 'all':
      return 'All time';
    default:
      return '';
  }
}

function farmerMap(farmers: Farmer[]): Map<string, Farmer> {
  const m = new Map<string, Farmer>();
  for (const f of farmers) m.set(f.id, f);
  return m;
}

function exportCSV(
  rows: Sale[],
  farmersById: Map<string, Farmer>,
  dateFilter: DateFilter
): void {
  const headers = [
    'Sale ID',
    'Date',
    'Farmer',
    'Mobile',
    'Payment mode',
    'Status',
    'Subtotal',
    'Discount',
    'Final amount',
    'Paid',
    'Balance',
    'Profit',
    'Items',
  ];
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const sale of rows) {
    const f = farmersById.get(sale.farmerId);
    const itemSummary = sale.items.map((i) => i.itemName).join('; ');
    lines.push(
      [
        sale.id,
        format(parseISO(sale.createdAt), "yyyy-MM-dd'T'HH:mm:ss"),
        f?.fullName ?? '',
        f?.mobile ?? '',
        sale.paymentMode,
        sale.status,
        sale.subtotal,
        sale.discountAmount,
        sale.finalAmount,
        sale.paidAmount,
        sale.balanceDue,
        sale.profitAfterDiscount,
        itemSummary,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sales-${dateFilter}-${format(new Date(), 'ddMMyyyy')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function paymentBadgeClass(mode: PaymentMode): string {
  switch (mode) {
    case 'cash':
      return 'border-success/30 bg-success/10 text-success';
    case 'upi':
      return 'border-info/30 bg-info/10 text-info';
    case 'credit':
      return 'border-warning/30 bg-warning/10 text-warning';
    default:
      return 'border-border bg-muted/50';
  }
}

function statusBadgeClass(status: Sale['status']): string {
  switch (status) {
    case 'paid':
      return 'border-primary/30 bg-primary-muted text-primary';
    case 'partial':
      return 'border-warning/35 bg-warning/10 text-warning';
    case 'pending':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-border';
  }
}

function statusBorderClass(status: Sale['status']): string {
  switch (status) {
    case 'paid':
      return 'border-l-primary';
    case 'partial':
      return 'border-l-warning';
    case 'pending':
      return 'border-l-destructive';
    default:
      return 'border-l-border';
  }
}

export default function SalesHistoryPage() {
  const { sales, salesLoading, getPaymentsForSale, discountRevenueRatio } = useSales();
  const { farmers, isLoading: farmersLoading } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDesc, setSortDesc] = useState(true);

  const farmersById = useMemo(() => farmerMap(farmers), [farmers]);

  const filteredSales = useMemo(() => {
    const now = new Date();
    const q = searchQuery.trim().toLowerCase();

    let list = sales.filter((s) => saleInDateRange(s, dateFilter, now));

    if (paymentFilter !== 'all') {
      list = list.filter((s) => s.paymentMode === paymentFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((s) => s.status === statusFilter);
    }

    if (q) {
      list = list.filter((sale) => {
        if (sale.id.toLowerCase().includes(q)) return true;
        const farmer = farmersById.get(sale.farmerId);
        if (farmer) {
          if (farmer.fullName.toLowerCase().includes(q)) return true;
          if (farmer.mobile.replace(/\s/g, '').includes(q.replace(/\s/g, ''))) return true;
        }
        return sale.items.some((it: SaleItem) => it.itemName.toLowerCase().includes(q));
      });
    }

    const dir = sortDesc ? -1 : 1;
    return [...list].sort((a, b) => {
      if (sortBy === 'date') {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return (ta - tb) * -dir;
      }
      if (sortBy === 'amount') {
        return (a.finalAmount - b.finalAmount) * -dir;
      }
      return (a.profitAfterDiscount - b.profitAfterDiscount) * -dir;
    });
  }, [
    sales,
    dateFilter,
    paymentFilter,
    statusFilter,
    searchQuery,
    farmersById,
    sortBy,
    sortDesc,
  ]);

  const metrics = useMemo(() => {
    const revenue = filteredSales.reduce((s, x) => s + x.finalAmount, 0);
    const collected = filteredSales.reduce((s, x) => s + x.paidAmount, 0);
    const outstanding = filteredSales.reduce((s, x) => s + x.balanceDue, 0);
    const profit = filteredSales.reduce((s, x) => s + x.profitAfterDiscount, 0);
    const grossRevenue = filteredSales.reduce((s, x) => s + x.subtotal, 0);
    const discountGiven = filteredSales.reduce((s, x) => s + x.discountAmount, 0);

    const cashRevenue = filteredSales.filter((x) => x.paymentMode === 'cash').reduce((s, x) => s + x.finalAmount, 0);
    const upiRevenue = filteredSales.filter((x) => x.paymentMode === 'upi').reduce((s, x) => s + x.finalAmount, 0);
    const creditRevenue = filteredSales.filter((x) => x.paymentMode === 'credit').reduce((s, x) => s + x.finalAmount, 0);

    const count = filteredSales.length;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const avgOrderValue = count > 0 ? revenue / count : 0;

    const discountRatioFiltered =
      grossRevenue > 0 ? (discountGiven / grossRevenue) * 100 : 0;
    /** Month-wide KPI from dashboard when viewing this calendar month with no extra narrowing. */
    const cohortIsBareMonth =
      dateFilter === 'month' &&
      paymentFilter === 'all' &&
      statusFilter === 'all' &&
      searchQuery.trim() === '';
    const discountRatio = cohortIsBareMonth ? discountRevenueRatio : discountRatioFiltered;

    const paidCount = filteredSales.filter((s) => s.status === 'paid').length;
    const pendingCount = filteredSales.filter((s) => s.status === 'partial' || s.status === 'pending').length;

    return {
      revenue,
      collected,
      outstanding,
      profit,
      grossRevenue,
      discountGiven,
      profitMargin,
      avgOrderValue,
      cashRevenue,
      upiRevenue,
      creditRevenue,
      discountRatio,
      paidCount,
      pendingCount,
      count,
    };
  }, [
    filteredSales,
    discountRevenueRatio,
    dateFilter,
    paymentFilter,
    statusFilter,
    searchQuery,
  ]);

  const topFarmers = useMemo(() => {
    const byFarmer = new Map<string, number>();
    for (const sale of filteredSales) {
      byFarmer.set(sale.farmerId, (byFarmer.get(sale.farmerId) ?? 0) + sale.finalAmount);
    }
    return [...byFarmer.entries()]
      .map(([farmerId, revenue]) => ({ farmerId, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
  }, [filteredSales]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, Sale[]>();

    for (const sale of filteredSales) {
      const dayKey = format(new Date(sale.createdAt), 'dd MMM yyyy');
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(sale);
    }

    for (const [, daySales] of map) {
      daySales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const entries = [...map.entries()].sort((a, b) => {
      const maxA = Math.max(...a[1].map((s) => new Date(s.createdAt).getTime()));
      const maxB = Math.max(...b[1].map((s) => new Date(s.createdAt).getTime()));
      return maxB - maxA;
    });

    return entries.map(([dayKey, sales]) => ({ dayKey, sales }));
  }, [filteredSales]);

  const handleSort = useCallback((key: SortKey) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortDesc((d) => !d);
        return prev;
      }
      setSortDesc(true);
      return key;
    });
  }, []);

  const txnCount = filteredSales.length;
  const periodLabel = getPeriodLabel(dateFilter);

  const layoutLoading = salesLoading || farmersLoading;

  const totalMix = metrics.cashRevenue + metrics.upiRevenue + metrics.creditRevenue;
  const cashPct = totalMix > 0 ? (metrics.cashRevenue / totalMix) * 100 : 0;
  const upiPct = totalMix > 0 ? (metrics.upiRevenue / totalMix) * 100 : 0;
  const creditPct = totalMix > 0 ? (metrics.creditRevenue / totalMix) * 100 : 0;

  const dateChip = (label: string, value: DateFilter) => (
    <Button
      key={value}
      type="button"
      variant={dateFilter === value ? 'default' : 'outline'}
      size="sm"
      className={cn(
        'rounded-full',
        dateFilter === value &&
          'shadow-[0_0_0_1px_hsl(var(--primary-strong)/0.35)] ring-2 ring-ring/35'
      )}
      onClick={() => setDateFilter(value)}
    >
      {label}
    </Button>
  );

  const paymentChip = (label: string, value: PaymentFilter) => (
    <Button
      key={String(value)}
      type="button"
      variant={paymentFilter === value ? 'default' : 'outline'}
      size="sm"
      className={cn(
        'rounded-full',
        paymentFilter === value &&
          'shadow-[0_0_0_1px_hsl(var(--primary-strong)/0.35)] ring-2 ring-ring/35'
      )}
      onClick={() => setPaymentFilter(value)}
    >
      {label}
    </Button>
  );

  const statusChip = (label: string, value: StatusFilter) => (
    <Button
      key={value}
      type="button"
      variant={statusFilter === value ? 'default' : 'outline'}
      size="sm"
      className={cn(
        'rounded-full',
        statusFilter === value &&
          'shadow-[0_0_0_1px_hsl(var(--primary-strong)/0.35)] ring-2 ring-ring/35'
      )}
      onClick={() => setStatusFilter(value)}
    >
      {label}
    </Button>
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header + export */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Sales History
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {txnCount.toLocaleString('en-IN')} transactions · {periodLabel}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="default"
          className="shrink-0 gap-2"
          onClick={() => exportCSV(filteredSales, farmersById, dateFilter)}
          disabled={filteredSales.length === 0 || layoutLoading}
        >
          <Download className="h-4 w-4" aria-hidden />
          Export CSV
        </Button>
      </div>

      {layoutLoading ? (
        <section className="space-y-4" aria-busy="true">
          <Card className="border-border bg-card p-4">
            <Skeleton className="h-36 w-full rounded-lg" />
          </Card>
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </section>
      ) : (
        <>
          {/* KPI */}
          <Card className="border-border bg-card">
            <div className="p-4 lg:p-5">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Revenue</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    ₹{metrics.revenue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">Final billed (GST incl.)</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Collected</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    ₹{metrics.collected.toLocaleString('en-IN')}
                  </p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">Cash + UPI + credits received</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-warning">
                    ₹{metrics.outstanding.toLocaleString('en-IN')}
                  </p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">Balance due on filtered sales</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Profit</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-primary">
                    ₹{metrics.profit.toLocaleString('en-IN')}
                  </p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    Margin {metrics.profitMargin.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-border pt-5">
                <p className="text-xs font-medium text-muted-foreground">Payment mix (by final amount)</p>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  {metrics.cashRevenue > 0 && (
                    <div
                      className="bg-success/70 h-full transition-all"
                      style={{ width: `${cashPct}%` }}
                      title={`Cash ${cashPct.toFixed(0)}%`}
                    />
                  )}
                  {metrics.upiRevenue > 0 && (
                    <div
                      className="bg-primary/70 h-full transition-all"
                      style={{ width: `${upiPct}%` }}
                      title={`UPI ${upiPct.toFixed(0)}%`}
                    />
                  )}
                  {metrics.creditRevenue > 0 && (
                    <div
                      className="bg-warning/70 h-full transition-all"
                      style={{ width: `${creditPct}%` }}
                      title={`Credit ${creditPct.toFixed(0)}%`}
                    />
                  )}
                </div>

                <ul className="grid gap-2 text-xs sm:grid-cols-3">
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                    Cash{' '}
                    <span className="font-medium text-foreground">
                      ₹{metrics.cashRevenue.toLocaleString('en-IN')}
                    </span>
                    <span className="text-muted-foreground">({cashPct.toFixed(0)}%)</span>
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                    UPI{' '}
                    <span className="font-medium text-foreground">
                      ₹{metrics.upiRevenue.toLocaleString('en-IN')}
                    </span>
                    <span className="text-muted-foreground">({upiPct.toFixed(0)}%)</span>
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                    Credit{' '}
                    <span className="font-medium text-foreground">
                      ₹{metrics.creditRevenue.toLocaleString('en-IN')}
                    </span>
                    <span className="text-muted-foreground">({creditPct.toFixed(0)}%)</span>
                  </li>
                </ul>

                <p className="text-xs text-muted-foreground">
                  Discount ₹{metrics.discountGiven.toLocaleString('en-IN')} (
                  {metrics.discountRatio.toFixed(1)}% of gross). Avg order ₹
                  {metrics.avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-2xs text-muted-foreground">
                  Paid {metrics.paidCount} · Outstanding / partial {metrics.pendingCount} · Total{' '}
                  {metrics.count}
                </p>
              </div>
            </div>
          </Card>

          {/* Filters */}
          <div className="space-y-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sale ID, farmer, mobile, item name…"
                className="h-10 pl-10"
                aria-label="Search sales"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Period
              </span>
              {dateChip('Today', 'today')}
              {dateChip('Week', 'week')}
              {dateChip('Month', 'month')}
              {dateChip('Last month', 'lastMonth')}
              {dateChip('All', 'all')}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Payment
              </span>
              {paymentChip('All', 'all')}
              {paymentChip('Cash', 'cash')}
              {paymentChip('UPI', 'upi')}
              {paymentChip('Credit', 'credit')}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </span>
              {statusChip('All', 'all')}
              {statusChip('Paid', 'paid')}
              {statusChip('Partial', 'partial')}
              {statusChip('Pending', 'pending')}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Sort
              </span>
              {(['date', 'amount', 'profit'] as const).map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant={sortBy === key ? 'secondary' : 'outline'}
                  size="sm"
                  className="gap-1 capitalize"
                  onClick={() => handleSort(key)}
                >
                  {key === 'date' ? 'Date' : key === 'amount' ? 'Amount' : 'Profit'}
                  {sortBy === key &&
                    (sortDesc ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />)}
                </Button>
              ))}
            </div>
          </div>

          {filteredSales.length === 0 ? (
            <Card className="border-border border-dashed bg-card">
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground" aria-hidden />
                <p className="text-base font-medium text-foreground">No sales match your filters</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Try clearing search, widening the period, or changing payment/status filters — or confirm new sales exist for this dealer.
                </p>
              </div>
            </Card>
          ) : (
            <div className="xl:grid xl:grid-cols-[1fr_280px] xl:gap-8 xl:items-start">
              <div className="space-y-8">
                {groupedByDay.map(({ dayKey, sales: daySales }) => {
                  const dayTotal = daySales.reduce((s, x) => s + x.finalAmount, 0);
                  return (
                    <section key={dayKey}>
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-sm font-semibold text-foreground">{dayKey}</h2>
                        <p className="text-xs text-muted-foreground">
                          {daySales.length} bill{daySales.length === 1 ? '' : 's'} · Day total ₹
                          {dayTotal.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {daySales.map((sale) => (
                          <SaleRowCard
                            key={sale.id}
                            sale={sale}
                            farmer={farmersById.get(sale.farmerId)}
                            farmersLoading={farmersLoading}
                            expanded={expandedSaleId === sale.id}
                            onToggle={() =>
                              setExpandedSaleId((id) => (id === sale.id ? null : sale.id))
                            }
                            payments={getPaymentsForSale(sale.id)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              {/* Top farmers */}
              <aside className="mt-8 xl:mt-0">
                <Card className="border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">Top farmers (by revenue)</p>
                  <p className="mt-1 text-xs text-muted-foreground">From your current filters</p>
                  <ol className="mt-4 space-y-3">
                    {topFarmers.map(({ farmerId, revenue }, idx) => {
                      const farmer = farmersById.get(farmerId);
                      const label = farmer?.fullName ?? (farmersLoading ? '…' : 'Unknown farmer');
                      return (
                        <li key={farmerId} className="flex items-start justify-between gap-2 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="tabular-nums text-muted-foreground">{idx + 1}.</span>
                            <Link
                              href={`/farmers/${farmerId}`}
                              className="truncate font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {label}
                            </Link>
                          </span>
                          <span className="shrink-0 tabular-nums text-foreground">
                            ₹{revenue.toLocaleString('en-IN')}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  {topFarmers.length === 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">No farmer revenue in selection.</p>
                  )}
                </Card>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SaleRowCard(props: {
  sale: Sale;
  farmer?: Farmer;
  farmersLoading: boolean;
  expanded: boolean;
  onToggle: () => void;
  payments: CreditPayment[];
}) {
  const { sale, farmer, farmersLoading, expanded, onToggle, payments } = props;

  return (
    <Card
      className={cn(
        'overflow-hidden border border-border bg-card transition-shadow hover:shadow-md',
        'border-l-4 border-t border-r border-b',
        statusBorderClass(sale.status)
      )}
    >
      <button
        type="button"
        className={cn(
          'flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-start sm:justify-between',
          sale.status === 'pending' ? 'rounded-r-md' : ''
        )}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="mt-1 shrink-0 text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">#{sale.id}</span>
              <Badge variant="outline" className={cn('text-[0.6875rem] font-semibold uppercase', paymentBadgeClass(sale.paymentMode))}>
                {sale.paymentMode}
              </Badge>
              <Badge variant="outline" className={cn('text-[0.6875rem] font-semibold capitalize', statusBadgeClass(sale.status))}>
                {sale.status}
              </Badge>
            </div>
            <p className="mt-1 truncate font-semibold text-foreground">
              {farmersLoading && !farmer ? 'Loading…' : farmer?.fullName ?? 'Unknown farmer'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {farmersLoading && !farmer ? '' : farmer?.mobile ?? ''} · {sale.items.length} item
              {sale.items.length === 1 ? '' : 's'}{' '}
              ·{' '}
              {format(new Date(sale.createdAt), 'hh:mm a')}
            </p>
          </div>
        </div>
        <div className="shrink-0 pl-8 text-right sm:pl-0">
          <p className="text-lg font-semibold tabular-nums text-foreground">
            ₹{sale.finalAmount.toLocaleString('en-IN')}
          </p>
          {sale.balanceDue > 0 && (
            <p className="text-xs font-medium text-destructive">Due ₹{sale.balanceDue.toLocaleString('en-IN')}</p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border bg-muted/20 px-4 py-4 sm:px-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Rate</th>
                  <th className="py-2 text-right font-medium">GST</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.itemId} className="border-b border-border/60">
                    <td className="py-2 pr-4 text-foreground">{item.itemName}</td>
                    <td className="py-2 text-muted-foreground">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2 text-right tabular-nums">{item.priceIncGstPerUnit.toFixed(2)}</td>
                    <td className="py-2 text-right">{item.gstPercent}%</td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      ₹{item.totalAmount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 text-xs sm:flex sm:flex-wrap sm:justify-end sm:gap-x-6">
            <p className="text-muted-foreground">
              Subtotal <span className="font-medium text-foreground">₹{sale.subtotal.toLocaleString('en-IN')}</span>
            </p>
            <p className="text-muted-foreground">
              Discount{' '}
              <span className="font-medium text-warning">−₹{sale.discountAmount.toLocaleString('en-IN')}</span>
            </p>
            <p className="text-muted-foreground">
              Final{' '}
              <span className="font-semibold text-foreground">₹{sale.finalAmount.toLocaleString('en-IN')}</span>
            </p>
            <p className="text-muted-foreground">
              Profit{' '}
              <span className="font-medium text-primary">₹{sale.profitAfterDiscount.toLocaleString('en-IN')}</span>
            </p>
          </div>

          {payments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground">Payments recorded</p>
              <ul className="mt-2 space-y-2 text-xs">
                {payments
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <span className="text-muted-foreground">{format(parseISO(p.createdAt), 'dd MMM yyyy, hh:mm a')}</span>
                      <span className="tabular-nums text-foreground">₹{p.amount.toLocaleString('en-IN')}</span>
                      <Badge
                        variant="outline"
                        className={cn('uppercase', paymentBadgeClass(p.paymentMode))}
                      >
                        {p.paymentMode}
                      </Badge>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/invoice?saleId=${encodeURIComponent(sale.id)}`}>View Invoice</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/farmers/${sale.farmerId}`}>View Farmer</Link>
            </Button>
            {sale.balanceDue > 0 && (
              <Button asChild size="sm" variant="default">
                <Link href="/udhaar">Record Payment</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
