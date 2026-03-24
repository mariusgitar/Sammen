import { asc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { items, responses, sessions } from '@/db/schema';

type RouteContext = {
  params: {
    code: string;
  };
};

type KartleggingSummaryItem = {
  id: string;
  text: string;
  is_new: boolean;
  created_by: string;
  excluded: boolean;
  tagCounts: Record<string, number>;
  untaggedCount: number;
};

type StemmingSummaryItem = {
  id: string;
  text: string;
  is_new: boolean;
  created_by: string;
  excluded: boolean;
  averageScore: number;
  voteCount: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const db = getDb();
    const code = params.code.toUpperCase();

    const [session] = await db
      .select({ id: sessions.id, phase: sessions.phase })
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
        excluded: items.excluded,
      })
      .from(items)
      .where(eq(items.sessionId, session.id))
      .orderBy(asc(items.orderIndex), asc(items.createdAt));

    const sessionResponses = await db
      .select({
        itemId: responses.itemId,
        value: responses.value,
        participantId: responses.participantId,
      })
      .from(responses)
      .where(eq(responses.sessionId, session.id));

    if (session.phase === 'stemming') {
      const votesByItem = new Map<string, number[]>();

      for (const entry of sessionResponses) {
        const numericVote = Number(entry.value);

        if (!Number.isInteger(numericVote) || numericVote < 1 || numericVote > 5) {
          continue;
        }

        const current = votesByItem.get(entry.itemId) ?? [];
        current.push(numericVote);
        votesByItem.set(entry.itemId, current);
      }

      const summaryItems: StemmingSummaryItem[] = sessionItems
        .filter((item) => !item.excluded)
        .map((item) => {
          const itemVotes = votesByItem.get(item.id) ?? [];
          const distribution: Record<'1' | '2' | '3' | '4' | '5', number> = {
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
            '5': 0,
          };

          for (const vote of itemVotes) {
            distribution[String(vote) as keyof typeof distribution] += 1;
          }

          const voteCount = itemVotes.length;
          const averageScore = voteCount > 0 ? itemVotes.reduce((sum, vote) => sum + vote, 0) / voteCount : 0;

          return {
            id: item.id,
            text: item.text,
            is_new: item.is_new,
            created_by: item.created_by,
            excluded: item.excluded,
            averageScore,
            voteCount,
            distribution,
          };
        });

      return NextResponse.json({
        phase: session.phase,
        participantCount: Number(participantTotals?.participantCount ?? 0),
        items: summaryItems,
      });
    }

    const tagsByItem = new Map<string, Record<string, number>>();
    const participantIdsByItem = new Map<string, Set<string>>();
    const allParticipantIds = new Set<string>();

    for (const entry of sessionResponses) {
      const current = tagsByItem.get(entry.itemId) ?? {};
      current[entry.value] = (current[entry.value] ?? 0) + 1;
      tagsByItem.set(entry.itemId, current);

      const itemParticipants = participantIdsByItem.get(entry.itemId) ?? new Set<string>();
      itemParticipants.add(entry.participantId);
      participantIdsByItem.set(entry.itemId, itemParticipants);

      allParticipantIds.add(entry.participantId);
    }

    const summaryItems: KartleggingSummaryItem[] = sessionItems.map((item) => {
      const tagCounts = tagsByItem.get(item.id) ?? {};
      const taggedParticipants = participantIdsByItem.get(item.id)?.size ?? 0;
      const totalParticipants = allParticipantIds.size;

      return {
        id: item.id,
        text: item.text,
        is_new: item.is_new,
        created_by: item.created_by,
        excluded: item.excluded,
        tagCounts,
        untaggedCount: Math.max(0, totalParticipants - taggedParticipants),
      };
    });

    return NextResponse.json({
      phase: session.phase,
      participantCount: Number(participantTotals?.participantCount ?? 0),
      items: summaryItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
