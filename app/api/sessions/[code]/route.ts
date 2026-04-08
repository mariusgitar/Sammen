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
  title?: string;
  status?: string;
  phase?: string;
  results_visible?: boolean;
  allow_new_items?: boolean;
  show_others_innspill?: boolean;
  innspill_max_chars?: number;
  dot_budget?: number;
  show_tag_headers?: boolean;
  timer_ends_at?: string | null;
  timer_label?: string | null;
  active_filter?: 'alle' | 'uenighet' | 'usikker' | 'konsensus';
};

function isValidPatchBody(candidate: unknown): candidate is PatchBody {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const body = candidate as Partial<PatchBody>;

  if (typeof body.title !== 'undefined' && (typeof body.title !== 'string' || body.title.trim().length === 0)) {
    return false;
  }

  if (typeof body.status !== 'undefined' && !sessionStatuses.includes(body.status as (typeof sessionStatuses)[number])) {
    return false;
  }

  if (typeof body.phase !== 'undefined' && !sessionPhases.includes(body.phase as (typeof sessionPhases)[number])) {
    return false;
  }

  if (typeof body.results_visible !== 'undefined' && typeof body.results_visible !== 'boolean') {
    return false;
  }

  if (typeof body.allow_new_items !== 'undefined' && typeof body.allow_new_items !== 'boolean') {
    return false;
  }

  if (typeof body.show_others_innspill !== 'undefined' && typeof body.show_others_innspill !== 'boolean') {
    return false;
  }

  if (typeof body.innspill_max_chars !== 'undefined' && (!Number.isInteger(body.innspill_max_chars) || body.innspill_max_chars < 50 || body.innspill_max_chars > 500)) {
    return false;
  }

  if (typeof body.dot_budget !== 'undefined' && (!Number.isInteger(body.dot_budget) || body.dot_budget < 1 || body.dot_budget > 20)) {
    return false;
  }

  if (typeof body.show_tag_headers !== 'undefined' && typeof body.show_tag_headers !== 'boolean') {
    return false;
  }

  if (typeof body.timer_ends_at !== 'undefined') {
    if (body.timer_ends_at !== null && typeof body.timer_ends_at !== 'string') {
      return false;
    }

    if (typeof body.timer_ends_at === 'string' && Number.isNaN(Date.parse(body.timer_ends_at))) {
      return false;
    }
  }

  if (typeof body.timer_label !== 'undefined' && body.timer_label !== null && typeof body.timer_label !== 'string') {
    return false;
  }

  if (
    typeof body.active_filter !== 'undefined' &&
    !['alle', 'uenighet', 'usikker', 'konsensus'].includes(body.active_filter)
  ) {
    return false;
  }

  return (
    typeof body.title !== 'undefined' ||
    typeof body.status !== 'undefined' ||
    typeof body.phase !== 'undefined' ||
    typeof body.results_visible !== 'undefined' ||
    typeof body.allow_new_items !== 'undefined' ||
    typeof body.show_others_innspill !== 'undefined' ||
    typeof body.innspill_max_chars !== 'undefined' ||
    typeof body.dot_budget !== 'undefined' ||
    typeof body.show_tag_headers !== 'undefined' ||
    typeof body.timer_ends_at !== 'undefined' ||
    typeof body.timer_label !== 'undefined' ||
    typeof body.active_filter !== 'undefined'
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
        showTagHeaders: sessions.showTagHeaders,
        show_tag_headers: sessions.showTagHeaders,
        visibilityMode: sessions.visibilityMode,
        show_others_innspill: sessions.showOthersInnspill,
        showOthersInnspill: sessions.showOthersInnspill,
        innspill_mode: sessions.innspillMode,
        innspill_max_chars: sessions.innspillMaxChars,
        maxRankItems: sessions.maxRankItems,
        timerEndsAt: sessions.timerEndsAt,
        timerLabel: sessions.timerLabel,
        active_filter: sessions.activeFilter,
        timer_ends_at: sessions.timerEndsAt,
        timer_label: sessions.timerLabel,
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
        ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
        ...(body.status ? { status: body.status as (typeof sessionStatuses)[number] } : {}),
        ...(body.phase ? { phase: body.phase as (typeof sessionPhases)[number] } : {}),
        ...(typeof body.results_visible === 'boolean' ? { resultsVisible: body.results_visible } : {}),
        ...(typeof body.allow_new_items === 'boolean' ? { allowNewItems: body.allow_new_items } : {}),
        ...(typeof body.show_others_innspill === 'boolean' ? { showOthersInnspill: body.show_others_innspill } : {}),
        ...(typeof body.innspill_max_chars === 'number' ? { innspillMaxChars: body.innspill_max_chars } : {}),
        ...(typeof body.dot_budget === 'number' ? { dotBudget: body.dot_budget } : {}),
        ...(typeof body.show_tag_headers === 'boolean' ? { showTagHeaders: body.show_tag_headers } : {}),
        ...(typeof body.timer_ends_at !== 'undefined'
          ? { timerEndsAt: body.timer_ends_at ? new Date(body.timer_ends_at) : null }
          : {}),
        ...(typeof body.timer_label !== 'undefined' ? { timerLabel: body.timer_label } : {}),
        ...(typeof body.active_filter === 'string' ? { activeFilter: body.active_filter } : {}),
      })
      .where(eq(sessions.code, code))
      .returning({
        title: sessions.title,
        dotBudget: sessions.dotBudget,
        dot_budget: sessions.dotBudget,
        phase: sessions.phase,
        status: sessions.status,
        resultsVisible: sessions.resultsVisible,
        allowNewItems: sessions.allowNewItems,
        allow_new_items: sessions.allowNewItems,
        showOthersInnspill: sessions.showOthersInnspill,
        show_others_innspill: sessions.showOthersInnspill,
        innspillMaxChars: sessions.innspillMaxChars,
        innspill_max_chars: sessions.innspillMaxChars,
        showTagHeaders: sessions.showTagHeaders,
        show_tag_headers: sessions.showTagHeaders,
        timerEndsAt: sessions.timerEndsAt,
        timerLabel: sessions.timerLabel,
        active_filter: sessions.activeFilter,
        timer_ends_at: sessions.timerEndsAt,
        timer_label: sessions.timerLabel,
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
