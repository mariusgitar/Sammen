'use client';

import { useEffect, useMemo, useState } from 'react';

import { InnspillView } from './InnspillView';
import { KartleggingView } from './KartleggingView';
import { StemmingView } from './StemmingView';
import { RangeringView } from './RangeringView';
import { TimerBanner } from '@/app/components/TimerBanner';

type ParticipantPageProps = {
  params: {
    code: string;
  };
};

type SessionStatus = 'setup' | 'active' | 'paused' | 'closed';
type SessionPhase = 'kartlegging' | 'stemming' | 'innspill' | 'rangering';
type QuestionStatus = 'inactive' | 'active' | 'locked';

type SessionResponse = {
  session: {
    id: string;
    code: string;
    title: string;
    mode: 'kartlegging' | 'stemming' | 'aapne-innspill' | 'rangering';
    votingType: 'scale' | 'dots';
    dotBudget: number;
    allowMultipleDots: boolean;
    phase: SessionPhase;
    status: SessionStatus;
    resultsVisible: boolean;
    tags: string[];
    allowNewItems: boolean;
    visibilityMode: 'manual' | 'all';
    show_others_innspill: boolean;
    innspill_mode: 'enkel' | 'detaljert';
    innspill_max_chars: number;
    maxRankItems: number | null;
    timerEndsAt: string | null;
    timerLabel: string | null;
  };
  items: Array<{
    id: string;
    text: string;
    description: string | null;
    isNew: boolean;
    excluded: boolean;
    orderIndex: number;
    isQuestion: boolean;
    questionStatus: QuestionStatus;
    defaultTag: string | null;
    default_tag: string | null;
    finalTag: string | null;
    final_tag: string | null;
  }>;
};

type ErrorResponse = {
  error: string;
};

export default function ParticipantPage({ params }: ParticipantPageProps) {
  const code = useMemo(() => params.code.toUpperCase(), [params.code]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isNotFound, setIsNotFound] = useState(false);
  const [data, setData] = useState<SessionResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSession() {
      try {
        const response = await fetch(`/api/delta/${code}`, { cache: 'no-store' });
        const payload = (await response.json()) as SessionResponse | ErrorResponse;

        if (!isMounted) {
          return;
        }

        if (response.status === 404) {
          setIsNotFound(true);
          setError('');
          setData(null);
          return;
        }

        if (!response.ok || !('session' in payload) || !('items' in payload)) {
          setError('error' in payload ? payload.error : 'Kunne ikke hente sesjonsdata.');
          return;
        }

        setIsNotFound(false);
        setError('');
        setData(payload);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : 'Kunne ikke hente sesjonsdata.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchSession();
    const timer = setInterval(() => {
      void fetchSession();
    }, 5_000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [code]);

  if (isLoading) return <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6"><div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold text-[#0f172a]">Laster sesjon…</h1></div></main>;
  if (isNotFound) return <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6"><div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold text-[#0f172a]">Sesjon ikke funnet</h1></div></main>;

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0f172a]">Kunne ikke laste sesjonen</h1>
          {error ? <p className="mt-2 text-sm text-[#64748b]">{error}</p> : null}
        </div>
      </main>
    );
  }

  const { session, items } = data;

  if (session.status === 'closed') {
    return <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6"><div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold text-[#0f172a]">Sesjonen er avsluttet.</h1></div><TimerBanner timerEndsAt={session.timerEndsAt} timerLabel={session.timerLabel} /></main>;
  }

  if (session.status === 'setup' || session.status === 'paused') {
    return <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6"><div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold text-[#0f172a]">Sesjonen er ikke åpen ennå. Vent på fasilitator.</h1></div><TimerBanner timerEndsAt={session.timerEndsAt} timerLabel={session.timerLabel} /></main>;
  }

  if (session.mode === 'aapne-innspill' && session.status === 'active') {
    return (
      <>
        <InnspillView session={session} items={items.filter((item) => item.isQuestion)} />
        <TimerBanner timerEndsAt={session.timerEndsAt} timerLabel={session.timerLabel} />
      </>
    );
  }


  if (session.mode === 'rangering' && session.status === 'active') {
    return (
      <>
        <RangeringView
          items={items.filter((item) => !item.excluded).map((item) => ({ id: item.id, text: item.text, description: item.description }))}
          session={{
            id: session.id,
            title: session.title,
            code: session.code,
            maxRankItems: session.maxRankItems,
          }}
        />
        <TimerBanner timerEndsAt={session.timerEndsAt} timerLabel={session.timerLabel} />
      </>
    );
  }

  if (session.status === 'active' && (session.phase === 'stemming' || session.mode === 'stemming')) {
    const tagOrder = new Map(session.tags.map((tag, index) => [tag, index]));
    const votableItems = items
      .filter((item) => !item.excluded && !item.isQuestion)
      .sort((a, b) => {
        const aFinalTag = a.finalTag ?? a.final_tag;
        const bFinalTag = b.finalTag ?? b.final_tag;

        if (!aFinalTag && !bFinalTag) {
          return a.orderIndex - b.orderIndex;
        }

        if (!aFinalTag) {
          return 1;
        }

        if (!bFinalTag) {
          return -1;
        }

        const aTagIndex = tagOrder.get(aFinalTag);
        const bTagIndex = tagOrder.get(bFinalTag);

        if (aTagIndex !== undefined && bTagIndex !== undefined && aTagIndex !== bTagIndex) {
          return aTagIndex - bTagIndex;
        }

        if (aTagIndex !== undefined && bTagIndex === undefined) {
          return -1;
        }

        if (aTagIndex === undefined && bTagIndex !== undefined) {
          return 1;
        }

        const alphabeticalSort = aFinalTag.localeCompare(bFinalTag, 'nb');

        if (alphabeticalSort !== 0) {
          return alphabeticalSort;
        }

        return a.orderIndex - b.orderIndex;
      });

    return (
      <>
        <StemmingView
          items={votableItems.map((item) => ({ id: item.id, text: item.text, isQuestion: item.isQuestion }))}
          session={{
            id: session.id,
            title: session.title,
            code: session.code,
            votingType: session.votingType,
            dotBudget: session.dotBudget,
            allowMultipleDots: session.allowMultipleDots,
          }}
        />
        <TimerBanner timerEndsAt={session.timerEndsAt} timerLabel={session.timerLabel} />
      </>
    );
  }

  return (
    <>
      <KartleggingView
        items={items}
        session={{
          id: session.id,
          code: session.code,
          title: session.title,
          tags: session.tags,
          allowNewItems: session.allowNewItems,
        }}
      />
      <TimerBanner timerEndsAt={session.timerEndsAt} timerLabel={session.timerLabel} />
    </>
  );
}
