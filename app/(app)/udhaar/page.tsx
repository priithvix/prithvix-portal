'use client';

import { useState, useMemo } from 'react';
import { useSales } from '@/contexts/SalesContext';
import { useData } from '@/contexts/DataContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { PageTransition } from '@/components/common/PageTransition';
import { formatINR } from '@/lib/format';
import {
  Search,
  IndianRupee,
  TrendingUp,
  Users,
  Phone,
  MapPin,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Banknote,
  Smartphone,
  MessageCircle,
  FileText,
  ArrowDownUp,
  SlidersHorizontal,
  Send,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

type FilterTab = 'all' | 'overdue' | 'current';
type SortKey = 'amount' | 'days' | 'name' | 'date';

interface PayModalState {
  farmerId: string;
  farmerName: string;
  totalDue: number;
  sales: { id: string; balanceDue: number; createdAt: string; initialBalanceDue: number }[];
}

export default function UdhaarPage() {
  const { t } = useLanguage();
  const { getCreditFarmers, totalCreditOutstanding, salesLoading, sales, recordPayment, isRecordingPayment, creditPayments } =
    useSales();
  const { farmers, isLoading: farmersLoading } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('amount');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<PayModalState | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<'cash' | 'upi'>('cash');
  const [payNotes, setPayNotes] = useState('');

  // Reminder campaign state
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderIndex, setReminderIndex] = useState(0);
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());

  const creditFarmers = useMemo(() => getCreditFarmers(), [getCreditFarmers]);

  // Enrich with farmer details + credit sales
  const enrichedCreditFarmers = useMemo(() => {
    return creditFarmers.map((cf) => {
      const farmer = farmers.find((f) => f.id === cf.farmerId);
      const farmerSales = sales.filter(
        (s) => s.farmerId === cf.farmerId && s.balanceDue > 0
      );
      return {
        ...cf,
        farmerName: farmer?.fullName ?? 'Unknown',
        farmerMobile: farmer?.mobile ?? '',
        farmerVillage: farmer?.village ?? '',
        farmerTaluka: farmer?.taluka ?? '',
        farmerId_link: farmer?.id ?? cf.farmerId,
        creditSales: farmerSales,
        totalPaid: (farmer ? sales.filter(s => s.farmerId === farmer.id) : [])
          .reduce((sum, s) => sum + s.paidAmount, 0),
      };
    });
  }, [creditFarmers, farmers, sales]);

  // Stats
  const overdueItems = enrichedCreditFarmers.filter((cf) => cf.daysOverdue > 30);
  const currentItems = enrichedCreditFarmers.filter((cf) => cf.daysOverdue <= 30);
  const overdueAmount = overdueItems.reduce((s, cf) => s + cf.totalDue, 0);
  const currentAmount = currentItems.reduce((s, cf) => s + cf.totalDue, 0);
  const avgDaysOverdue =
    enrichedCreditFarmers.length > 0
      ? Math.round(enrichedCreditFarmers.reduce((s, cf) => s + cf.daysOverdue, 0) / enrichedCreditFarmers.length)
      : 0;

  // Filter + sort
  const filteredFarmers = useMemo(() => {
    let list = enrichedCreditFarmers;

    // Tab filter
    if (filterTab === 'overdue') list = list.filter((cf) => cf.daysOverdue > 30);
    else if (filterTab === 'current') list = list.filter((cf) => cf.daysOverdue <= 30);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (cf) =>
          cf.farmerName.toLowerCase().includes(q) ||
          cf.farmerMobile.includes(q) ||
          cf.farmerVillage.toLowerCase().includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === 'amount') diff = b.totalDue - a.totalDue;
      else if (sortKey === 'days') diff = b.daysOverdue - a.daysOverdue;
      else if (sortKey === 'name') diff = a.farmerName.localeCompare(b.farmerName);
      else if (sortKey === 'date')
        diff = new Date(b.lastSaleDate).getTime() - new Date(a.lastSaleDate).getTime();
      return sortAsc ? -diff : diff;
    });

    return list;
  }, [enrichedCreditFarmers, filterTab, searchQuery, sortKey, sortAsc]);

  const isLoading = salesLoading || farmersLoading;

  // ── Open payment modal ─────────────────────────────────────────
  const openPayModal = (cf: (typeof enrichedCreditFarmers)[0]) => {
    setPayModal({
      farmerId: cf.farmerId,
      farmerName: cf.farmerName,
      totalDue: cf.totalDue,
      sales: cf.creditSales.map((s) => ({
        id: s.id,
        balanceDue: s.balanceDue,
        createdAt: s.createdAt,
        initialBalanceDue: s.initialBalanceDue,
      })),
    });
    setPayAmount(cf.totalDue.toFixed(0));
    setPayMode('cash');
    setPayNotes('');
  };

  // ── Submit payment ─────────────────────────────────────────────
  const handleRecordPayment = async () => {
    if (!payModal) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    if (amount > payModal.totalDue) {
      toast.error(`Amount cannot exceed ₹${payModal.totalDue.toFixed(0)} due`);
      return;
    }

    // Distribute across sales oldest-first
    const sorted = [...payModal.sales].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    let remaining = amount;

    try {
      for (const s of sorted) {
        if (remaining <= 0) break;
        const pay = Math.min(remaining, s.balanceDue);
        await recordPayment({
          saleId: s.id,
          farmerId: payModal.farmerId,
          amount: pay,
          paymentMode: payMode,
          notes: payNotes || undefined,
        });
        remaining -= pay;
      }
      toast.success(`₹${amount.toFixed(0)} recorded for ${payModal.farmerName}`);
      setPayModal(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed');
    }
  };

  // ── WhatsApp reminder ──────────────────────────────────────────
  const sendWhatsApp = (mobile: string, name: string, amount: number) => {
    const msg = encodeURIComponent(
      `Namaste ${name} ji 🙏\n\nYeh message aapke dealer ki taraf se hai.\n\n` +
      `Aapke upar ₹${amount.toFixed(0)} ka udhaar pending hai.\n` +
      `Kripya jald settlement karein.\n\nDhanyawad 🌾`
    );
    window.open(`https://wa.me/91${mobile}?text=${msg}`, '_blank');
  };

  // ── Reminder campaign helpers ──────────────────────────────────
  const reminderList = enrichedCreditFarmers.filter((cf) => cf.farmerMobile);
  const currentReminder = reminderList[reminderIndex];

  const openRemindAll = () => {
    setReminderIndex(0);
    setRemindedIds(new Set());
    setReminderOpen(true);
  };

  const handleSendCurrent = () => {
    if (!currentReminder) return;
    sendWhatsApp(currentReminder.farmerMobile, currentReminder.farmerName, currentReminder.totalDue);
    setRemindedIds((prev) => new Set([...prev, currentReminder.farmerId]));
  };

  const goNext = () => {
    if (reminderIndex < reminderList.length - 1) setReminderIndex((i) => i + 1);
    else setReminderOpen(false);
  };

  const goPrev = () => setReminderIndex((i) => Math.max(0, i - 1));

  // ── Recent payments for a farmer ──────────────────────────────
  const getRecentPayments = (farmerId: string) =>
    creditPayments
      .filter((p) => p.farmerId === farmerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-56" />
        <Skeleton className="h-12" />
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-[1100px] space-y-5 p-4 md:p-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t('udhaar.bookTitle')}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('udhaar.subtitleBook')}</p>
          </div>
          {enrichedCreditFarmers.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={openRemindAll}
            >
              <Send className="h-3.5 w-3.5" />
              {t('udhaar.remindAll')} ({reminderList.length})
            </Button>
          )}
        </div>

        {/* ── Stats strip ── */}
        <div className="rounded-lg border border-border bg-card">
          {/* Total row */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('udhaar.totalOutstanding')}</p>
              <AnimatedNumber
                value={totalCreditOutstanding}
                format={(n) => formatINR(n)}
                className="mt-0.5 text-2xl font-bold tabular-nums"
              />
            </div>
            {totalCreditOutstanding > 0 && (
              <div className="w-48">
                <div className="mb-1 flex justify-between text-2xs text-muted-foreground">
                  <span>Overdue</span><span>Current</span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="bg-destructive" style={{ width: `${(overdueAmount / totalCreditOutstanding) * 100}%` }} />
                  <div className="bg-warning"    style={{ width: `${(currentAmount  / totalCreditOutstanding) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
          {/* 4 stats inline */}
          <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: 'Overdue >30d', value: formatINR(overdueAmount), sub: `${overdueItems.length} farmers`, accent: overdueAmount > 0 ? 'text-destructive' : '' },
              { label: 'Current ≤30d', value: formatINR(currentAmount),  sub: `${currentItems.length} farmers`,  accent: 'text-warning' },
              { label: 'Avg days due', value: `${avgDaysOverdue}d`,        sub: 'across all',   accent: '' },
              { label: 'Farmers',      value: String(enrichedCreditFarmers.length), sub: 'with credit', accent: '' },
            ].map(({ label, value, sub, accent }) => (
              <div key={label} className="px-4 py-3">
                <p className="text-2xs text-muted-foreground">{label}</p>
                <p className={cn('mt-0.5 text-sm font-semibold tabular-nums', accent)}>{value}</p>
                <p className="text-2xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filter Tabs + Search + Sort ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Tabs */}
          <div className="flex rounded-lg border border-border bg-muted/40 p-1 gap-1">
            {(['all', 'overdue', 'current'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium capitalize transition-all',
                  filterTab === tab
                    ? 'bg-card shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'all' && `All (${enrichedCreditFarmers.length})`}
                {tab === 'overdue' && (
                  <span className={overdueItems.length > 0 ? 'text-destructive' : ''}>
                    Overdue ({overdueItems.length})
                  </span>
                )}
                {tab === 'current' && `Current (${currentItems.length})`}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, mobile, village..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm h-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              <option value="amount">By Amount</option>
              <option value="days">By Days Due</option>
              <option value="name">By Name</option>
              <option value="date">By Date</option>
            </select>
            <button
              onClick={() => setSortAsc((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Empty State ── */}
        {filteredFarmers.length === 0 && (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">
              {enrichedCreditFarmers.length === 0 ? 'All clear! 🎉' : 'No results'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {enrichedCreditFarmers.length === 0
                ? 'No pending udhaar. All credit has been collected.'
                : 'Try adjusting your search or filter.'}
            </p>
          </Card>
        )}

        {/* ── Farmer Cards ── */}
        <div className="space-y-2">
          {filteredFarmers.map((cf) => {
            const isOverdue = cf.daysOverdue > 30;
            const isExpanded = expandedId === cf.farmerId;
            const recentPayments = getRecentPayments(cf.farmerId);
            const pctPaid =
              cf.totalPaid + cf.totalDue > 0
                ? (cf.totalPaid / (cf.totalPaid + cf.totalDue)) * 100
                : 0;

            return (
              <div
                key={cf.farmerId}
                className={cn(
                  'overflow-hidden rounded-lg border bg-card transition-all duration-150',
                  isOverdue ? 'border-destructive/30' : 'border-border',
                  isExpanded ? 'shadow-sm' : 'hover:border-border/80'
                )}
              >
                <div className="p-4">
                  {/* Top row */}
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {cf.farmerName.charAt(0).toUpperCase()}
                    </div>

                    {/* Name + location */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/farmers/${cf.farmerId_link}`}
                          className="text-sm font-semibold hover:text-primary hover:underline"
                        >
                          {cf.farmerName}
                        </Link>
                        <Badge
                          variant={isOverdue ? 'destructive' : 'secondary'}
                          className="text-2xs px-1.5 py-0"
                        >
                          {isOverdue ? (
                            <><AlertTriangle className="mr-1 h-2.5 w-2.5" />{cf.daysOverdue}d overdue</>
                          ) : (
                            <><Clock className="mr-1 h-2.5 w-2.5" />{cf.daysOverdue}d pending</>
                          )}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />{cf.farmerMobile}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{cf.farmerVillage}{cf.farmerTaluka ? `, ${cf.farmerTaluka}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold tabular-nums">{formatINR(cf.totalDue)}</p>
                      <p className="text-2xs text-muted-foreground">
                        {cf.creditSales.length} bill{cf.creditSales.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2.5">
                    <div className="mb-1 flex justify-between text-2xs text-muted-foreground">
                      <span>Collected {formatINR(cf.totalPaid)}</span>
                      <span>{pctPaid.toFixed(0)}% paid</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pctPaid}%` }} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-1.5">
                    <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => openPayModal(cf)}>
                      <IndianRupee className="h-3 w-3" />
                      Record Payment
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                      onClick={() => sendWhatsApp(cf.farmerMobile, cf.farmerName, cf.totalDue)}
                      disabled={!cf.farmerMobile}>
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </Button>
                    <a href={`tel:${cf.farmerMobile}`}>
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                        <Phone className="h-3 w-3" />
                        Call
                      </Button>
                    </a>
                    <button
                      className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setExpandedId(isExpanded ? null : cf.farmerId)}
                    >
                      Details
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* ── Expanded: pending bills + payment history ── */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-4 space-y-4">

                    {/* Pending bills */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Pending Bills
                      </p>
                      <div className="space-y-1.5">
                        {cf.creditSales.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                          >
                            <div>
                              <p className="text-xs font-medium">
                                {new Date(s.createdAt).toLocaleDateString('en-IN', {
                                  day: 'numeric', month: 'short', year: 'numeric',
                                })}
                              </p>
                              <p className="text-2xs text-muted-foreground">
                                Bill total: {formatINR(s.initialBalanceDue)} · ID: {s.id.slice(-6)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-destructive">
                                {formatINR(s.balanceDue)}
                              </p>
                              <p className="text-2xs text-muted-foreground">pending</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent payments */}
                    {recentPayments.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Recent Payments
                        </p>
                        <div className="space-y-1.5">
                          {recentPayments.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                {p.paymentMode === 'upi' ? (
                                  <Smartphone className="h-3.5 w-3.5 text-info" />
                                ) : (
                                  <Banknote className="h-3.5 w-3.5 text-primary" />
                                )}
                                <div>
                                  <p className="text-xs font-medium capitalize">{p.paymentMode}</p>
                                  <p className="text-2xs text-muted-foreground">
                                    {new Date(p.createdAt).toLocaleDateString('en-IN', {
                                      day: 'numeric', month: 'short',
                                    })}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm font-semibold text-primary">
                                +{formatINR(p.amount)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Link href={`/farmers/${cf.farmerId_link}`}>
                      <Button size="sm" variant="outline" className="w-full h-7 gap-1.5 text-xs">
                        <FileText className="h-3.5 w-3.5" />
                        View Full Farmer Profile
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Reminder Campaign Modal ── */}
      {reminderOpen && currentReminder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="text-base font-semibold">Reminder Campaign</h2>
                <p className="text-xs text-muted-foreground">
                  {reminderIndex + 1} of {reminderList.length} farmers
                </p>
              </div>
              <button
                onClick={() => setReminderOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((reminderIndex + 1) / reminderList.length) * 100}%` }}
              />
            </div>

            <div className="p-5 space-y-4">
              {/* Farmer info */}
              <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                  {currentReminder.farmerName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{currentReminder.farmerName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />{currentReminder.farmerMobile}
                    &nbsp;·&nbsp;
                    <MapPin className="h-3 w-3" />{currentReminder.farmerVillage}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-destructive tabular-nums">
                    {formatINR(currentReminder.totalDue)}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    {currentReminder.daysOverdue}d pending
                  </p>
                </div>
              </div>

              {/* Message preview */}
              <div className="rounded-xl border border-border bg-[#dcf8c6]/20 p-4">
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  WhatsApp Message Preview
                </p>
                <p className="whitespace-pre-line text-xs text-foreground leading-relaxed">
                  {`Namaste ${currentReminder.farmerName} ji 🙏\n\nYeh message aapke dealer ki taraf se hai.\n\nAapke upar ₹${currentReminder.totalDue.toFixed(0)} ka udhaar pending hai.\nKripya jald settlement karein.\n\nDhanyawad 🌾`}
                </p>
              </div>

              {/* Sent indicator */}
              {remindedIds.has(currentReminder.farmerId) && (
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  Reminder sent! You can now go to the next farmer.
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="space-y-2 border-t border-border p-5">
              <Button
                className="w-full gap-2"
                onClick={handleSendCurrent}
              >
                <MessageCircle className="h-4 w-4" />
                {remindedIds.has(currentReminder.farmerId) ? 'Re-send on WhatsApp' : 'Send on WhatsApp'}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={goPrev}
                  disabled={reminderIndex === 0}
                >
                  <ChevronUp className="h-3.5 w-3.5 -rotate-90" />
                  Previous
                </Button>
                <Button
                  variant={remindedIds.has(currentReminder.farmerId) ? 'default' : 'outline'}
                  className="flex-1 gap-1"
                  onClick={goNext}
                >
                  {reminderIndex === reminderList.length - 1 ? (
                    <>Done <CheckCircle2 className="h-3.5 w-3.5" /></>
                  ) : (
                    <>Next <ChevronDown className="h-3.5 w-3.5 rotate-90" /></>
                  )}
                </Button>
              </div>
              <p className="text-center text-2xs text-muted-foreground">
                {remindedIds.size} of {reminderList.length} reminders sent
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {payModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setPayModal(null)}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="text-base font-semibold">Record Payment</h2>
                <p className="text-xs text-muted-foreground">{payModal.farmerName}</p>
              </div>
              <button
                onClick={() => setPayModal(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Outstanding summary */}
              <div className="rounded-xl bg-destructive/8 border border-destructive/20 p-4 text-center">
                <p className="text-xs text-muted-foreground">{t('udhaar.totalOutstanding')}</p>
                <p className="mt-0.5 text-3xl font-bold text-destructive tabular-nums">
                  {formatINR(payModal.totalDue)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Across {payModal.sales.length} bill{payModal.sales.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Amount input */}
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Amount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="pl-7 text-lg font-bold tabular-nums"
                    placeholder="0"
                    min={1}
                    max={payModal.totalDue}
                  />
                </div>
                {/* Quick amount chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[payModal.totalDue, payModal.totalDue / 2, 500, 1000, 2000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setPayAmount(Math.min(amt, payModal.totalDue).toFixed(0))}
                      className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs hover:bg-muted"
                    >
                      {amt === payModal.totalDue ? 'Full' : formatINR(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment mode */}
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPayMode('cash')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all',
                      payMode === 'cash'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Banknote className="h-4 w-4" />
                    Cash
                  </button>
                  <button
                    onClick={() => setPayMode('upi')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all',
                      payMode === 'upi'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Smartphone className="h-4 w-4" />
                    UPI
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  placeholder="e.g. Partial payment, cheque no..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-border p-5">
              <Button variant="outline" className="flex-1" onClick={() => setPayModal(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleRecordPayment}
                disabled={isRecordingPayment || !payAmount || parseFloat(payAmount) <= 0}
              >
                {isRecordingPayment ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Recording...
                  </span>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Payment
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
