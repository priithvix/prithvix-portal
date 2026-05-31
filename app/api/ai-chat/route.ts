import { NextRequest, NextResponse } from 'next/server';

type HistoryItem = { role: 'user' | 'assistant'; content: string };
type DetectedLang = 'Hindi' | 'Gujarati' | 'Hinglish' | 'English';

function detectLanguage(text: string): DetectedLang {
  if (/[ऀ-ॿ]/.test(text)) return 'Hindi';
  if (/[઀-૿]/.test(text)) return 'Gujarati';
  if (/\b(kya|kaise|hai|nahi|fasal|kisan|kheti|bimari|kide|urea|pani|gehu|chawal|kapas|batao|lagao|kitna|kab)\b/i.test(text))
    return 'Hinglish';
  return 'English';
}

const SYSTEM = `You are PrithviX AI — a focused advisor for agricultural INPUT DEALERS and farmers in India (बीज–खाद–दवाई दुकान + खेत).

## TONE
Warm, conversational, and practical — like a trusted personal agent. Reply to greetings ("hi", "namaste", "hello") warmly and invite them to share their farm or shop situation. Default to **concise** answers; go deeper only when they ask or when detail is clearly needed.

## WHAT YOU HELP WITH (IN SCOPE)
- Crops, pests, diseases, nutrition, irrigation, weather-linked decisions, varieties, basic mandi/scheme pointers.
- **Dealer / shop context:** inventory mix, what to stock this season, slow-moving stock risk, credit/udhaar discipline basics, farmer-facing talking points, simple working-capital priorities for the agri-input business.
- **Personal situation / goals:** help them clarify priorities ("what should I focus on first?"), trade-offs, and **practical** money allocation for the shop or farm inputs — frame as general guidance with disclaimers, not regulated financial advice.
- Govt schemes relevant to farmers/dealers (PM-KISAN, PMFBY, KCC, e-NAM, subsidies — factual overview level).

## WHAT TO DECLINE (OUT OF SCOPE)
Politely refuse **briefly** (2–4 sentences), no lectures — then offer something relevant instead:
- Wars, geopolitics, elections, religion debates, celebrity gossip, unrelated general trivia.
- Stock/crypto/trading tips, personal loans unrelated to agri business, illegal activity.
- Human medical diagnosis / legal advice — suggest seeing a qualified professional.

Do **not** pretend to know their live inventory numbers unless they paste data; ask what they stock if needed.

## CROP & TECH KNOWLEDGE (summary)
Wheat, rice, cotton/Bt, soybean, maize, groundnut, sugarcane, mustard, onion, potato, tomato, chilli, bajra, jowar, etc. Diseases/pests: blast, blight, rust, wilt, bollworm, aphid, whitefly, stem borer, etc.

## IMAGE ANALYSIS
When an image is sent: diagnose crop health / pest / disease / deficiency where possible; state confidence; suggest treatment with dose + timing + generic + brand examples; ask for clearer photos if unsure.

## BRANDS (examples)
Anant, Coragen, Monocil, Rogor, Mancozeb, Carbendazim, Propiconazole, Tebuconazole, Imidacloprid, Thiamethoxam, Emamectin, etc.

## LANGUAGE
Match user: Hindi script → Hindi; Gujarati → Gujarati; Hinglish → Hinglish; English → clear English (Hindi crop names in brackets where helpful).

## FORMAT
Use short headings or bullets when helpful. For pure agronomy technical queries: Problem → Cause → Solution (product/dose/timing) → Precaution. For business/inventory chats: listen → 3–5 actionable bullets → one clarifying question if needed.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], useWebSearch = false, deepMode = false, imageBase64 } = body as {
      message: string;
      history: HistoryItem[];
      useWebSearch: boolean;
      deepMode: boolean;
      imageBase64?: string;
    };

    const groqKey = process.env.GROQ_API_KEY?.trim();
    if (!groqKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY not set in .env.local' }, { status: 503 });
    }

    const detectedLang = detectLanguage(message);
    const langNote = detectedLang !== 'English'
      ? `\n\nIMPORTANT: Respond in ${detectedLang}. Do not switch to English.`
      : '';

    // Serper web search
    let webSection = '';
    let sources: { title: string; url: string; snippet: string }[] = [];
    if (useWebSearch && !imageBase64) {
      const serperKey = process.env.SERPER_API_KEY?.trim();
      if (serperKey) {
        try {
          const sr = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              q: `${message} India agriculture farmer dealer inputs subsidy mandi 2025`,
              num: 5,
              gl: 'in',
            }),
          });
          if (sr.ok) {
            const sd = await sr.json() as {
              organic?: { title: string; link: string; snippet: string }[];
              answerBox?: { answer?: string; snippet?: string };
            };
            sources = (sd.organic ?? []).slice(0, 4).map((r) => ({
              title: r.title, url: r.link, snippet: r.snippet ?? '',
            }));
            const ab = sd.answerBox?.answer ?? sd.answerBox?.snippet ?? '';
            const ctx = [ab ? `Key Answer: ${ab}` : '', sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`).join('\n')].filter(Boolean).join('\n\n');
            if (ctx) webSection = `\n\n## LIVE WEB DATA (use as primary source, cite [1],[2]):\n${ctx}\n## END WEB DATA`;
          }
        } catch (e) { console.error('[Serper]', e); }
      }
    }

    const systemContent = SYSTEM + langNote + webSection;

    // ── Image analysis: use Llama vision model ────────────────────────────
    if (imageBase64) {
      // Groq: ~4MB max for base64 payloads — reject early with a clear message
      if (imageBase64.length > 4_200_000) {
        return NextResponse.json(
          { error: 'Image too large for analysis. Please use a smaller photo (try cropping or lower resolution).' },
          { status: 413 },
        );
      }
      const isDataUrl = imageBase64.startsWith('data:');
      const imageUrl = isDataUrl ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

      const visionMessages = [
        { role: 'system', content: systemContent },
        ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: message || 'Analyse this crop image. Identify disease, pest, or nutrient deficiency. Give specific treatment with doses and brand names.' },
          ],
        },
      ];

      const visionRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: visionMessages,
          temperature: 0.4,
          max_tokens: 2048,
        }),
      });

      if (!visionRes.ok) {
        const err = await visionRes.json().catch(() => ({})) as { error?: { message?: string } };
        const em = err?.error?.message ?? `HTTP ${visionRes.status}`;
        // Fallback: if vision model unavailable, try text-based analysis
        if (visionRes.status === 404 || visionRes.status === 400) {
          const fallbackMsg = `The user has uploaded a crop image for analysis. Based on the description: "${message}". Please provide a thorough analysis of possible crop diseases, pests, or deficiencies and specific treatment recommendations.`;
          const fbRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: systemContent },
                { role: 'user', content: fallbackMsg },
              ],
              temperature: 0.5,
              max_tokens: 2048,
            }),
          });
          if (fbRes.ok) {
            const fbData = await fbRes.json() as { choices: { message: { content: string } }[] };
            const reply = fbData.choices[0]?.message?.content?.trim() ?? '';
            return NextResponse.json({ reply: `📸 *Image received — vision analysis unavailable, providing general guidance:*\n\n${reply}`, lang: detectedLang });
          }
        }
        console.error('[Vision]', em);
        return NextResponse.json({ error: `Vision error: ${em}` }, { status: 500 });
      }

      const vd = await visionRes.json() as { choices: { message: { content: string } }[] };
      const reply = vd.choices[0]?.message?.content?.trim() ?? '';
      return NextResponse.json({ reply, lang: detectedLang });
    }

    // ── Text chat: llama-3.3-70b ──────────────────────────────────────────
    const chatMessages = [
      { role: 'system', content: systemContent },
      ...history.slice(-14).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    // Retry once on 429
    let res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: chatMessages,
        temperature: deepMode ? 0.7 : 0.55,
        max_tokens: deepMode ? 4096 : 2048,
        top_p: 0.95,
        stream: false,
      }),
    });

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 5000));
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: chatMessages,
          temperature: deepMode ? 0.7 : 0.55,
          max_tokens: deepMode ? 4096 : 2048,
          top_p: 0.95,
          stream: false,
        }),
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const em = err?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 401) return NextResponse.json({ error: 'Invalid Groq API key. Check .env.local' }, { status: 401 });
      if (res.status === 429) return NextResponse.json({ error: '⏳ Bahut requests aa gayi — 15 second baad retry karo.' }, { status: 429 });
      return NextResponse.json({ error: em }, { status: 500 });
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    const reply = data.choices[0]?.message?.content?.trim() ?? '';

    return NextResponse.json({
      reply,
      sources: sources.length > 0 ? sources : undefined,
      model: 'llama-3.3-70b-versatile',
      lang: detectedLang,
    });

  } catch (err) {
    console.error('[AI Route]', err);
    return NextResponse.json({ error: 'Request failed: ' + (err instanceof Error ? err.message : 'unknown') }, { status: 500 });
  }
}
