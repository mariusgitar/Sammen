import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, innspillThemes } from '@/db/schema';

type PatchBody = {
  theme_id: string | null;
};

function isValidBody(candidate: unknown): candidate is PatchBody {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as PatchBody;

  return typeof body.theme_id === 'string' || body.theme_id === null;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();

    const [entry] = await db
      .select({ id: innspill.id })
      .from(innspill)
      .where(eq(innspill.id, params.id))
      .limit(1);

    if (!entry) {
      return NextResponse.json({ error: 'Innspill not found' }, { status: 404 });
    }

    await db.delete(innspillThemes).where(eq(innspillThemes.innspillId, params.id));

    if (body.theme_id) {
      await db.insert(innspillThemes).values({
        innspillId: params.id,
        themeId: body.theme_id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
