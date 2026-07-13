'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  format,
  formatDistanceToNow,
  startOfDay,
  isToday as isTodayFn,
  isThisWeek,
} from 'date-fns';
import {
  Users,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Package,
  AlertTriangle,
  Calendar,
  Leaf,
  ChevronRight,
  Activity,
  FileText,
  UserPlus,
  Lock,
  ClipboardList,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useSales } from '@/contexts/SalesContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { EmptyState } from '@/components/common/EmptyState';
import { PageTransition } from '@/components/common/PageTransition';
import { AgriAlertStrip } from '@/components/dashboard/AgriAlertStrip';
import { AiInsightsCard } from '@/components/dashboard/AiInsightsCard';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CropStage, Farmer, Sale, Visit } from '@/constants/types';

function isToday(dateStr: string): boolean {
  try {
    return isTodayFn(new Date(dateStr));
  } catch {
    return false;
  }
}

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = startOfDay(d);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getDailyNewFarmerRegs(farmersList: Farmer[], days: number): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const { start, end } = dayBounds(date);
    const n = farmersList.filter((f) => {
      const t = new Date(f.createdAt).getTime();
      return t >= start.getTime() && t <= end.getTime();
    }).length;
    out.push(n);
  }
  return out;
}

function getDailyVisitCounts(visitsList: Visit[], days: number): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const { start, end } = dayBounds(date);
    const n = visitsList.filter((v) => {
      const t = new Date(v.createdAt).getTime();
      return t >= start.getTime() && t <= end.getTime();
    }).length;
    out.push(n);
  }
  return out;
}

function getDailyCreditSalesAmount(salesList: Sale[], days: number): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const { start, end } = dayBounds(date);
    const sum = salesList
      .filter((s) => {
        if (s.paymentMode !== 'credit') return false;
        const t = new Date(s.createdAt).getTime();
        return t >= start.getTime() && t <= end.getTime();
      })
      .reduce((acc, s) => acc + s.finalAmount, 0);
    out.push(sum);
  }
  return out;
}

/** vs prior day; if prev 0 and curr > 0 → +100% signal */
function trendPercent(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return null;
    return 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--card-foreground))',
};

function formatCropStage(stage: CropStage): string {
  return stage.slice(0, 1).toUpperCase() + stage.slice(1);
}

function buildRevenueVisitPoints(
  revenues: number[],
  visitsDaily: number[],
  days: number
): { label: string; revenue: number; visits: number; fullLabel: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { label: string; revenue: number; visits: number; fullLabel: string }[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    out.push({
      label: days <= 14 ? format(date, 'MMM d') : format(date, 'd MMM'),
      fullLabel: format(date, 'EEE, d MMM yyyy'),
      revenue: revenues[i] ?? 0,
      visits: visitsDaily[i] ?? 0,
    });
  }
  return out;
}

