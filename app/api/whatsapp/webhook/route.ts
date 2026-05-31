import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/whatsapp/verify';
import { sendWhatsAppText } from '@/lib/whatsapp/send';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET ?? '';
  const raw = await req.text();
  const sig = req.headers.get('x-hub-signature-256');
  if (secret && !verifyWebhookSignature(raw, sig, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const admin = createServiceRoleClient();
  const entry = (body as { entry?: unknown[] })?.entry?.[0] as Record<string, unknown> | undefined;
  const change = (entry?.changes as Record<string, unknown>[] | undefined)?.[0] as Record<string, unknown> | undefined;
  const value = change?.value as Record<string, unknown> | undefined;
  const messages = value?.messages as Record<string, unknown>[] | undefined;
  const metadata = value?.metadata as Record<string, unknown> | undefined;
  const phoneNumberId = metadata?.phone_number_id != null ? String(metadata.phone_number_id) : '';

  const message = messages?.[0];
  if (!message || String(message.type) !== 'text') {
    return NextResponse.json({ ok: true });
  }

  const fromNumber = String(message.from ?? '');
  const messageText = String((message.text as { body?: string } | undefined)?.body ?? '');
  const waMessageId = String(message.id ?? '');

  if (!admin || !phoneNumberId) {
    console.warn('[whatsapp webhook] Service role or phone_number_id missing');
    return NextResponse.json({ ok: true });
  }

  const { data: dealerRow } = await admin
    .from('dealers')
    .select('id, dealer_id, wa_access_token')
    .eq('wa_phone_number_id', phoneNumberId)
    .maybeSingle();

  const dealerUuid = dealerRow?.id as string | undefined;
  const dealerSlug = dealerRow?.dealer_id as string | undefined;
  const token = (dealerRow as { wa_access_token?: string | null } | null)?.wa_access_token ?? '';

  if (!dealerUuid || !dealerSlug) {
    return NextResponse.json({ ok: true });
  }

  const tail = fromNumber.replace(/\D/g, '').slice(-10);
  const { data: farmer } = await admin.from('farmers').select('id').eq('dealer_id', dealerSlug).ilike('mobile', `%${tail}%`).maybeSingle();

  const ins = await admin
    .from('whatsapp_messages')
    .insert({
      dealer_id: dealerUuid,
      wa_message_id: waMessageId || null,
      from_number: fromNumber,
      farmer_id: (farmer as { id?: string } | null)?.id ?? null,
      message_text: messageText,
      message_type: 'text',
      status: 'RECEIVED',
    })
    .select('id')
    .single();

  const savedId = (ins.data as { id?: string } | null)?.id;
  if (!savedId || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: true });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_WHATSAPP_MODEL ?? 'claude-sonnet-4-20250514';

  const { data: products } = await admin
    .from('product_master')
    .select('id, product_name, base_unit')
    .eq('dealer_id', dealerSlug)
    .limit(80);

  const catalog =
    (products ?? [])
      .map((p: Record<string, unknown>) => `- ${String(p.product_name)} (${String(p.base_unit ?? 'unit')})`)
      .join('\n') || '(no catalog)';

  let parsed: Record<string, unknown> = { is_order: false, items: [], confidence: 'LOW' };
  try {
    const resp = await anthropic.messages.create({
      model,
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `Parse this farmer WhatsApp message into JSON only.

Message: "${messageText}"

Products:\n${catalog}

Schema:
{"is_order":bool,"items":[{"product_name":string,"quantity":number,"unit":string,"matched_product_id":string|null}],"delivery_note":string,"confidence":"HIGH"|"MEDIUM"|"LOW"}
`,
        },
      ],
    });
    const block = resp.content[0];
    const txt = block?.type === 'text' ? block.text : '{}';
    const start = txt.indexOf('{');
    const end = txt.lastIndexOf('}');
    parsed = JSON.parse(start >= 0 ? txt.slice(start, end + 1) : '{}') as Record<string, unknown>;
  } catch {
    parsed = { is_order: false, items: [], confidence: 'LOW', parse_error: true };
  }

  await admin
    .from('whatsapp_messages')
    .update({
      parsed_order: parsed,
      status: 'PARSED',
      processed_at: new Date().toISOString(),
    })
    .eq('id', savedId);

  const conf = String(parsed.confidence ?? 'LOW');
  const isOrder = parsed.is_order === true;
  if (isOrder && conf !== 'LOW' && token && phoneNumberId) {
    const items = (parsed.items as { quantity?: number; unit?: string; product_name?: string }[]) ?? [];
    const summary = items.map((i) => `${i.quantity ?? ''} ${i.unit ?? ''} ${i.product_name ?? ''}`.trim()).join(', ');
    await sendWhatsAppText({
      phoneNumberId,
      accessToken: token,
      toE164: fromNumber,
      body: summary ? `Order received: ${summary}. Your dealer will confirm shortly.` : 'Order received. Your dealer will confirm shortly.',
    });
  }

  return NextResponse.json({ ok: true });
}
