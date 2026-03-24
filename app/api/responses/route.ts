import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { responses } from '@/db/schema';

type ResponseInput = {
  itemId: string;
  value: string;
};

type RequestBody = {
  sessionId: string;
  participantId: string;
  nickname: string;
  responses: ResponseInput[];
};

function isValidBody(candidate: unknown): candidate is RequestBody {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as Partial<RequestBody>;

  return (
    typeof body.sessionId === 'string' &&
    typeof body.participantId === 'string' &&
    typeof body.nickname === 'string' &&
    Array.isArray(body.responses) &&
    body.responses.every(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof entry.itemId === 'string' &&
        typeof entry.value === 'string' &&
        entry.value.trim().length > 0,
    )
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();

    for (const response of body.responses) {
      await db.insert(responses).values({
        sessionId: body.sessionId,
        itemId: response.itemId,
        participantId: body.participantId,
        value: response.value.trim(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
