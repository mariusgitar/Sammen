import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';

import { getDb } from '@/db';
import { innspill, innspillLikes, innspillModes, items, responses, sessionModes, sessions, visibilityModes, votingTypes } from '@/db/schema';
import { generateCode } from '@/lib/generate-code';

type CreateSessionMode = (typeof sessionModes)[number] | 'innspill+stemming';

type CreateSessionBody = {
  title: string;
  mode: CreateSessionMode;
  voting_type?: (typeof votingTypes)[number];
  dot_budget?: number;
  allow_multiple_dots?: boolean;
  visibility_mode?: (typeof visibilityModes)[number];
  show_others_innspill?: boolean;
  innspill_mode?: (typeof innspillModes)[number];
  innspill_max_chars?: number;
  max_rank_items?: number | null;
  items: string[];
  tags: string[];
  allow_new_items: boolean;
};

type BulkDeleteBody = {
  status: 'closed' | 'setup';
};

function normalizeTagKey(tag: string) {
  return tag.trim().toLowerCase();
}

function normalizeTagsPreserveCasing(tags: string[]) {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const trimmed = tag.trim();
    const key = normalizeTagKey(trimmed);

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function isCreateSessionBody(body: unknown): body is CreateSessionBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const candidate = body as Partial<CreateSessionBody>;

  return (
    typeof candidate.title === 'string' &&
    (sessionModes.includes(candidate.mode as (typeof sessionModes)[number]) || candidate.mode === 'innspill+stemming') &&
    (typeof candidate.voting_type === 'undefined' ||
      votingTypes.includes(candidate.voting_type as (typeof votingTypes)[number])) &&
    (typeof candidate.dot_budget === 'undefined' || Number.isInteger(candidate.dot_budget)) &&
    (typeof candidate.allow_multiple_dots === 'undefined' || typeof candidate.allow_multiple_dots === 'boolean') &&
    (typeof candidate.visibility_mode === 'undefined' ||
      visibilityModes.includes(candidate.visibility_mode as (typeof visibilityModes)[number])) &&
    (typeof candidate.show_others_innspill === 'undefined' || typeof candidate.show_others_innspill === 'boolean') &&
    (typeof candidate.innspill_mode === 'undefined' ||
      innspillModes.includes(candidate.innspill_mode as (typeof innspillModes)[number])) &&
    (typeof candidate.innspill_max_chars === 'undefined' || Number.isInteger(candidate.innspill_max_chars)) &&
    (typeof candidate.max_rank_items === 'undefined' || candidate.max_rank_items === null || Number.isInteger(candidate.max_rank_items)) &&
    Array.isArray(candidate.items) &&
    candidate.items.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === 'string') &&
    typeof candidate.allow_new_items === 'boolean'
  );
}

