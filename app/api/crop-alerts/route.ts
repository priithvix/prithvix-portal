import { NextRequest, NextResponse } from 'next/server';

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') || 'India';
  const month = searchParams.get('month') || new Date().toLocaleString('en-IN', { month: 'long' });

  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    return NextResponse.json({ alerts: [] });
  }

  try {
    const query = `crop disease pest alert ${region} ${month} farmers India`;

    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 6, gl: 'in', hl: 'en' }),
    });

    if (!res.ok) {
      return NextResponse.json({ alerts: [] });
    }

    const data = (await res.json()) as SerperResponse;
    const organic = data.organic ?? [];

    const alerts = organic.slice(0, 4).map((r) => ({
      title: r.title,
      snippet: r.snippet,
      url: r.link,
    }));

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('[CropAlerts] Error:', error);
    return NextResponse.json({ alerts: [] });
  }
}
