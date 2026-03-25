import { and, asc, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, items, sessions } from '@/db/schema';

export async function GET(_request: Request, { params }: { params: { code: string } }) {
  try {
    const db = getDb();
    const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, params.code.toUpperCase())).limit(1);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const questions = await db.select({ id: items.id, text: items.text, question_status: items.questionStatus, orderIndex: items.orderIndex })
      .from(items)
      .where(and(eq(items.sessionId, session.id), eq(items.isQuestion, true)))
      .orderBy(asc(items.orderIndex), asc(items.createdAt));

    const result = [] as Array<{ id: string; text: string; question_status: string; innspill: Array<{ id: string; text: string; nickname: string; likes: number }> }>;

    for (const question of questions) {
      const rows = await db.select({ id: innspill.id, text: innspill.text, nickname: innspill.nickname, likes: innspill.likes })
        .from(innspill)
        .where(and(eq(innspill.sessionId, session.id), eq(innspill.questionId, question.id)))
        .orderBy(desc(innspill.likes), asc(innspill.createdAt));
      result.push({ id: question.id, text: question.text, question_status: question.question_status, innspill: rows });
    }

    return NextResponse.json({ questions: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
