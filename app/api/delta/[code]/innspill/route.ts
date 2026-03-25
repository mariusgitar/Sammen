import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, items, sessions } from '@/db/schema';

type RouteContext = { params: { code: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const db = getDb();
    const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, params.code.toUpperCase())).limit(1);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const activeQuestions = await db
      .select({ id: items.id, text: items.text, question_status: items.questionStatus })
      .from(items)
      .where(and(eq(items.sessionId, session.id), eq(items.isQuestion, true), eq(items.questionStatus, 'active')))
      .orderBy(asc(items.orderIndex), asc(items.createdAt));

    const payload = [] as Array<{ id: string; text: string; question_status: string; innspill: Array<{ id: string; text: string; nickname: string; likes: number; participant_id: string }> }>;

    for (const question of activeQuestions) {
      const entries = await db.select({ id: innspill.id, text: innspill.text, nickname: innspill.nickname, likes: innspill.likes, participant_id: innspill.participantId })
        .from(innspill)
        .where(and(eq(innspill.sessionId, session.id), eq(innspill.questionId, question.id)))
        .orderBy(asc(innspill.createdAt));
      payload.push({ ...question, innspill: entries });
    }

    return NextResponse.json({ questions: payload });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
