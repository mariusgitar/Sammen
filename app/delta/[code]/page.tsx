'use client';

import { useEffect, useMemo, useState } from 'react';

import { KartleggingView } from './KartleggingView';
import { StemmingView } from './StemmingView';

type ParticipantPageProps = {
  params: {
    code: string;
  };
};

export default function ParticipantPage({ params }: ParticipantPageProps) {
  const code = params.code.toUpperCase();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionData, setSessionData] = useState<{
    session: {
      id: string;
      title: string;
      phase: 'kartlegging' | 'stemming';
      status: 'setup' | 'active' | 'paused' | 'closed';
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
  } | null>(null);

  async function fetchSession() {
    try {
      const response = await fetch(`/api/sessions/${code}`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as
        | {
            session: {
              id: string;
              title: string;
              phase: 'kartlegging' | 'stemming';
              status: 'setup' | 'active' | 'paused' | 'closed';
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
          }
        | { error: string };

      if (!response.ok || !('session' in data)) {
        setError('error' in data ? data.error : 'Kunne ikke hente sesjonen.');
        setSessionData(null);
        return;
      }

      setError('');
      setSessionData(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Kunne ikke hente sesjonen.');
      setSessionData(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void fetchSession();
    const timer = setInterval(() => {
      void fetchSession();
    }, 5_000);

    return () => clearInterval(timer);
  }, [code]);

  const visibleItems = useMemo(() => {
    if (!sessionData) {
      return [];
    }
    if (sessionData.session.phase === 'stemming') {
      return sessionData.items.filter((item) => !item.excluded);
    }
    return sessionData.items;
  }, [sessionData]);

  if (isLoading) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Laster sesjon…</h1>
        </div>
      </main>
    );
  }

  if (!sessionData) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sesjon ikke funnet</h1>
          {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        </div>
      </main>
    );
  }

  if (sessionData.session.status === 'closed') {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sesjonen er avsluttet.</h1>
        </div>
      </main>
    );
  }

  if (sessionData.session.status === 'setup' || sessionData.session.status === 'paused') {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sesjonen er ikke åpen ennå.</h1>
          <p className="mt-2 text-sm text-slate-300">Vent på fasilitator.</p>
        </div>
      </main>
    );
  }

  if (sessionData.session.phase === 'stemming') {
    return (
      <StemmingView
        items={visibleItems.map((item) => ({ id: item.id, text: item.text }))}
        session={{
          id: sessionData.session.id,
          title: sessionData.session.title,
        }}
      />
    );
  }

  return (
    <KartleggingView
      items={visibleItems}
      session={{
        id: sessionData.session.id,
        title: sessionData.session.title,
        tags: sessionData.session.tags,
        allowNewItems: sessionData.session.allowNewItems,
      }}
    />
  );
}
