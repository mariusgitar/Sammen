import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, sessionModes, sessions, votingTypes } from '@/db/schema';
import { generateCode } from '@/lib/generate-code';

type CreateSessionBody = {
  title: string;
  mode: (typeof sessionModes)[number];
  voting_type?: (typeof votingTypes)[number];
  dot_budget?: number;
  items: string[];
  tags: string[];
  allow_new_items: boolean;
};

function isCreateSessionBody(body: unknown): body is CreateSessionBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const candidate = body as Partial<CreateSessionBody>;

  return (
    typeof candidate.title === 'string' &&
    sessionModes.includes(candidate.mode as (typeof sessionModes)[number]) &&
    (typeof candidate.voting_type === 'undefined' ||
      votingTypes.includes(candidate.voting_type as (typeof votingTypes)[number])) &&
    (typeof candidate.dot_budget === 'undefined' || Number.isInteger(candidate.dot_budget)) &&
    Array.isArray(candidate.items) &&
    candidate.items.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === 'string') &&
    typeof candidate.allow_new_items === 'boolean'
  );
}

async function generateUniqueCode() {
  const db = getDb();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCode();
    const existing = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code)).limit(1);

    if (existing.length === 0) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique session code');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;

    if (!isCreateSessionBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const title = body.title.trim();
    const itemTexts = body.items.map((item) => item.trim()).filter(Boolean);
    const tags = body.tags.map((tag) => tag.trim()).filter(Boolean);

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const code = await generateUniqueCode();
    const db = getDb();
    const votingType = body.voting_type ?? 'scale';
    const dotBudget = Math.max(3, Math.min(20, body.dot_budget ?? 5));

    const [createdSession] = await db
      .insert(sessions)
      .values({
        code,
        title,
        mode: body.mode,
        phase: body.mode === 'stemming' ? 'stemming' : 'kartlegging',
        votingType: body.mode === 'stemming' ? votingType : 'scale',
        dotBudget: body.mode === 'stemming' && votingType === 'dots' ? dotBudget : 5,
        tags,
        allowNewItems: body.allow_new_items,
      })
      .returning({
        id: sessions.id,
        code: sessions.code,
        title: sessions.title,
        mode: sessions.mode,
        votingType: sessions.votingType,
        dotBudget: sessions.dotBudget,
        status: sessions.status,
        tags: sessions.tags,
      });

    if (itemTexts.length > 0) {
      await db.insert(items).values(
        itemTexts.map((text, orderIndex) => ({
          sessionId: createdSession.id,
          text,
          orderIndex,
        }))
      );
    }

    return NextResponse.json({ session: createdSession }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
