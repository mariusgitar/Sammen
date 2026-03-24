'use client';

import { useEffect, useMemo, useState } from 'react';

type SessionView = {
  id: string;
  title: string;
  code: string;
  mode: string;
  status: 'setup' | 'active' | 'paused' | 'closed';
};

type SessionItem = {
  id: string;
  text: string;
  isNew: boolean;
  createdBy: string;
};

type SummaryItem = {
  id: string;
  text: string;
  is_new: boolean;
  created_by: string;
  tagCounts: Record<string, number>;
  untaggedCount: number;
};

type SummaryResponse = {
  participantCount: number;
  items: SummaryItem[];
};

type AdminPanelProps = {
  session: SessionView;
  items: SessionItem[];
};

export function AdminPanel({ session, items }: AdminPanelProps) {
  const [currentSession, setCurrentSession] = useState(session);
  const [sessionStatus, setSessionStatus] = useState<SessionView['status']>(session.status);
  const [summary, setSummary] = useState<SummaryResponse>({
    participantCount: 0,
    items: items.map((item) => ({
      id: item.id,
      text: item.text,
      is_new: item.isNew,
      created_by: item.createdBy,
      tagCounts: {},
      untaggedCount: 0,
    })),
  });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [error, setError] = useState('');

  async function fetchSummary() {
    try {
      const response = await fetch(`/api/admin/${session.code}/summary`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as SummaryResponse | { error: string };
      console.log('Admin summary poll result:', data);

      if (!response.ok || !('items' in data)) {
        setError('error' in data ? data.error : 'Kunne ikke hente oppsummering.');
        return;
      }

      setSummary(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Kunne ikke hente oppsummering.');
    }
  }

  useEffect(() => {
    void fetchSummary();

    const timer = setInterval(() => {
      void fetchSummary();
    }, 10_000);

    return () => clearInterval(timer);
    // We intentionally run this only once on mount for initial fetch + polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateSessionStatus(status: SessionView['status']) {
    setIsUpdatingStatus(true);
    setError('');

    try {
      const response = await fetch(`/api/sessions/${currentSession.code}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const data = (await response.json()) as
        | {
            session: SessionView;
          }
        | { error: string };

      if (!response.ok || !('session' in data)) {
        setError('error' in data ? data.error : 'Kunne ikke oppdatere status.');
        return;
      }

      setCurrentSession(data.session);
      setSessionStatus(data.session.status);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Kunne ikke oppdatere status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function promoteItem(itemId: string) {
    setError('');

    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_new: false }),
      });

      const data = (await response.json()) as { item: { id: string } } | { error: string };

      if (!response.ok || !('item' in data)) {
        setError('error' in data ? data.error : 'Kunne ikke oppdatere element.');
        return;
      }

      await fetchSummary();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Kunne ikke oppdatere element.');
    }
  }

  const proposedItems = useMemo(() => summary.items.filter((item) => item.is_new), [summary.items]);
  const mainItems = useMemo(() => summary.items.filter((item) => !item.is_new), [summary.items]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Sesjonsinfo</h2>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{currentSession.title}</h1>
        <p className="mt-2 text-slate-300">Modus: {currentSession.mode}</p>
        <p className="text-slate-300">Status: {sessionStatus}</p>
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-sm text-slate-400">Sesjonskode</p>
          <p className="mt-1 text-3xl font-bold tracking-[0.2em] text-white">{currentSession.code}</p>
          <p className="mt-2 text-xs text-slate-500">Sesjonskode: {currentSession.code}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Sesjonskontroller</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {sessionStatus === 'setup' ? (
            <button
              type="button"
              onClick={() => updateSessionStatus('active')}
              disabled={isUpdatingStatus}
              className="rounded bg-emerald-200 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-100 disabled:opacity-70"
            >
              Åpne for deltakere
            </button>
          ) : null}

          {sessionStatus === 'active' ? (
            <button
              type="button"
              onClick={() => updateSessionStatus('paused')}
              disabled={isUpdatingStatus}
              className="rounded bg-amber-200 px-4 py-2 text-sm font-medium text-amber-950 transition hover:bg-amber-100 disabled:opacity-70"
            >
              Avslutt innsamling
            </button>
          ) : null}

          {sessionStatus === 'paused' ? (
            <>
              <button
                type="button"
                onClick={() => updateSessionStatus('active')}
                disabled={isUpdatingStatus}
                className="rounded bg-sky-200 px-4 py-2 text-sm font-medium text-sky-950 transition hover:bg-sky-100 disabled:opacity-70"
              >
                Åpne for stemming
              </button>
              <button
                type="button"
                onClick={() => updateSessionStatus('closed')}
                disabled={isUpdatingStatus}
                className="rounded bg-rose-200 px-4 py-2 text-sm font-medium text-rose-950 transition hover:bg-rose-100 disabled:opacity-70"
              >
                Avslutt sesjon
              </button>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Live oversikt</h2>
        <p className="mt-3 text-slate-100">Antall deltakere som har sendt inn: {summary.participantCount}</p>

        <div className="mt-4 space-y-3">
          {mainItems.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100">
              <p className="font-medium text-slate-50">{item.text}</p>
              <p className="mt-2 text-slate-300">
                {Object.entries(item.tagCounts)
                  .map(([tag, count]) => `${tag}: ${count}`)
                  .join('  |  ') || 'Ingen tagger enda'}
                {'  |  '}(ingen tag): {item.untaggedCount}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">Nye forslag</h3>
          {proposedItems.length > 0 ? (
            <div className="mt-3 space-y-3">
              {proposedItems.map((item) => (
                <article key={item.id} className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-3">
                  <p className="text-sm text-slate-100">{item.text}</p>
                  <p className="mt-1 text-xs text-emerald-200">Foreslått av: {item.created_by || 'ukjent'}</p>
                  <button
                    type="button"
                    onClick={() => promoteItem(item.id)}
                    className="mt-3 rounded bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-white"
                  >
                    Legg til i listen
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-300">Ingen nye forslag.</p>
          )}
        </div>

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      </section>
    </div>
  );
}
