'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { listWhatsAppMessages, updateWaMessageStatus } from '@/lib/supabase/wa-inbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTransition } from '@/components/common/PageTransition';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function WhatsAppInboxPage() {
  const { session } = useAuth();
  const dealerRowId = session?.dealerRowId ?? '';
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['wa-inbox', dealerRowId],
    queryFn: () => listWhatsAppMessages(dealerRowId),
    enabled: !!dealerRowId,
  });

  const pending = (q.data ?? []).filter((m) => m.status === 'RECEIVED' || m.status === 'PARSED');

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">WhatsApp inbox</h1>
            <p className="text-sm text-muted-foreground">
              Pending: {pending.length}. Configure Cloud API on the setup page.
            </p>
          </div>
          <Link href="/whatsapp/setup">
            <Button size="sm" variant="outline">
              Setup
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {(q.data ?? []).map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-1">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{m.from_number}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {formatDistanceToNow(new Date(m.received_at), { addSuffix: true })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="whitespace-pre-wrap text-foreground">{m.message_text}</p>
                {m.parsed_order ? (
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-2 text-xs">
                    {JSON.stringify(m.parsed_order, null, 2)}
                  </pre>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void updateWaMessageStatus(m.id, 'CONFIRMED')
                        .then(() => {
                          toast.success('Marked confirmed');
                          void qc.invalidateQueries({ queryKey: ['wa-inbox'] });
                        })
                        .catch(() => toast.error('Update failed'))
                    }
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void updateWaMessageStatus(m.id, 'REJECTED')
                        .then(() => {
                          toast.message('Rejected');
                          void qc.invalidateQueries({ queryKey: ['wa-inbox'] });
                        })
                        .catch(() => toast.error('Update failed'))
                    }
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!q.data?.length && !q.isLoading ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No messages yet. Paste webhook URL in Meta after migration Phase G.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </PageTransition>
  );
}
