'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  format,
  isSameDay,
  isToday,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  parseISO,
  compareAsc,
  isBefore,
  startOfDay,
  differenceInCalendarDays,
} from 'date-fns';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  MapPin,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { PageTransition } from '@/components/common/PageTransition';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CropCycle, Farmer, Visit } from '@/constants/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function firstName(fullName: string): string {
  const p = fullName.trim().split(/\s+/);
  return p[0] ?? fullName;
}

function notesSnippet(notes: string, max = 60): string {
  const t = (notes ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function isKharifStart(d: Date): boolean {
  return d.getMonth() === 5 && d.getDate() === 1;
}
function isRabiStart(d: Date): boolean {
  return d.getMonth() === 10 && d.getDate() === 1;
}
function isSummerStart(d: Date): boolean {
  return d.getMonth() === 2 && d.getDate() === 1;
}

function seasonMarkerChips(d: Date): { key: string; label: string; className: string }[] {
  const out: { key: string; label: string; className: string }[] = [];
  if (isKharifStart(d)) {
    out.push({
      key: 'kharif-start',
      label: 'Kharif Start',
      className: 'bg-primary/10 text-primary',
    });
  }
  if (isRabiStart(d)) {
    out.push({ key: 'rabi-start', label: 'Rabi Start', className: 'bg-info/10 text-info' });
  }
  if (isSummerStart(d)) {
    out.push({
      key: 'summer-start',
      label: 'Summer Start',
      className: 'bg-warning/10 text-warning',
    });
  }
  return out;
}

/** Mar 1, Jun 1, Nov 1 in a small year window — for “days until next season” */
function seasonStartCandidates(from: Date): { date: Date; label: string; cycle: CropCycle }[] {
  const y = from.getFullYear();
  return [
    { date: new Date(y - 1, 2, 1), label: 'Summer', cycle: 'summer' as const },
    { date: new Date(y - 1, 5, 1), label: 'Kharif', cycle: 'kharif' as const },
    { date: new Date(y - 1, 10, 1), label: 'Rabi', cycle: 'rabi' as const },
    { date: new Date(y, 2, 1), label: 'Summer', cycle: 'summer' },
    { date: new Date(y, 5, 1), label: 'Kharif', cycle: 'kharif' },
    { date: new Date(y, 10, 1), label: 'Rabi', cycle: 'rabi' },
    { date: new Date(y + 1, 2, 1), label: 'Summer', cycle: 'summer' },
    { date: new Date(y + 1, 5, 1), label: 'Kharif', cycle: 'kharif' },
    { date: new Date(y + 1, 10, 1), label: 'Rabi', cycle: 'rabi' },
  ];
}

function preparingCycleForMonth(monthDate: Date): CropCycle | null {
  const m = monthDate.getMonth();
  if (m === 4 || m === 5) return 'kharif';
  if (m === 9 || m === 10) return 'rabi';
  if (m === 1 || m === 2) return 'summer';
  return null;
}

export default function CropCalendarPage() {
  const { farmers, visits } = useData();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const farmerById = useMemo(() => {
    const m = new Map<string, Farmer>();
    farmers.forEach((f) => m.set(f.id, f));
    return m;
  }, [farmers]);

  const seasonCounts = useMemo(() => {
    const counts: Record<CropCycle, number> = { kharif: 0, rabi: 0, summer: 0 };
    farmers.forEach((farmer) => {
      farmer.cropCycle.forEach((cycle) => {
        counts[cycle]++;
      });
    });
    return counts;
  }, [farmers]);

  const visitsWithFollowUp = useMemo(
    () => visits.filter((v) => v.followUpDate),
    [visits]
  );

  /** followUpDate (ISO) → visits that day */
  const visitsByFollowUpDay = useMemo(() => {
    const map = new Map<string, Visit[]>();
    for (const v of visitsWithFollowUp) {
      if (!v.followUpDate) continue;
      let d: Date;
      try {
        d = parseISO(v.followUpDate);
      } catch {
        continue;
      }
      const key = format(startOfDay(d), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    return map;
  }, [visitsWithFollowUp]);

  const calendarDays = useMemo(() => {
    const ms = startOfMonth(currentMonth);
    const me = endOfMonth(currentMonth);
    const gridStart = startOfWeek(ms, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(me, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const followUpsThisMonth = useMemo(() => {
    const list = visitsWithFollowUp.filter((v) => {
      if (!v.followUpDate) return false;
      try {
        return isSameMonth(parseISO(v.followUpDate), currentMonth);
      } catch {
        return false;
      }
    });
    list.sort((a, b) => compareAsc(parseISO(a.followUpDate!), parseISO(b.followUpDate!)));
    return list;
  }, [visitsWithFollowUp, currentMonth]);

  const preparingCycle = preparingCycleForMonth(currentMonth);
  const farmersInPreparingSeason = useMemo(() => {
    if (!preparingCycle) return [];
    return farmers.filter((f) => f.cropCycle.includes(preparingCycle));
  }, [farmers, preparingCycle]);

  const upcomingSeasonAlert = useMemo(() => {
    const now = startOfDay(new Date());
    const candidates = seasonStartCandidates(new Date())
      .map((c) => ({
        ...c,
        days: differenceInCalendarDays(startOfDay(c.date), now),
      }))
      .filter((c) => c.days >= 0 && c.days <= 30);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.days - b.days);
    return candidates[0];
  }, []);

  const nextSevenFollowUps = useMemo(() => {
    const today = startOfDay(new Date());
    return [...visitsWithFollowUp]
      .filter((v) => {
        try {
          const d = startOfDay(parseISO(v.followUpDate!));
          return !isBefore(d, today);
        } catch {
          return false;
        }
      })
      .sort((a, b) => compareAsc(parseISO(a.followUpDate!), parseISO(b.followUpDate!)))
      .slice(0, 7);
  }, [visitsWithFollowUp]);

  function dayChips(day: Date): { key: string; label: string; className: string }[] {
    const chips: { key: string; label: string; className: string }[] = [];
    for (const c of seasonMarkerChips(day)) {
      chips.push({ key: c.key, label: c.label, className: c.className });
    }
    const key = format(startOfDay(day), 'yyyy-MM-dd');
    const list = visitsByFollowUpDay.get(key) ?? [];
    for (const v of list) {
      const name = farmerById.get(v.farmerId)?.fullName ?? 'Farmer';
      chips.push({
        key: v.id,
        label: firstName(name),
        className: 'bg-warning/10 text-warning border-0',
      });
    }
    return chips;
  }

  function eventsForSelectedDay(day: Date) {
    const out: {
      id: string;
      kind: 'followup' | 'season';
      title: string;
      subtitle?: string;
      visit?: Visit;
    }[] = [];
    for (const c of seasonMarkerChips(day)) {
      out.push({ id: c.key, kind: 'season', title: c.label });
    }
    const key = format(startOfDay(day), 'yyyy-MM-dd');
    for (const v of visitsByFollowUpDay.get(key) ?? []) {
      const f = farmerById.get(v.farmerId);
      out.push({
        id: v.id,
        kind: 'followup',
        title: f?.fullName ?? 'Farmer',
        subtitle: notesSnippet(v.notes),
        visit: v,
      });
    }
    return out;
  }

  const panelIsDefault = selectedDay === null;

  return (
    <PageTransition>
      <div className="space-y-6 p-4 lg:p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Crop Calendar</h1>
          <p className="mt-1 text-muted-foreground">Season markers, follow-ups, and field planning</p>
        </div>

        {/* Section 1: Season stats strip */}
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card p-4 sm:flex-row sm:divide-x sm:divide-y-0">
          <div className="flex flex-1 items-center gap-3 py-3 sm:px-4 sm:py-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">{seasonCounts.kharif} farmers</p>
              <p className="text-xs text-muted-foreground">Kharif · Jun–Nov</p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-3 py-3 sm:px-4 sm:py-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-info" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">{seasonCounts.rabi} farmers</p>
              <p className="text-xs text-muted-foreground">Rabi · Nov–Mar</p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-3 py-3 sm:px-4 sm:py-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-warning" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">{seasonCounts.summer} farmers</p>
              <p className="text-xs text-muted-foreground">Summer · Mar–Jun</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Section 2: Calendar */}
          <div className="min-w-0 flex-1 space-y-3">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Month
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setCurrentMonth(subMonths(currentMonth, 1));
                      setSelectedDay(null);
                    }}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[10rem] text-center text-sm font-semibold tabular-nums text-foreground">
                    {format(currentMonth, 'MMMM yyyy')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setCurrentMonth(addMonths(currentMonth, 1));
                      setSelectedDay(null);
                    }}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d}
                      className="p-1.5 text-center text-xs font-semibold text-muted-foreground"
                    >
                      {d}
                    </div>
                  ))}
                  {calendarDays.map((day) => {
                    const inMonth = isSameMonth(day, currentMonth);
                    const chips = dayChips(day);
                    const visible = chips.slice(0, 2);
                    const rest = chips.length - 2;
                    const isSel = selectedDay !== null && isSameDay(day, selectedDay);
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={cn(
                          'min-h-[72px] rounded border p-1.5 text-left transition-colors',
                          'cursor-pointer hover:bg-muted/40',
                          !inMonth && 'opacity-40',
                          isToday(day) && 'border-primary bg-primary/5',
                          isSel && 'border-primary bg-primary/10 ring-1 ring-primary',
                          !isToday(day) && !isSel && 'border-border bg-card'
                        )}
                      >
                        <span
                          className={cn(
                            'text-xs font-semibold tabular-nums',
                            isToday(day) ? 'text-primary' : 'text-foreground'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                        <div className="mt-1 flex flex-col gap-0.5">
                          {visible.map((c) => (
                            <span
                              key={c.key}
                              className={cn(
                                'truncate rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
                                c.className
                              )}
                            >
                              {c.label}
                            </span>
                          ))}
                          {rest > 0 && (
                            <span className="text-[10px] text-muted-foreground">+{rest} more</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 3: Side panel */}
          <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-20 lg:w-80 lg:self-start">
            {panelIsDefault ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">This month</CardTitle>
                  <p className="text-xs text-muted-foreground">{format(currentMonth, 'MMMM yyyy')}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Follow-ups
                    </p>
                    {followUpsThisMonth.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No follow-ups scheduled</p>
                    ) : (
                      <ul className="space-y-2">
                        {followUpsThisMonth.map((v) => {
                          const f = farmerById.get(v.farmerId);
                          const d = parseISO(v.followUpDate!);
                          return (
                            <li key={v.id}>
                              <Link
                                href={`/farmers/${v.farmerId}`}
                                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-sm transition-colors hover:bg-muted/50"
                              >
                                <Badge variant="outline" className="shrink-0 tabular-nums">
                                  {format(d, 'd MMM')}
                                </Badge>
                                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                                  {f?.fullName ?? 'Farmer'}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {f?.village}
                                </span>
                                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Farmers by season
                    </p>
                    {!preparingCycle ? (
                      <p className="text-sm text-muted-foreground">
                        No dedicated prep window this calendar month (peaks: May–Jun Kharif, Oct–Nov Rabi,
                        Feb–Mar Summer).
                      </p>
                    ) : farmersInPreparingSeason.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No farmers tagged for{' '}
                        <span className="font-medium capitalize text-foreground">{preparingCycle}</span>{' '}
                        this cycle.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {farmersInPreparingSeason.map((f) => (
                          <li key={f.id}>
                            <Link
                              href={`/farmers/${f.id}`}
                              className="flex items-center justify-between gap-2 rounded-md border border-transparent px-1 py-1 text-sm hover:border-border hover:bg-muted/40"
                            >
                              <span className="font-medium text-foreground">{f.fullName}</span>
                              <span className="truncate text-xs text-muted-foreground">{f.village}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {upcomingSeasonAlert && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-sm font-semibold text-foreground">
                        Upcoming season ({upcomingSeasonAlert.label})
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Starts in {upcomingSeasonAlert.days} day
                        {upcomingSeasonAlert.days === 1 ? '' : 's'} — review stock for{' '}
                        {seasonCounts[upcomingSeasonAlert.cycle]} farmers on this cycle.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {selectedDay && format(selectedDay, 'EEEE, d MMMM yyyy')}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">Day view</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSelectedDay(null)}
                  >
                    Clear
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedDay && eventsForSelectedDay(selectedDay).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No events on this day.</p>
                  ) : (
                    <ul className="space-y-3">
                      {selectedDay &&
                        eventsForSelectedDay(selectedDay).map((ev) => (
                          <li
                            key={ev.id}
                            className="rounded-lg border border-border bg-card p-3 text-sm"
                          >
                            {ev.kind === 'season' ? (
                              <p className="font-medium text-foreground">{ev.title}</p>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 font-medium text-foreground">
                                  <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                                  {ev.title}
                                </div>
                                {ev.visit && (
                                  <>
                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                      {notesSnippet(ev.visit.notes, 60)}
                                    </p>
                                    <Link
                                      href={`/farmers/${ev.visit.farmerId}`}
                                      className="mt-2 inline-flex text-xs font-medium text-primary"
                                    >
                                      View Visit
                                    </Link>
                                  </>
                                )}
                              </>
                            )}
                          </li>
                        ))}
                    </ul>
                  )}
                  <Button asChild className="w-full">
                    <Link href="/log-visit">Log Visit</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>

        {/* Section 4: Activity timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
              Upcoming Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextSevenFollowUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No follow-ups scheduled.{' '}
                <Link href="/log-visit" className="font-medium text-primary underline-offset-4 hover:underline">
                  Log a visit
                </Link>{' '}
                to add one.
              </p>
            ) : (
              <ul className="space-y-2">
                {nextSevenFollowUps.map((v) => {
                  const f = farmerById.get(v.farmerId);
                  const d = parseISO(v.followUpDate!);
                  return (
                    <li
                      key={v.id}
                      className="flex gap-3 rounded-md border-l-4 border-l-warning border border-border bg-card pl-3 pr-3 py-2.5"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-xs font-semibold text-foreground tabular-nums">
                          {format(d, 'EEE d MMM')}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          {f?.fullName ?? 'Farmer'}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {f?.village}
                        </span>
                        {v.notes?.trim() && (
                          <p className="text-xs text-muted-foreground">{notesSnippet(v.notes, 80)}</p>
                        )}
                      </div>
                      <Link
                        href={`/farmers/${v.farmerId}`}
                        className="shrink-0 self-center text-primary"
                        aria-label={`Open ${f?.fullName ?? 'farmer'}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
