import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, items, sessions } from '@/db/schema';

type RouteContext = { params: { code: string } };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const db = getDb();
    const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, params.code.toUpperCase())).limit(1);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const questions = await db
      .select({ id: items.id, text: items.text, question_status: items.questionStatus })
      .from(items)
      .where(and(eq(items.sessionId, session.id), eq(items.isQuestion, true)))
      .orderBy(asc(items.orderIndex), asc(items.createdAt));

    const allInnspill = await db
      .select({
        id: innspill.id,
        text: innspill.text,
        nickname: innspill.nickname,
        likes: innspill.likes,
        participant_id: innspill.participantId,
        question_id: innspill.questionId,
        created_at: innspill.createdAt,
      })
      .from(innspill)
      .where(eq(innspill.sessionId, session.id));

    const result = questions
      .map((q) => ({
      id: q.id,
      text: q.text,
      question_status: q.question_status,
      innspill: allInnspill
        .filter((i) => i.question_id === q.id)
        .map((i) => ({
          id: i.id,
          text: i.text,
          nickname: i.nickname,
          likes: i.likes,
          participant_id: i.participant_id,
          created_at: i.created_at,
        }))
        .sort((a, b) => b.likes - a.likes),
      }))
      .filter((question) => question.question_status === 'active' || question.innspill.length > 0);

    return NextResponse.json(
      { questions: result },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      },
    );
  } catch (error: any) {
    console.error('GET /api/delta/[code]/innspill error:', error);
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
