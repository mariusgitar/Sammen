import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, sessionStatuses, sessions } from '@/db/schema';

type RouteContext = {
  params: {
    code: string;
  };
};

type PatchBody = {
  status: string;
};

function isValidPatchBody(candidate: unknown): candidate is PatchBody {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as Partial<PatchBody>;
  return typeof body.status === 'string' && sessionStatuses.includes(body.status as (typeof sessionStatuses)[number]);
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const code = params.code.toUpperCase();
    const db = getDb();

    const [session] = await db
      .select({
        id: sessions.id,
        code: sessions.code,
        title: sessions.title,
        mode: sessions.mode,
        status: sessions.status,
        tags: sessions.tags,
        allowNewItems: sessions.allowNewItems,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionItems = await db
      .select({
        id: items.id,
        sessionId: items.sessionId,
        text: items.text,
        createdBy: items.createdBy,
        isNew: items.isNew,
        orderIndex: items.orderIndex,
        createdAt: items.createdAt,
      })
      .from(items)
      .where(eq(items.sessionId, session.id))
      .orderBy(asc(items.orderIndex), asc(items.createdAt));

    return NextResponse.json({ session, items: sessionItems });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidPatchBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();
    const code = params.code.toUpperCase();

    const [updatedSession] = await db
      .update(sessions)
      .set({ status: body.status as (typeof sessionStatuses)[number] })
      .where(eq(sessions.code, code))
      .returning({
        id: sessions.id,
        code: sessions.code,
        title: sessions.title,
        mode: sessions.mode,
        status: sessions.status,
        tags: sessions.tags,
        allowNewItems: sessions.allowNewItems,
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
