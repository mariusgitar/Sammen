import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, sessions } from '@/db/schema';

type RouteContext = {
  params: {
    code: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const code = params.code.toUpperCase();
    const db = getDb();

    const [session] = await db
      .select({
        id: sessions.id,
        code: sessions.code,
        title: sessions.title,
        mode: sessions.mode,
        votingType: sessions.votingType,
        dotBudget: sessions.dotBudget,
        allowMultipleDots: sessions.allowMultipleDots,
        phase: sessions.phase,
        status: sessions.status,
        resultsVisible: sessions.resultsVisible,
        results_visible: sessions.resultsVisible,
        tags: sessions.tags,
        allowNewItems: sessions.allowNewItems,
        visibilityMode: sessions.visibilityMode,
        show_others_innspill: sessions.showOthersInnspill,
        showOthersInnspill: sessions.showOthersInnspill,
        innspill_mode: sessions.innspillMode,
        innspill_max_chars: sessions.innspillMaxChars,
        maxRankItems: sessions.maxRankItems,
        timerEndsAt: sessions.timerEndsAt,
        timerLabel: sessions.timerLabel,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionItems = await db
      .select({
        id: items.id,
        sessionId: items.sessionId,
        text: items.text,
        description: items.description,
        createdBy: items.createdBy,
        isNew: items.isNew,
        excluded: items.excluded,
        isQuestion: items.isQuestion,
        questionStatus: items.questionStatus,
        defaultTag: items.defaultTag,
        default_tag: items.defaultTag,
        finalTag: items.finalTag,
        final_tag: items.finalTag,
        orderIndex: items.orderIndex,
        createdAt: items.createdAt,
      })
      .from(items)
      .where(eq(items.sessionId, session.id))
      .orderBy(asc(items.orderIndex), asc(items.createdAt));

    const responseSession = {
      ...session,
      results_visible: session.resultsVisible ?? false,
    };

    return NextResponse.json({ session: responseSession, items: sessionItems });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
