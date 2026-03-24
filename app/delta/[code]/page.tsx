'use client';

import { useEffect, useMemo, useState } from 'react';

import { KartleggingView } from './KartleggingView';
import { StemmingView } from './StemmingView';

type ParticipantPageProps = {
  params: {
    code: string;
  };
};

type SessionStatus = 'setup' | 'active' | 'paused' | 'closed';
type SessionPhase = 'kartlegging' | 'stemming';

type SessionResponse = {
  session: {
    id: string;
    code: string;
    title: string;
    mode: string;
    votingType: 'scale' | 'dots';
    dotBudget: number;
    allowMultipleDots: boolean;
    phase: SessionPhase;
    status: SessionStatus;
    tags: string[];
    allowNewItems: boolean;
  };
  items: Array<{
    id: string;
    text: string;
    isNew: boolean;
    excluded: boolean;
    orderIndex: number;
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
        const response = await fetch(`/api/sessions/${code}`, { cache: 'no-store' });
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

  if (isLoading) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Laster sesjon…</h1>
        </div>
      </main>
    );
  }

  if (isNotFound) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sesjon ikke funnet</h1>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Kunne ikke laste sesjonen</h1>
          {error ? <p className="mt-2 text-sm text-slate-300">{error}</p> : null}
        </div>
      </main>
    );
  }

  const { session, items } = data;

  if (session.status === 'closed') {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sesjonen er avsluttet.</h1>
        </div>
      </main>
    );
  }

  if (session.status === 'setup' || session.status === 'paused') {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sesjonen er ikke åpen ennå.</h1>
          <p className="mt-2 text-sm text-slate-300">Vent på fasilitator.</p>
        </div>
      </main>
    );
  }

  if (session.status === 'active' && (session.phase === 'stemming' || session.mode === 'stemming')) {
    return (
      <StemmingView
        items={items.filter((item) => !item.excluded).map((item) => ({ id: item.id, text: item.text }))}
        session={{
          id: session.id,
          title: session.title,
          votingType: session.votingType,
          dotBudget: session.dotBudget,
          allowMultipleDots: session.allowMultipleDots,
        }}
      />
    );
  }

  return (
    <KartleggingView
      items={items}
      session={{
        id: session.id,
        title: session.title,
        tags: session.tags,
        allowNewItems: session.allowNewItems,
      }}
    />
  );
}
