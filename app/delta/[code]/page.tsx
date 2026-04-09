'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { InnspillView } from './InnspillView';
import { KartleggingView } from './KartleggingView';
import { StemmingView } from './StemmingView';
import { RangeringView } from './RangeringView';
import { TimerBanner } from '@/app/components/TimerBanner';
import { normalizeSession, type NormalizedSession } from '@/app/lib/normalizeSession';
import { resolveView } from '@/app/lib/resolveView';

type ParticipantPageProps = {
  params: {
    code: string;
  };
};

type QuestionStatus = 'inactive' | 'active' | 'locked';

type SessionResponse = {
  session: Record<string, unknown>;
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

type NormalizedSessionResponse = {
  session: NormalizedSession;
  items: SessionResponse['items'];
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
  const [data, setData] = useState<NormalizedSessionResponse | null>(null);

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

        const normalizedSession = normalizeSession(payload.session);

        setIsNotFound(false);
        setError('');
        setData((current) => {
          if (!current) {
            return {
              session: normalizedSession,
              items: payload.items,
            };
          }

          const incomingItems = payload.items;
          const shouldUpdateItems =
            incomingItems.length > 0 && JSON.stringify(incomingItems) !== JSON.stringify(current.items);
          const shouldUpdateSession = JSON.stringify(normalizedSession) !== JSON.stringify(current.session);

          if (!shouldUpdateItems && !shouldUpdateSession) {
            return current;
          }

          return {
            session: shouldUpdateSession ? normalizedSession : current.session,
            items: shouldUpdateItems ? incomingItems : current.items,
          };
        });
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

  const { session, items } = data;

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
          />
          {timerBanner}
        </>
      );
    case 'stemming': {
      const tagOrder = new Map((session.tags ?? []).map((tag, index) => [tag, index]));
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
            session={session}
          />
          {timerBanner}
        </>
      );
    }
    case 'innspill':
      return (
        <>
          <InnspillView session={session} items={items.filter((item) => item.isQuestion)} />
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
