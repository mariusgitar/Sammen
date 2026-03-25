import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, innspillLikes } from '@/db/schema';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as { participantId?: string };
    if (!body?.participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    const db = getDb();
    const [entry] = await db.select({ id: innspill.id }).from(innspill).where(and(eq(innspill.id, params.id), eq(innspill.participantId, body.participantId))).limit(1);

    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db.delete(innspillLikes).where(eq(innspillLikes.innspillId, params.id));
    await db.delete(innspill).where(eq(innspill.id, params.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