function isBulkDeleteBody(body: unknown): body is BulkDeleteBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const candidate = body as Partial<BulkDeleteBody>;
  return candidate.status === 'closed' || candidate.status === 'setup';
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
    const itemLines = body.items.map((item) => item.trim()).filter(Boolean);
    const tags = normalizeTagsPreserveCasing(body.tags);
    const tagsByKey = new Map(tags.map((tag) => [normalizeTagKey(tag), tag]));

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (itemLines.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const normalizedMode = body.mode === 'innspill+stemming' ? 'aapne-innspill' : body.mode;
    const includesStemming = body.mode === 'innspill+stemming';

    const normalizedMaxRankItems = normalizedMode === 'rangering' && Number.isInteger(body.max_rank_items)
      ? Math.max(2, body.max_rank_items as number)
      : null;

    const code = await generateUniqueCode();
    const db = getDb();
    const votingType = body.voting_type ?? 'scale';
    const dotBudget = Math.max(3, Math.min(20, body.dot_budget ?? 5));
    const allowMultipleDots = body.allow_multiple_dots ?? true;
    const visibilityMode = body.visibility_mode ?? 'manual';
    const showOthersInnspill = body.show_others_innspill ?? true;
    const innspillMode = body.innspill_mode ?? 'enkel';
    const innspillMaxChars = [60, 100, 200].includes(body.innspill_max_chars ?? 100) ? (body.innspill_max_chars ?? 100) : 100;

    const [createdSession] = await db
      .insert(sessions)
      .values({
        code,
        title,
        mode: normalizedMode,
        phase:
          normalizedMode === 'stemming'
            ? 'stemming'
            : normalizedMode === 'aapne-innspill'
              ? 'innspill'
              : normalizedMode === 'rangering'
                ? 'rangering'
                : 'kartlegging',
        votingType: normalizedMode === 'stemming' || includesStemming ? votingType : 'scale',
        dotBudget: (normalizedMode === 'stemming' || includesStemming) && votingType === 'dots' ? dotBudget : 5,
        allowMultipleDots: (normalizedMode === 'stemming' || includesStemming) && votingType === 'dots' ? allowMultipleDots : true,
        visibilityMode,
        showOthersInnspill,
        innspillMode: normalizedMode === 'aapne-innspill' ? innspillMode : 'enkel',
        innspillMaxChars: normalizedMode === 'aapne-innspill' ? innspillMaxChars : 100,
        maxRankItems: normalizedMaxRankItems,
        tags: normalizedMode === 'aapne-innspill' || normalizedMode === 'rangering' ? [] : tags,
        allowNewItems: normalizedMode === 'aapne-innspill' || normalizedMode === 'rangering' ? true : body.allow_new_items,
        includesStemming,
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

    const parsedItems = itemLines
      .map((line, orderIndex) => {
        const shouldParseStructuredItem = normalizedMode === 'kartlegging' || normalizedMode === 'rangering';
        const [rawText, rawDefaultTag, ...rawDescriptionParts] = shouldParseStructuredItem ? line.split(';') : [line];
        const text = rawText?.trim() ?? '';
        const defaultTag = rawDefaultTag?.trim() ?? '';
        const description = rawDescriptionParts.join(';').trim();
        const validDefaultTag = defaultTag ? (tagsByKey.get(normalizeTagKey(defaultTag)) ?? null) : null;

        return {
          text,
          orderIndex,
          defaultTag: normalizedMode === 'kartlegging' ? validDefaultTag : null,
          description: description.length > 0 ? description : null,
        };
      })
      .filter((item) => item.text.length > 0);

    if (parsedItems.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    const itemRows = parsedItems.map(({ text, orderIndex, defaultTag, description }) => {
      const questionStatus: 'active' | 'inactive' =
        normalizedMode === 'aapne-innspill' && visibilityMode === 'all' ? 'active' : 'inactive';

      return {
        sessionId: createdSession.id,
        text,
        description,
        orderIndex,
        isQuestion: normalizedMode === 'aapne-innspill',
        questionStatus,
        defaultTag,
        finalTag: defaultTag,
      };
    });

    await db.insert(items).values(itemRows);

    return NextResponse.json({ session: createdSession }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!isBulkDeleteBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();
    const matchingSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.status, body.status));

    if (matchingSessions.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    const sessionIds = matchingSessions.map((session) => session.id);

    const relatedInnspill = await db
      .select({ id: innspill.id })
      .from(innspill)
      .where(inArray(innspill.sessionId, sessionIds));

    const innspillIds = relatedInnspill.map((entry) => entry.id);

    if (innspillIds.length > 0) {
      await db.delete(innspillLikes).where(inArray(innspillLikes.innspillId, innspillIds));
    }

    await db.delete(responses).where(inArray(responses.sessionId, sessionIds));
    await db.delete(innspill).where(inArray(innspill.sessionId, sessionIds));
    await db.delete(items).where(inArray(items.sessionId, sessionIds));

    const deletedRows = await db
      .delete(sessions)
      .where(inArray(sessions.id, sessionIds))
      .returning({ id: sessions.id });

    return NextResponse.json({ ok: true, deleted: deletedRows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
