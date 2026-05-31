'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  addDays,
  differenceInDays,
  format,
  isAfter,
  isBefore,
  parseISO,
} from 'date-fns';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  MessageSquare,
  Phone,
  Sprout,
  UserPlus,
  Wheat,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useData } from '@/contexts/DataContext';
import { useSales } from '@/contexts/SalesContext';
import type { CropCycle, CropStage, Farmer, Sale, Visit } from '@/constants/types';

// ── Types ─────────────────────────────────────────────────────────────

type FollowUpReason =
  | 'overdue_visit'
  | 'scheduled_followup'
  | 'overdue_credit'
  | 'season_approaching'
  | 'never_visited'
  | 'post_harvest';

type FollowUpEntry = Farmer & {
  priority: 'high' | 'medium' | 'low';
  reasons: FollowUpReason[];
  primaryReason: FollowUpReason;
  lastVisitDate?: Date;
  daysSinceVisit?: number;
  nextFollowUpDate?: Date;
  outstandingCredit?: number;
  lastCropStage?: CropStage;
  lastVisitNotes?: string;
  /** Days credit is overdue (from getCreditFarmers aggregation) */
  creditDaysOverdue?: number;
  /** Days scheduled follow-up is late (max over due visits) */
  daysFollowUpLate?: number;
  /** Nearest applicable season start within window */
  daysUntilSeason?: number;
};

type CreditRow = { farmerId: string; totalDue: number; daysOverdue: number };

