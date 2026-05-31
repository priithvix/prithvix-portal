'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { differenceInCalendarDays, format, isSameDay, startOfMonth } from 'date-fns';
import { useData } from '@/contexts/DataContext';
import { useSales } from '@/contexts/SalesContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/components/common/PageTransition';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Farmer, Visit } from '@/constants/types';
import {
  Search,
  UserPlus,
  Phone,
  MapPin,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';

type SortKey = 'name' | 'lastVisit';
type FilterChip = 'all' | 'overdue' | 'noVisits' | 'hasCredit';

function getLastVisit(farmerId: string, visits: Visit[]) {
  const list = visits
    .filter((v) => v.farmerId === farmerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list[0] ?? null;
}

function isOverdueFarmer(farmerId: string, visits: Visit[]): boolean {
  const last = getLastVisit(farmerId, visits);
  if (!last) return false;
  const days = differenceInCalendarDays(new Date(), new Date(last.createdAt));
  return days > 20 && last.cropStage !== 'harvest';
}

export default function FarmersPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { farmers, visits, isLoading } = useData();
  const { getCreditFarmers } = useSales();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterChip>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const creditByFarmer = useMemo(() => {
    const m = new Map<string, number>();
    getCreditFarmers().forEach((c) => m.set(c.farmerId, c.totalDue));
    return m;
  }, [getCreditFarmers]);

  const creditFarmerIds = useMemo(() => new Set(getCreditFarmers().map((c) => c.farmerId)), [getCreditFarmers]);

  const visitedTodayCount = useMemo(() => {
    const today = new Date();
    const set = new Set<string>();
    for (const v of visits) {
      if (isSameDay(new Date(v.createdAt), today)) set.add(v.farmerId);
    }
    return set.size;
  }, [visits]);

  const newThisMonthCount = useMemo(() => {
    const sm = startOfMonth(new Date());
    return farmers.filter((f) => new Date(f.createdAt) >= sm).length;
  }, [farmers]);

  const visitCounts = useMemo(() => {
    const m = new Map<string, number>();
    visits.forEach((v) => m.set(v.farmerId, (m.get(v.farmerId) ?? 0) + 1));
    return m;
  }, [visits]);

  const filteredAndSorted = useMemo(() => {
    let list: Farmer[] = [...farmers];

    if (filter === 'overdue') {
      list = list.filter((f) => isOverdueFarmer(f.id, visits));
    } else if (filter === 'noVisits') {
      list = list.filter((f) => !visitCounts.has(f.id) || (visitCounts.get(f.id) ?? 0) === 0);
    } else if (filter === 'hasCredit') {
      list = list.filter((f) => creditFarmerIds.has(f.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.fullName.toLowerCase().includes(q) ||
          f.mobile.includes(q) ||
          f.village.toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
        return sortAsc ? cmp : -cmp;
      }
      const da = getLastVisit(a.id, visits);
      const db = getLastVisit(b.id, visits);
      const ta = da ? new Date(da.createdAt).getTime() : 0;
      const tb = db ? new Date(db.createdAt).getTime() : 0;
      const cmp = ta - tb;
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [
    farmers,
    visits,
    filter,
    searchQuery,
    sortKey,
    sortAsc,
    visitCounts,
    creditFarmerIds,
  ]);

  const mapsUrl = (lat?: number, lng?: number) =>
    typeof lat === 'number' && typeof lng === 'number'
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : null;

  const cropCycleLabel = (raw: string) => {
    const c = raw.toLowerCase();
    if (c === 'kharif') return t('farmers.kharif');
    if (c === 'rabi') return t('farmers.rabi');
    if (c === 'summer') return t('farmers.summer');
    return raw;
  };

  const visitCountLabel = (n: number) =>
    n === 1 ? t('farmers.visitCountOne').replace('{n}', String(n)) : t('farmers.visitCountMany').replace('{n}', String(n));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (isLoading) {
    return (
      <PageTransition>
        <div className="space-y-4 p-4 lg:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-9 w-44" />
          </div>
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-9 w-full max-w-xs" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  const chipClass = (active: boolean) =>
    cn(
      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
      active
        ? 'bg-primary text-primary-foreground'
        : 'border border-border text-muted-foreground hover:bg-muted/50'
    );

  const showEmptyRegistered = farmers.length === 0;
  const showNoSearchMatch =
    farmers.length > 0 && filteredAndSorted.length === 0 && searchQuery.trim() !== '';

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('farmers.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('farmers.subtitle')}</p>
            {!showEmptyRegistered && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {farmers.length === 1
                  ? t('farmers.registeredSingular')
                  : t('farmers.registeredPlural').replace('{n}', String(farmers.length))}
              </p>
            )}
          </div>
          <Link href="/register-farmer">
            <Button className="gap-2" size="sm">
              <UserPlus className="h-4 w-4" />
              {t('farmers.addFarmer')}
            </Button>
          </Link>
        </div>

        {!showEmptyRegistered && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ['farmers.totalFarmers', String(farmers.length)],
                  ['farmers.withCredit', String(creditFarmerIds.size)],
                  ['farmers.visitedToday', String(visitedTodayCount)],
                  ['farmers.newThisMonth', String(newThisMonthCount)],
                ] as const
              ).map(([key, value]) => (
                <Card key={key} className="border border-border p-4">
                  <p className="text-xs font-medium text-muted-foreground">{t(key)}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
                </Card>
              ))}
            </div>

            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('farmers.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label={t('farmers.search')}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xs font-medium uppercase text-muted-foreground">{t('common.filter')}</span>
              {(
                [
                  ['all', 'farmers.filterAll'],
                  ['overdue', 'farmers.filterOverdueChip'],
                  ['noVisits', 'farmers.filterNoVisits'],
                  ['hasCredit', 'farmers.filterHasCredit'],
                ] as const
              ).map(([key, labelKey]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={chipClass(filter === key)}
                >
                  {t(labelKey)}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-2xs uppercase text-muted-foreground">{t('farmers.sortBy')}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => toggleSort('name')}
                >
                  {t('farmers.sortByName')}
                  {sortKey === 'name' && (
                    <ArrowUpDown
                      className={cn('h-3.5 w-3.5', !sortAsc && 'rotate-180')}
                    />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => toggleSort('lastVisit')}
                >
                  {t('farmers.sortByLastVisit')}
                  {sortKey === 'lastVisit' && (
                    <ArrowUpDown
                      className={cn('h-3.5 w-3.5', !sortAsc && 'rotate-180')}
                    />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {showEmptyRegistered ? (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-muted/40">
              <UserPlus className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t('farmers.noFarmers')}</h2>
            <p className="mb-6 text-sm text-muted-foreground">{t('farmers.emptyRegisterDesc')}</p>
            <Link href="/register-farmer">
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                {t('farmers.emptyRegisterCta')}
              </Button>
            </Link>
          </Card>
        ) : showNoSearchMatch ? (
          <Card className="p-10 text-center">
            <p className="font-medium text-foreground">{t('farmers.noSearchMatchTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('farmers.noSearchMatchHint')}</p>
          </Card>
        ) : filteredAndSorted.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-muted-foreground">{t('farmers.noFilterMatch')}</p>
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden overflow-hidden md:block">
              <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,0.75fr)_auto] gap-2 border-b border-border bg-card px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{t('farmers.name')}</span>
                <span>{t('farmers.mobile')}</span>
                <span>{t('farmers.village')}</span>
                <span>{t('farmers.cropCycle')}</span>
                <span>{t('farmers.lastVisit')}</span>
                <span>{t('farmers.creditDue')}</span>
                <span className="w-20 text-right">{t('common.actions')}</span>
              </div>
              <div>
                {filteredAndSorted.map((farmer, idx) => {
                  const overdue = isOverdueFarmer(farmer.id, visits);
                  const credit = creditByFarmer.get(farmer.id) ?? 0;
                  const hasCredit = credit > 0;
                  const last = getLastVisit(farmer.id, visits);
                  const vCount = visitCounts.get(farmer.id) ?? 0;
                  const maps = mapsUrl(farmer.latitude, farmer.longitude);
                  const rowHover = hoveredRow === farmer.id;

                  return (
                    <div
                      key={farmer.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/farmers/${farmer.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/farmers/${farmer.id}`);
                        }
                      }}
                      className={cn(
                        'group relative grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,0.75fr)_auto] gap-2 border-b border-border px-4 py-3 transition-colors last:border-0',
                        idx % 2 === 0 ? 'bg-card' : 'bg-muted/20',
                        'hover:bg-muted/40',
                        overdue && 'border-l-2 border-destructive',
                        !overdue && hasCredit && 'border-l-2 border-warning'
                      )}
                      onMouseEnter={() => setHoveredRow(farmer.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{farmer.fullName}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {farmer.mobile}
                        </p>
                      </div>
                      <div className="min-w-0">
                        {maps ? (
                          <a
                            href={maps}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-10 flex items-start gap-1 text-sm text-primary underline-offset-4 hover:underline"
                          >
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="line-clamp-2">{farmer.village}</span>
                          </a>
                        ) : (
                          <p className="flex items-start gap-1 text-sm text-foreground">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="line-clamp-2">{farmer.village}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {farmer.cropCycle?.slice(0, 2).map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center justify-center rounded-full border border-border px-2 py-0.5 text-xs font-medium leading-none text-foreground"
                          >
                            {cropCycleLabel(c)}
                          </span>
                        ))}
                        {(farmer.cropCycle?.length ?? 0) > 2 && (
                          <span className="inline-flex items-center justify-center rounded-full border border-border px-2 py-0.5 text-xs leading-none text-muted-foreground">
                            +{(farmer.cropCycle?.length ?? 0) - 2}
                          </span>
                        )}
                        {!farmer.cropCycle?.length && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        {last ? (
                          <>
                            <p className="text-sm font-medium text-foreground">
                              {format(new Date(last.createdAt), 'd MMM yyyy')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {visitCountLabel(vCount)}
                            </p>
                            {overdue && (
                              <Badge
                                variant="outline"
                                className="mt-1 border-warning/50 bg-warning/10 text-warning"
                              >
                                {t('farmers.overdue')}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('farmers.noVisits')}</span>
                        )}
                      </div>
                      <div>
                        {hasCredit ? (
                          <span className="text-sm font-semibold tabular-nums text-destructive">
                            {formatINR(credit)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                      <div
                        className={cn(
                          'flex items-center justify-end gap-0.5 text-xs font-medium text-primary transition-opacity',
                          rowHover ? 'opacity-100' : 'opacity-0'
                        )}
                      >
                        {t('farmers.viewAction')}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filteredAndSorted.map((farmer) => {
                const overdue = isOverdueFarmer(farmer.id, visits);
                const credit = creditByFarmer.get(farmer.id) ?? 0;
                const hasCredit = credit > 0;
                const last = getLastVisit(farmer.id, visits);
                const vCount = visitCounts.get(farmer.id) ?? 0;
                const maps = mapsUrl(farmer.latitude, farmer.longitude);

                return (
                  <div
                    key={farmer.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/farmers/${farmer.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/farmers/${farmer.id}`);
                      }
                    }}
                  >
                    <Card
                      className={cn(
                        'cursor-pointer p-4 transition-colors hover:bg-muted/30',
                        overdue && 'border-l-2 border-destructive',
                        !overdue && hasCredit && 'border-l-2 border-warning'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{farmer.fullName}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {farmer.mobile}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </div>
                      {maps ? (
                        <a
                          href={maps}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="relative z-10 mt-2 flex items-start gap-1 text-sm text-primary"
                        >
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="line-clamp-2">
                            {[farmer.village, farmer.taluka, farmer.district].filter(Boolean).join(', ')}
                          </span>
                        </a>
                      ) : (
                        <p className="mt-2 flex items-start gap-1 text-sm text-muted-foreground">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {[farmer.village, farmer.taluka, farmer.district].filter(Boolean).join(', ')}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {farmer.cropCycle?.slice(0, 3).map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center justify-center rounded-full border border-border px-2 py-0.5 text-xs font-medium leading-none text-foreground"
                          >
                            {cropCycleLabel(c)}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                        <div>
                          {last ? (
                            <>
                              <span className="font-medium text-foreground">
                                {format(new Date(last.createdAt), 'd MMM yy')}
                              </span>
                              <span className="ml-1 text-muted-foreground">
                                · {visitCountLabel(vCount)}
                              </span>
                              {overdue && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 border-warning/50 bg-warning/10 text-warning"
                                >
                                  {t('farmers.overdue')}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">{t('farmers.noVisits')}</span>
                          )}
                        </div>
                        <div>
                          {hasCredit ? (
                            <span className="font-semibold text-destructive">{formatINR(credit)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
