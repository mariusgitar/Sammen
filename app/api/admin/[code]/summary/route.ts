import { asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/db';
import { innspillThemes, items, responses, sessions, themes } from '@/db/schema';

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
  stdDev: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
};

type RangeringSummaryItem = {
  id: string;
  text: string;
  is_new: boolean;
  created_by: string;
  excluded: boolean;
  average_position: number;
  vote_count: number;
  position_distribution: Record<string, number>;
  minPosition: number | null;
  maxPosition: number | null;
};

type ThemeSummaryItem = {
  id: string;
  name: string;
  color: string;
  totalDots: number;
  topInnspill: Array<{
    id: string;
    text: string;
    dots: number;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const db = getDb();
    const code = params.code.toUpperCase();

    const [session] = await db
      .select({ id: sessions.id, mode: sessions.mode, phase: sessions.phase, status: sessions.status, votingType: sessions.votingType })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
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

    const participantCount = new Set(allResponses.map((r) => r.participant_id)).size;

    const sessionThemes = await db
      .select({
        id: themes.id,
        name: themes.name,
        color: themes.color,
        order_index: themes.orderIndex,
      })
      .from(themes)
      .where(eq(themes.sessionId, session.id))
      .orderBy(asc(themes.orderIndex));

    const innspillThemeLinks =
      sessionThemes.length > 0
        ? await db
            .select({
              innspill_id: innspillThemes.innspillId,
              theme_id: innspillThemes.themeId,
            })
            .from(innspillThemes)
            .where(inArray(innspillThemes.themeId, sessionThemes.map((theme) => theme.id)))
        : [];

    const themeResults: ThemeSummaryItem[] = sessionThemes.map((theme) => {
      const linkedInnspillIds = innspillThemeLinks.filter((link) => link.theme_id === theme.id).map((link) => link.innspill_id);
      const linkedInnspillIdSet = new Set(linkedInnspillIds);

      const themeResponses = allResponses.filter((response) => linkedInnspillIdSet.has(response.item_id));
      const totalDots = themeResponses.reduce((sum, response) => sum + (Number.parseInt(response.value, 10) || 0), 0);

      const topInnspill = linkedInnspillIds
        .map((linkedId) => {
          const dots = allResponses
            .filter((response) => response.item_id === linkedId)
            .reduce((sum, response) => sum + (Number.parseInt(response.value, 10) || 0), 0);
          const item = allItems.find((candidate) => candidate.id === linkedId);
          return { id: linkedId, text: item?.text ?? 'Ukjent innspill', dots };
        })
        .sort((a, b) => b.dots - a.dots)
        .slice(0, 3);

      return {
        id: theme.id,
        name: theme.name,
        color: theme.color,
        totalDots,
        topInnspill,
      };
    });

    if (session.mode === 'rangering') {
      const positionByItem = new Map<string, number[]>();
      const positionDistributionByItem = new Map<string, Record<string, number>>();

      for (const entry of allResponses) {
        const numericValue = Number(entry.value);

        if (!Number.isInteger(numericValue) || numericValue <= 0) {
          continue;
        }

        const currentVotes = positionByItem.get(entry.item_id) ?? [];
        currentVotes.push(numericValue);
        positionByItem.set(entry.item_id, currentVotes);

        const currentDistribution = positionDistributionByItem.get(entry.item_id) ?? {};
        const key = String(numericValue);
        currentDistribution[key] = (currentDistribution[key] ?? 0) + 1;
        positionDistributionByItem.set(entry.item_id, currentDistribution);
      }

      const summaryItems: RangeringSummaryItem[] = allItems
        .map((item) => {
          const itemVotes = positionByItem.get(item.id) ?? [];
          const voteCount = itemVotes.length;
          const averagePosition = voteCount > 0 ? itemVotes.reduce((sum, vote) => sum + vote, 0) / voteCount : Number.POSITIVE_INFINITY;

          return {
            id: item.id,
            text: item.text,
            is_new: item.is_new,
            created_by: item.created_by,
            excluded: item.excluded,
            average_position: averagePosition,
            vote_count: voteCount,
            position_distribution: positionDistributionByItem.get(item.id) ?? {},
            minPosition: voteCount > 0 ? Math.min(...itemVotes) : null,
            maxPosition: voteCount > 0 ? Math.max(...itemVotes) : null,
          };
        })
        .sort((a, b) => a.average_position - b.average_position);

      return NextResponse.json({
        mode: session.mode,
        phase: session.phase,
        status: session.status,
        votingType: session.votingType,
        participantCount,
        items: summaryItems,
        themes: themeResults,
      });
    }

    if (session.phase === 'stemming') {
      const votesByItem = new Map<string, number[]>();

      for (const entry of allResponses) {
        const numericVote = Number(entry.value);

        if (!Number.isInteger(numericVote) || numericVote < 1 || numericVote > 5) {
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

        for (const vote of itemVotes) {
          distribution[String(vote) as keyof typeof distribution] += 1;
        }

        const voteCount = itemVotes.length;
        const averageScore = voteCount > 0 ? itemVotes.reduce((sum, vote) => sum + vote, 0) / voteCount : 0;
        const stdDev =
          voteCount > 0
            ? Math.sqrt(itemVotes.reduce((sum, vote) => sum + Math.pow(vote - averageScore, 2), 0) / voteCount)
            : 0;

        return {
          id: item.id,
          text: item.text,
          is_new: item.is_new,
          created_by: item.created_by,
          excluded: item.excluded,
          averageScore,
          voteCount,
          stdDev,
          distribution,
        };
      });

      return NextResponse.json({
        mode: session.mode,
        phase: session.phase,
        status: session.status,
        votingType: session.votingType,
        participantCount,
        items: summaryItems,
        themes: themeResults,
      });
    }

    const itemSummaries: KartleggingSummaryItem[] = allItems.map((item) => {
      const itemResponses = allResponses.filter((r) => r.item_id === item.id);
      const tagCounts: Record<string, number> = {};

      for (const r of itemResponses) {
        tagCounts[r.value] = (tagCounts[r.value] ?? 0) + 1;
      }

      const taggedCount = new Set(itemResponses.map((r) => r.participant_id)).size;

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
      mode: session.mode,
      phase: session.phase,
      status: session.status,
      votingType: session.votingType,
      participantCount,
      items: itemSummaries,
      themes: themeResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
