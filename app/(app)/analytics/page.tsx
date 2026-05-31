'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSales, LOYALTY_TIER_CONFIG, getLoyaltyTier } from '@/contexts/SalesContext';
import { useData } from '@/contexts/DataContext';
import { useInventory } from '@/contexts/InventoryContext';
import type { CropCycle, InventoryItem, ItemCategory, Sale, SaleItem } from '@/constants/types';
import { formatINR, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--card-foreground))',
};

const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };

type TabId = 'overview' | 'sales' | 'inventory' | 'farmers' | 'predictions';
type TrendWindow = 7 | 30 | 90;

function startOfWeekSunday(d: Date): Date {
  const x = startOfDay(new Date(d));
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function saleInRange(s: Sale, start: Date, end: Date): boolean {
  const t = new Date(s.createdAt).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function resolveItemCategory(item: SaleItem, activeItems: InventoryItem[]): ItemCategory | 'unknown' {
  if (item.itemId) {
    const bySku = activeItems.find((i) => i.id === item.itemId);
    if (bySku) return bySku.category;
  }
  if (item.productId) {
    const byProduct = activeItems.find((i) => i.productId === item.productId);
    if (byProduct) return byProduct.category;
  }
  const byName = activeItems.find(
    (i) => i.productName === item.itemName || i.name === item.itemName || i.displayLabel === item.itemName
  );
  return byName?.category ?? 'unknown';
}

function linearRegressionSlopeIntercept(ys: number[]): { slope: number; intercept: number } {
  const m = ys.length;
  if (m === 0) return { slope: 0, intercept: 0 };
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < m; i++) {
    sumX += i;
    sumY += ys[i];
    sumXY += i * ys[i];
    sumX2 += i * i;
  }
  const denom = m * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (m * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / m;
  return { slope, intercept };
}

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const {
    sales,
    salesLoading,
    thisMonthSales,
    getCreditFarmers,
    monthSalesTotal,
    monthCollected,
    monthProfit,
    totalCreditOutstanding,
  } = useSales();
  const { farmers, visits, isLoading: dataLoading } = useData();
  const { activeItems, lowStockItems, isLoading: inventoryLoading } = useInventory();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [trendWindow, setTrendWindow] = useState<TrendWindow>(30);

  const isBusy = salesLoading || dataLoading || inventoryLoading;

  const dailyRevenue = useMemo(() => {
    const n = trendWindow;
    const today = startOfDay(new Date());
    const rows: {
      date: string;
      label: string;
      revenue: number;
      profit: number;
      transactions: number;
    }[] = [];

    for (let i = n - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const lo = startOfDay(d);
      const hi = endOfDay(d);
      const daySales = sales.filter((s) => saleInRange(s, lo, hi));
      const revenue = daySales.reduce((sum, s) => sum + s.finalAmount, 0);
      const profit = daySales.reduce((sum, s) => sum + s.profitAfterDiscount, 0);
      const transactions = daySales.length;

      let label: string;
      if (trendWindow === 7) {
        label = format(d, 'EEE');
      } else if (trendWindow === 30) {
        label = format(d, 'd MMM');
      } else {
        label = format(d, 'd MMM');
      }

      rows.push({
        date: format(d, 'yyyy-MM-dd'),
        label,
        revenue,
        profit,
        transactions,
      });
    }
    return rows;
  }, [sales, trendWindow]);

  const predictions = useMemo(() => {
    const n = 30;
    const today = startOfDay(new Date());
    const ys: number[] = [];

    for (let i = n - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const lo = startOfDay(d);
      const hi = endOfDay(d);
      const rev = sales.filter((s) => saleInRange(s, lo, hi)).reduce((sum, s) => sum + s.finalAmount, 0);
      ys.push(rev);
    }

    const { slope, intercept } = linearRegressionSlopeIntercept(ys);

    const next7: { date: string; label: string; predicted: number }[] = [];
    for (let j = 1; j <= 7; j++) {
      const future = addDays(today, j);
      const x = n - 1 + j;
      const predicted = Math.max(0, intercept + slope * x);
      next7.push({
        date: format(future, 'yyyy-MM-dd'),
        label: format(future, 'd MMM'),
        predicted,
      });
    }

    const byDow: { sum: number; count: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
    for (let i = 0; i < n; i++) {
      const d = subDays(today, n - 1 - i);
      const dow = d.getDay();
      byDow[dow].sum += ys[i];
      byDow[dow].count += 1;
    }
    const dayAvgs = byDow.map((b, dow) => ({
      dow,
      name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow],
      avg: b.count ? b.sum / b.count : 0,
    }));
    let bestDay = 0;
    for (let d = 1; d < 7; d++) {
      if (dayAvgs[d].avg > dayAvgs[bestDay].avg) bestDay = d;
    }

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = subMonths(thisMonthStart, 1);

    const thisMonthTotal = sales
      .filter((s) => new Date(s.createdAt) >= thisMonthStart)
      .reduce((sum, s) => sum + s.finalAmount, 0);
    const lastMonthTotal = sales
      .filter((s) => {
        const t = new Date(s.createdAt);
        return t >= lastMonthStart && t < thisMonthStart;
      })
      .reduce((sum, s) => sum + s.finalAmount, 0);

    const eom = endOfMonth(now);
    const remainingDays = Math.max(0, eom.getDate() - now.getDate());
    let projectedRest = 0;
    for (let day = 1; day <= remainingDays; day++) {
      const x = n - 1 + day;
      projectedRest += Math.max(0, intercept + slope * x);
    }
    const projectedMonthTotal = thisMonthTotal + projectedRest;

    return {
      next7,
      trendSlope: slope,
      projectedMonthTotal,
      bestDay,
      dayAvgs,
      monthTotals: { thisMonth: thisMonthTotal, lastMonth: lastMonthTotal },
    };
  }, [sales]);

  const productAnalytics = useMemo(() => {
    type Row = {
      key: string;
      displayName: string;
      revenue: number;
      qty: number;
      category: ItemCategory | 'unknown';
    };
    const productMap: Record<string, Row> = {};

    for (const sale of sales) {
      for (const item of sale.items) {
        const key = (item.itemId && String(item.itemId).trim()) || (item.itemName && item.itemName.trim()) || '__anon';
        const cat = resolveItemCategory(item, activeItems);
        if (!productMap[key]) {
          productMap[key] = {
            key,
            displayName: item.itemName || key,
            revenue: 0,
            qty: 0,
            category: cat,
          };
        }
        productMap[key].revenue += item.lineTotalIncGst;
        productMap[key].qty += item.quantity;
        productMap[key].category = cat;
      }
    }

    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 12);

    const categoryTotals: Record<string, number> = {};
    for (const p of Object.values(productMap)) {
      const c = p.category;
      categoryTotals[c] = (categoryTotals[c] ?? 0) + p.revenue;
    }
    const categoryPie = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

    const thirtyAgo = subDays(startOfDay(new Date()), 30);
    const recentTop = Object.values(productMap)
      .map((p) => ({ ...p, recentRevenue: 0 }))
      .map((p) => {
        let r = 0;
        for (const sale of sales) {
          if (new Date(sale.createdAt) < thirtyAgo) continue;
          for (const item of sale.items) {
            const k = (item.itemId && String(item.itemId).trim()) || (item.itemName && item.itemName.trim()) || '__anon';
            if (k === p.key) r += item.lineTotalIncGst;
          }
        }
        return { ...p, recentRevenue: r };
      })
      .sort((a, b) => b.recentRevenue - a.recentRevenue)
      .slice(0, 8);

    return { productMap, topProducts, categoryPie, recentTop };
  }, [sales, activeItems]);

  const visitsByFarmer = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of visits) {
      m[v.farmerId] = (m[v.farmerId] ?? 0) + 1;
    }
    return m;
  }, [visits]);

  const farmerAnalytics = useMemo(() => {
    const revenueByFarmer: Record<string, number> = {};
    for (const s of sales) {
      revenueByFarmer[s.farmerId] = (revenueByFarmer[s.farmerId] ?? 0) + s.finalAmount;
    }

    const topFarmers = Object.entries(revenueByFarmer)
      .map(([farmerId, revenue]) => ({ farmerId, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);

    const lastVisit: Record<string, string | null> = {};
    for (const f of farmers) lastVisit[f.id] = null;
    for (const v of visits) {
      const cur = lastVisit[v.farmerId];
      if (!cur || new Date(v.createdAt) > new Date(cur)) lastVisit[v.farmerId] = v.createdAt;
    }

    const now = new Date();
    const churnRisk = farmers.filter((f) => {
      const lv = lastVisit[f.id];
      if (!lv) return true;
      const days = Math.floor((now.getTime() - new Date(lv).getTime()) / (86_400_000));
      return days >= 45;
    });

    const weeklyVisits: { label: string; visits: number; weekStart: string }[] = [];
    const thisWeekStart = startOfWeekSunday(now);
    for (let w = 11; w >= 0; w--) {
      const ws = subDays(thisWeekStart, w * 7);
      const we = endOfDay(addDays(ws, 6));
      const c = visits.filter((v) => {
        const t = new Date(v.createdAt).getTime();
        return t >= ws.getTime() && t <= we.getTime();
      }).length;
      weeklyVisits.push({
        label: w === 0 ? 'This wk' : format(ws, 'd MMM'),
        visits: c,
        weekStart: format(ws, 'yyyy-MM-dd'),
      });
    }

    const cropCycleData: { cycle: CropCycle | 'none'; count: number }[] = (
      ['kharif', 'rabi', 'summer'] as const
    ).map((cycle) => ({
      cycle,
      count: farmers.filter((f) => (f.cropCycle ?? []).includes(cycle)).length,
    }));
    const noneCount = farmers.filter((f) => !f.cropCycle?.length).length;
    cropCycleData.push({ cycle: 'none', count: noneCount });

    return {
      topFarmers,
      weeklyVisits,
      churnRisk,
      cropCycleData,
      lastVisit,
      revenueByFarmer,
    };
  }, [sales, farmers, visits]);

  const skuVelocity = useMemo(() => {
    const thirty = subDays(startOfDay(new Date()), 30);
    const qtyMap: Record<string, number> = {};
    for (const s of sales) {
      if (new Date(s.createdAt) < thirty) continue;
      for (const it of s.items) {
        const id = it.itemId?.trim();
        if (!id) continue;
        qtyMap[id] = (qtyMap[id] ?? 0) + it.quantity * (it.unitsPerBase || 1);
      }
    }
    return qtyMap;
  }, [sales]);

  const kpis = useMemo(() => {
    const { thisMonth, lastMonth } = predictions.monthTotals;
    const monthGrowth = lastMonth <= 0 ? null : ((thisMonth - lastMonth) / lastMonth) * 100;
    const collectionRate = monthSalesTotal <= 0 ? 0 : (monthCollected / monthSalesTotal) * 100;

    const thirtyAgo = subDays(startOfDay(new Date()), 30);
    const activeFarmerIds = new Set(
      visits.filter((v) => new Date(v.createdAt) >= thirtyAgo).map((v) => v.farmerId)
    );
    const avgTicket = thisMonthSales.length ? monthSalesTotal / thisMonthSales.length : 0;

    const churnRevenueImpact = farmerAnalytics.churnRisk.reduce((sum, f) => {
      const r = farmerAnalytics.revenueByFarmer[f.id] ?? 0;
      return r > 0 ? sum + r : sum;
    }, 0);

    return {
      monthGrowth,
      collectionRate,
      activeFarmers: activeFarmerIds.size,
      avgTicket,
      monthTxCount: thisMonthSales.length,
      churnRevenueImpact,
      mtdRevenue: thisMonth,
      prevRevenue: lastMonth,
      lowStockCount: lowStockItems.length,
    };
  }, [
    predictions.monthTotals,
    monthSalesTotal,
    monthCollected,
    thisMonthSales,
    visits,
    farmerAnalytics.churnRisk,
    farmerAnalytics.revenueByFarmer,
    lowStockItems.length,
  ]);

  const paymentMix = useMemo(() => {
    const cash = thisMonthSales.filter((s) => s.paymentMode === 'cash').length;
    const upi = thisMonthSales.filter((s) => s.paymentMode === 'upi').length;
    const credit = thisMonthSales.filter((s) => s.paymentMode === 'credit').length;
    return [
      { name: 'Cash', count: cash },
      { name: 'UPI', count: upi },
      { name: 'Credit', count: credit },
    ];
  }, [thisMonthSales]);

  const inventoryCategoryValue = useMemo(() => {
    const byCat: Partial<Record<ItemCategory | 'unknown', number>> = {};
    for (const it of activeItems) {
      const unitCost = it.lastInvoicePricePerBase ?? it.costPrice ?? 0;
      const v = it.stock * unitCost;
      const c = it.category;
      byCat[c] = (byCat[c] ?? 0) + v;
    }
    return Object.entries(byCat).map(([name, value]) => ({ name, value: value ?? 0 }));
  }, [activeItems]);

  const totalInventoryValue = useMemo(
    () =>
      activeItems.reduce(
        (s, it) => s + it.stock * (it.lastInvoicePricePerBase ?? it.costPrice ?? 0),
        0
      ),
    [activeItems]
  );

  const stockRows = useMemo(() => {
    return activeItems.map((it) => {
      const daily = skuVelocity[it.id] ? skuVelocity[it.id]! / 30 : 0;
      const daysLeft =
        daily > 0 && it.stock > 0 ? Math.floor(it.stock / daily) : daily === 0 && it.stock > 0 ? null : 0;
      const unitCost = it.lastInvoicePricePerBase ?? it.costPrice ?? 0;
      return {
        id: it.id,
        name: it.name,
        category: it.category,
        stock: it.stock,
        value: it.stock * unitCost,
        status: it.stockStatus ?? 'healthy',
        daysLeft,
      };
    });
  }, [activeItems, skuVelocity]);

  const movers = useMemo(() => {
    const scored = activeItems.map((it) => {
      const sold = skuVelocity[it.id] ?? 0;
      const rate = it.stock > 0 ? sold / it.stock : sold;
      return { it, sold, rate };
    });
    const fast = [...scored].sort((a, b) => b.rate - a.rate).slice(0, 5);
    const slow = [...scored].sort((a, b) => a.rate - b.rate).slice(0, 5);
    return { fast, slow };
  }, [activeItems, skuVelocity]);

  const combinedSalesChartData = useMemo(() => {
    const hist = dailyRevenue.map((d) => ({
      date: d.date,
      label: d.label,
      revenue: d.revenue as number | null,
      predicted: null as number | null,
    }));
    const fut = predictions.next7.map((d) => ({
      date: d.date,
      label: d.label,
      revenue: null as number | null,
      predicted: d.predicted,
    }));
    return [...hist, ...fut];
  }, [dailyRevenue, predictions.next7]);

  const creditFarmers = useMemo(() => getCreditFarmers(), [getCreditFarmers]);

  const forecast7Total = useMemo(
    () => predictions.next7.reduce((s, x) => s + x.predicted, 0),
    [predictions.next7]
  );

  const tabs: { id: TabId; label: string }[] = useMemo(
    () => [
      { id: 'overview', label: t('analytics.overview') },
      { id: 'sales', label: t('analytics.salesDeepDive') },
      { id: 'inventory', label: t('analytics.inventoryIntel') },
      { id: 'farmers', label: t('analytics.farmerIntel') },
      { id: 'predictions', label: t('analytics.predictions') },
    ],
    [t],
  );

  function GrowthArrow({ value }: { value: number | null }) {
    if (value === null)
      return (
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Minus className="size-3.5" />
          n/a
        </span>
      );
    if (value > 0.5)
      return (
        <span className="text-primary inline-flex items-center gap-1 text-xs font-medium">
          <ArrowUpRight className="size-3.5" />
          {value.toFixed(1)}%
        </span>
      );
    if (value < -0.5)
      return (
        <span className="text-destructive inline-flex items-center gap-1 text-xs font-medium">
          <ArrowDownRight className="size-3.5" />
          {Math.abs(value).toFixed(1)}%
        </span>
      );
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Minus className="size-3.5" />
        {value.toFixed(1)}%
      </span>
    );
  }

  if (isBusy) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg border border-border bg-card" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg border border-border" />
        <Skeleton className="h-72 rounded-lg border border-border" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('analytics.title')}</h1>
          <p className="mt-1 text-pretty text-muted-foreground">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Trend window">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setTrendWindow(d)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                trendWindow === d
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              {d}D
            </button>
          ))}
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Analytics sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              activeTab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">MTD revenue</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
                {formatINR(kpis.mtdRevenue)}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">vs last month</span>
                <GrowthArrow value={kpis.monthGrowth} />
              </div>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">MTD profit</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
                {formatINR(monthProfit)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">After discount &amp; cost</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Collection rate</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
                {kpis.collectionRate.toFixed(1)}%
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Paid ÷ billed (this month)</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Credit outstanding</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
                {formatINR(totalCreditOutstanding)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">All unpaid balances</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Monthly transactions</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
                {formatNumber(kpis.monthTxCount)}
              </p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Avg ticket</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
                {formatINR(Math.round(kpis.avgTicket))}
              </p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Active farmers (30d)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
                {formatNumber(kpis.activeFarmers)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Visited in last 30 days</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Stock alerts</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-card-foreground">
                {formatNumber(kpis.lowStockCount)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Low or reorder SKUs</p>
            </Card>
          </div>

          <Card className="border-border bg-card p-4 md:p-6">
            <h2 className="text-lg font-semibold text-card-foreground">Revenue &amp; profit</h2>
            <p className="text-sm text-muted-foreground">Last {trendWindow} days</p>
            <div className="mt-4 h-80 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRevenue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fillProf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} width={48} tickFormatter={(v) => formatCompactAxis(v)} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => {
                      const n = coalesceNumber(value);
                      const label = String(name) === 'revenue' ? 'Revenue' : 'Profit';
                      return [n != null ? formatINR(n) : '—', label];
                    }}
                  />
                  <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#fillRev)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    fill="url(#fillProf)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border bg-card p-4 lg:col-span-2">
              <h2 className="text-lg font-semibold text-card-foreground">Actual vs forecast</h2>
              <p className="text-sm text-muted-foreground">
                Solid: actual (₹). Dashed: 7-day linear forecast from 30d regression.
              </p>
              <div className="mt-4 h-80 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={combinedSalesChartData}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(v) => combinedSalesChartData.find((r) => r.date === v)?.label ?? v} />
                    <YAxis tick={AXIS_TICK} width={52} tickFormatter={(v) => formatCompactAxis(v)} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value, name) => {
                        const n = coalesceNumber(value);
                        const label = String(name) === 'predicted' ? 'Forecast' : 'Revenue';
                        return [n != null ? formatINR(n) : '—', label];
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Forecast"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-card-foreground">Payment mix</h2>
              <p className="text-sm text-muted-foreground">This month (count)</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentMix} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis type="number" tick={AXIS_TICK} />
                    <YAxis type="category" dataKey="name" width={52} tick={AXIS_TICK} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Bills" radius={[0, 4, 4, 0]}>
                      {paymentMix.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="border-border bg-card p-4">
            <h2 className="text-lg font-semibold text-card-foreground">Sales by weekday (30d avg)</h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={predictions.dayAvgs}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} width={44} tickFormatter={(v) => formatCompactAxis(v)} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => {
                      const n = coalesceNumber(value);
                      return n != null ? formatINR(n) : '—';
                    }}
                  />
                  <Bar dataKey="avg" name="Avg ₹" radius={[4, 4, 0, 0]}>
                    {predictions.dayAvgs.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          i === predictions.bestDay
                            ? 'hsl(var(--primary))'
                            : CHART_COLORS[i % CHART_COLORS.length]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-card-foreground">Top products (30d)</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Product</th>
                      <th className="py-2 pr-2 font-medium">Category</th>
                      <th className="py-2 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productAnalytics.recentTop.map((r) => (
                      <tr key={r.key} className="border-b border-border/80">
                        <td className="py-2 pr-2 text-card-foreground">{r.displayName}</td>
                        <td className="py-2 pr-2 capitalize text-muted-foreground">{r.category}</td>
                        <td className="py-2 text-right tabular-nums">{formatINR(r.recentRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-card-foreground">Revenue by category</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={productAnalytics.categoryPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {productAnalytics.categoryPie.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => {
                        const n = coalesceNumber(value);
                        return n != null ? formatINR(n) : '—';
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border bg-card p-4 sm:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Stock value at cost (est.)</p>
                  <p className="text-2xl font-semibold tabular-nums text-card-foreground">
                    {formatINR(Math.round(totalInventoryValue))}
                  </p>
                </div>
                <Link
                  href="/inventory"
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-primary hover:bg-muted/50"
                >
                  Open inventory →
                </Link>
              </div>
            </Card>
          </div>

          <Card className="border-border bg-card p-4">
            <h2 className="text-lg font-semibold text-card-foreground">Stock by category (₹)</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryCategoryValue} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatCompactAxis(v)} />
                  <YAxis type="category" dataKey="name" width={88} tick={AXIS_TICK} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => {
                      const n = coalesceNumber(value);
                      return n != null ? formatINR(n) : '—';
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {inventoryCategoryValue.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-card-foreground">Fast movers (30d)</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {movers.fast.map(({ it, sold }) => (
                  <li key={it.id} className="flex justify-between gap-2 border-b border-border/60 py-1">
                    <span className="truncate text-card-foreground">{it.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatNumber(Math.round(sold))} base sold
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-card-foreground">Slow movers (30d)</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {movers.slow.map(({ it, sold }) => (
                  <li key={it.id} className="flex justify-between gap-2 border-b border-border/60 py-1">
                    <span className="truncate text-card-foreground">{it.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatNumber(Math.round(sold))} base sold
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-card-foreground">Active SKUs</h2>
              <Link href="/inventory" className="text-sm font-medium text-primary hover:underline">
                Manage
              </Link>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">SKU</th>
                    <th className="py-2 pr-2 font-medium">Status</th>
                    <th className="py-2 pr-2 text-right font-medium">Qty (base)</th>
                    <th className="py-2 pr-2 text-right font-medium">Value</th>
                    <th className="py-2 text-right font-medium">Days left</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.slice(0, 40).map((r) => (
                    <tr key={r.id} className="border-b border-border/80">
                      <td className="py-2 pr-2 text-card-foreground">{r.name}</td>
                      <td className="py-2 pr-2 capitalize">{r.status}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatNumber(Math.round(r.stock))}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatINR(Math.round(r.value))}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {r.daysLeft === null ? '—' : r.daysLeft === 0 ? '—' : formatNumber(r.daysLeft)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'farmers' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Registered</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(farmers.length)}</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Active (visit 30d)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(kpis.activeFarmers)}</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">At churn risk (45d+)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(farmerAnalytics.churnRisk.length)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Lifetime revenue at risk (₹&gt;0): {formatINR(Math.round(kpis.churnRevenueImpact))}
              </p>
            </Card>
          </div>

          <Card className="border-border bg-card p-4">
            <h2 className="text-lg font-semibold text-card-foreground">Visits by week</h2>
            <p className="text-sm text-muted-foreground">Last 12 weeks (Sun–Sat)</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={farmerAnalytics.weeklyVisits}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} width={36} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="visits" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-card-foreground">Crop cycle mix</h2>
              <ul className="mt-4 space-y-3">
                {farmerAnalytics.cropCycleData.map(({ cycle, count }) => {
                  const max = Math.max(1, ...farmerAnalytics.cropCycleData.map((c) => c.count));
                  const pct = (count / max) * 100;
                  return (
                    <li key={cycle}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="capitalize text-card-foreground">{cycle === 'none' ? 'None set' : cycle}</span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card className="border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-card-foreground">Churn risk</h2>
              <p className="text-sm text-muted-foreground">No visit in 45+ days (or never)</p>
              <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
                {farmerAnalytics.churnRisk.slice(0, 25).map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 border-b border-border/60 py-1">
                    <span className="truncate text-card-foreground">{f.fullName}</span>
                    <Link
                      href={`/log-visit?farmerId=${encodeURIComponent(f.id)}`}
                      className="shrink-0 text-primary hover:underline"
                    >
                      Log visit
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="border-border bg-card p-4">
            <h2 className="text-lg font-semibold text-card-foreground">Top farmers by revenue</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Farmer</th>
                    <th className="py-2 pr-2 font-medium">Visits</th>
                    <th className="py-2 pr-2 font-medium">Tier</th>
                    <th className="py-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {farmerAnalytics.topFarmers.map(({ farmerId, revenue }) => {
                    const farmer = farmers.find((x) => x.id === farmerId);
                    const vc = visitsByFarmer[farmerId] ?? 0;
                    const tier = getLoyaltyTier(vc);
                    const cfg = LOYALTY_TIER_CONFIG[tier];
                    return (
                      <tr key={farmerId} className="border-b border-border/80">
                        <td className="py-2 pr-2 text-card-foreground">{farmer?.fullName ?? farmerId}</td>
                        <td className="py-2 pr-2 tabular-nums text-muted-foreground">{vc}</td>
                        <td className="py-2 pr-2">
                          <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium capitalize">
                            {cfg.emoji} {cfg.label}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums">{formatINR(revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'predictions' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">7-day forecast total</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatINR(Math.round(forecast7Total))}</p>
              <p className="mt-2 text-xs text-muted-foreground">Sum of next 7 projected days</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Daily trend (slope)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatINR(Math.round(predictions.trendSlope))}</p>
              <p className="mt-2 text-xs text-muted-foreground">₹ change per day (30d regression)</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Projected month-end revenue</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatINR(Math.round(predictions.projectedMonthTotal))}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">MTD actual + forecast for remaining days</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Credit exposure</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(creditFarmers.length)} farmers</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Outstanding: {formatINR(Math.round(totalCreditOutstanding))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">From getCreditFarmers (unpaid sales)</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Best weekday (30d avg)</p>
              <p className="mt-1 text-2xl font-semibold">{predictions.dayAvgs[predictions.bestDay]?.name ?? '—'}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Avg {formatINR(Math.round(predictions.dayAvgs[predictions.bestDay]?.avg ?? 0))}
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCompactAxis(n: number) {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function coalesceNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (Array.isArray(value) && value.length > 0) return coalesceNumber(value[0]);
  return null;
}
