import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { items } from '@/db/schema';

type RouteContext = {
  params: {
    id: string;
  };
};

type RequestBody = {
  is_new: boolean;
};

function isValidBody(candidate: unknown): candidate is RequestBody {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as Partial<RequestBody>;
  return typeof body.is_new === 'boolean';
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();

    const [updatedItem] = await db
      .update(items)
      .set({ isNew: body.is_new })
      .where(eq(items.id, params.id))
      .returning({
        id: items.id,
        text: items.text,
        is_new: items.isNew,
        created_by: items.createdBy,
      });

    if (!updatedItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
