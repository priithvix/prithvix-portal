'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { listProductBatches, fetchExpiringBatchesRpc } from '@/lib/supabase/product-batches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTransition } from '@/components/common/PageTransition';
import { formatTallyDate } from '@/lib/tally-format';
import { Badge } from '@/components/ui/badge';

export default function BatchTrackingPage() {
  const { session } = useAuth();
  const dealerRowId = session?.dealerRowId ?? '';
  const [filter, setFilter] = useState<'all' | 'expiring' | 'expired'>('all');

  const q = useQuery({
    queryKey: ['product-batches', dealerRowId],
    queryFn: () => listProductBatches(dealerRowId),
    enabled: !!dealerRowId,
  });

  const exp = useQuery({
    queryKey: ['exp-batches', dealerRowId],
    queryFn: () => fetchExpiringBatchesRpc(dealerRowId, 60),
    enabled: !!dealerRowId,
  });

  const today = new Date().toISOString().slice(0, 10);
  const rows = (q.data ?? []).filter((b) => {
    const expi = b.expiry_date.slice(0, 10);
    if (filter === 'expiring') return expi >= today && expi <= addDays(today, 30) && b.quantity_remaining > 0;
    if (filter === 'expired') return expi < today;
    return true;
  });

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Batch inventory</h1>
            <p className="text-sm text-muted-foreground">Expiry-led FIFO visibility for traceability.</p>
          </div>
          <div className="flex gap-2 text-sm">
            {(['all', 'expiring', 'expired'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`rounded-md border px-3 py-1 capitalize ${filter === f ? 'border-primary bg-primary/10' : 'border-border'}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'expiring' ? 'Expiring soon' : 'Expired'}
              </button>
            ))}
          </div>
        </div>

        {exp.data?.length ? (
          <Card className="border-warning/40 bg-warning/5">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">Expiring in ~30–60 days (RPC)</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {exp.data.length} batch(es). Estimated risk ₹
              {exp.data.reduce((s, x) => s + Number(x.estimated_value ?? 0), 0).toLocaleString('en-IN')}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">Expiry</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const expi = b.expiry_date.slice(0, 10);
                  const days = Math.ceil((new Date(expi).getTime() - new Date(today).getTime()) / 86400000);
                  const status =
                    expi < today ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : days <= 30 ? (
                      <Badge variant="secondary">{days}d</Badge>
                    ) : (
                      <Badge variant="outline">OK</Badge>
                    );
                  const pname =
                    (b.product_master as { product_name?: string } | null)?.product_name ?? b.product_id.slice(0, 8);
                  return (
                    <tr key={b.id} className="border-b border-border/60">
                      <td className="px-3 py-2">{pname}</td>
                      <td className="px-3 py-2 font-mono text-xs">{b.batch_number}</td>
                      <td className="px-3 py-2 tabular-nums">{formatTallyDate(expi)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(b.quantity_remaining).toFixed(3)}</td>
                      <td className="px-3 py-2">{status}</td>
                    </tr>
                  );
                })}
                {!rows.length && !q.isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No batches — apply migration Phase G and record GRN batches.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/whatsapp/setup" className="underline-offset-4 hover:underline">
            WhatsApp setup
          </Link>
        </p>
      </div>
    </PageTransition>
  );
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
