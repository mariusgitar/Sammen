'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { InnspillView } from './InnspillView';
import { KartleggingView } from './KartleggingView';
import { StemmingView } from './StemmingView';
import { RangeringView } from './RangeringView';
import { TimerBanner } from '@/app/components/TimerBanner';
import { type NormalizedSession } from '@/app/lib/normalizeSession';
import { resolveView } from '@/app/lib/resolveView';

type ParticipantPageProps = {
  params: {
    code: string;
  };
};

type QuestionStatus = 'inactive' | 'active' | 'locked';

type StateItem = {
  id: string;
  text: string;
  description: string | null;
  isNew: boolean;
  excluded: boolean;
  orderIndex: number;
  isQuestion: boolean;
  questionStatus: QuestionStatus;
  defaultTag: string | null;
  finalTag: string | null;
  createdAt: string;
};

type ServerInnspillEntry = {
  id: string;
  text: string;
  detaljer: string | null;
  nickname: string;
  likes: number;
  participantId: string;
  createdAt: string;
};

type ServerQuestion = {
  id: string;
  text: string;
  questionStatus: QuestionStatus;
  innspill: ServerInnspillEntry[];
};

type StateData = {
  session: NormalizedSession;
  items: StateItem[];
  innspill: ServerQuestion[];
  myResponses: Array<{ itemId: string; value: string }>;
};

type StateResponse = {
  session: NormalizedSession;
  items: StateItem[];
  innspill: ServerQuestion[];
  myResponses: Array<{ itemId: string; value: string }>;
};

type ErrorResponse = {
  error: string;
};

function WaitingView({ reason }: { reason: string }) {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#0f172a]">{reason}</h1>
      </div>
    </main>
  );
}

function ClosedView() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#0f172a]">Sesjonen er avsluttet.</h1>
      </div>
    </main>
  );
}

export default function ParticipantPage({ params }: ParticipantPageProps) {
  const code = useMemo(() => params.code.toUpperCase(), [params.code]);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isNotFound, setIsNotFound] = useState(false);
  const [data, setData] = useState<StateData | null>(null);
  const [participantId, setParticipantId] = useState('');
  const initializedRef = useRef(false);

  // Read participantId from localStorage once on mount
  useEffect(() => {
    const stored = localStorage.getItem('samen_participant_id');
    if (stored) {
      setParticipantId(stored);
    } else {
      const newId = crypto.randomUUID();
      localStorage.setItem('samen_participant_id', newId);
      setParticipantId(newId);
    }
  }, []);

  useEffect(() => {
    if (!participantId) return;

    let isMounted = true;

    async function fetchState() {
      try {
        const response = await fetch(
          `/api/delta/${code}/state?participantId=${encodeURIComponent(participantId)}`,
          { cache: 'no-store' },
        );
        const payload = (await response.json()) as StateResponse | ErrorResponse;

        if (!isMounted) return;

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
        setData((current) => {
          const incoming: StateData = {
            session: payload.session,
            items: payload.items,
            innspill: payload.innspill ?? [],
            myResponses: payload.myResponses ?? [],
          };

          if (!initializedRef.current || !current) {
            initializedRef.current = true;
            return incoming;
          }

          return {
            session: incoming.session,
            items: incoming.items.length > 0 ? incoming.items : current.items,
            innspill: incoming.innspill.length > 0 ? incoming.innspill : current.innspill,
            myResponses: incoming.myResponses,
          };
        });
      } catch (fetchError) {
        if (!isMounted) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Kunne ikke hente sesjonsdata.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void fetchState();
    const timer = setInterval(() => { void fetchState(); }, 5_000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [code, participantId]);

  const viewState = useMemo(() => (data ? resolveView(data.session) : null), [data]);

  useEffect(() => {
    if (viewState?.view === 'results') {
      router.push(`/delta/${code}/resultater`);
    }
  }, [code, router, viewState]);

  if (isLoading) return <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6"><div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold text-[#0f172a]">Laster sesjon…</h1></div></main>;
  if (isNotFound) return <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6"><div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm"><h1 className="text-2xl font-semibold text-[#0f172a]">Sesjon ikke funnet</h1></div></main>;

  if (error || !data || !viewState) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0f172a]">Kunne ikke laste sesjonen</h1>
          {error ? <p className="mt-2 text-sm text-[#64748b]">{error}</p> : null}
        </div>
      </main>
    );
  }

  const { session, items, innspill, myResponses } = data;

  const timerBanner = (
    <TimerBanner
      timerEndsAt={session.timerEndsAt}
      timerLabel={session.timerLabel}
    />
  );

  switch (viewState.view) {
    case 'kartlegging':
      return (
        <>
          <KartleggingView
            items={items}
            session={session}
            myResponses={myResponses}
          />
          {timerBanner}
        </>
      );
    case 'stemming': {
      const tagOrder = new Map((session.tags ?? []).map((tag, index) => [tag, index]));
      const votableItems = items
        .filter((item) => !item.excluded && !item.isQuestion)
        .sort((a, b) => {
          const aTag = a.finalTag;
          const bTag = b.finalTag;

          if (!aTag && !bTag) return a.orderIndex - b.orderIndex;
          if (!aTag) return 1;
          if (!bTag) return -1;

          const aIdx = tagOrder.get(aTag) ?? null;
          const bIdx = tagOrder.get(bTag) ?? null;

          if (aIdx !== null && bIdx !== null && aIdx !== bIdx) return aIdx - bIdx;
          if (aIdx !== null && bIdx === null) return -1;
          if (aIdx === null && bIdx !== null) return 1;

          const alpha = aTag.localeCompare(bTag, 'nb');
          if (alpha !== 0) return alpha;
          return a.orderIndex - b.orderIndex;
        });

      return (
        <>
          <StemmingView
            items={votableItems.map((item) => ({ id: item.id, text: item.text, isQuestion: item.isQuestion }))}
            session={session}
          />
          {timerBanner}
        </>
      );
    }
    case 'innspill':
      return (
        <>
          <InnspillView
            session={session}
            items={items.filter((item) => item.isQuestion)}
            serverInnspill={innspill}
          />
          {timerBanner}
        </>
      );
    case 'rangering':
      return (
        <>
          <RangeringView
            items={items.filter((item) => !item.excluded).map((item) => ({ id: item.id, text: item.text, description: item.description }))}
            session={session}
          />
          {timerBanner}
        </>
      );
    case 'results':
      return null;
    case 'closed':
      return (
        <>
          <ClosedView />
          {timerBanner}
        </>
      );
    case 'waiting':
    default:
      return (
        <>
          <WaitingView reason={viewState.reason} />
          {timerBanner}
        </>
      );
  }
}
