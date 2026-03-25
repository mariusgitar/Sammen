import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { items, questionStatuses } from '@/db/schema';

type RouteContext = {
  params: {
    id: string;
  };
};

type RequestBody = {
  is_new?: boolean;
  excluded?: boolean;
  question_status?: (typeof questionStatuses)[number];
};

function isValidBody(candidate: unknown): candidate is RequestBody {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as Partial<RequestBody>;

  if (typeof body.is_new !== 'undefined' && typeof body.is_new !== 'boolean') {
    return false;
  }

  if (typeof body.excluded !== 'undefined' && typeof body.excluded !== 'boolean') {
    return false;
  }

  if (typeof body.question_status !== 'undefined' && !questionStatuses.includes(body.question_status)) {
    return false;
  }

  return typeof body.is_new !== 'undefined' || typeof body.excluded !== 'undefined' || typeof body.question_status !== 'undefined';
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
      .set({
        ...(typeof body.is_new === 'boolean' ? { isNew: body.is_new } : {}),
        ...(typeof body.excluded === 'boolean' ? { excluded: body.excluded } : {}),
        ...(typeof body.question_status === 'string' ? { questionStatus: body.question_status } : {}),
      })
      .where(eq(items.id, params.id))
      .returning({
        id: items.id,
        text: items.text,
        is_new: items.isNew,
        excluded: items.excluded,
        question_status: items.questionStatus,
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
