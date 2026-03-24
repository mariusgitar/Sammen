import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { items, responses, sessions } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      .select({
        id: sessions.id,
        phase: sessions.phase,
        status: sessions.status,
        mode: sessions.mode,
        votingType: sessions.votingType,
        resultsVisible: sessions.resultsVisible,
      })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.resultsVisible) {
      return NextResponse.json({ error: 'not visible' }, { status: 403 });
    }

    const allItems = await db
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

    const allResponses = await db
      .select({
        item_id: responses.itemId,
        value: responses.value,
        participant_id: responses.participantId,
      })
      .from(responses)
      .where(eq(responses.sessionId, session.id));

    const participantCount = new Set(allResponses.map((response) => response.participant_id)).size;

    if (session.phase === 'stemming') {
      const votesByItem = new Map<string, number[]>();

      for (const entry of allResponses) {
        const numericVote = Number(entry.value);

        if (!Number.isFinite(numericVote) || numericVote < 0) {
          continue;
        }

        const current = votesByItem.get(entry.item_id) ?? [];
        current.push(numericVote);
        votesByItem.set(entry.item_id, current);
      }

      const summaryItems: StemmingSummaryItem[] = allItems.map((item) => {
        const itemVotes = votesByItem.get(item.id) ?? [];
        const distribution: Record<'1' | '2' | '3' | '4' | '5', number> = {
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 0,
          '5': 0,
        };

        if (session.votingType === 'scale') {
          for (const vote of itemVotes) {
            if (Number.isInteger(vote) && vote >= 1 && vote <= 5) {
              distribution[String(vote) as keyof typeof distribution] += 1;
            }
          }
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
        status: session.status,
        mode: session.mode,
        votingType: session.votingType,
        participantCount,
        items: summaryItems,
      });
    }

    const summaryItems: KartleggingSummaryItem[] = allItems.map((item) => {
      const itemResponses = allResponses.filter((response) => response.item_id === item.id);
      const tagCounts: Record<string, number> = {};

      for (const response of itemResponses) {
        tagCounts[response.value] = (tagCounts[response.value] ?? 0) + 1;
      }

      const taggedCount = new Set(itemResponses.map((response) => response.participant_id)).size;

      return {
        id: item.id,
        text: item.text,
        is_new: item.is_new,
        created_by: item.created_by,
        excluded: item.excluded,
        tagCounts,
        untaggedCount: participantCount - taggedCount,
      };
    });

    return NextResponse.json({
      phase: session.phase,
      status: session.status,
      mode: session.mode,
      votingType: session.votingType,
      participantCount,
      items: summaryItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
