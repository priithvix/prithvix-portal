'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfDay, endOfDay } from 'date-fns';
import {
  Download,
  Calendar as CalendarIcon,
  TrendingUp,
  Banknote,
  Smartphone,
  CreditCard,
  IndianRupee,
  ArrowDown,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSales } from '@/contexts/SalesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  printDailyClose,
  type DailyCloseData,
} from '@/components/pdf/DailyClosePDF';
import { useLanguage } from '@/contexts/LanguageContext';

function paymentBadgeClass(mode: string): string {
  if (mode === 'upi') return 'border-border text-info';
  if (mode === 'credit') return 'border-border text-warning';
  return 'border-border text-foreground';
}

function paymentModeLabel(mode: string, t: (key: string) => string): string {
  if (mode === 'upi') return t('sales.upi');
  if (mode === 'credit') return t('sales.credit');
  return t('sales.cash');
}

export default function DailyClosePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { sales, creditPayments, salesLoading } = useSales();
  const { farmers, isLoading: farmersLoading } = useData();
  const { dealer } = useAuth();

  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [expenses, setExpenses] = useState(0);
  const [safeDeposit, setSafeDeposit] = useState(0);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [creditCollected, setCreditCollected] = useState(0);

  const dayData = useMemo(() => {
    const dayStart = startOfDay(new Date(selectedDate));
    const dayEnd = endOfDay(new Date(selectedDate));

    const daySales = sales.filter((s) => {
      const d = new Date(s.createdAt);
      return d >= dayStart && d <= dayEnd;
    });

    const itemMap = new Map<
      string,
      {
        itemName: string;
        unit: string;
        totalQty: number;
        pricePerUnit: number;
        totalAmount: number;
        gstPercent: number;
      }
    >();

    daySales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = itemMap.get(item.itemName);
        if (existing) {
          existing.totalQty += item.quantity;
          existing.totalAmount += item.totalAmount;
        } else {
          itemMap.set(item.itemName, {
            itemName: item.itemName,
            unit: item.unit,
            totalQty: item.quantity,
            pricePerUnit: item.pricePerUnit,
            totalAmount: item.totalAmount,
            gstPercent: item.gstPercent,
          });
        }
      });
    });

    const soldItems = Array.from(itemMap.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );

    const dayPayments = creditPayments.filter((p) => {
      const d = new Date(p.createdAt);
      return d >= dayStart && d <= dayEnd;
    });

    const computedCreditCollected = dayPayments.reduce(
      (sum, p) => sum + p.amount,
      0
    );

    const cashSales = daySales
      .filter((s) => s.paymentMode === 'cash')
      .reduce((sum, s) => sum + s.finalAmount, 0);
    const upiSales = daySales
      .filter((s) => s.paymentMode === 'upi')
      .reduce((sum, s) => sum + s.finalAmount, 0);
    const creditSales = daySales
      .filter((s) => s.paymentMode === 'credit')
      .reduce((sum, s) => sum + s.finalAmount, 0);

    const totalSales = cashSales + upiSales + creditSales;
    const totalProfit = daySales.reduce(
      (sum, s) => sum + s.profitAfterDiscount,
      0
    );
    const totalDiscount = daySales.reduce(
      (sum, s) => sum + s.discountAmount,
      0
    );
    const grossRevenue = daySales.reduce((sum, s) => sum + s.subtotal, 0);

    return {
      daySales,
      soldItems,
      dayPayments,
      computedCreditCollected,
      cashSales,
      upiSales,
      creditSales,
      totalProfit,
      totalDiscount,
      grossRevenue,
      transactionCount: daySales.length,
      farmerCount: new Set(daySales.map((s) => s.farmerId)).size,
    };
  }, [sales, creditPayments, selectedDate]);

  useEffect(() => {
    setCreditCollected(dayData.computedCreditCollected);
  }, [selectedDate, dayData.computedCreditCollected]);

  const totalSales = dayData.cashSales + dayData.upiSales + dayData.creditSales;
  const totalCash = dayData.cashSales + creditCollected;
  const cashInHand = totalCash - expenses - safeDeposit;
  const marginPct =
    totalSales > 0 ? (dayData.totalProfit / totalSales) * 100 : 0;

  const recentSales = useMemo(() => {
    const sorted = [...dayData.daySales].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sorted.slice(0, 5);
  }, [dayData.daySales]);

  const handleGenerate = () => {
    if (!dealer) {
      toast.error(t('close.errorDealerUnavailable'));
      return;
    }

    setGenerating(true);
    try {
      const dailyCloseData: DailyCloseData = {
        reportDate: selectedDate,
        cashSales: dayData.cashSales,
        digitalSales: dayData.upiSales,
        creditSales: dayData.creditSales,
        creditCollected,
        totalSales,
        totalCash,
        expenses,
        safeDeposit,
        cashInHand,
        notes,
        grossRevenue: dayData.grossRevenue,
        totalDiscount: dayData.totalDiscount,
        totalProfit: dayData.totalProfit,
        transactionCount: dayData.transactionCount,
        farmerCount: dayData.farmerCount,
        soldItems: dayData.soldItems,
        daySales: dayData.daySales.map((s) => ({
          id: s.id,
          farmerName:
            farmers.find((f) => f.id === s.farmerId)?.fullName ||
            t('common.unknown'),
          paymentMode: s.paymentMode,
          finalAmount: s.finalAmount,
          balanceDue: s.balanceDue,
          itemCount: s.items.length,
          createdAt: s.createdAt,
        })),
      };

      printDailyClose(dailyCloseData, dealer);
      toast.success(t('close.successReportOpened'));
    } finally {
      setGenerating(false);
    }
  };

  const loading = salesLoading || farmersLoading;

  if (loading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('close.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('close.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]">
        {/* LEFT */}
        <div className="space-y-8">
          <section className="space-y-3">
            <Label
              htmlFor="reportDate"
              className="text-sm font-medium text-foreground"
            >
              {t('close.reportDate')}
            </Label>
            <Input
              id="reportDate"
              type="date"
              value={selectedDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-12 max-w-md text-base"
            />
            <p className="text-sm text-muted-foreground">
              {dayData.transactionCount} {t('close.transactions')} ·{' '}
              {dayData.farmerCount} {t('close.farmersServed')}
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('close.salesBreakdown')}
            </p>
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="px-3 text-center first:pl-0 last:pr-0">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5 shrink-0" />
                  {t('sales.cash')}
                </div>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  ₹{dayData.cashSales.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="px-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5 shrink-0" />
                  {t('sales.upi')}
                </div>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  ₹{dayData.upiSales.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="px-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5 shrink-0" />
                  {t('close.creditGiven')}
                </div>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  ₹{dayData.creditSales.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              {t('close.itemsSoldToday')}
            </h2>
            {dayData.soldItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('close.noSalesForDate')}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 text-left font-medium text-muted-foreground">
                        {t('close.tableItem')}
                      </th>
                      <th className="py-2 pr-3 text-right font-medium text-muted-foreground">
                        {t('sales.quantity')}
                      </th>
                      <th className="py-2 pr-3 text-right font-medium text-muted-foreground">
                        {t('close.tableUnit')}
                      </th>
                      <th className="py-2 pr-3 text-right font-medium text-muted-foreground">
                        {t('sales.rate')}
                      </th>
                      <th className="py-2 text-right font-medium text-muted-foreground">
                        {t('common.amount')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayData.soldItems.map((item) => (
                      <tr
                        key={item.itemName}
                        className="border-b border-border/50"
                      >
                        <td className="py-2 pr-3 font-medium text-foreground">
                          {item.itemName}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {item.totalQty}
                        </td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">
                          {item.unit}
                        </td>
                        <td className="py-2 pr-3 text-right text-muted-foreground tabular-nums">
                          ₹{item.pricePerUnit.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums text-foreground">
                          ₹{item.totalAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td
                        colSpan={4}
                        className="pt-2 font-bold text-foreground"
                      >
                        {t('close.totalItemsSold')}
                      </td>
                      <td className="pt-2 text-right font-bold text-primary tabular-nums">
                        ₹{totalSales.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              {t('close.cashReconciliation')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="creditCollected">{t('udhaar.collected')}</Label>
                <Input
                  id="creditCollected"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={Number.isNaN(creditCollected) ? '' : creditCollected}
                  onChange={(e) =>
                    setCreditCollected(parseFloat(e.target.value) || 0)
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="expenses">{t('close.expenses')}</Label>
                <Input
                  id="expenses"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={Number.isNaN(expenses) ? '' : expenses}
                  onChange={(e) =>
                    setExpenses(parseFloat(e.target.value) || 0)
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="safeDeposit">{t('close.safeDeposit')}</Label>
                <Input
                  id="safeDeposit"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={Number.isNaN(safeDeposit) ? '' : safeDeposit}
                  onChange={(e) =>
                    setSafeDeposit(parseFloat(e.target.value) || 0)
                  }
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {t('close.cashInHand')}
              </p>
              <p
                className={
                  cashInHand >= 0
                    ? 'mt-1 text-2xl font-bold tabular-nums text-primary'
                    : 'mt-1 text-2xl font-bold tabular-nums text-destructive'
                }
              >
                ₹{cashInHand.toLocaleString('en-IN')}
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <Label htmlFor="notes">{t('close.notesOptional')}</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder={t('close.notesPlaceholder')}
            />
            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              disabled={generating}
              onClick={handleGenerate}
            >
              <Download className="mr-2 h-5 w-5" />
              {generating ? t('close.generating') : t('close.generateReport')}
            </Button>
          </section>
        </div>

        {/* RIGHT — sticky summary */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('close.plSnapshot')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selectedDate), 'dd MMM yyyy')}
                </p>
              </div>
            </div>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('close.grossRevenue')}</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  ₹{dayData.grossRevenue.toLocaleString('en-IN')}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('close.discountGiven')}</dt>
                <dd className="font-medium tabular-nums text-destructive">
                  -₹{dayData.totalDiscount.toLocaleString('en-IN')}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="font-medium text-foreground">{t('close.totalSales')}</dt>
                <dd className="text-lg font-bold tabular-nums text-primary">
                  ₹{totalSales.toLocaleString('en-IN')}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('close.estimatedProfit')}</dt>
                <dd
                  className={
                    dayData.totalProfit > 0
                      ? 'font-semibold tabular-nums text-success'
                      : 'font-semibold tabular-nums text-foreground'
                  }
                >
                  ₹{dayData.totalProfit.toLocaleString('en-IN')}
                </dd>
              </div>
              <div className="flex justify-between gap-4 text-xs">
                <dt className="text-muted-foreground">{t('close.margin')}</dt>
                <dd className="tabular-nums text-muted-foreground">
                  {marginPct.toFixed(1)}%
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                {t('close.cashFlow')}
              </p>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('close.cashReceived')}</dt>
                <dd className="tabular-nums text-foreground">
                  ₹{dayData.cashSales.toLocaleString('en-IN')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('close.creditCollectedLine')}</dt>
                <dd className="tabular-nums text-foreground">
                  ₹{creditCollected.toLocaleString('en-IN')}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-medium">
                <dt className="text-foreground">{t('close.totalCashIn')}</dt>
                <dd className="tabular-nums text-foreground">
                  ₹{totalCash.toLocaleString('en-IN')}
                </dd>
              </div>
              <div className="flex justify-between text-destructive">
                <dt>{t('close.minusExpenses')}</dt>
                <dd className="tabular-nums">
                  -₹{expenses.toLocaleString('en-IN')}
                </dd>
              </div>
              <div className="flex justify-between text-destructive">
                <dt>{t('close.minusSafeDeposit')}</dt>
                <dd className="tabular-nums">
                  -₹{safeDeposit.toLocaleString('en-IN')}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="font-semibold text-foreground">
                  {t('close.equalsCashInHand')}
                </dt>
                <dd
                  className={
                    cashInHand >= 0
                      ? 'text-xl font-bold tabular-nums text-primary'
                      : 'text-xl font-bold tabular-nums text-destructive'
                  }
                >
                  ₹{cashInHand.toLocaleString('en-IN')}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">
                  {t('close.todaysSales')}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {t('close.lastFive')}
              </span>
            </div>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('close.noSalesThisDay')}
              </p>
            ) : (
              <ul className="space-y-2">
                {recentSales.map((s) => {
                  const farmer = farmers.find((f) => f.id === s.farmerId);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/farmers/${s.farmerId}`)}
                        className="flex w-full items-start justify-between gap-2 rounded-md border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">
                            {farmer?.fullName ?? t('close.farmerFallback')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(s.createdAt),
                              'hh:mm a'
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="font-semibold tabular-nums text-foreground">
                            ₹{s.finalAmount.toLocaleString('en-IN')}
                          </span>
                          <span
                            className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase ${paymentBadgeClass(s.paymentMode)}`}
                          >
                            {paymentModeLabel(s.paymentMode, t)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <FileText className="h-4 w-4 shrink-0" />
        <span>{t('close.printPdfHint')}</span>
      </div>
    </div>
  );
}
