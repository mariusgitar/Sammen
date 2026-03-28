import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, innspillThemes, sessions, themes } from '@/db/schema';

const ADMIN_COOKIE_NAME = 'admin_session';

type ThemeInput = {
  name: string;
  description?: string;
  color: string;
  innspill_ids: string[];
};

async function getSha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const password = process.env.ADMIN_PASSWORD || '';

  if (!cookieValue || !password) {
    return false;
  }

  const expectedHash = await getSha256Hex(password);
  return cookieValue === expectedHash;
}

function isValidPostBody(candidate: unknown): candidate is { themes: ThemeInput[] } {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as { themes?: ThemeInput[] };

  if (!Array.isArray(body.themes)) {
    return false;
  }

  return body.themes.every((theme) => (
    typeof theme?.name === 'string' &&
    theme.name.trim().length > 0 &&
    typeof theme.color === 'string' &&
    theme.color.trim().length > 0 &&
    Array.isArray(theme.innspill_ids)
  ));
}

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const db = getDb();
    const code = params.code.toUpperCase();
    const admin = await isAdminRequest(request);

    const [session] = await db
      .select({ id: sessions.id, resultsVisible: sessions.resultsVisible })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!admin && !session.resultsVisible) {
      return NextResponse.json({ error: 'Resultater er ikke synlige' }, { status: 403 });
    }

    const sessionThemes = await db
      .select({
        id: themes.id,
        name: themes.name,
        description: themes.description,
        color: themes.color,
        order_index: themes.orderIndex,
      })
      .from(themes)
      .where(eq(themes.sessionId, session.id))
      .orderBy(asc(themes.orderIndex), asc(themes.createdAt));

    const sessionInnspill = await db
      .select({
        id: innspill.id,
        text: innspill.text,
        detaljer: innspill.detaljer,
        nickname: innspill.nickname,
        likes: innspill.likes,
        created_at: innspill.createdAt,
      })
      .from(innspill)
      .where(eq(innspill.sessionId, session.id));

    const allThemeIds = sessionThemes.map((theme) => theme.id);
    const themeLinks = allThemeIds.length === 0
      ? []
      : await db
        .select({ innspill_id: innspillThemes.innspillId, theme_id: innspillThemes.themeId })
        .from(innspillThemes)
        .where(inArray(innspillThemes.themeId, allThemeIds));

    const themeByInnspillId = new Map<string, string>();
    for (const link of themeLinks) {
      themeByInnspillId.set(link.innspill_id, link.theme_id);
    }

    const serializedThemes = sessionThemes.map((theme) => ({
      ...theme,
      innspill: sessionInnspill.filter((entry) => themeByInnspillId.get(entry.id) === theme.id),
    }));

    const ungrouped = sessionInnspill.filter((entry) => !themeByInnspillId.has(entry.id));

    return NextResponse.json({ themes: serializedThemes, ungrouped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { code: string } }) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidPostBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();
    const code = params.code.toUpperCase();

    const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.code, code)).limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const existingThemes = await db
      .select({ id: themes.id })
      .from(themes)
      .where(eq(themes.sessionId, session.id));

    const existingThemeIds = existingThemes.map((theme) => theme.id);

    if (existingThemeIds.length > 0) {
      await db.delete(innspillThemes).where(inArray(innspillThemes.themeId, existingThemeIds));
    }

    await db.delete(themes).where(eq(themes.sessionId, session.id));

    if (body.themes.length === 0) {
      return NextResponse.json({ themes: [] });
    }

    const insertedThemes = await db
      .insert(themes)
      .values(
        body.themes.map((theme, index) => ({
          sessionId: session.id,
          name: theme.name.trim(),
          description: theme.description?.trim() || null,
          color: theme.color,
          orderIndex: index,
        })),
      )
      .returning({
        id: themes.id,
        name: themes.name,
        description: themes.description,
        color: themes.color,
        order_index: themes.orderIndex,
      });

    const linksToInsert = insertedThemes.flatMap((insertedTheme, index) => {
      const inputTheme = body.themes[index];
      return inputTheme.innspill_ids.map((innspillId) => ({
        innspillId,
        themeId: insertedTheme.id,
      }));
    });

    if (linksToInsert.length > 0) {
      await db.insert(innspillThemes).values(linksToInsert).onConflictDoNothing();
    }

    const fullThemes = insertedThemes.map((theme) => ({ ...theme, innspill: [] as Array<{ id: string }> }));

    return NextResponse.json({ themes: fullThemes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
