import { asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspill, innspillThemes, sessions, themes } from '@/db/schema';

export async function GET(_request: Request, { params }: { params: { code: string } }) {
  try {
    const db = getDb();
    const code = params.code.toUpperCase();

    const [session] = await db
      .select({
        id: sessions.id,
        results_visible: sessions.resultsVisible,
      })
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

    const themeIds = sessionThemes.map((theme) => theme.id);

    const linkedInnspill = themeIds.length === 0
      ? []
      : await db
          .select({
            theme_id: innspillThemes.themeId,
            innspill_id: innspillThemes.innspillId,
            text: innspill.text,
            detaljer: innspill.detaljer,
            likes: innspill.likes,
            nickname: innspill.nickname,
            created_at: innspill.createdAt,
          })
          .from(innspillThemes)
          .innerJoin(innspill, eq(innspillThemes.innspillId, innspill.id))
          .where(inArray(innspillThemes.themeId, themeIds));

    const linkedInnspillIds = new Set(linkedInnspill.map((entry) => entry.innspill_id));

    const serializedThemes = sessionThemes.map((theme) => ({
      ...theme,
      innspill: linkedInnspill.filter((entry) => entry.theme_id === theme.id),
    }));

    const ungrouped = sessionInnspill.filter((entry) => !linkedInnspillIds.has(entry.id));

    return NextResponse.json({ themes: serializedThemes, ungrouped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
