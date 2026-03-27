import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { sessions, themes } from '@/db/schema';

type PatchBody = {
  name?: string;
  description?: string;
};

function isValidPatchBody(candidate: unknown): candidate is PatchBody {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as PatchBody;

  if (typeof body.name !== 'undefined' && typeof body.name !== 'string') {
    return false;
  }

  if (typeof body.description !== 'undefined' && typeof body.description !== 'string') {
    return false;
  }

  return typeof body.name !== 'undefined' || typeof body.description !== 'undefined';
}

export async function PATCH(request: Request, { params }: { params: { code: string; themeId: string } }) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidPatchBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();
    const code = params.code.toUpperCase();

    const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code)).limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const [updatedTheme] = await db
      .update(themes)
      .set({
        ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
        ...(typeof body.description === 'string' ? { description: body.description.trim() || null } : {}),
      })
      .where(and(eq(themes.id, params.themeId), eq(themes.sessionId, session.id)))
      .returning({
        id: themes.id,
        name: themes.name,
        description: themes.description,
        color: themes.color,
        order_index: themes.orderIndex,
      });

    if (!updatedTheme) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }

    return NextResponse.json({ theme: updatedTheme });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { code: string; themeId: string } }) {
  try {
    const db = getDb();
    const code = params.code.toUpperCase();

    const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code)).limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const [deletedTheme] = await db
      .delete(themes)
      .where(and(eq(themes.id, params.themeId), eq(themes.sessionId, session.id)))
      .returning({ id: themes.id });

    if (!deletedTheme) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
