'use client';

import { useEffect, useMemo, useState } from 'react';

type PageProps = {
  params: {
    code: string;
  };
};

type SessionInfoResponse = {
  session: {
    code: string;
    title: string;
    mode: 'kartlegging' | 'stemming' | 'rangering' | 'aapne-innspill';
    phase: 'kartlegging' | 'stemming' | 'rangering' | 'innspill';
    votingType: 'scale' | 'dots';
    status: 'setup' | 'active' | 'paused' | 'closed';
    resultsVisible?: boolean;
    results_visible?: boolean;
  };
};

type KartleggingSummaryItem = {
  id: string;
  text: string;
  is_new: boolean;
  excluded: boolean;
  tagCounts: Record<string, number>;
  untaggedCount: number;
};

type StemmingSummaryItem = {
  id: string;
  text: string;
  is_new: boolean;
  excluded: boolean;
  averageScore: number;
  voteCount: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
};

type RangeringSummaryItem = {
  id: string;
  text: string;
  is_new: boolean;
  excluded: boolean;
  average_position: number;
  vote_count: number;
  position_distribution: Record<string, number>;
};

type ResultsResponse = {
  mode: 'kartlegging' | 'stemming' | 'rangering' | 'aapne-innspill';
  phase: 'kartlegging' | 'stemming' | 'rangering' | 'innspill';
  votingType: 'scale' | 'dots';
  participantCount: number;
  items: Array<KartleggingSummaryItem | StemmingSummaryItem | RangeringSummaryItem>;
};

type ThemeResponse = {
  themes: Array<{
    id: string;
    name: string;
    description?: string | null;
    color: string;
    innspill: Array<{ id: string; text: string; detaljer?: string | null }>;
  }>;
  ungrouped: Array<{ id: string; text: string; detaljer?: string | null }>;
};

// show_others_innspill only affects InnspillView during collection
// Results always show everything

function hasSplitVotes(item: KartleggingSummaryItem, participantCount: number) {
  if (participantCount === 0) {
    return false;
  }

  const maxTagCount = Math.max(...Object.values(item.tagCounts), 0);
  return maxTagCount / participantCount <= 0.5;
}

function getScoreClass(score: number) {
  if (score >= 4) {
    return 'text-sky-500';
  }

  if (score >= 2.5) {
    return 'text-amber-500';
  }

  return 'text-[#3b5bdb]';
}

