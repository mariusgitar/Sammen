import { and, asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { normalizeSession } from '@/app/lib/normalizeSession';
import { getDb } from '@/db';
import { innspill, innspillThemes, items, responses, sessions, themes } from '@/db/schema';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { code: string } };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const db = getDb();
    const code = params.code.toUpperCase();
    const { searchParams } = new URL(request.url);
    const participantId = searchParams.get('participantId') ?? '';

    // --- session ---
    const [sessionRow] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!sessionRow) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = normalizeSession(sessionRow as Record<string, unknown>);

    // --- items ---
    const sessionItems = await db
      .select({
        id: items.id,
        text: items.text,
        description: items.description,
        isNew: items.isNew,
        excluded: items.excluded,
        orderIndex: items.orderIndex,
        isQuestion: items.isQuestion,
        questionStatus: items.questionStatus,
        defaultTag: items.defaultTag,
        finalTag: items.finalTag,
        createdAt: items.createdAt,
      })
      .from(items)
      .where(eq(items.sessionId, sessionRow.id))
      .orderBy(asc(items.orderIndex), asc(items.createdAt));

    // --- innspill (questions + their submissions) ---
    const questions = sessionItems.filter((item) => item.isQuestion);

    const allInnspill =
      questions.length === 0
        ? []
        : await db
            .select({
              id: innspill.id,
              questionId: innspill.questionId,
              text: innspill.text,
              detaljer: innspill.detaljer,
              nickname: innspill.nickname,
              likes: innspill.likes,
              participantId: innspill.participantId,
              createdAt: innspill.createdAt,
            })
            .from(innspill)
            .where(eq(innspill.sessionId, sessionRow.id));

    const innspillByQuestion = questions
      .map((q) => ({
        id: q.id,
        text: q.text,
        questionStatus: q.questionStatus,
        innspill: allInnspill
          .filter((i) => i.questionId === q.id)
          .map((i) => ({
            id: i.id,
            text: i.text,
            detaljer: i.detaljer,
            nickname: i.nickname,
            likes: i.likes,
            participantId: i.participantId,
            createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : String(i.createdAt),
          }))
          .sort((a, b) => b.likes - a.likes),
      }))
      .filter((q) => q.questionStatus === 'active' || q.innspill.length > 0);

    // --- themes ---
    const sessionThemes = await db
      .select({
        id: themes.id,
        name: themes.name,
        description: themes.description,
        color: themes.color,
        orderIndex: themes.orderIndex,
      })
      .from(themes)
      .where(eq(themes.sessionId, sessionRow.id))
      .orderBy(asc(themes.orderIndex), asc(themes.createdAt));

    const themeLinks =
      sessionThemes.length === 0
        ? []
        : await db
            .select({
              themeId: innspillThemes.themeId,
              innspillId: innspillThemes.innspillId,
            })
            .from(innspillThemes)
            .where(inArray(innspillThemes.themeId, sessionThemes.map((t) => t.id)));

    const themedInnspillIds = new Set(themeLinks.map((l) => l.innspillId));

    const themesWithInnspill = sessionThemes.map((theme) => {
      const linkedIds = themeLinks.filter((l) => l.themeId === theme.id).map((l) => l.innspillId);
      return {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        color: theme.color,
        orderIndex: theme.orderIndex,
        innspill: allInnspill
          .filter((i) => linkedIds.includes(i.id))
          .map((i) => ({
            id: i.id,
            text: i.text,
            detaljer: i.detaljer,
            nickname: i.nickname,
            likes: i.likes,
          })),
      };
    });

    const ungrouped = allInnspill
      .filter((i) => !themedInnspillIds.has(i.id))
      .map((i) => ({
        id: i.id,
        text: i.text,
        detaljer: i.detaljer,
        nickname: i.nickname,
        likes: i.likes,
        participantId: i.participantId,
        createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : String(i.createdAt),
      }));

    // --- myResponses (filtered by participantId) ---
    const myResponses =
      participantId === ''
        ? []
        : await db
            .select({
              itemId: responses.itemId,
              value: responses.value,
            })
            .from(responses)
            .where(
              and(
                eq(responses.sessionId, sessionRow.id),
                eq(responses.participantId, participantId),
              ),
            );

    return NextResponse.json({
      session,
      items: sessionItems.map((item) => ({
        ...item,
        createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
      })),
      innspill: innspillByQuestion,
      themes: themesWithInnspill,
      ungrouped,
      myResponses,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
