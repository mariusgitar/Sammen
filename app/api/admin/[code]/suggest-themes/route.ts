import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, sessions } from '@/db/schema';

type InnspillForPrompt = {
  id: string;
  text: string;
  detaljer: string | null;
};

function buildPrompt(entries: InnspillForPrompt[]) {
  const innspillText = entries
    .map((entry, idx) => `${idx + 1}. ID:${entry.id} | "${entry.text}"${entry.detaljer ? ` (kontekst: ${entry.detaljer})` : ''}`)
    .join('\n');

  return `Analyser disse innspillene fra en workshop og grupper dem i 3-6 meningsfulle temaer.

INNSPILL:
${innspillText}

Returner et JSON-objekt med denne eksakte strukturen:
{
  "themes": [
    {
      "name": "Kort temaname (2-4 ord)",
      "description": "Én setning som beskriver temaet",
      "color": "#hex-farge",
      "innspill_ids": ["uuid1", "uuid2"]
    }
  ],
  "ungrouped_ids": ["uuid3"]
}

Regler:
- Hvert innspill skal plasseres i nøyaktig ett tema
- Hvis et innspill ikke passer noe tema, legg det i ungrouped_ids
- Temanavnene skal være på norsk
- Farger skal være duse hex-farger som passer på hvit bakgrunn
- Velg farger fra denne paletten: #6366f1, #0ea5e9, #10b981, #f59e0b, #ec4899, #8b5cf6`;
}

export async function POST(_request: Request, { params }: { params: { code: string } }) {
  try {
    const db = getDb();
    const code = params.code.toUpperCase();

    const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code)).limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const allInnspill = await db
      .select({
        id: innspill.id,
        text: innspill.text,
        detaljer: innspill.detaljer,
      })
      .from(innspill)
      .where(eq(innspill.sessionId, session.id));

    if (allInnspill.length < 3) {
      return NextResponse.json({ error: 'For få innspill til tematisering' }, { status: 400 });
    }

    if (!process.env.SAMMEN_OPENROUTER_KEY) {
      return NextResponse.json({ error: 'SAMMEN_OPENROUTER_KEY mangler' }, { status: 500 });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SAMMEN_OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sammen-alene.vercel.app',
        'X-Title': 'Sammen Workshop Tool',
      },
      body: JSON.stringify({
        model: 'mistralai/mixtral-8x7b-instruct',
        messages: [
          {
            role: 'system',
            content: `Du er en erfaren fasilitator som hjelper med å gruppere innspill fra workshops.
Du skal analysere innspill og foreslå meningsfulle temaer som grupperer dem.
Svar KUN med valid JSON, ingen forklaring, ingen markdown, ingen kodeblokker.`,
          },
          {
            role: 'user',
            content: buildPrompt(allInnspill),
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message ?? 'Klarte ikke å hente forslag fra AI' }, { status: response.status });
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'AI returnerte tomt svar' }, { status: 502 });
    }

    try {
      const parsed = JSON.parse(content.trim()) as {
        themes?: Array<{ name: string; description?: string; color: string; innspill_ids: string[] }>;
        ungrouped_ids?: string[];
      };

      return NextResponse.json({
        themes: parsed.themes ?? [],
        ungrouped_ids: parsed.ungrouped_ids ?? [],
      });
    } catch {
      return NextResponse.json({ error: 'Klarte ikke å tolke AI-svar som JSON' }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
