import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { participants, sessions } from '@/db/schema';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    code: string;
  };
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const code = params.code.toUpperCase();
    const body = (await request.json()) as {
      participantId?: string;
      nickname?: string;
    };

    const participantId = body.participantId?.trim();
    const nickname = body.nickname?.trim();

    if (!participantId || !nickname) {
      return NextResponse.json({ error: 'participantId and nickname are required' }, { status: 400 });
    }

    const db = getDb();

    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await db
      .insert(participants)
      .values({
        sessionId: session.id,
        participantId,
        nickname,
      })
      .onConflictDoNothing({
        target: [participants.sessionId, participants.participantId],
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
