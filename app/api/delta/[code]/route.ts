import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';

import { normalizeSession } from '@/app/lib/normalizeSession';
import { getDb } from '@/db';
import { items, sessions } from '@/db/schema';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    code: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const code = params.code.toUpperCase();
    const db = getDb();

    const [sessionRow] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!sessionRow) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionItems = await db
      .select({
        id: items.id,
        text: items.text,
        description: items.description,
        isNew: items.isNew,
        excluded: items.excluded,
        isQuestion: items.isQuestion,
        questionStatus: items.questionStatus,
        defaultTag: items.defaultTag,
        finalTag: items.finalTag,
        orderIndex: items.orderIndex,
        createdAt: items.createdAt,
      })
      .from(items)
      .where(eq(items.sessionId, sessionRow.id))
      .orderBy(asc(items.orderIndex), asc(items.createdAt));

    return NextResponse.json({
      session: normalizeSession(sessionRow as Record<string, unknown>),
      items: sessionItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
