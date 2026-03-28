import { asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, innspillThemes, sessions, themes } from '@/db/schema';

export async function GET(_request: Request, { params }: { params: { code: string } }) {
  try {
    const db = getDb();
    const code = params.code.toUpperCase();

    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
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
