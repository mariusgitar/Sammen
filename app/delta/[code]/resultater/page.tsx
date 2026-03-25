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
    mode: 'kartlegging' | 'stemming' | 'rangering';
    phase: 'kartlegging' | 'stemming' | 'rangering';
    votingType: 'scale' | 'dots';
    resultsVisible: boolean;
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
  mode: 'kartlegging' | 'stemming' | 'rangering';
  phase: 'kartlegging' | 'stemming' | 'rangering';
  votingType: 'scale' | 'dots';
  participantCount: number;
  items: Array<KartleggingSummaryItem | StemmingSummaryItem | RangeringSummaryItem>;
};

function hasSplitVotes(item: KartleggingSummaryItem, participantCount: number) {
  if (participantCount === 0) {
    return false;
  }

  const maxTagCount = Math.max(...Object.values(item.tagCounts), 0);
  return maxTagCount / participantCount <= 0.5;
}

function getScoreClass(score: number) {
  if (score >= 4) {
    return 'text-emerald-600';
  }

  if (score >= 2.5) {
    return 'text-amber-500';
  }

  return 'text-rose-500';
}

export default function ParticipantResultsPage({ params }: PageProps) {
  const code = useMemo(() => params.code.toUpperCase(), [params.code]);
  const [title, setTitle] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [results, setResults] = useState<ResultsResponse | null>(null);
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

        setTitle(sessionData.session.title);
        setIsVisible(sessionData.session.resultsVisible);

        if (!sessionData.session.resultsVisible) {
          setResults(null);
          setError('');
          return;
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
    }, 5_000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [code]);

  if (!isVisible) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl shadow-slate-950/30">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title || `Sesjon ${code}`}</h1>
          <div className="mt-6 flex items-center justify-center gap-2" aria-hidden>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-300 [animation-delay:0ms]" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-300 [animation-delay:150ms]" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-300 [animation-delay:300ms]" />
          </div>
          <p className="mt-4 text-sm text-slate-300">Fasilitator åpner resultatene snart...</p>
        </section>
      </main>
    );
  }

  if (error || !results) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Kunne ikke laste resultater</h1>
          {error ? <p className="mt-3 text-sm text-slate-300">{error}</p> : null}
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
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>

        {results.mode === 'rangering' ? (
          <>
            <h2 className="text-xl font-semibold text-slate-900">Rangering-resultater</h2>
            <div className="space-y-3">
              {rankingItems.map((item, index) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">#{index + 1}</p>
                  <p className="font-medium text-slate-900">{item.text}</p>
                  <p className="mt-1 text-sm text-slate-700">Snitt posisjon: {item.average_position.toFixed(1)}</p>
                  <p className="text-xs text-slate-500">{item.vote_count} deltakere</p>
                </article>
              ))}
            </div>
          </>
        ) : results.phase === 'kartlegging' ? (
          <>
            <h2 className="text-xl font-semibold text-slate-900">Kartlegging-resultater</h2>
            <div className="space-y-3">
              {mainKartleggingItems.map((item) => {
                const splitVotes = hasSplitVotes(item, results.participantCount);
                const tagRows = [
                  ...Object.entries(item.tagCounts),
                  ...(item.untaggedCount > 0 ? ([['Ingen tag', item.untaggedCount]] as Array<[string, number]>) : []),
                ];
                const maxCount = Math.max(...tagRows.map(([, count]) => count), 1);

                return (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{item.text}</p>
                      {splitVotes ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Uenighet</span>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      {tagRows.map(([tag, count]) => (
                        <div key={`${item.id}-${tag}`}>
                          <div className="mb-1 flex justify-between text-xs text-slate-600">
                            <span>{tag}</span>
                            <span>{count}</span>
                          </div>
                          <div className="h-2 rounded bg-slate-200">
                            <div
                              className="h-2 rounded bg-sky-500"
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
                <h3 className="text-lg font-semibold text-slate-900">Nye forslag</h3>
                <div className="mt-3 space-y-3">
                  {newKartleggingItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-medium text-slate-900">{item.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-slate-900">Stemming-resultater</h2>
            <div className="space-y-3">
              {results.votingType === 'dots'
                ? dotItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-medium text-slate-900">{item.text}</p>
                      <p className="mt-2 text-sm text-slate-700">
                        Totalt antall prikker: <span className="font-semibold text-slate-900">{Math.round(item.totalDots)}</span> ·{' '}
                        {totalDots > 0 ? ((item.totalDots / totalDots) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </article>
                  ))
                : scaleItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-medium text-slate-900">{item.text}</p>
                      <p className="mt-2 text-sm text-slate-700">
                        Snittscore:{' '}
                        <span className={`font-semibold ${getScoreClass(item.averageScore)}`}>{item.averageScore.toFixed(1)}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
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
