'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTransition } from '@/components/common/PageTransition';
import { formatTallyDate } from '@/lib/tally-format';
import { countEnrollmentsByScheme, listActiveSchemes } from '@/lib/supabase/schemes';

export default function SchemesHubPage() {
  const { session } = useAuth();
  const dealerRowId = session?.dealerRowId ?? '';

  const q = useQuery({
    queryKey: ['schemes-hub', dealerRowId],
    queryFn: async () => {
      const schemes = await listActiveSchemes(dealerRowId);
      const counts = await countEnrollmentsByScheme(dealerRowId);
      return schemes.map((s) => ({ ...s, farmer_count: counts.get(s.id) ?? 0 }));
    },
    enabled: !!dealerRowId,
  });

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Subsidy & Scheme Tracker</h1>
            <p className="text-sm text-muted-foreground">National templates plus your dealer-specific schemes.</p>
          </div>
          <Button variant="outline" size="sm" disabled className="gap-1">
            <Plus className="h-4 w-4" />
            Add Scheme (admin)
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active schemes ({q.data?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Scheme</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium text-right">Farmers</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(q.data ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="px-4 py-2 font-medium">{s.scheme_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.scheme_type}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.farmer_count}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {s.deadline_date ? `Deadline: ${formatTallyDate(s.deadline_date)}` : 'Open'}
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/schemes/${s.id}/enroll`} className="text-primary underline-offset-4 hover:underline">
                        Enroll
                      </Link>
                    </td>
                  </tr>
                ))}
                {!q.data?.length && !q.isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Run migration Phase G or refresh — no schemes loaded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
