'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';

type SessionView = {
  id: string;
  title: string;
  code: string;
  mode: string;
  phase: 'kartlegging' | 'stemming';
  status: 'setup' | 'active' | 'paused' | 'closed';
};

type SessionItem = {
  id: string;
  text: string;
  isNew: boolean;
  excluded: boolean;
  createdBy: string;
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

type SummaryResponse = {
  phase: 'kartlegging' | 'stemming';
  status: 'setup' | 'active' | 'paused' | 'closed';
  participantCount: number;
  items: Array<KartleggingSummaryItem | StemmingSummaryItem>;
};

type AdminPanelProps = {
  session: SessionView;
  items: SessionItem[];
};

const tagBadgeClasses = [
  'bg-cyan-500/15 text-cyan-200 border-cyan-500/30',
  'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  'bg-violet-500/15 text-violet-200 border-violet-500/30',
  'bg-amber-500/15 text-amber-200 border-amber-500/30',
  'bg-rose-500/15 text-rose-200 border-rose-500/30',
];

function getScoreColorClass(score: number) {
  if (score >= 4.0) {
    return 'text-emerald-300';
  }

  if (score >= 2.5) {
    return 'text-amber-300';
  }

  return 'text-rose-300';
}

function hasSplitVotes(item: KartleggingSummaryItem, participantCount: number) {
  if (participantCount === 0) {
    return false;
  }

  const highestTagCount = Object.values(item.tagCounts).reduce((max, count) => Math.max(max, count), 0);
  return highestTagCount / participantCount <= 0.5;
}

export function AdminPanel({ session, items }: AdminPanelProps) {
  const [currentSession, setCurrentSession] = useState(session);
  const [sessionStatus, setSessionStatus] = useState<SessionView['status']>(session.status);
  const [sessionPhase, setSessionPhase] = useState<SessionView['phase']>(session.phase);
  const [summary, setSummary] = useState<SummaryResponse>({
    phase: session.phase,
    status: session.status,
    participantCount: 0,
    items: items.map((item) => ({
      id: item.id,
      text: item.text,
      is_new: item.isNew,
      created_by: item.createdBy,
      excluded: item.excluded,
      tagCounts: {},
      untaggedCount: 0,
    })),
  });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isOpeningVoting, setIsOpeningVoting] = useState(false);
  const [includeMap, setIncludeMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, !item.excluded])),
  );
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [origin, setOrigin] = useState('');
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function fetchSummary() {
    try {
      const response = await fetch(`/api/admin/${session.code}/summary`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as SummaryResponse | { error: string };

      if (!response.ok || !('items' in data)) {
        setSummaryError('Feil ved henting av data');
        return;
      }

      setSummaryError('');
      setSummary(data);
      setSessionPhase(data.phase);
      setSessionStatus(data.status);
      setCurrentSession((current) => ({
        ...current,
        phase: data.phase,
        status: data.status,
      }));
      setIncludeMap((current) => {
        const next = { ...current };

        for (const item of data.items) {
          if (typeof next[item.id] === 'undefined') {
            next[item.id] = !item.excluded;
          }
        }

        return next;
      });
    } catch {
      setSummaryError('Feil ved henting av data');
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
            session: Pick<SessionView, 'status' | 'phase'>;
          }
        | { error: string };

      if (!response.ok || !('session' in data)) {
        setError('Kunne ikke oppdatere sesjonen. Prøv igjen.');
        return;
      }

      setSessionStatus(data.session.status);
      setSessionPhase(data.session.phase);
      setCurrentSession((current) => ({
        ...current,
        status: data.session.status,
        phase: data.session.phase,
      }));
    } catch {
      setError('Kunne ikke oppdatere sesjonen. Prøv igjen.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(currentSession.code);
      setCopyConfirmed(true);
      setTimeout(() => {
        setCopyConfirmed(false);
      }, 2_000);
    } catch {
      setError('Kunne ikke kopiere sesjonskoden.');
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

      setIncludeMap((current) => ({ ...current, [itemId]: true }));
      await fetchSummary();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Kunne ikke oppdatere element.');
    }
  }

  async function openVoting() {
    setIsOpeningVoting(true);
    setError('');

    try {
      const excludedIds = Object.entries(includeMap)
        .filter(([, included]) => !included)
        .map(([itemId]) => itemId);

      await Promise.all(
        excludedIds.map(async (itemId) => {
          const response = await fetch(`/api/items/${itemId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ excluded: true }),
          });

          const data = (await response.json()) as { item: { id: string } } | { error: string };

          if (!response.ok || !('item' in data)) {
            throw new Error('error' in data ? data.error : 'Kunne ikke oppdatere element.');
          }
        }),
      );

      const sessionResponse = await fetch(`/api/sessions/${currentSession.code}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'active', phase: 'stemming' }),
      });

      const data = (await sessionResponse.json()) as
        | { session: Pick<SessionView, 'status' | 'phase'> }
        | { error: string };

      if (!sessionResponse.ok || !('session' in data)) {
        setError('error' in data ? data.error : 'Kunne ikke åpne for stemming.');
        return;
      }

      setSessionStatus(data.session.status);
      setSessionPhase(data.session.phase);
      setCurrentSession((current) => ({
        ...current,
        status: data.session.status,
        phase: data.session.phase,
      }));
      await fetchSummary();
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Kunne ikke åpne for stemming.');
    } finally {
      setIsOpeningVoting(false);
    }
  }

  const proposedItems = useMemo(
    () =>
      summary.items.filter((item): item is KartleggingSummaryItem =>
        'tagCounts' in item ? item.is_new : false,
      ),
    [summary.items],
  );

  const mainItems = useMemo(
    () =>
      summary.items.filter((item): item is KartleggingSummaryItem =>
        'tagCounts' in item ? !item.is_new : false,
      ),
    [summary.items],
  );

  const finalListItems = useMemo(() => [...mainItems, ...proposedItems], [mainItems, proposedItems]);

  const voteResults = useMemo(
    () =>
      summary.items
        .filter((item): item is StemmingSummaryItem => 'averageScore' in item)
        .sort((a, b) => b.averageScore - a.averageScore),
    [summary.items],
  );

  const participantUrl = origin ? `${origin}/delta/${currentSession.code}` : '';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Sesjonsinfo</h2>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{currentSession.title}</h1>
        <p className="mt-2 text-slate-300">Modus: {currentSession.mode}</p>
        <p className="text-slate-300">Status: {sessionStatus}</p>
        <p className="text-slate-300">Fase: {sessionPhase}</p>
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-sm text-slate-400">Sesjonskode</p>
          <button
            type="button"
            onClick={handleCopyCode}
            className="mt-1 text-3xl font-bold tracking-[0.2em] text-white transition hover:text-slate-300"
            aria-label="Kopier sesjonskode"
            title="Trykk for å kopiere"
          >
            {currentSession.code}
          </button>
          {copyConfirmed ? <p className="mt-1 text-xs text-emerald-300">Kopiert!</p> : null}
          <p className="mt-2 text-xs text-slate-500">Sesjonskode: {currentSession.code}</p>
          {participantUrl ? (
            <div className="mt-4 flex flex-col items-start gap-3">
              <div className="rounded-lg bg-white p-2">
                <QRCode value={participantUrl} size={180} bgColor="#ffffff" fgColor="#000000" />
              </div>
              <p className="text-xs text-slate-400">samen-alene.vercel.app/delta/{currentSession.code}</p>
            </div>
          ) : null}
        </div>
      </section>

      {sessionStatus === 'closed' ? null : (
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
                  onClick={() => updateSessionStatus('closed')}
                  disabled={isUpdatingStatus}
                  className="rounded bg-rose-200 px-4 py-2 text-sm font-medium text-rose-950 transition hover:bg-rose-100 disabled:opacity-70"
                >
                  Avslutt sesjon
                </button>
                <Link
                  href={`/admin/${currentSession.code}/results`}
                  className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white"
                >
                  Se resultater →
                </Link>
              </>
            ) : null}
          </div>
        </section>
      )}

      {sessionStatus === 'paused' && sessionPhase === 'kartlegging' ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Rediger endelig liste</h2>
          <div className="mt-4 space-y-3">
            {finalListItems.map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100"
              >
                <input
                  type="checkbox"
                  checked={includeMap[item.id] ?? true}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIncludeMap((current) => ({
                      ...current,
                      [item.id]: checked,
                    }));
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900"
                />
                <span>{item.text}</span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={openVoting}
            disabled={isOpeningVoting}
            className="mt-6 rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white disabled:opacity-70"
          >
            Åpne for stemming
          </button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Live oversikt</h2>
        {summaryError ? <p className="mt-2 text-xs text-amber-300">{summaryError}</p> : null}
        <p className="mt-3 text-slate-100">Antall deltakere som har sendt inn: {summary.participantCount}</p>

        {sessionPhase === 'stemming' ? (
          <div className="mt-4 space-y-3">
            {voteResults.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-100">
                <p className="font-medium text-slate-50">{item.text}</p>
                <div className="mt-3 flex items-end gap-2">
                  <p className={`text-4xl font-bold ${getScoreColorClass(item.averageScore)}`}>{item.averageScore.toFixed(1)}</p>
                  <p className="pb-1 text-slate-400">i snitt</p>
                </div>
                <p className="text-slate-300">Antall stemmer: {item.voteCount}</p>
                <p className="mt-1 text-slate-300">
                  1:{item.distribution['1']} &nbsp; 2:{item.distribution['2']} &nbsp; 3:{item.distribution['3']} &nbsp; 4:
                  {item.distribution['4']} &nbsp; 5:{item.distribution['5']}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {mainItems.map((item) => {
                const splitVotes = hasSplitVotes(item, summary.participantCount);
                const tagEntries = [
                  ...Object.entries(item.tagCounts),
                  ...(item.untaggedCount > 0 ? ([['Ingen tag', item.untaggedCount]] as Array<[string, number]>) : []),
                ];

                return (
                  <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-50">{item.text}</p>
                      {splitVotes ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200">
                          ⚠ Uenighet
                        </span>
                      ) : null}
                    </div>
                    {tagEntries.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tagEntries.map(([tag, count], index) => (
                          <span
                            key={`${item.id}-${tag}`}
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tagBadgeClasses[index % tagBadgeClasses.length]}`}
                          >
                            {tag}: {count}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-slate-300">Ingen tagger enda</p>
                    )}
                  </article>
                );
              })}
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
          </>
        )}

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      </section>
    </div>
  );
}
