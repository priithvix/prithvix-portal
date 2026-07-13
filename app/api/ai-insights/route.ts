import { NextRequest, NextResponse } from 'next/server';

interface InsightsRequest {
  dealerName: string;
  today: string;
  inventory: { name: string; category: string; stock: number; unit: string; reorderLevel: number }[];
  salesLast30d: { name: string; qty: number; revenue: number }[];
  salesPrev30d: { name: string; qty: number; revenue: number }[];
  creditOutstanding: { farmerName: string; amount: number; daysOverdue: number }[];
  licenseExpiries: { type: string; daysLeft: number }[];
}

interface Insight {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  category: 'restock' | 'sales' | 'credit' | 'compliance';
}

const SYSTEM = `You are PrithviX's business analyst for an agri-input dealer (fertilizer/pesticide/seed shop owner) in India.
You will receive a JSON snapshot of the dealer's current inventory, last-60-days sales split into two 30-day windows, outstanding farmer credit, and license expiry status.

Return ONLY valid JSON (no markdown fences, no prose) matching exactly:
{"insights": [{"title": string, "detail": string, "priority": "high"|"medium"|"low", "category": "restock"|"sales"|"credit"|"compliance"}]}

Rules:
- Generate 4 to 6 insights, most important first.
- Be SPECIFIC: name actual products, actual farmer names, actual numbers from the data given. Never invent products or names not present in the input.
- "restock": call out products where stock is at/below reorderLevel, or where 30-day sales velocity means the dealer will run out soon (estimate days remaining from qty sold in last 30 days vs current stock).
- "sales": call out products or trends with strong month-over-month growth or decline (compare salesLast30d vs salesPrev30d).
- "credit": call out farmers with high outstanding balances or days overdue that need follow-up.
- "compliance": call out licenses expiring soon (under 45 days).
- title: under 8 words, punchy, like a dashboard headline. detail: 1-2 short sentences, concrete and actionable (what to do, e.g. "Reorder ~15 bags from IFFCO this week").
- Amounts in ₹ with Indian comma formatting. Keep tone practical, not generic corporate fluff.`;

export async function POST(request: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY?.trim();
    if (!groqKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 503 });
    }

    const body = (await request.json()) as InsightsRequest;
    if (!body || !Array.isArray(body.inventory)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Cap payload size defensively — this is a summary, not raw tables.
    const trimmed: InsightsRequest = {
      dealerName: String(body.dealerName ?? '').slice(0, 200),
      today: String(body.today ?? '').slice(0, 20),
      inventory: (body.inventory ?? []).slice(0, 40),
      salesLast30d: (body.salesLast30d ?? []).slice(0, 40),
      salesPrev30d: (body.salesPrev30d ?? []).slice(0, 40),
      creditOutstanding: (body.creditOutstanding ?? []).slice(0, 30),
      licenseExpiries: (body.licenseExpiries ?? []).slice(0, 10),
    };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: JSON.stringify(trimmed) },
        ],
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const em = err?.error?.message ?? `HTTP ${res.status}`;
      return NextResponse.json({ error: em }, { status: 500 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const raw = data.choices[0]?.message?.content?.trim() ?? '{}';

    let parsed: { insights?: Insight[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'AI returned malformed response' }, { status: 502 });
    }

    const insights = Array.isArray(parsed.insights) ? parsed.insights.slice(0, 6) : [];
    return NextResponse.json({ insights });
  } catch (err) {
    console.error('[AI Insights]', err);
    return NextResponse.json({ error: 'Request failed: ' + (err instanceof Error ? err.message : 'unknown') }, { status: 500 });
  }
}
