import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { items, questionStatuses, sessions } from '@/db/schema';

type RouteContext = {
  params: {
    id: string;
  };
};

type RequestBody = {
  is_new?: boolean;
  excluded?: boolean;
  question_status?: (typeof questionStatuses)[number];
  final_tag?: string | null;
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

  if (typeof body.final_tag !== 'undefined' && body.final_tag !== null && typeof body.final_tag !== 'string') {
    return false;
  }

  return (
    typeof body.is_new !== 'undefined' ||
    typeof body.excluded !== 'undefined' ||
    typeof body.question_status !== 'undefined' ||
    typeof body.final_tag !== 'undefined'
  );
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();
    const [itemWithSession] = await db
      .select({
        id: items.id,
        sessionId: items.sessionId,
        tags: sessions.tags,
      })
      .from(items)
      .innerJoin(sessions, eq(items.sessionId, sessions.id))
      .where(eq(items.id, params.id))
      .limit(1);

    if (!itemWithSession) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    let normalizedFinalTag: string | null | undefined;

    if (typeof body.final_tag !== 'undefined') {
      if (body.final_tag === null) {
        normalizedFinalTag = null;
      } else {
        const requestedTag = body.final_tag.trim();

        if (requestedTag.length === 0) {
          normalizedFinalTag = null;
        } else {
          const matchingTag = itemWithSession.tags.find((tag) => tag.trim().toLowerCase() === requestedTag.toLowerCase());

          if (!matchingTag) {
            return NextResponse.json({ error: 'Invalid final_tag value' }, { status: 400 });
          }

          normalizedFinalTag = matchingTag;
        }
      }
    }

    const [updatedItem] = await db
      .update(items)
      .set({
        ...(typeof body.is_new === 'boolean' ? { isNew: body.is_new } : {}),
        ...(typeof body.excluded === 'boolean' ? { excluded: body.excluded } : {}),
        ...(typeof body.question_status === 'string' ? { questionStatus: body.question_status } : {}),
        ...(typeof normalizedFinalTag !== 'undefined' ? { finalTag: normalizedFinalTag } : {}),
      })
      .where(and(eq(items.id, params.id), eq(items.sessionId, itemWithSession.sessionId)))
      .returning({
        id: items.id,
        text: items.text,
        is_new: items.isNew,
        excluded: items.excluded,
        question_status: items.questionStatus,
        created_by: items.createdBy,
        finalTag: items.finalTag,
        final_tag: items.finalTag,
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