/** Prefer aggregated credit row from `getCreditFarmers`; always reconcile with `getSalesForFarmer`. */
function resolveCreditForFarmer(
  farmerId: string,
  row: CreditRow | undefined,
  getSalesForFarmer: (id: string) => Sale[]
): { totalDue: number; daysOverdue: number } {
  const sales = getSalesForFarmer(farmerId);
  let fromSalesDue = 0;
  let fromSalesOverdue = 0;
  const now = new Date();
  for (const s of sales) {
    if (s.status === 'paid' || s.balanceDue <= 0) continue;
    fromSalesDue += s.balanceDue;
    if (s.dueDate) {
      const due = new Date(s.dueDate);
      const diff = Math.floor(
        (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diff > fromSalesOverdue) fromSalesOverdue = diff;
    }
  }
  if (row) {
    return {
      totalDue: row.totalDue > 0 ? row.totalDue : fromSalesDue,
      daysOverdue: Math.max(row.daysOverdue, fromSalesOverdue),
    };
  }
  return { totalDue: fromSalesDue, daysOverdue: fromSalesOverdue };
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Indian crop season approximate planning starts for dealer follow-up (defaults).
 * - Kharif: main monsoon crop; sowing/transplant typically from June.
 * - Rabi: winter crop after monsoon; sowing commonly from late Oct / November.
 * - Summer (Zaid): short interval crop window; often from March onward.
 */
function seasonAnchor(cycle: CropCycle, year: number): Date {
  if (cycle === 'kharif') return new Date(year, 5, 1); // Jun 1
  if (cycle === 'rabi') return new Date(year, 10, 1); // Nov 1
  return new Date(year, 2, 1); // summer → Mar 1
}

/** Next season start on or after `from` for this cycle. */
function nextSeasonStart(cycle: CropCycle, from: Date): Date {
  const y = from.getFullYear();
  const a = seasonAnchor(cycle, y);
  if (!isBefore(from, a)) {
    return seasonAnchor(cycle, y + 1);
  }
  return a;
}

/** Smallest positive days from `from` to any of the farmer's season starts, or null if none in window. */
function daysUntilNearestSeasonStart(
  cycles: CropCycle[] | undefined,
  from: Date,
  maxAheadDays: number
): number | null {
  if (!cycles?.length) return null;
  let best: number | null = null;
  const today = startOfLocalDay(from);
  for (const c of cycles) {
    let cursor = from;
    for (let i = 0; i < 4; i++) {
      const next = nextSeasonStart(c, cursor);
      const d0 = startOfLocalDay(next);
      const days = differenceInDays(d0, today);
      if (days >= 0 && days <= maxAheadDays) {
        if (best === null || days < best) best = days;
      }
      cursor = addDays(next, 1);
    }
  }
  return best;
}

function normMobile(m: string): string {
  return m.replace(/\D/g, '');
}

/** WhatsApp copy: dealer-style Hindi reminder; optional outstanding line with ₹. */
function getWhatsAppMessage(fullName: string, outstandingCredit?: number): string {
  const credit =
    outstandingCredit != null && outstandingCredit > 0
      ? `Aapke upar ₹${outstandingCredit.toFixed(0)} ka udhaar pending hai.\n` +
        `Kripya jald settlement karein.\n\n`
      : '';
  return (
    `Namaste ${fullName} ji 🙏\n\n` +
    `Yeh message aapke dealer ki taraf se hai.\n\n` +
    credit +
    `Dhanyawad 🌾`
  );
}

const REASON_META: Record<
  FollowUpReason,
  { label: string; icon: LucideIcon }
> = {
  overdue_visit: { label: 'Overdue Visit', icon: CalendarDays },
  scheduled_followup: { label: 'Scheduled Follow-up', icon: CalendarClock },
  overdue_credit: { label: 'Outstanding Credit', icon: CircleDollarSign },
  season_approaching: { label: 'Season Prep', icon: Sprout },
  never_visited: { label: 'Never Visited', icon: UserPlus },
  post_harvest: { label: 'Post Harvest', icon: Wheat },
};

const PRIMARY_ORDER: FollowUpReason[] = [
  'scheduled_followup',
  'overdue_credit',
  'overdue_visit',
  'never_visited',
  'post_harvest',
  'season_approaching',
];

function pickPrimaryReason(reasons: FollowUpReason[]): FollowUpReason {
  for (const r of PRIMARY_ORDER) {
    if (reasons.includes(r)) return r;
  }
  return reasons[0] ?? 'season_approaching';
}

type PriorityRank = 'high' | 'medium' | 'low';

const PRIORITY_VALUE: Record<PriorityRank, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function maxPriority(a: PriorityRank, b: PriorityRank): PriorityRank {
  return PRIORITY_VALUE[a] >= PRIORITY_VALUE[b] ? a : b;
}

function computeFollowUps(
  farmers: Farmer[],
  visits: Visit[],
  creditFarmers: CreditRow[],
  getSalesForFarmer: (id: string) => Sale[],
  now: Date = new Date()
): FollowUpEntry[] {
  const today = startOfLocalDay(now);
  const creditByFarmer = new Map(
    creditFarmers.map((c) => [c.farmerId, c] as const)
  );

  const scored: Array<{ entry: FollowUpEntry; urgency: number }> = [];

  for (const farmer of farmers) {
    const farmerVisits = visits
      .filter((v) => v.farmerId === farmer.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const lastVisit = farmerVisits[0];
    const lastVisitDate = lastVisit ? new Date(lastVisit.createdAt) : undefined;
    const daysSinceVisit = lastVisitDate
      ? Math.max(0, differenceInDays(today, startOfLocalDay(lastVisitDate)))
      : undefined;

    const { totalDue, daysOverdue: creditDaysOverdue } = resolveCreditForFarmer(
      farmer.id,
      creditByFarmer.get(farmer.id),
      getSalesForFarmer
    );

    const regDate = parseISO(farmer.createdAt);
    const daysSinceReg = Math.max(0, differenceInDays(today, startOfLocalDay(regDate)));

    const reasons: FollowUpReason[] = [];
    let daysFollowUpLate = 0;
    let nextFollowUpDue: Date | undefined;

    if (farmerVisits.length === 0) {
      reasons.push('never_visited');
    }

    if (
      lastVisit &&
      lastVisit.cropStage !== 'harvest' &&
      daysSinceVisit !== undefined &&
      daysSinceVisit >= 20
    ) {
      reasons.push('overdue_visit');
    }

    for (const v of farmerVisits) {
      if (!v.followUpDate) continue;
      const fd = startOfLocalDay(parseISO(v.followUpDate));
      if (!isAfter(fd, today)) {
        reasons.push('scheduled_followup');
        const late = Math.max(0, differenceInDays(today, fd));
        if (late > daysFollowUpLate) daysFollowUpLate = late;
        if (!nextFollowUpDue || isBefore(fd, nextFollowUpDue)) {
          nextFollowUpDue = fd;
        }
      }
    }

    if (totalDue > 0) {
      reasons.push('overdue_credit');
    }

    const daysUntilSeason = daysUntilNearestSeasonStart(farmer.cropCycle, now, 30);
    if (daysUntilSeason !== null) {
      reasons.push('season_approaching');
    }

    if (lastVisit?.cropStage === 'harvest') {
      reasons.push('post_harvest');
    }

    const dedup = Array.from(new Set(reasons));
    if (dedup.length === 0) continue;

    const hasScheduled = dedup.includes('scheduled_followup');
    const neverVisited = farmerVisits.length === 0;
    const overdueVisitDays =
      lastVisit && lastVisit.cropStage !== 'harvest' && daysSinceVisit !== undefined
        ? daysSinceVisit
        : -1;

    let priority: PriorityRank = 'low';

    const highFromCombo = hasScheduled && creditDaysOverdue > 0 && totalDue > 0;
    const highFromVisit = overdueVisitDays > 30;
    const highFromNever = neverVisited && daysSinceReg > 15;
    if (highFromCombo || highFromVisit || highFromNever) {
      priority = maxPriority(priority, 'high');
    }

    const medFromVisit =
      overdueVisitDays >= 20 && overdueVisitDays <= 30;
    const medFromSeason =
      daysUntilSeason !== null && daysUntilSeason >= 0 && daysUntilSeason <= 15;
    const medFromHarvest = dedup.includes('post_harvest');
    const medFromSched = hasScheduled;
    const medFromCredit = totalDue > 0 && creditDaysOverdue > 0;
    if (
      medFromVisit ||
      medFromSeason ||
      medFromHarvest ||
      medFromSched ||
      medFromCredit
    ) {
      priority = maxPriority(priority, 'medium');
    }

    const lowFromSeason =
      daysUntilSeason !== null && daysUntilSeason >= 16 && daysUntilSeason <= 30;
    const lowFromCreditTouch = totalDue > 0 && creditDaysOverdue === 0;
    const lowFromNewFarmer = neverVisited && daysSinceReg <= 15;
    if (lowFromSeason || lowFromCreditTouch || lowFromNewFarmer) {
      priority = maxPriority(priority, 'low');
    }

    const primaryReason = pickPrimaryReason(dedup);

    const urgencyScore =
      (daysSinceVisit ?? 0) * 10 +
      creditDaysOverdue * 15 +
      daysFollowUpLate * 12 +
      (daysUntilSeason !== null ? (30 - daysUntilSeason) * 2 : 0);

    scored.push({
      urgency: urgencyScore,
      entry: {
        ...farmer,
        priority,
        reasons: dedup,
        primaryReason,
        lastVisitDate,
        daysSinceVisit,
        nextFollowUpDate: nextFollowUpDue,
        outstandingCredit: totalDue > 0 ? totalDue : undefined,
        lastCropStage: lastVisit?.cropStage,
        lastVisitNotes: lastVisit?.notes,
        creditDaysOverdue: totalDue > 0 ? creditDaysOverdue : undefined,
        daysFollowUpLate: daysFollowUpLate > 0 ? daysFollowUpLate : undefined,
        daysUntilSeason: daysUntilSeason ?? undefined,
      },
    });
  }

  return scored
    .sort((a, b) => {
      const pd =
        PRIORITY_VALUE[b.entry.priority] - PRIORITY_VALUE[a.entry.priority];
      if (pd !== 0) return pd;
      return b.urgency - a.urgency;
    })
    .map((s) => s.entry);
}

const PRIORITY_ROW: Array<{ key: PriorityRank | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];

const REASON_FILTER_ORDER: Array<{ key: FollowUpReason | 'all'; label: string }> = [
  { key: 'all', label: 'All reasons' },
  { key: 'overdue_visit', label: 'Overdue Visit' },
  { key: 'scheduled_followup', label: 'Scheduled Follow-up' },
  { key: 'overdue_credit', label: 'Outstanding Credit' },
  { key: 'season_approaching', label: 'Season Prep' },
  { key: 'never_visited', label: 'Never Visited' },
  { key: 'post_harvest', label: 'Post Harvest' },
];

export default function SmartFollowupPage() {
  const router = useRouter();
  const { farmers, visits, isLoading: dataLoading } = useData();
  const { getCreditFarmers, getSalesForFarmer } = useSales();

  const [filterPriority, setFilterPriority] = useState<
    'all' | 'high' | 'medium' | 'low'
  >('all');
  const [filterReason, setFilterReason] = useState<FollowUpReason | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissedIds, setDismissedIds] = useState(() => new Set<string>());

  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignIndex, setCampaignIndex] = useState(0);
  const [campaignIncludeMedium, setCampaignIncludeMedium] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState('');

  const creditFarmers = useMemo(() => getCreditFarmers(), [getCreditFarmers]);

  const totalCreditDue = useMemo(
    () => creditFarmers.reduce((s, c) => s + c.totalDue, 0),
    [creditFarmers]
  );

  const allFollowUps = useMemo(
    () =>
      computeFollowUps(farmers, visits, creditFarmers, getSalesForFarmer),
    [farmers, visits, creditFarmers, getSalesForFarmer]
  );

  const visibleList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allFollowUps.filter((e) => {
      if (dismissedIds.has(e.id)) return false;
      if (filterPriority !== 'all' && e.priority !== filterPriority) return false;
      if (filterReason !== 'all' && !e.reasons.includes(filterReason)) return false;
      if (q) {
        const blob = `${e.fullName} ${e.village} ${e.mobile}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [
    allFollowUps,
    dismissedIds,
    filterPriority,
    filterReason,
    searchQuery,
  ]);

  const stats = useMemo(() => {
    const active = allFollowUps.filter((e) => !dismissedIds.has(e.id));
    return {
      needingAttention: active.length,
      high: active.filter((e) => e.priority === 'high').length,
      pendingFollowUps: active.filter((e) =>
        e.reasons.includes('scheduled_followup')
      ).length,
    };
  }, [allFollowUps, dismissedIds]);

  const campaignQueue = useMemo(() => {
    const active = allFollowUps.filter((e) => !dismissedIds.has(e.id));
    return active.filter(
      (e) =>
        e.priority === 'high' || (campaignIncludeMedium && e.priority === 'medium')
    );
  }, [allFollowUps, dismissedIds, campaignIncludeMedium]);

  const canCampaign = useMemo(
    () =>
      allFollowUps.some(
        (e) =>
          !dismissedIds.has(e.id) &&
          (e.priority === 'high' || e.priority === 'medium')
      ),
    [allFollowUps, dismissedIds]
  );

  const campaignFarmer = campaignQueue[campaignIndex] ?? null;

  useEffect(() => {
    if (!campaignOpen || !campaignFarmer) return;
    setCampaignMessage(
      getWhatsAppMessage(campaignFarmer.fullName, campaignFarmer.outstandingCredit)
    );
  }, [campaignOpen, campaignIndex, campaignFarmer?.id]);

  const openCampaign = () => {
    setCampaignOpen(true);
    setCampaignIndex(0);
  };

  const closeCampaign = () => {
    setCampaignOpen(false);
    setCampaignIndex(0);
    setCampaignMessage('');
  };

  const openWhatsApp = (mobile: string, message: string) => {
    const m = normMobile(mobile);
    if (!m) {
      toast.error('Invalid mobile number');
      return;
    }
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/91${m}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleCampaignSend = () => {
    if (!campaignFarmer) return;
    openWhatsApp(campaignFarmer.mobile, campaignMessage);
    if (campaignIndex >= campaignQueue.length - 1) {
      toast.success('Campaign completed — all selected farmers processed.');
      closeCampaign();
    } else {
      setCampaignIndex((i) => i + 1);
    }
  };

  const handleCampaignSkip = () => {
    if (!campaignFarmer) return;
    if (campaignIndex >= campaignQueue.length - 1) {
      toast.message('Done', { description: 'No more farmers in this campaign.' });
      closeCampaign();
    } else {
      setCampaignIndex((i) => i + 1);
    }
  };

  const handleToggleMedium = (checked: boolean) => {
    setCampaignIncludeMedium(checked);
    setCampaignIndex(0);
  };

  if (dataLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
        <p className="text-sm">Loading follow-up insights…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Smart Follow-ups
          </h1>
          <p className="mt-1 text-muted-foreground">
            {stats.needingAttention === 0
              ? 'Nobody needs attention right now.'
              : `${stats.needingAttention} farmer${
                  stats.needingAttention === 1 ? '' : 's'
                } need attention`}
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 gap-2"
          onClick={openCampaign}
          disabled={!canCampaign}
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          Send Campaign
        </Button>
      </div>

      {/* Stats strip */}
      <div className="flex flex-wrap overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex min-w-[7rem] flex-1 flex-col gap-0.5 border-border p-4 sm:border-e">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {stats.needingAttention}
          </span>
        </div>
        <div className="flex min-w-[7rem] flex-1 flex-col gap-0.5 border-border p-4 sm:border-e">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            High priority
          </span>
          <span className="text-2xl font-semibold tabular-nums text-destructive">
            {stats.high}
          </span>
        </div>
        <div className="flex min-w-[7rem] flex-1 flex-col gap-0.5 border-border p-4 sm:border-e">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending follow-ups
          </span>
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {stats.pendingFollowUps}
          </span>
        </div>
        <div className="flex min-w-[7rem] flex-1 flex-col gap-0.5 p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total credit due
          </span>
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            ₹{totalCreditDue.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Priority">
          {PRIORITY_ROW.map(({ key, label }) => {
            const active = filterPriority === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterPriority(key)}
                className={
                  active
                    ? 'rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm'
                    : 'rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
          {REASON_FILTER_ORDER.map(({ key, label }) => {
            const active = filterReason === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterReason(key)}
                className={
                  active
                    ? 'rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm'
                    : 'rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <label className="block text-sm font-medium text-foreground">
          Search
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Name, village, or mobile"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            autoComplete="off"
          />
        </label>
      </div>

      {/* List */}
      {allFollowUps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center">
          <Sprout className="h-12 w-12 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-lg font-semibold text-foreground">All set</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            No follow-up rules matched your farmers yet. Log visits and credit to
            unlock recommendations.
          </p>
        </div>
      ) : visibleList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
          <p className="text-lg font-semibold text-foreground">No matches</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Try clearing filters, search, or restoring dismissed cards from a fresh
            page load.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleList.map((entry) => {
            const borderClass =
              entry.priority === 'high'
                ? 'border-l-destructive'
                : entry.priority === 'medium'
                  ? 'border-l-warning'
                  : 'border-l-border';
            const badgeClass =
              entry.priority === 'high'
                ? 'bg-destructive/15 text-destructive'
                : entry.priority === 'medium'
                  ? 'bg-warning/15 text-warning'
                  : 'bg-muted text-muted-foreground';
            const initials = entry.fullName
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? '')
              .join('');

            return (
              <li key={entry.id}>
                <div
                  className={`relative rounded-lg border border-border bg-card p-4 shadow-sm border-l-4 ${borderClass}`}
                >
                  <button
                    type="button"
                    aria-label={`Dismiss ${entry.fullName}`}
                    className="absolute end-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() =>
                      setDismissedIds((prev) => new Set([...prev, entry.id]))
                    }
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="flex gap-3 pe-8">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground"
                      aria-hidden
                    >
                      {initials || '?'}
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-foreground">
                          {entry.fullName}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}
                        >
                          {entry.priority}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {entry.village}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {entry.reasons.map((r) => {
                          const meta = REASON_META[r];
                          const Icon = meta.icon;
                          return (
                            <span
                              key={r}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium text-foreground"
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              {meta.label}
                            </span>
                          );
                        })}
                      </div>

                      <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        {entry.lastVisitDate && (
                          <>
                            <dt className="sr-only">Last visit</dt>
                            <dd>
                              Last visit:{' '}
                              <span className="text-foreground">
                                {format(entry.lastVisitDate, 'd MMM yyyy')}
                              </span>
                              {entry.daysSinceVisit != null && (
                                <> ({entry.daysSinceVisit}d ago)</>
                              )}
                            </dd>
                          </>
                        )}
                        {entry.nextFollowUpDate && (
                          <>
                            <dt className="sr-only">Follow-up</dt>
                            <dd>
                              Follow-up was due:{' '}
                              <span className="text-foreground">
                                {format(entry.nextFollowUpDate, 'd MMM yyyy')}
                              </span>
                            </dd>
                          </>
                        )}
                        {entry.outstandingCredit != null &&
                          entry.outstandingCredit > 0 && (
                            <>
                              <dt className="sr-only">Credit</dt>
                              <dd>
                                Outstanding:{' '}
                                <span className="text-foreground">
                                  ₹{entry.outstandingCredit.toFixed(0)}
                                </span>
                                {entry.creditDaysOverdue ? (
                                  <> ({entry.creditDaysOverdue}d overdue)</>
                                ) : null}
                              </dd>
                            </>
                          )}
                        {entry.daysUntilSeason != null && (
                          <>
                            <dt className="sr-only">Season</dt>
                            <dd>
                              Season prep:{' '}
                              <span className="text-foreground">
                                {entry.daysUntilSeason}d to window
                              </span>
                            </dd>
                          </>
                        )}
                        {entry.lastCropStage && (
                          <>
                            <dt className="sr-only">Last stage</dt>
                            <dd>
                              Last stage:{' '}
                              <span className="text-foreground">
                                {entry.lastCropStage}
                              </span>
                            </dd>
                          </>
                        )}
                      </dl>

                      {entry.lastVisitNotes ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          Notes: {entry.lastVisitNotes}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() =>
                            window.open(
                              `tel:${normMobile(entry.mobile)}`,
                              '_self'
                            )
                          }
                        >
                          <Phone className="h-3.5 w-3.5" />
                          Call
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() =>
                            openWhatsApp(
                              entry.mobile,
                              getWhatsAppMessage(
                                entry.fullName,
                                entry.outstandingCredit
                              )
                            )
                          }
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          WhatsApp
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            router.push(`/log-visit?farmerId=${entry.id}`)
                          }
                        >
                          Log visit
                        </Button>
                        <Button type="button" size="sm" asChild>
                          <Link href={`/farmers/${entry.id}`}>View profile</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Campaign modal */}
      {campaignOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center"
          role="presentation"
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 rounded-t-xl border border-border bg-card p-6 shadow-lg sm:rounded-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-title"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2
                  id="campaign-title"
                  className="text-lg font-semibold text-foreground"
                >
                  WhatsApp campaign
                </h2>
                <p className="text-sm text-muted-foreground">
                  {campaignFarmer
                    ? `${campaignIndex + 1} / ${campaignQueue.length} — ${
                        campaignFarmer.fullName
                      }`
                    : 'No farmers in queue'}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close campaign"
                onClick={closeCampaign}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={campaignIncludeMedium}
                onChange={(e) => handleToggleMedium(e.target.checked)}
              />
              Include medium priority
            </label>

            <textarea
              className="min-h-[5rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              rows={3}
              value={campaignMessage}
              onChange={(e) => setCampaignMessage(e.target.value)}
              disabled={!campaignFarmer}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={campaignIndex === 0}
                onClick={() => {
                  setCampaignIndex((i) => Math.max(0, i - 1));
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCampaignSkip}
                  disabled={!campaignFarmer}
                >
                  Skip
                </Button>
                <Button
                  type="button"
                  onClick={handleCampaignSend}
                  disabled={!campaignFarmer || !campaignMessage.trim()}
                >
                  Send on WhatsApp
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
