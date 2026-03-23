import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, sessionModes, sessions } from '@/db/schema';
import { generateCode } from '@/lib/generate-code';

type CreateSessionBody = {
  title: string;
  mode: (typeof sessionModes)[number];
  items: string[];
  tags: string[];
  allow_new_items: boolean;
};

function isCreateSessionBody(body: unknown): body is CreateSessionBody {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const candidate = body as Partial<CreateSessionBody>;

  return (
    typeof candidate.title === 'string' &&
    sessionModes.includes(candidate.mode as (typeof sessionModes)[number]) &&
    Array.isArray(candidate.items) &&
    candidate.items.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === 'string') &&
    typeof candidate.allow_new_items === 'boolean'
  );
}

async function generateUniqueCode() {
  const db = getDb();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateCode();
    const existing = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code)).limit(1);

    if (existing.length === 0) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique session code');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;

    if (!isCreateSessionBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const title = body.title.trim();
    const itemTexts = body.items.map((item) => item.trim()).filter(Boolean);
    const tags = body.tags.map((tag) => tag.trim()).filter(Boolean);

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const code = await generateUniqueCode();
    const db = getDb();

    const createdSession = await db.transaction(async (tx) => {
      const [session] = await tx
        .insert(sessions)
        .values({
          code,
          title,
          mode: body.mode,
          tags,
          allowNewItems: body.allow_new_items,
        })
        .returning({
          id: sessions.id,
          code: sessions.code,
          title: sessions.title,
          mode: sessions.mode,
          status: sessions.status,
          tags: sessions.tags,
        });

      if (itemTexts.length > 0) {
        await tx.insert(items).values(
          itemTexts.map((text, orderIndex) => ({
            sessionId: session.id,
            text,
            orderIndex,
          }))
        );
      }

      return session;
    });

    return NextResponse.json({ session: createdSession }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
