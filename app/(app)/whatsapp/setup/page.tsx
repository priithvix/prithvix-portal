'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTransition } from '@/components/common/PageTransition';
import { toast } from 'sonner';

export default function WhatsAppSetupPage() {
  const webhookUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/api/whatsapp/webhook`;
  }, []);

  return (
    <PageTransition>
      <div className="mx-auto max-w-lg space-y-4 p-4 md:p-6">
        <Link href="/whatsapp" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Inbox
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">WhatsApp Cloud API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Copy this callback URL into Meta Developer Console → WhatsApp → Configuration.</p>
            <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs text-foreground break-all">{webhookUrl}</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void navigator.clipboard.writeText(webhookUrl).then(() => toast.success('Copied webhook URL'))
              }
            >
              Copy webhook URL
            </Button>
            <div className="space-y-1 text-xs">
              <p>
                <code className="rounded bg-muted px-1">WHATSAPP_VERIFY_TOKEN</code> — Meta verify token
              </p>
              <p>
                <code className="rounded bg-muted px-1">WHATSAPP_APP_SECRET</code> — App secret (signature)
              </p>
              <p>
                <code className="rounded bg-muted px-1">SUPABASE_SERVICE_ROLE_KEY</code> — server inserts (webhook)
              </p>
              <p>
                <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> — optional parsing
              </p>
            </div>
            <p className="text-xs">
              Store Cloud API token + phone_number_id on the dealer row (<code className="rounded bg-muted px-1">wa_access_token</code>,{' '}
              <code className="rounded bg-muted px-1">wa_phone_number_id</code>) via Supabase after migration.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
