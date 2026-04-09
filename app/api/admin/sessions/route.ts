import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { normalizeSession } from '@/app/lib/normalizeSession';
import { getDb } from '@/db';
import { sessions } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const db = getDb();
    const allSessions = await db
      .select({
        id: sessions.id,
        code: sessions.code,
        title: sessions.title,
        mode: sessions.mode,
        status: sessions.status,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .orderBy(desc(sessions.createdAt));

    return NextResponse.json({ sessions: allSessions.map((session) => normalizeSession(session)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
