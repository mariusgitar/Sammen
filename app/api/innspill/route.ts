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

function parseBody(candidate: unknown): Body | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const body = candidate as Record<string, unknown>;

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : typeof body.session_id === 'string' ? body.session_id : null;
  const questionId = typeof body.questionId === 'string' ? body.questionId : typeof body.question_id === 'string' ? body.question_id : null;
  const participantId =
    typeof body.participantId === 'string' ? body.participantId : typeof body.participant_id === 'string' ? body.participant_id : null;
  const nickname = typeof body.nickname === 'string' ? body.nickname : null;
  const text = typeof body.text === 'string' ? body.text : null;

  if (!sessionId || !questionId || !participantId || !nickname || !text) {
    return null;
  }

  return { sessionId, questionId, participantId, nickname, text };
}

export async function POST(request: Request) {
  try {
    const parsed = parseBody((await request.json()) as unknown);
    if (!parsed || !isValidBody(parsed) || !parsed.text.trim() || !parsed.nickname.trim()) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();
    const [session] = await db.select({ id: sessions.id, status: sessions.status }).from(sessions).where(eq(sessions.id, parsed.sessionId)).limit(1);
    if (!session || session.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 409 });
    }

    const [question] = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, parsed.questionId), eq(items.sessionId, parsed.sessionId), eq(items.questionStatus, 'active')))
      .limit(1);

    if (!question) {
      return NextResponse.json({ error: 'Question is not active' }, { status: 409 });
    }

    const [created] = await db
      .insert(innspill)
      .values({
        sessionId: parsed.sessionId,
        questionId: parsed.questionId,
        participantId: parsed.participantId,
        nickname: parsed.nickname.trim(),
        text: parsed.text.trim(),
        likes: 0,
      })
      .returning({ id: innspill.id, text: innspill.text, likes: innspill.likes });

    return NextResponse.json({ innspill: created }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/innspill error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}
