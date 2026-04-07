import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, sessionPhases, sessionStatuses, sessions } from '@/db/schema';

type RouteContext = {
  params: {
    code: string;
  };
};

type PatchBody = {
  status?: string;
  phase?: string;
  results_visible?: boolean;
};

function isValidPatchBody(candidate: unknown): candidate is PatchBody {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as Partial<PatchBody>;

  if (typeof body.status !== 'undefined' && !sessionStatuses.includes(body.status as (typeof sessionStatuses)[number])) {
    return false;
  }

  if (typeof body.phase !== 'undefined' && !sessionPhases.includes(body.phase as (typeof sessionPhases)[number])) {
    return false;
  }

  if (typeof body.results_visible !== 'undefined' && typeof body.results_visible !== 'boolean') {
    return false;
  }

  return (
    typeof body.status !== 'undefined' ||
    typeof body.phase !== 'undefined' ||
    typeof body.results_visible !== 'undefined'
  );
}

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

    return NextResponse.json({ session, items: sessionItems });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as unknown;

    if (!isValidPatchBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const db = getDb();
    const code = params.code.toUpperCase();

    const [updatedSession] = await db
      .update(sessions)
      .set({
        ...(body.status ? { status: body.status as (typeof sessionStatuses)[number] } : {}),
        ...(body.phase ? { phase: body.phase as (typeof sessionPhases)[number] } : {}),
        ...(typeof body.results_visible === 'boolean' ? { resultsVisible: body.results_visible } : {}),
      })
      .where(eq(sessions.code, code))
      .returning({
        phase: sessions.phase,
        status: sessions.status,
        resultsVisible: sessions.resultsVisible,
      });

    if (!updatedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const db = getDb();
    const code = params.code.toUpperCase();

    const [existingSession] = await db
      .select({ id: sessions.id, status: sessions.status })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (existingSession.status === 'active') {
      return NextResponse.json(
        { error: 'Kan ikke slette en aktiv sesjon. Avslutt den først.' },
        { status: 400 },
      );
    }

    await db.delete(sessions).where(eq(sessions.id, existingSession.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
