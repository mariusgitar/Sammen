import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, sessionModes, sessions, visibilityModes, votingTypes } from '@/db/schema';
import { generateCode } from '@/lib/generate-code';

type CreateSessionBody = {
  title: string;
  mode: (typeof sessionModes)[number];
  voting_type?: (typeof votingTypes)[number];
  dot_budget?: number;
  allow_multiple_dots?: boolean;
  visibility_mode?: (typeof visibilityModes)[number];
  max_rank_items?: number | null;
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
    (typeof candidate.allow_multiple_dots === 'undefined' || typeof candidate.allow_multiple_dots === 'boolean') &&
    (typeof candidate.visibility_mode === 'undefined' ||
      visibilityModes.includes(candidate.visibility_mode as (typeof visibilityModes)[number])) &&
    (typeof candidate.max_rank_items === 'undefined' || candidate.max_rank_items === null || Number.isInteger(candidate.max_rank_items)) &&
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

    if (itemTexts.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const normalizedMaxRankItems = body.mode === 'rangering' && Number.isInteger(body.max_rank_items)
      ? Math.max(2, body.max_rank_items as number)
      : null;

    const code = await generateUniqueCode();
    const db = getDb();
    const votingType = body.voting_type ?? 'scale';
    const dotBudget = Math.max(3, Math.min(20, body.dot_budget ?? 5));
    const allowMultipleDots = body.allow_multiple_dots ?? true;
    const visibilityMode = body.visibility_mode ?? 'manual';

    const [createdSession] = await db
      .insert(sessions)
      .values({
        code,
        title,
        mode: body.mode,
        phase:
          body.mode === 'stemming'
            ? 'stemming'
            : body.mode === 'aapne-innspill'
              ? 'innspill'
              : body.mode === 'rangering'
                ? 'rangering'
                : 'kartlegging',
        votingType: body.mode === 'stemming' ? votingType : 'scale',
        dotBudget: body.mode === 'stemming' && votingType === 'dots' ? dotBudget : 5,
        allowMultipleDots: body.mode === 'stemming' && votingType === 'dots' ? allowMultipleDots : true,
        visibilityMode,
        maxRankItems: normalizedMaxRankItems,
        tags: body.mode === 'aapne-innspill' || body.mode === 'rangering' ? [] : tags,
        allowNewItems: body.mode === 'aapne-innspill' || body.mode === 'rangering' ? true : body.allow_new_items,
      })
      .returning({
        id: sessions.id,
        code: sessions.code,
        title: sessions.title,
        mode: sessions.mode,
        votingType: sessions.votingType,
        dotBudget: sessions.dotBudget,
        allowMultipleDots: sessions.allowMultipleDots,
        status: sessions.status,
        tags: sessions.tags,
      });

    const itemRows = itemTexts.map((text, orderIndex) => {
      const questionStatus: 'active' | 'inactive' =
        body.mode === 'aapne-innspill' && visibilityMode === 'all' ? 'active' : 'inactive';

      return {
        sessionId: createdSession.id,
        text,
        orderIndex,
        isQuestion: body.mode === 'aapne-innspill',
        questionStatus,
      };
    });

    await db.insert(items).values(itemRows);

    return NextResponse.json({ session: createdSession }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
