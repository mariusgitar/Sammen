import { eq, max } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { items, sessions } from '@/db/schema';

type RequestBody = {
  sessionId: string;
  text: string;
  participantId: string;
  nickname: string;
  description?: string | null;
};

function isValidBody(candidate: unknown): candidate is RequestBody {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as Partial<RequestBody>;

  return (
    typeof body.sessionId === 'string' &&
    typeof body.text === 'string' &&
    body.text.trim().length > 0 &&
    typeof body.participantId === 'string' &&
    typeof body.nickname === 'string' &&
    body.nickname.trim().length > 0 &&
    (typeof body.description === 'undefined' || body.description === null || typeof body.description === 'string')
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
        allowNewItems: sessions.allowNewItems,
        status: sessions.status,
        phase: sessions.phase,
      })
      .from(sessions)
      .where(eq(sessions.id, body.sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'active' || session.phase !== 'kartlegging') {
      return NextResponse.json({ error: 'Session is not open for new proposals' }, { status: 409 });
    }

    if (!session.allowNewItems) {
      return NextResponse.json({ error: 'Session does not allow new items' }, { status: 400 });
    }

    const [row] = await db.select({ maxOrderIndex: max(items.orderIndex) }).from(items).where(eq(items.sessionId, body.sessionId));

    const nextOrderIndex = (row?.maxOrderIndex ?? -1) + 1;

    const [newItem] = await db
      .insert(items)
      .values({
        sessionId: body.sessionId,
        text: body.text.trim(),
        description: body.description?.trim() || null,
        createdBy: body.nickname.trim(),
        isNew: true,
        orderIndex: nextOrderIndex,
      })
      .returning({
        id: items.id,
        text: items.text,
        description: items.description,
        is_new: items.isNew,
      });

    return NextResponse.json({ item: newItem });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
