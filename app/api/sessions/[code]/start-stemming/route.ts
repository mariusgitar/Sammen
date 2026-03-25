import { and, asc, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { items, sessions, votingTypes } from '@/db/schema';

type RouteContext = {
  params: {
    code: string;
  };
};

type ItemPayload = {
  text: string;
  created_by?: string;
};

type Body = {
  voting_type?: 'scale' | 'dots';
  dot_budget?: number;
  allow_multiple_dots?: boolean;
  items?: Array<string | ItemPayload>;
};

function isValidBody(candidate: unknown): candidate is Body {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as Body;

  if (!body.voting_type || !votingTypes.includes(body.voting_type)) {
    return false;
  }

  if (typeof body.dot_budget !== 'undefined' && (!Number.isInteger(body.dot_budget) || body.dot_budget < 1)) {
    return false;
  }

  if (typeof body.allow_multiple_dots !== 'undefined' && typeof body.allow_multiple_dots !== 'boolean') {
    return false;
  }

  if (typeof body.items !== 'undefined' && !Array.isArray(body.items)) {
    return false;
  }

  if (Array.isArray(body.items)) {
    for (const entry of body.items) {
      if (typeof entry === 'string') {
        if (entry.trim().length === 0) {
          return false;
        }
        continue;
      }

      if (!entry || typeof entry !== 'object') {
        return false;
      }

      if (typeof entry.text !== 'string' || entry.text.trim().length === 0) {
        return false;
      }

      if (typeof entry.created_by !== 'undefined' && typeof entry.created_by !== 'string') {
        return false;
      }
    }
  }

  return true;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();
    const code = params.code.toUpperCase();

    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const normalizedItems =
      body.items?.map((entry) =>
        typeof entry === 'string'
          ? { text: entry.trim(), created_by: 'deltaker' }
          : { text: entry.text.trim(), created_by: entry.created_by?.trim() || 'deltaker' },
      ) ?? [];

    if (normalizedItems.length > 0) {
      const [lastItem] = await db
        .select({ orderIndex: items.orderIndex })
        .from(items)
        .where(and(eq(items.sessionId, session.id), eq(items.isQuestion, false)))
        .orderBy(desc(items.orderIndex), asc(items.createdAt))
        .limit(1);

      const startIndex = (lastItem?.orderIndex ?? -1) + 1;

      await db.insert(items).values(
        normalizedItems.map((entry, index) => ({
          sessionId: session.id,
          text: entry.text,
          createdBy: entry.created_by,
          isNew: false,
          excluded: false,
          isQuestion: false,
          orderIndex: startIndex + index,
        })),
      );
    }

    const [updatedSession] = await db
      .update(sessions)
      .set({
        status: 'active',
        phase: 'stemming',
        mode: 'stemming',
        votingType: body.voting_type,
        dotBudget: body.voting_type === 'dots' ? body.dot_budget ?? 5 : 5,
        allowMultipleDots: body.voting_type === 'dots' ? body.allow_multiple_dots ?? true : true,
      })
      .where(eq(sessions.code, code))
      .returning({
        status: sessions.status,
        phase: sessions.phase,
        mode: sessions.mode,
        resultsVisible: sessions.resultsVisible,
      });

    if (!updatedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
