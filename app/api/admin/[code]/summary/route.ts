import { asc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { items, responses, sessions } from '@/db/schema';

type RouteContext = {
  params: {
    code: string;
  };
};

type SummaryItem = {
  id: string;
  text: string;
  is_new: boolean;
  created_by: string;
  tagCounts: Record<string, number>;
  untaggedCount: number;
};

export async function GET(_request: Request, { params }: RouteContext) {
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

    const [participantTotals] = await db
      .select({
        participantCount: sql<number>`count(distinct ${responses.participantId})`,
      })
      .from(responses)
      .where(eq(responses.sessionId, session.id));

    const sessionItems = await db
      .select({
        id: items.id,
        text: items.text,
        is_new: items.isNew,
        created_by: items.createdBy,
      })
      .from(items)
      .where(eq(items.sessionId, session.id))
      .orderBy(asc(items.orderIndex), asc(items.createdAt));

    const sessionResponses = await db
      .select({
        itemId: responses.itemId,
        tag: responses.value,
        participantId: responses.participantId,
      })
      .from(responses)
      .where(eq(responses.sessionId, session.id));

    console.log('Admin summary items raw result:', sessionItems);
    console.log('Admin summary responses raw result:', sessionResponses);

    const tagsByItem = new Map<string, Record<string, number>>();
    const participantIdsByItem = new Map<string, Set<string>>();
    const allParticipantIds = new Set<string>();

    for (const entry of sessionResponses) {
      const current = tagsByItem.get(entry.itemId) ?? {};
      current[entry.tag] = (current[entry.tag] ?? 0) + 1;
      tagsByItem.set(entry.itemId, current);

      const itemParticipants = participantIdsByItem.get(entry.itemId) ?? new Set<string>();
      itemParticipants.add(entry.participantId);
      participantIdsByItem.set(entry.itemId, itemParticipants);

      allParticipantIds.add(entry.participantId);
    }

    const summaryItems: SummaryItem[] = sessionItems.map((item) => {
      const tagCounts = tagsByItem.get(item.id) ?? {};
      const taggedParticipants = participantIdsByItem.get(item.id)?.size ?? 0;
      const totalParticipants = allParticipantIds.size;

      return {
        id: item.id,
        text: item.text,
        is_new: item.is_new,
        created_by: item.created_by,
        tagCounts,
        untaggedCount: Math.max(0, totalParticipants - taggedParticipants),
      };
    });

    return NextResponse.json({
      participantCount: Number(participantTotals?.participantCount ?? 0),
      items: summaryItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