export default function ParticipantResultsPage({ params }: PageProps) {
  const code = useMemo(() => params.code.toUpperCase(), [params.code]);
  const [title, setTitle] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'setup' | 'active' | 'paused' | 'closed' | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionInfoResponse['session']['mode'] | null>(null);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [themeResults, setThemeResults] = useState<ThemeResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const sessionResponse = await fetch(`/api/sessions/${code}`, { cache: 'no-store' });
        const sessionData = (await sessionResponse.json()) as SessionInfoResponse | { error: string };

        if (!isMounted) {
          return;
        }

        if (!sessionResponse.ok || !('session' in sessionData)) {
          setError('Kunne ikke hente sesjon.');
          return;
        }

        const serverVisibility =
          typeof sessionData.session.results_visible === 'boolean'
            ? sessionData.session.results_visible
            : Boolean(sessionData.session.resultsVisible);

        setTitle(sessionData.session.title);
        setIsVisible(serverVisibility);
        setSessionStatus(sessionData.session.status);
        setSessionMode(sessionData.session.mode);

        if (!serverVisibility) {
          setResults(null);
          setError('');
          return;
        }

        if (sessionData.session.mode === 'aapne-innspill') {
          const themesResponse = await fetch(`/api/admin/${code}/themes`, { cache: 'no-store' });
          const themesData = (await themesResponse.json()) as ThemeResponse | { error: string };

          if (!isMounted) {
            return;
          }

          if (themesResponse.ok && 'themes' in themesData) {
            setThemeResults(themesData);
            setResults(null);
            setError('');
            return;
          }
        }

        const resultsResponse = await fetch(`/api/delta/${code}/results`, { cache: 'no-store' });
        const resultsData = (await resultsResponse.json()) as ResultsResponse | { error: string };

        if (!isMounted) {
          return;
        }

        if (!resultsResponse.ok || !('items' in resultsData)) {
          setError('Kunne ikke hente resultater.');
          return;
        }

        setError('');
        setResults(resultsData);
        setThemeResults(null);
      } catch {
        if (!isMounted) {
          return;
        }

        setError('Kunne ikke hente resultater.');
      }
    }

    void fetchData();
    const timer = setInterval(() => {
      void fetchData();
    }, 3_000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [code]);

  if (!isVisible) {
    const isClosed = sessionStatus === 'closed';

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4">
        <section className="w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0f172a]">{title || `Sesjon ${code}`}</h1>
          <div className="mt-6 flex items-center justify-center gap-2" aria-hidden>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#94a3b8] [animation-delay:0ms]" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#94a3b8] [animation-delay:150ms]" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#94a3b8] [animation-delay:300ms]" />
          </div>
          <p className="mt-4 text-sm text-[#64748b]">
            {isClosed ? 'Denne sesjonen er avsluttet.' : 'Fasilitator åpner resultatene snart...'}
          </p>
          {isClosed ? <p className="mt-2 text-sm text-[#64748b]">Ta kontakt med fasilitator for mer informasjon.</p> : null}
        </section>
      </main>
    );
  }

  if (error || (!results && sessionMode !== 'aapne-innspill')) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4">
        <section className="w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0f172a]">Kunne ikke laste resultater</h1>
          {error ? <p className="mt-3 text-sm text-[#64748b]">{error}</p> : null}
        </section>
      </main>
    );
  }

  if (sessionMode === 'aapne-innspill' && themeResults && themeResults.themes.length > 0) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <h1 className="text-center text-2xl font-semibold text-[#0f172a]">{title}</h1>
          <h2 className="text-xl font-semibold text-[#0f172a]">Tematiserte innspill</h2>
          {themeResults.themes.map((theme) => (
            <section key={theme.id} style={{ borderLeft: `4px solid ${theme.color}` }} className="mb-6 pl-4">
              <h3 style={{ color: theme.color }} className="text-lg font-semibold">{theme.name}</h3>
              {theme.description ? <p className="text-sm text-[#64748b]">{theme.description}</p> : null}
              <div className="mt-3 space-y-2">
                {theme.innspill.map((entry) => (
                  <div key={entry.id} className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="font-medium text-[#0f172a]">{entry.text}</p>
                    {entry.detaljer ? <p className="text-sm text-slate-500">{entry.detaljer}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
          {themeResults.ungrouped.length > 0 ? (
            <section>
              <h3 className="text-lg font-semibold text-[#0f172a]">Andre innspill</h3>
              <div className="mt-3 space-y-2">
                {themeResults.ungrouped.map((entry) => (
                  <div key={entry.id} className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="font-medium text-[#0f172a]">{entry.text}</p>
                    {entry.detaljer ? <p className="text-sm text-slate-500">{entry.detaljer}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    );
  }

  if (!results) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4">
        <section className="w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0f172a]">Ingen resultater enda</h1>
        </section>
      </main>
    );
  }

  const kartleggingItems = results.items
    .filter((item): item is KartleggingSummaryItem => 'tagCounts' in item)
    .filter((item) => !item.excluded);
  const mainKartleggingItems = kartleggingItems.filter((item) => !item.is_new);
  const newKartleggingItems = kartleggingItems.filter((item) => item.is_new);
  const totalDots = results.items.reduce((sum, item) => sum + ('averageScore' in item ? item.averageScore * item.voteCount : 0), 0);

  const dotItems = results.items
    .filter((item): item is StemmingSummaryItem => 'averageScore' in item)
    .filter((item) => !item.excluded)
    .map((item) => ({
      ...item,
      totalDots: item.averageScore * item.voteCount,
    }))
    .sort((a, b) => b.totalDots - a.totalDots);

  const rankingItems = results.items
    .filter((item): item is RangeringSummaryItem => 'average_position' in item)
    .filter((item) => !item.excluded)
    .sort((a, b) => a.average_position - b.average_position);

  const scaleItems = results.items
    .filter((item): item is StemmingSummaryItem => 'averageScore' in item)
    .filter((item) => !item.excluded)
    .sort((a, b) => b.averageScore - a.averageScore);

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-center text-2xl font-semibold text-[#0f172a]">{title}</h1>

        {results.mode === 'rangering' ? (
          <>
            <h2 className="text-xl font-semibold text-[#0f172a]">Rangering-resultater</h2>
            <div className="space-y-3">
              {rankingItems.map((item, index) => (
                <article key={item.id} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <p className="text-xs text-[#64748b]">#{index + 1}</p>
                  <p className="font-medium text-[#0f172a]">{item.text}</p>
                  <p className="mt-1 text-sm text-[#64748b]">Snitt posisjon: {item.average_position.toFixed(1)}</p>
                  <p className="text-xs text-[#64748b]">{item.vote_count} deltakere</p>
                </article>
              ))}
            </div>
          </>
        ) : results.phase === 'kartlegging' ? (
          <>
            <h2 className="text-xl font-semibold text-[#0f172a]">Kartlegging-resultater</h2>
            <div className="space-y-3">
              {mainKartleggingItems.map((item) => {
                const splitVotes = hasSplitVotes(item, results.participantCount);
                const tagRows = [
                  ...Object.entries(item.tagCounts),
                  ...(item.untaggedCount > 0 ? ([['Ingen tag', item.untaggedCount]] as Array<[string, number]>) : []),
                ];
                const maxCount = Math.max(...tagRows.map(([, count]) => count), 1);

                return (
                  <article key={item.id} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[#0f172a]">{item.text}</p>
                      {splitVotes ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Uenighet</span>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      {tagRows.map(([tag, count]) => (
                        <div key={`${item.id}-${tag}`}>
                          <div className="mb-1 flex justify-between text-xs text-[#64748b]">
                            <span>{tag}</span>
                            <span>{count}</span>
                          </div>
                          <div className="h-2 rounded bg-[#e2e8f0]">
                            <div
                              className="h-2 rounded bg-[#0ea5e9]"
                              style={{ width: `${Math.max(8, (count / maxCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            {newKartleggingItems.length > 0 ? (
              <section className="pt-2">
                <h3 className="text-lg font-semibold text-[#0f172a]">Nye forslag</h3>
                <div className="mt-3 space-y-3">
                  {newKartleggingItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                      <p className="font-medium text-[#0f172a]">{item.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-[#0f172a]">Stemming-resultater</h2>
            <div className="space-y-3">
              {results.votingType === 'dots'
                ? dotItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                      <p className="font-medium text-[#0f172a]">{item.text}</p>
                      <p className="mt-2 text-sm text-[#64748b]">
                        Totalt antall prikker: <span className="font-semibold text-[#0f172a]">{Math.round(item.totalDots)}</span> ·{' '}
                        {totalDots > 0 ? ((item.totalDots / totalDots) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </article>
                  ))
                : scaleItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                      <p className="font-medium text-[#0f172a]">{item.text}</p>
                      <p className="mt-2 text-sm text-[#64748b]">
                        Snittscore:{' '}
                        <span className={`font-semibold ${getScoreClass(item.averageScore)}`}>{item.averageScore.toFixed(1)}</span>
                      </p>
                      <p className="mt-1 text-xs text-[#64748b]">
                        1:{item.distribution['1']} &nbsp; 2:{item.distribution['2']} &nbsp; 3:{item.distribution['3']} &nbsp;
                        4:{item.distribution['4']} &nbsp; 5:{item.distribution['5']}
                      </p>
                    </article>
                  ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