function MiniAreaChart({
  data,
  dataKey,
  color,
  gradientId,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  color: string;
  gradientId: string;
}) {
  if (!data.length) return null;
  return (
    <div className="h-10 w-[112px] shrink-0 min-w-0" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MiniVisitsBars({ data }: { data: { i: number; v: number }[] }) {
  if (!data.length) return null;
  return (
    <div className="h-10 w-[112px] shrink-0 min-w-0" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <Bar dataKey="v" radius={[3, 3, 0, 0]} fill="hsl(var(--chart-2))" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendPctBadge({ pct, className }: { pct: number | null; className?: string }) {
  if (pct == null || Number.isNaN(pct))
    return (
      <Badge variant="outline" className={cn('tabular-nums text-muted-foreground', className)}>
        —
      </Badge>
    );
  const up = pct >= 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-0.5 border-border/80 tabular-nums',
        up ? 'text-success border-success/35 bg-success/5' : 'text-destructive border-destructive/35 bg-destructive/5',
        className
      )}
    >
      {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
      {Math.abs(pct) < 0.05 ? '0%' : `${up ? '+' : ''}${pct.toFixed(0)}%`}
    </Badge>
  );
}

type Period = 7 | 30 | 90;

function RevenueAreaChartSection({
  data,
  period,
  onPeriod,
  reducesMotion,
}: {
  data: { label: string; revenue: number; visits: number; fullLabel: string }[];
  period: Period;
  onPeriod: (p: Period) => void;
  reducesMotion?: boolean | null;
}) {
  const { t } = useLanguage();

  return (
    <Card className="overflow-hidden shadow-sm ring-1 ring-border/30 transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">
            {t('home.dashboard.revenueTrend', 'Revenue trend')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('home.dashboard.revenueTrendHint', 'Daily revenue and visits')}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border/80 bg-muted/40 p-0.5">
          {([7, 30, 90] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriod(p)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                period === p
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p === 7
                ? t('home.dashboard.period7', '7d')
                : p === 30
                  ? t('home.dashboard.period30', '30d')
                  : t('home.dashboard.period90', '90d')}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="h-[260px] min-h-[220px] w-full min-w-0 pb-4">
        {data.every((d) => d.revenue === 0 && d.visits === 0) ? (
          <p className="text-sm text-muted-foreground">
            {t('home.dashboard.noRangeData', 'No activity in this range yet')}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="home-revenue-main" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide domain={['dataMin', 'auto']} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ display: 'none' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { fullLabel: string; revenue: number; visits: number };
                  return (
                    <div className="rounded-lg px-3 py-2 shadow-md ring-1 ring-border/30" style={TOOLTIP_STYLE}>
                      <p className="text-xs font-medium">{p.fullLabel}</p>
                      <p className="text-sm font-semibold tabular-nums">{formatINR(p.revenue)}</p>
                      <p className="text-2xs text-muted-foreground">
                        {p.visits}{' '}
                        {t('home.dashboard.visitsLabel', 'visits')}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#home-revenue-main)"
                isAnimationActive={!reducesMotion}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

type ActivityKind = 'visit' | 'sale' | 'farmer';

interface ActivityRow {
  id: string;
  at: Date;
  kind: ActivityKind;
  farmerId: string;
  title: string;
  detail: string;
}

function ActivityFeed({
  rows,
  viewAllHref,
  reducesMotion,
}: {
  rows: ActivityRow[];
  viewAllHref: string;
  reducesMotion?: boolean | null;
}) {
  const { t } = useLanguage();

  return (
    <Card className="flex h-full min-h-[320px] flex-col shadow-sm ring-1 ring-border/30 transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">{t('home.dashboard.recentActivity', 'Recent activity')}</CardTitle>
        <Link href={viewAllHref} className="text-xs font-medium text-primary hover:underline">
          {t('home.viewAll', 'View all')}
          <ChevronRight className="mb-px ml-0.5 inline size-3" aria-hidden />
        </Link>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-0 overflow-y-auto pb-4 pr-1">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('home.dashboard.noRecentActivity', 'No recent activity')}</p>
        ) : (
          <ul className="space-y-0 divide-y divide-border/60">
            {rows.map((row, idx) => {
              const initials = row.title
                .split(/\s+/)
                .slice(0, 2)
                .map((s) => s[0]?.toUpperCase() ?? '')
                .join('')
                .slice(0, 2);

              return (
                <motion.li
                  key={row.id}
                  initial={reducesMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: idx * 0.04 }}
                  className="border-l-2 border-l-transparent py-2.5 pl-3 first:pt-0 first:border-l-primary/80"
                  style={
                    idx === 0 && !reducesMotion
                      ? ({
                          animation: 'home-border-pulse 2.4s ease-in-out infinite',
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <Link href={`/farmers/${row.farmerId}`} className="flex gap-3 rounded-md transition-colors hover:bg-muted/40">
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                      aria-hidden
                    >
                      {initials || '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{row.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                      <p className="mt-1 text-2xs tabular-nums text-muted-foreground">
                        {formatDistanceToNow(row.at, { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InventoryRing({
  healthPct,
  ok,
  low,
  critical,
  topLow,
}: {
  healthPct: number;
  ok: number;
  low: number;
  critical: number;
  topLow: { id: string; name: string; qty: number; unit: string }[];
}) {
  const { t } = useLanguage();
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, healthPct)) / 100);

  return (
    <Card className="h-full shadow-sm ring-1 ring-border/30 transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{t('home.dashboard.inventoryHealth', 'Inventory health')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <svg width={80} height={80} viewBox="0 0 80 80" className="-rotate-90" aria-hidden>
            <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" opacity={0.25} />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke="hsl(var(--chart-1))"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold tabular-nums leading-none text-foreground">{healthPct}%</span>
            <span className="text-2xs text-muted-foreground">{t('home.dashboard.stockOk', 'OK')}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2 text-2xs">
            <span className="rounded-md bg-success/10 px-2 py-0.5 font-medium text-success tabular-nums">
              {ok} {t('home.dashboard.countOk', 'healthy')}
            </span>
            <span className="rounded-md bg-warning/10 px-2 py-0.5 font-medium text-warning tabular-nums">
              {low} {t('home.dashboard.countLow', 'low')}
            </span>
            <span className="rounded-md bg-destructive/10 px-2 py-0.5 font-medium text-destructive tabular-nums">
              {critical} {t('home.dashboard.countCritical', 'critical')}
            </span>
          </div>
          <div>
            <p className="mb-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('home.dashboard.topLowStock', 'Top low stock')}
            </p>
            {topLow.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('home.dashboard.allStockFine', 'All SKUs above safety')}</p>
            ) : (
              <ul className="space-y-1.5">
                {topLow.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {item.qty}
                      {item.unit ? ` ${item.unit}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/inventory" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {t('home.addStock', 'Add stock')} <ChevronRight className="size-3" aria-hidden />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TopFarmersBar({
  rows,
  metricLabel,
}: {
  rows: { farmerId: string; name: string; value: number }[];
  metricLabel: string;
}) {
  const { t } = useLanguage();
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <Card className="h-full shadow-sm ring-1 ring-border/30 transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{t('home.dashboard.topFarmers', 'Top farmers')}</CardTitle>
        <p className="text-xs text-muted-foreground">{metricLabel}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('home.dashboard.noFarmerRanking', 'Not enough visits yet')}</p>
        ) : (
          rows.map((row, idx) => {
            const w = (row.value / max) * 100;
            const barColors = ['hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-1))'];
            const barFill = barColors[idx % barColors.length];
            return (
              <Link key={row.farmerId} href={`/farmers/${row.farmerId}`} className="block group">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium group-hover:text-primary">{row.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{row.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-300 group-hover:opacity-90"
                    style={{ width: `${w}%`, backgroundColor: barFill }}
                  />
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function FollowUpRow({
  visit,
  farmerName,
}: {
  visit: Visit;
  farmerName: string;
}) {
  const fu = visit.followUpDate ? new Date(visit.followUpDate) : null;
  const todayFu = fu && isTodayFn(fu);
  const weekFu = fu && isThisWeek(fu, { weekStartsOn: 1 }) && !todayFu;
  const chipClass = todayFu
    ? 'border-destructive/50 bg-destructive/10 text-destructive'
    : weekFu
      ? 'border-warning/50 bg-warning/10 text-warning'
      : 'border-border bg-muted/50 text-muted-foreground';

  return (
    <li>
      <Link
        href={`/farmers/${visit.farmerId}`}
        className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/80 p-2.5 transition-all hover:bg-muted/40 hover:shadow-sm"
      >
        <Badge variant="outline" className={cn('shrink-0 tabular-nums', chipClass)}>
          {fu ? format(fu, 'MMM d') : '—'}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{farmerName}</p>
          <p className="text-xs text-muted-foreground">{formatCropStage(visit.cropStage)}</p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

export default function HomePage() {
  const reducesMotion = useReducedMotion();
  const { session, dealer } = useAuth();
  const { t } = useLanguage();
  const { farmers, visits, isLoading: dataLoading } = useData();
  const {
    todaySalesTotal,
    totalCreditOutstanding,
    getCreditFarmers,
    salesLoading,
    getDailyRevenue,
    sales,
  } = useSales();
  const { activeItems, lowStockItems, reorderRequiredItems, isLoading: inventoryLoading } = useInventory();

  const [revenuePeriod, setRevenuePeriod] = useState<Period>(30);

  const isLoading = dataLoading || salesLoading || inventoryLoading;

  const farmerById = useMemo(() => {
    const m = new Map<string, Farmer>();
    farmers.forEach((f) => m.set(f.id, f));
    return m;
  }, [farmers]);

  const last7Revenue = useMemo(() => getDailyRevenue(7), [getDailyRevenue]);
  const last7Regs = useMemo(() => getDailyNewFarmerRegs(farmers, 7), [farmers]);
  const last7Visits = useMemo(() => getDailyVisitCounts(visits, 7), [visits]);
  const last7CreditVol = useMemo(() => getDailyCreditSalesAmount(sales, 7), [sales]);

  const heroAreaData = useMemo(
    () => last7Revenue.map((v, i) => ({ x: i, revenue: v })),
    [last7Revenue]
  );

  const twoDayRev = useMemo(() => getDailyRevenue(2), [getDailyRevenue]);
  const revenueVsYesterday = trendPercent(twoDayRev[1] ?? 0, twoDayRev[0] ?? 0);

  const stats = useMemo(() => {
    const todayRegs = farmers.filter((f) => isToday(f.createdAt)).length;
    const totalVisits = visits.length;
    const visitsToday = visits.filter((v) => isToday(v.createdAt)).length;
    return { todayRegs, totalFarmers: farmers.length, totalVisits, visitsToday };
  }, [farmers, visits]);

  const twoDayRegs = useMemo(() => {
    const a = getDailyNewFarmerRegs(farmers, 2);
    return { prev: a[0] ?? 0, curr: a[1] ?? 0 };
  }, [farmers]);
  const regsTrend = trendPercent(twoDayRegs.curr, twoDayRegs.prev);

  const twoDayVisits = useMemo(() => {
    const a = getDailyVisitCounts(visits, 2);
    return { prev: a[0] ?? 0, curr: a[1] ?? 0 };
  }, [visits]);
  const visitsTrend = trendPercent(twoDayVisits.curr, twoDayVisits.prev);

  const twoDaySaleRev = useMemo(() => {
    const a = getDailyRevenue(2);
    return { prev: a[0] ?? 0, curr: a[1] ?? 0 };
  }, [getDailyRevenue]);
  const salesTrendKpi = trendPercent(twoDaySaleRev.curr, twoDaySaleRev.prev);

  const twoDayCredit = useMemo(() => {
    const a = getDailyCreditSalesAmount(sales, 2);
    return { prev: a[0] ?? 0, curr: a[1] ?? 0 };
  }, [sales]);
  const creditVolTrend = trendPercent(twoDayCredit.curr, twoDayCredit.prev);

  const revenueChartPoints = useMemo(() => {
    const rev = getDailyRevenue(revenuePeriod);
    const vd = getDailyVisitCounts(visits, revenuePeriod);
    return buildRevenueVisitPoints(rev, vd, revenuePeriod);
  }, [getDailyRevenue, visits, revenuePeriod]);

  const creditFarmers = useMemo(() => getCreditFarmers(), [getCreditFarmers]);
  const overdueCount = useMemo(
    () => creditFarmers.filter((f) => f.daysOverdue > 30).length,
    [creditFarmers]
  );

  const visitsBarData = useMemo(() => last7Visits.map((v, i) => ({ i, v })), [last7Visits]);
  const farmersTrendData = useMemo(() => last7Regs.map((r, i) => ({ x: i, registrations: r })), [last7Regs]);
  const revenueKpiTrendData = useMemo(
    () => last7Revenue.map((v, i) => ({ x: i, revenue: v })),
    [last7Revenue]
  );
  const creditTrendData = useMemo(
    () => last7CreditVol.map((v, i) => ({ x: i, credit: v })),
    [last7CreditVol]
  );

  const activityRows = useMemo((): ActivityRow[] => {
    const visitEvents = visits.slice(0, 60).map(
      (v): ActivityRow => ({
        id: `visit-${v.id}`,
        at: new Date(v.createdAt),
        kind: 'visit',
        farmerId: v.farmerId,
        title: farmerById.get(v.farmerId)?.fullName ?? t('home.dashboard.unknownFarmer', 'Farmer'),
        detail: `${t('home.dashboard.activityVisit', 'Field visit')} · ${formatCropStage(v.cropStage)}`,
      })
    );

    const saleEvents = sales.slice(0, 60).map(
      (s): ActivityRow => ({
        id: `sale-${s.id}`,
        at: new Date(s.createdAt),
        kind: 'sale',
        farmerId: s.farmerId,
        title: farmerById.get(s.farmerId)?.fullName ?? t('home.dashboard.unknownFarmer', 'Farmer'),
        detail:
          `${t('home.dashboard.activitySale', 'Sale')} · ${formatINR(s.finalAmount)}` +
          (s.paymentMode === 'credit' ? ` · ${t('udhaar.pending', 'Pending').toLowerCase()}` : ''),
      })
    );

    const regEvents = farmers.slice(0, 40).map(
      (f): ActivityRow => ({
        id: `reg-${f.id}`,
        at: new Date(f.createdAt),
        kind: 'farmer',
        farmerId: f.id,
        title: f.fullName,
        detail: t('home.dashboard.activityRegistered', 'New registration'),
      })
    );

    return [...visitEvents, ...saleEvents, ...regEvents]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 8);
  }, [farmers, visits, sales, farmerById, t]);

  const topFarmersVisits = useMemo(() => {
    const counts = new Map<string, number>();
    visits.forEach((v) => counts.set(v.farmerId, (counts.get(v.farmerId) ?? 0) + 1));
    const rows = [...counts.entries()]
      .map(([farmerId, value]) => ({
        farmerId,
        name: farmerById.get(farmerId)?.fullName ?? t('home.dashboard.unknownFarmer', 'Farmer'),
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    return rows;
  }, [visits, farmerById, t]);

  const followUpRows = useMemo(() => {
    const todayStart = startOfDay(new Date());
    return [...visits]
      .filter((v) => v.followUpDate)
      .sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime())
      .filter((v) => new Date(v.followUpDate!).getTime() >= todayStart.getTime())
      .slice(0, 5);
  }, [visits]);

  const inventoryBuckets = useMemo(() => {
    const ok = activeItems.filter((i) => i.stockStatus === 'healthy').length;
    const low = activeItems.filter((i) => i.stockStatus === 'low').length;
    const critical = activeItems.filter((i) => i.stockStatus === 'reorder').length;
    const total = ok + low + critical;
    const healthPct = total === 0 ? 100 : Math.round((ok / total) * 100);
    const topLow = [...lowStockItems]
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 3)
      .map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.stock,
        unit: i.baseUnit ?? '',
      }));
    return { ok, low, critical, healthPct, topLow };
  }, [activeItems, lowStockItems]);

  const needsAttention = useMemo(() => {
    const items: {
      icon: typeof AlertTriangle;
      severity: 'high' | 'medium' | 'low';
      title: string;
      subtitle: string;
      href: string;
    }[] = [];

    if (overdueCount > 0) {
      items.push({
        icon: AlertTriangle,
        severity: 'high',
        title: `${overdueCount} farmer${overdueCount !== 1 ? 's' : ''} overdue`,
        subtitle: `${t('home.dashboard.ctaCollect', 'Collect')} ${formatINR(totalCreditOutstanding)}`,
        href: '/udhaar',
      });
    } else if (totalCreditOutstanding > 0) {
      items.push({
        icon: IndianRupee,
        severity: 'medium',
        title: `${formatINR(totalCreditOutstanding)} ${t('home.dashboard.pendingUdhaar', 'udhaar pending')}`,
        subtitle: `${creditFarmers.length} farmer${creditFarmers.length !== 1 ? 's' : ''} owe you`,
        href: '/udhaar',
      });
    }

    if (reorderRequiredItems.length > 0) {
      items.push({
        icon: Package,
        severity: 'high',
        title: `${reorderRequiredItems.length} SKU${reorderRequiredItems.length !== 1 ? 's' : ''} below safety stock`,
        subtitle: t('home.dashboard.reorderCta', 'Reorder required'),
        href: '/inventory',
      });
    } else if (lowStockItems.length > 0) {
      items.push({
        icon: Package,
        severity: 'medium',
        title: `${lowStockItems.length} SKU${lowStockItems.length !== 1 ? 's' : ''} running low`,
        subtitle: t('home.lowStock', 'Low stock'),
        href: '/inventory',
      });
    }

    const followUps3Days = visits.filter((v) => {
      if (!v.followUpDate) return false;
      const d = new Date(v.followUpDate);
      const today = startOfDay(new Date());
      const in3 = new Date(today);
      in3.setDate(today.getDate() + 3);
      return d <= in3 && d >= today;
    });

    if (followUps3Days.length > 0) {
      items.push({
        icon: Calendar,
        severity: 'low',
        title: `${followUps3Days.length} follow-up${followUps3Days.length !== 1 ? 's' : ''} due soon`,
        subtitle: t('home.dashboard.followUpSoon', 'Due within 3 days'),
        href: '/smart-followup',
      });
    }

    const overdueStageCount = farmers.filter((f) => {
      const fVisits = visits
        .filter((v) => v.farmerId === f.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (fVisits.length === 0) return false;
      const last = fVisits[0];
      const days = Math.floor((Date.now() - new Date(last.createdAt).getTime()) / 86400000);
      return days > 20 && last.cropStage !== 'harvest';
    }).length;

    if (overdueStageCount > 0) {
      items.push({
        icon: Leaf,
        severity: 'low',
        title: `${overdueStageCount} farmer${overdueStageCount !== 1 ? 's' : ''} need a crop update`,
        subtitle: t('home.dashboard.noVisit20', 'No visit in 20+ days'),
        href: '/farmers',
      });
    }

    return items.slice(0, 8);
  }, [
    overdueCount,
    totalCreditOutstanding,
    creditFarmers.length,
    reorderRequiredItems.length,
    lowStockItems.length,
    visits,
    farmers,
    t,
  ]);

  const hourNow = new Date().getHours();
  const greeting =
    hourNow < 12 ? t('home.greeting.morning') : hourNow < 17 ? t('home.greeting.afternoon') : t('home.greeting.evening');

  const dealerName = (dealer?.owner_name || session?.displayName || '').trim();

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-12 w-64 bg-muted" />
        <Skeleton className="h-44 w-full rounded-xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-36 rounded-xl bg-muted" />
          <Skeleton className="h-36 rounded-xl bg-muted" />
          <Skeleton className="h-36 rounded-xl bg-muted" />
          <Skeleton className="h-36 rounded-xl bg-muted" />
        </div>
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-72 rounded-xl bg-muted lg:col-span-7" />
          <Skeleton className="h-72 rounded-xl bg-muted lg:col-span-5" />
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <>
        <style jsx global>{`
          @keyframes home-border-pulse {
            0%,
            100% {
              border-left-color: hsl(var(--primary));
            }
            50% {
              border-left-color: hsl(var(--chart-2));
            }
          }
        `}</style>
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6">
          {/* Hero */}
          <motion.section
            initial={reducesMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative overflow-hidden rounded-2xl border border-border/80 p-5 shadow-md ring-1 ring-border/30',
              'bg-gradient-to-br from-primary/[0.08] via-background to-background'
            )}
            style={{
              backgroundImage:
                'var(--bg-gradient), linear-gradient(to bottom right, hsl(var(--primary)/0.08), hsl(var(--background)), hsl(var(--background)))',
              backgroundBlendMode: 'normal',
            }}
          >
            <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,_hsl(var(--primary)/0.12),_transparent_55%)] md:block pointer-events-none" />
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-start lg:gap-6">
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight text-balance">
                      {dealerName
                        ? `${greeting}, ${dealerName} ${t('home.dashboard.emojiWave', '👋')}`
                        : `${greeting}!`}
                    </h1>
                    <p className="mt-1 text-xs text-muted-foreground">{t('home.subtitle')}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" className="h-9 border-border">
                      {t('common.today')}
                    </Button>
                    <Link href="/daily-close">
                      <Button size="sm" className="h-9 gap-1.5 shadow-sm">
                        <Lock className="h-3.5 w-3.5" />
                        {t('nav.closeDay')}
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('home.revenueToday')}
                    </p>
                    <AnimatedNumber
                      value={todaySalesTotal}
                      format={(n) => formatINR(n)}
                      className="text-3xl font-bold tabular-nums tracking-tight"
                    />
                  </div>
                  <TrendPctBadge pct={revenueVsYesterday} />
                </div>
                <p className="max-w-xl text-xs text-muted-foreground">
                  {t('home.dashboard.vsYesterday', 'Compared to yesterday · trailing 7 days on the chart')}
                </p>
              </div>
              <div className="relative w-full min-w-0 max-w-xl lg:flex-1">
                <div className="flex items-center justify-between gap-3 px-1">
                  <p className="text-2xs text-muted-foreground">
                    {stats.visitsToday} {t('home.dashboard.visitsLabel', 'visits')} · {stats.todayRegs}{' '}
                    {t('home.newToday', 'new today')}
                  </p>
                  <Badge variant="secondary" className="text-2xs">
                    {t('home.last7Days', 'Last 7 days')}
                  </Badge>
                </div>
                <div className="mt-2 h-[88px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={heroAreaData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hero-rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        fill="url(#hero-rev)"
                        isAnimationActive={!reducesMotion}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.section>

          <AgriAlertStrip />

          <AiInsightsCard />

          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: '/farmers',
                border: 'border-l-success bg-gradient-to-br from-transparent to-success/[0.04]',
                title: t('home.totalFarmers'),
                value: stats.totalFarmers,
                subtitle:
                  stats.todayRegs > 0
                    ? `+${stats.todayRegs} ${t('common.today').toLowerCase()}`
                    : `${stats.totalFarmers} ${t('home.dashboard.inNetwork', 'in network')}`,
                trend: regsTrend,
                chart: (
                  <MiniAreaChart
                    gradientId="kpi-farmers"
                    color="hsl(var(--chart-1))"
                    dataKey="registrations"
                    data={farmersTrendData}
                  />
                ),
                icon: <Users className="size-4 text-success" aria-hidden />,
              },
              {
                href: '/smart-followup',
                border: 'border-l-[hsl(var(--chart-2))] bg-gradient-to-br from-transparent to-muted/50',
                title: t('home.todayVisits'),
                value: stats.visitsToday,
                subtitle: `${stats.totalVisits} ${t('home.totalVisits', 'Total visits')}`.toLowerCase(),
                trend: visitsTrend,
                chart: <MiniVisitsBars data={visitsBarData} />,
                icon: <Activity className="size-4 text-info" aria-hidden />,
              },
              {
                href: '/sales-history',
                border: 'border-l-success bg-gradient-to-br from-transparent to-success/[0.04]',
                title: t('home.todaySales'),
                subtitle: t('home.revenueToday'),
                trend: salesTrendKpi,
                chart: (
                  <MiniAreaChart
                    gradientId="kpi-rev"
                    color="hsl(var(--chart-1))"
                    dataKey="revenue"
                    data={revenueKpiTrendData}
                  />
                ),
                icon: <TrendingUp className="size-4 text-success" aria-hidden />,
                isMoney: true,
              },
              {
                href: '/udhaar',
                border:
                  overdueCount > 0
                    ? 'border-l-destructive bg-gradient-to-br from-transparent to-destructive/[0.05]'
                    : 'border-l-[hsl(var(--chart-3))] bg-gradient-to-br from-transparent to-warning/[0.06]',
                title: t('home.creditOutstanding'),
                subtitle:
                  overdueCount > 0
                    ? `${overdueCount} ${t('home.daysOverdue')}`
                    : creditFarmers.length > 0
                      ? `${creditFarmers.length} ${t('nav.farmers').toLowerCase()}`
                      : t('udhaar.noCredit', 'No credit'),
                trend: creditVolTrend,
                extraBadge:
                  overdueCount > 0 ? (
                    <Badge variant="destructive" className="text-2xs tabular-nums">
                      {overdueCount}
                    </Badge>
                  ) : null,
                chart: (
                  <MiniAreaChart
                    gradientId="kpi-cr"
                    color="hsl(var(--chart-3))"
                    dataKey="credit"
                    data={creditTrendData}
                  />
                ),
                icon:
                  overdueCount > 0 ? (
                    <IndianRupee className="size-4 text-destructive" aria-hidden />
                  ) : (
                    <IndianRupee className="size-4 text-warning" aria-hidden />
                  ),
                isMoney: true,
              },
            ].map((card, idx) => (
              <motion.div
                key={card.title}
                initial={reducesMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link href={card.href}>
                  <Card className="h-full rounded-xl border-border/70 shadow-sm ring-1 ring-border/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className={cn('flex gap-4 p-4 pt-4 border-l-4', card.border)}>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="rounded-md bg-muted/70 p-1.5">{card.icon}</span>
                            <span className="text-2xs font-semibold uppercase tracking-wider">{card.title}</span>
                          </div>
                          <TrendPctBadge pct={card.trend} className="text-2xs" />
                          {'extraBadge' in card && card.extraBadge}
                        </div>
                        {'isMoney' in card && card.isMoney ? (
                          <AnimatedNumber
                            value={card.href === '/sales-history' ? todaySalesTotal : totalCreditOutstanding}
                            format={(n) => formatINR(n)}
                            className="text-3xl font-bold tabular-nums tracking-tight"
                          />
                        ) : 'value' in card ? (
                          <AnimatedNumber
                            value={(card as { value: number }).value}
                            className="text-3xl font-bold tabular-nums tracking-tight"
                          />
                        ) : null}
                        <p className="text-2xs text-muted-foreground">{card.subtitle}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end justify-between pt-8">{card.chart}</div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Mid: revenue chart + activity */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
            <motion.div
              className="min-w-0 lg:col-span-7"
              initial={reducesMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <RevenueAreaChartSection
                data={revenueChartPoints}
                period={revenuePeriod}
                onPeriod={setRevenuePeriod}
                reducesMotion={reducesMotion}
              />
            </motion.div>
            <motion.div
              className="min-w-0 lg:col-span-5"
              initial={reducesMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <ActivityFeed rows={activityRows} viewAllHref="/sales-history" reducesMotion={reducesMotion} />
            </motion.div>
          </div>

          {/* BI row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <motion.div
              initial={reducesMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <TopFarmersBar rows={topFarmersVisits} metricLabel={t('home.dashboard.byVisits', 'By visit count')} />
            </motion.div>
            <motion.div
              initial={reducesMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card className="h-full shadow-sm ring-1 ring-border/30 transition-shadow duration-200 hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    {t('home.followUpsDue', 'Follow-ups due')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {followUpRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('farmers.noFollowUpsScheduled')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {followUpRows.map((visit) => (
                        <FollowUpRow
                          key={visit.id}
                          visit={visit}
                          farmerName={farmerById.get(visit.farmerId)?.fullName ?? t('home.dashboard.unknownFarmer', 'Farmer')}
                        />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={reducesMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <InventoryRing
                healthPct={inventoryBuckets.healthPct}
                ok={inventoryBuckets.ok}
                low={inventoryBuckets.low}
                critical={inventoryBuckets.critical}
                topLow={inventoryBuckets.topLow}
              />
            </motion.div>
          </div>

          {/* Needs attention + quick actions */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('home.needsAttention')}</h2>
                {needsAttention.length > 0 && (
                  <Badge variant="secondary" className="tabular-nums text-2xs">
                    {needsAttention.length}
                  </Badge>
                )}
              </div>
              {needsAttention.length === 0 ? (
                <EmptyState icon={TrendingUp} title={t('home.allCaughtUp')} description={t('home.allCaughtUpDesc')} />
              ) : (
                <div className="-mx-2 flex gap-4 overflow-x-auto pb-2 md:mx-0 md:flex-col md:space-y-4 md:overflow-visible">
                  {needsAttention.map((item, idx) => {
                    const Icon = item.icon;
                    const borderCls =
                      item.severity === 'high'
                        ? 'ring-destructive/40 md:border-destructive/50'
                        : item.severity === 'medium'
                          ? 'ring-warning/40 md:border-warning/55'
                          : 'ring-info/35 md:border-info/55';
                    return (
                      <motion.div
                        key={`${item.title}-${idx}`}
                        initial={reducesMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="min-w-[min(100%-1rem,20rem)] shrink-0 px-2 md:min-w-0 md:px-0"
                      >
                        <Link href={item.href}>
                          <Card className={`group rounded-xl border-2 md:border md:shadow-sm ring-1 ring-border/20 ${borderCls}`}>
                            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                              <div
                                className={cn(
                                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                                  item.severity === 'high' && 'bg-destructive/10 text-destructive',
                                  item.severity === 'medium' && 'bg-warning/10 text-warning',
                                  item.severity === 'low' && 'bg-info/10 text-info'
                                )}
                              >
                                <Icon className="size-5" aria-hidden />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold leading-snug">{item.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                              </div>
                              <Button size="sm" variant="outline" className="shrink-0 gap-1 border-border/80 hover:bg-muted">
                                {t('home.dashboard.open', 'Open')}
                                <ChevronRight className="size-4" aria-hidden />
                              </Button>
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-5">
              <div className="mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('home.quickActions')}</h2>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
                {[
                  { href: '/register-farmer', icon: UserPlus, label: t('home.registerFarmer') },
                  { href: '/invoice', icon: FileText, label: t('home.newInvoice') },
                  { href: '/inventory', icon: Package, label: t('home.addStock') },
                  {
                    href: '/ai-agronomist',
                    icon: Sparkles,
                    label: t('home.dashboard.askAi', 'Ask AI'),
                  },
                  {
                    href: '/analytics',
                    icon: BarChart3,
                    label: t('home.dashboard.analytics', 'Analytics'),
                  },
                  {
                    href: '/log-visit',
                    icon: ClipboardList,
                    label: t('farmers.logVisit'),
                  },
                ].map((action, idx) => {
                  const Ico = action.icon;
                  return (
                    <motion.div
                      key={action.href}
                      initial={reducesMotion ? false : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: 0.12 + idx * 0.05 }}
                    >
                      <Link href={action.href}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full flex-col items-start gap-2 rounded-xl border border-border/70 p-4 text-left',
                            'bg-gradient-to-br from-primary/[0.10] via-card to-card shadow-sm ring-1 ring-border/30',
                            'transition-transform duration-200 hover:scale-[1.02] hover:shadow-md',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                          )}
                        >
                          <Ico className="size-5 text-primary" aria-hidden />
                          <span className="text-xs font-semibold leading-tight">{action.label}</span>
                        </button>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </>
    </PageTransition>
  );
}
