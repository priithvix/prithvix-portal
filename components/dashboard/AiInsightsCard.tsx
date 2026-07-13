'use client';

import { useCallback, useMemo, useState } from 'react';
import { Sparkles, RefreshCw, Loader2, Package, TrendingUp, IndianRupee, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useSales } from '@/contexts/SalesContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Insight {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  category: 'restock' | 'sales' | 'credit' | 'compliance';
}

const categoryIcon: Record<Insight['category'], typeof Package> = {
  restock: Package,
  sales: TrendingUp,
  credit: IndianRupee,
  compliance: ShieldAlert,
};

const priorityTone: Record<Insight['priority'], string> = {
  high: 'border-l-destructive',
  medium: 'border-l-warning',
  low: 'border-l-emerald-600',
};

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.round(diff / 86400000);
}

export function AiInsightsCard() {
  const { dealer } = useAuth();
  const { activeItems, isLoading: inventoryLoading } = useInventory();
  const { sales, getCreditFarmers, salesLoading } = useSales();
  const { farmers, isLoading: dataLoading } = useData();

  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'unavailable'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isLoading = inventoryLoading || salesLoading || dataLoading;

  const farmerName = useMemo(() => {
    const m = new Map(farmers.map((f) => [f.id, f.fullName]));
    return (id: string) => m.get(id) ?? 'Unknown farmer';
  }, [farmers]);

  const buildSummary = useCallback(() => {
    const now = Date.now();
    const DAY = 86400000;

    const salesWindow = (fromDaysAgo: number, toDaysAgo: number) => {
      const bucket = new Map<string, { qty: number; revenue: number }>();
      for (const s of sales) {
        const age = (now - new Date(s.createdAt).getTime()) / DAY;
        if (age < toDaysAgo || age >= fromDaysAgo) continue;
        for (const it of s.items) {
          const cur = bucket.get(it.itemName) ?? { qty: 0, revenue: 0 };
          cur.qty += it.quantity;
          cur.revenue += it.quantity * it.priceExGst;
          bucket.set(it.itemName, cur);
        }
      }
      return [...bucket.entries()].map(([name, v]) => ({ name, qty: Math.round(v.qty * 100) / 100, revenue: Math.round(v.revenue) }));
    };

    const creditFarmers = getCreditFarmers()
      .sort((a, b) => b.totalDue - a.totalDue)
      .slice(0, 8)
      .map((c) => ({
        farmerName: farmerName(c.farmerId),
        amount: Math.round(c.totalDue),
        daysOverdue: c.daysOverdue,
      }));

    const licenseExpiries = (
      [
        ['Fertilizer', dealer?.fertilizer_license_valid_until],
        ['Pesticide', dealer?.pesticide_license_valid_until],
        ['Seed', dealer?.seed_license_valid_until],
      ] as [string, string | undefined][]
    )
      .map(([type, date]) => ({ type, daysLeft: daysUntil(date) }))
      .filter((x): x is { type: string; daysLeft: number } => x.daysLeft !== null && x.daysLeft < 60);

    return {
      dealerName: dealer?.company_name ?? 'this shop',
      today: new Date().toISOString().slice(0, 10),
      inventory: activeItems.map((i) => ({
        name: i.name,
        category: i.category,
        stock: Math.round(i.stock * 100) / 100,
        unit: i.baseUnit,
        reorderLevel: Math.round(i.reorderLevel * 100) / 100,
      })),
      salesLast30d: salesWindow(30, 0),
      salesPrev30d: salesWindow(60, 30),
      creditOutstanding: creditFarmers,
      licenseExpiries,
    };
  }, [activeItems, sales, getCreditFarmers, farmerName, dealer]);

  const fetchInsights = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSummary()),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          setStatus('unavailable');
          return;
        }
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setInsights(data.insights ?? []);
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Failed to generate insights');
    }
  }, [buildSummary]);

  if (isLoading) return null;
  if (status === 'unavailable') return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          AI Insights
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchInsights}
          disabled={status === 'loading'}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {status === 'loading' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          {insights ? 'Refresh' : 'Generate'}
        </Button>
      </CardHeader>
      <CardContent>
        {!insights && status === 'idle' && (
          <button
            onClick={fetchInsights}
            className="w-full rounded-lg border border-dashed border-border/80 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Tap to analyse your inventory, sales &amp; credit — get purchase and business recommendations.
          </button>
        )}
        {status === 'loading' && !insights && (
          <div className="space-y-2">
            {[0, 1, 2].map((k) => (
              <div key={k} className="h-14 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        )}
        {status === 'error' && (
          <p className="text-sm text-destructive">{errorMsg || 'Could not generate insights right now.'}</p>
        )}
        {insights && insights.length === 0 && status === 'idle' && (
          <p className="text-sm text-muted-foreground">No notable insights right now — everything looks steady.</p>
        )}
        {insights && insights.length > 0 && (
          <div className="space-y-2">
            {insights.map((ins, idx) => {
              const Icon = categoryIcon[ins.category] ?? Sparkles;
              return (
                <div
                  key={idx}
                  className={cn(
                    'rounded-lg border border-border/70 border-l-4 bg-card/60 p-3',
                    priorityTone[ins.priority]
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{ins.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{ins.detail}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
