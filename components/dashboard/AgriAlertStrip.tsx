'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchExpiringBatchesRpc } from '@/lib/supabase/product-batches';
import { countPendingWaOrders } from '@/lib/supabase/wa-inbox';
import { listCropCycles } from '@/lib/supabase/crop-cycles';
import { cn } from '@/lib/utils';

export function AgriAlertStrip() {
  const { session } = useAuth();
  const dealerRowId = session?.dealerRowId ?? '';

  const batches = useQuery({
    queryKey: ['dash-exp-batches', dealerRowId],
    queryFn: () => fetchExpiringBatchesRpc(dealerRowId, 30),
    enabled: !!dealerRowId,
  });

  const wa = useQuery({
    queryKey: ['dash-wa-pending', dealerRowId],
    queryFn: () => countPendingWaOrders(dealerRowId),
    enabled: !!dealerRowId,
  });

  const crops = useQuery({
    queryKey: ['dash-crops', dealerRowId],
    queryFn: async () => {
      const rows = await listCropCycles(dealerRowId, null);
      const today = new Date().toISOString().slice(0, 10);
      const limit = new Date();
      limit.setDate(limit.getDate() + 7);
      const lim = limit.toISOString().slice(0, 10);
      return rows.filter((r) => r.status === 'ACTIVE' && r.expected_harvest >= today && r.expected_harvest <= lim);
    },
    enabled: !!dealerRowId,
  });

  const expVal = (batches.data ?? []).reduce((s, r) => s + Number(r.estimated_value ?? 0), 0);
  const items = [
    batches.data?.length
      ? {
          href: '/inventory/batches?filter=expiring',
          icon: '⚠️',
          title: 'Batches expiring soon',
          subtitle: `${batches.data.length} · ₹${expVal.toLocaleString('en-IN', { minimumFractionDigits: 0 })} at risk`,
          tone: 'border-l-warning',
        }
      : null,
    crops.data?.length
      ? {
          href: '/crop-cycles',
          icon: '🌾',
          title: 'Harvests this week',
          subtitle: `${crops.data.length} active crop cycle(s)`,
          tone: 'border-l-emerald-600',
        }
      : null,
    (wa.data ?? 0) > 0
      ? {
          href: '/whatsapp',
          icon: '📱',
          title: 'Pending WhatsApp orders',
          subtitle: `${wa.data} to review`,
          tone: 'border-l-primary',
        }
      : null,
  ].filter(Boolean) as {
    href: string;
    icon: string;
    title: string;
    subtitle: string;
    tone: string;
  }[];

  if (!items.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((x) => (
        <Link
          key={x.href}
          href={x.href}
          className={cn(
            'rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm transition-colors hover:bg-accent/40',
            'border-l-4',
            x.tone
          )}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg" aria-hidden>
              {x.icon}
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">{x.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{x.subtitle}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
