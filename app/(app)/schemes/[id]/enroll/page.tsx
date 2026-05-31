'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { enrollFarmersBulk, listActiveSchemes } from '@/lib/supabase/schemes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PageTransition } from '@/components/common/PageTransition';
import { toast } from 'sonner';

type Props = { params: Promise<{ id: string }> };

export default function SchemeEnrollPage({ params }: Props) {
  const { id: schemeId } = use(params);
  const { session } = useAuth();
  const dealerRowId = session?.dealerRowId ?? '';
  const dealerSlug = session?.dealerId ?? '';
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const schemesQ = useQuery({
    queryKey: ['schemes', dealerRowId],
    queryFn: () => listActiveSchemes(dealerRowId),
    enabled: !!dealerRowId,
  });

  const scheme = schemesQ.data?.find((s) => s.id === schemeId);

  const farmersQ = useQuery({
    queryKey: ['farmers-enroll', dealerSlug],
    queryFn: async () => {
      const { data, error } = await supabase.from('farmers').select('id, full_name, village, mobile').eq('dealer_id', dealerSlug).order('full_name');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!dealerSlug,
  });

  const enrolledQ = useQuery({
    queryKey: ['scheme-enrolled', schemeId, dealerRowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmer_scheme_enrollments')
        .select('farmer_id, status')
        .eq('scheme_id', schemeId)
        .eq('dealer_id', dealerRowId);
      if (error) throw new Error(error.message);
      return new Map((data ?? []).map((r: { farmer_id: string; status: string }) => [r.farmer_id, r.status]));
    },
    enabled: !!schemeId && !!dealerRowId,
  });

  const rows = farmersQ.data ?? [];
  const enrolled = enrolledQ.data ?? new Map();

  const toggle = (fid: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(fid)) n.delete(fid);
      else n.add(fid);
      return n;
    });
  };

  const enrollSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      await enrollFarmersBulk(dealerRowId, schemeId, ids, 'ENROLLED');
      toast.success(`Enrolled ${ids.length} farmer(s)`);
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ['scheme-enrolled', schemeId] });
      void qc.invalidateQueries({ queryKey: ['schemes-hub'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Enroll failed');
    }
  };

  const title = useMemo(() => scheme?.scheme_name ?? 'Scheme', [scheme]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">Bulk enroll farmers for this scheme.</p>
          </div>
          <Link href="/schemes" className="text-sm text-primary underline-offset-4 hover:underline">
            Back
          </Link>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Farmers</CardTitle>
            <Button size="sm" disabled={!selected.size} onClick={() => void enrollSelected()}>
              Enroll selected ({selected.size})
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.map((f: { id: string; full_name: string; village: string | null; mobile: string | null }) => (
              <label key={f.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-border/80 p-2 hover:bg-muted/40">
                <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} disabled={!!enrolled.has(f.id)} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{f.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.village ?? '—'} · {f.mobile ?? '—'}
                  </div>
                  {enrolled.has(f.id) ? (
                    <div className="text-2xs mt-1 text-primary">Already: {enrolled.get(f.id)}</div>
                  ) : null}
                </div>
              </label>
            ))}
            {!rows.length && !farmersQ.isLoading ? (
              <p className="text-sm text-muted-foreground">No farmers found for this shop.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
