import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, innspillLikes } from '@/db/schema';

type Body = { participantId: string };

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as Body;
    if (!body?.participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select({ id: innspillLikes.id })
      .from(innspillLikes)
      .where(and(eq(innspillLikes.innspillId, params.id), eq(innspillLikes.participantId, body.participantId)))
      .limit(1);

    let liked = false;
    if (existing) {
      await db.delete(innspillLikes).where(eq(innspillLikes.id, existing.id));
      await db.update(innspill).set({ likes: sql`GREATEST(${innspill.likes} - 1, 0)` }).where(eq(innspill.id, params.id));
    } else {
      await db.insert(innspillLikes).values({ innspillId: params.id, participantId: body.participantId });
      await db.update(innspill).set({ likes: sql`${innspill.likes} + 1` }).where(eq(innspill.id, params.id));
      liked = true;
    }

    const [row] = await db.select({ likes: innspill.likes }).from(innspill).where(eq(innspill.id, params.id)).limit(1);
    return NextResponse.json({ likes: row?.likes ?? 0, liked });
  } catch (error) {
    console.error('POST /api/innspill/[id]/like error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 },
    );
  }
}
