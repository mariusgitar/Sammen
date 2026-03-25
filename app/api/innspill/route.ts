import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, items, sessions } from '@/db/schema';

type Body = { sessionId: string; questionId: string; participantId: string; nickname: string; text: string };

function isValidBody(candidate: unknown): candidate is Body {
  if (!candidate || typeof candidate !== 'object') return false;
  const body = candidate as Partial<Body>;
  return typeof body.sessionId === 'string' && typeof body.questionId === 'string' && typeof body.participantId === 'string' && typeof body.nickname === 'string' && typeof body.text === 'string';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!isValidBody(body) || !body.text.trim() || !body.nickname.trim()) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();
    const [session] = await db.select({ id: sessions.id, status: sessions.status }).from(sessions).where(eq(sessions.id, body.sessionId)).limit(1);
    if (!session || session.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 409 });
    }

    const [question] = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, body.questionId), eq(items.sessionId, body.sessionId), eq(items.questionStatus, 'active')))
      .limit(1);

    if (!question) {
      return NextResponse.json({ error: 'Question is not active' }, { status: 409 });
    }

    const [created] = await db.insert(innspill).values({
      sessionId: body.sessionId,
      questionId: body.questionId,
      participantId: body.participantId,
      nickname: body.nickname.trim(),
      text: body.text.trim(),
    }).returning({ id: innspill.id, text: innspill.text, likes: innspill.likes });

    return NextResponse.json({ innspill: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
