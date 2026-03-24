import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { items, responses, sessions } from '@/db/schema';

type ResponseInput = {
  itemId: string;
  value: string | null;
};

type RequestBody = {
  sessionId: string;
  participantId: string;
  nickname: string;
  responses: ResponseInput[];
};

function isValidBody(candidate: unknown): candidate is RequestBody {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as Partial<RequestBody>;

  return (
    typeof body.sessionId === 'string' &&
    typeof body.participantId === 'string' &&
    typeof body.nickname === 'string' &&
    Array.isArray(body.responses) &&
    body.responses.every(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof entry.itemId === 'string' &&
        (typeof entry.value === 'string' || entry.value === null),
    )
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();

    const [session] = await db
      .select({
        id: sessions.id,
        status: sessions.status,
        phase: sessions.phase,
      })
      .from(sessions)
      .where(eq(sessions.id, body.sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Session is not open for responses' }, { status: 409 });
    }

    const validResponses = body.responses.filter(
      (entry): entry is { itemId: string; value: string } => entry.value !== '' && entry.value !== null,
    );

    if (validResponses.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const responseItemIds = validResponses.map((entry) => entry.itemId);
    const uniqueItemIds = [...new Set(responseItemIds)];

    const sessionItems =
      uniqueItemIds.length > 0
        ? await db
            .select({
              id: items.id,
              excluded: items.excluded,
            })
            .from(items)
            .where(and(eq(items.sessionId, session.id), inArray(items.id, uniqueItemIds)))
        : [];

    if (sessionItems.length !== uniqueItemIds.length) {
      return NextResponse.json({ error: 'One or more items are invalid for this session' }, { status: 400 });
    }

    if (session.phase === 'stemming' && sessionItems.some((item) => item.excluded)) {
      return NextResponse.json({ error: 'One or more items are not open for voting' }, { status: 400 });
    }

    try {
      for (const response of validResponses) {
        await db.insert(responses).values({
          sessionId: body.sessionId,
          itemId: response.itemId,
          participantId: body.participantId,
          value: response.value,
        });
      }
    } catch (insertError) {
      const message = insertError instanceof Error ? insertError.message : 'Unknown insert error';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
