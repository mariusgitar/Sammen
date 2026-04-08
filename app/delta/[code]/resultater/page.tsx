'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TimerBanner } from '@/app/components/TimerBanner';

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
    timerEndsAt: string | null;
    timerLabel: string | null;
    active_filter?: 'alle' | 'uenighet' | 'usikker' | 'konsensus';
  };
};

type KartleggingSummaryItem = {
  id: string;
  text: string;
  description?: string | null;
  is_new: boolean;
  excluded: boolean;
  finalTag?: string | null;
  final_tag?: string | null;
  tagCounts: Record<string, number>;
  untaggedCount: number;
  uncertainCount?: number;
};

type StemmingSummaryItem = {
  id: string;
  text: string;
  is_new: boolean;
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

type ResultsResponse = {
  mode: 'kartlegging' | 'stemming' | 'rangering' | 'aapne-innspill';
  phase: 'kartlegging' | 'stemming' | 'rangering' | 'innspill';
  votingType: 'scale' | 'dots';
  participantCount: number;
  items: Array<KartleggingSummaryItem | StemmingSummaryItem | RangeringSummaryItem>;
  themes?: ThemeSummaryItem[];
};

type AdminSummaryResponse = {
  phase: 'kartlegging' | 'stemming' | 'rangering' | 'innspill';
  status: 'setup' | 'active' | 'paused' | 'closed';
  votingType?: 'scale' | 'dots';
  participantCount: number;
  items: Array<KartleggingSummaryItem | StemmingSummaryItem | RangeringSummaryItem>;
  themes?: ThemeSummaryItem[];
};

type ThemeResponse = {
  themes: Array<{
    id: string;
    name: string;
    description?: string | null;
    color: string;
    innspill: Array<{ id: string; text: string; detaljer?: string | null; likes?: number }>;
  }>;
  ungrouped: Array<{ id: string; text: string; detaljer?: string | null; likes?: number }>;
};

// show_others_innspill only affects InnspillView during collection
// Results always show everything

function getScoreClass(score: number) {
  if (score >= 4) {
    return 'text-sky-500';
  }

  if (score >= 2.5) {
    return 'text-amber-500';
  }

  return 'text-[#3b5bdb]';
}

function consensusMeta(score: number) {
  if (score > 0.7) return { text: 'Høy enighet', color: '#22c55e' };
  if (score > 0.4) return { text: 'Noe uenighet', color: '#f59e0b' };
  return { text: 'Stor uenighet', color: '#ef4444' };
}

const CONSENSUS_TAG_COLORS: Record<string, string> = {
  'må-krav': '#0f172a',
  vurderingskriterie: '#6366f1',
  'ikke relevant': '#94a3b8',
};

const getDisplayTag = (item: KartleggingSummaryItem) => {
  const finalTag = (item.finalTag ?? item.final_tag)?.trim();
  if (finalTag) return finalTag;
  const entries = Object.entries(item.tagCounts ?? {});
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
};

export default function ParticipantResultsPage({ params }: PageProps) {
  const router = useRouter();
  const code = useMemo(() => params.code.toUpperCase(), [params.code]);
  const [title, setTitle] = useState('');
  const initialResultsVisible = false;
  const [resultsVisible, setResultsVisible] = useState<boolean>(initialResultsVisible);
  const [sessionStatus, setSessionStatus] = useState<'setup' | 'active' | 'paused' | 'closed' | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionInfoResponse['session']['mode'] | null>(null);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [themeResults, setThemeResults] = useState<ThemeResponse | null>(null);
  const [viewMode, setViewMode] = useState<'temaer' | 'alle'>('alle');
  const viewModeInitialized = useRef(false);
  const [error, setError] = useState('');
  const [timerEndsAt, setTimerEndsAt] = useState<string | null>(null);
  const [timerLabel, setTimerLabel] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'alle' | 'uenighet' | 'usikker' | 'konsensus'>('alle');

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const sessionResponse = await fetch(`/api/delta/${code}`, { cache: 'no-store' });
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

        let currentResultsVisible = serverVisibility;

        const sessionRes = await fetch(`/api/sessions/${code}`);
        if (sessionRes.ok) {
          const sessionPayload = (await sessionRes.json()) as {
            session?: {
              resultsVisible?: boolean;
              results_visible?: boolean;
              active_filter?: 'alle' | 'uenighet' | 'usikker' | 'konsensus';
            };
            resultsVisible?: boolean;
            active_filter?: 'alle' | 'uenighet' | 'usikker' | 'konsensus';
          };
          const filter =
            sessionPayload.session?.active_filter ??
            sessionPayload.active_filter ??
            'alle';
          setActiveFilter(filter);
          const visible =
            sessionPayload.session?.resultsVisible ??
            sessionPayload.session?.results_visible ??
            sessionPayload.resultsVisible ??
            false;
          currentResultsVisible = visible;
          setResultsVisible(visible);
        } else {
          setResultsVisible(serverVisibility);
        }

        if (sessionData.session.status === 'active' && sessionData.session.phase === 'stemming') {
          const stemmingKey = `samen_stemming_done_${code}`;
          const alreadyVoted = localStorage.getItem(stemmingKey) === 'true';

          if (!alreadyVoted) {
            router.push(`/delta/${code}`);
            return;
          }
        }

        setTitle(sessionData.session.title);
        setSessionStatus(sessionData.session.status);
        setSessionMode(sessionData.session.mode);
        setTimerEndsAt(sessionData.session.timerEndsAt ?? null);
        setTimerLabel(sessionData.session.timerLabel ?? null);

        if (!currentResultsVisible) {
          setResults(null);
          setError('');
          return;
        }

        if (sessionData.session.mode === 'aapne-innspill') {
          const themesResponse = await fetch(`/api/delta/${code}/themes`, { cache: 'no-store' });
          const themesData = (await themesResponse.json()) as ThemeResponse | { error: string };

          if (!isMounted) {
            return;
          }

          if (themesResponse.ok && 'themes' in themesData) {
            setThemeResults((previous) => {
              if (themesData.themes.length === 0 && themesData.ungrouped.length === 0 && previous && (previous.themes.length > 0 || previous.ungrouped.length > 0)) {
                return previous;
              }
              return themesData;
            });
            setResults(null);
            setError('');
            return;
          }
        }

        const summaryResponse = await fetch(`/api/admin/${code}/summary`, { cache: 'no-store' });
        const summaryData = (await summaryResponse.json()) as AdminSummaryResponse | { error: string };

        if (!isMounted) {
          return;
        }

        if (!summaryResponse.ok || !('items' in summaryData)) {
          setError('Kunne ikke hente resultater.');
          return;
        }

        setError('');
        setResults((previous) => {
          if (summaryData.items.length === 0 && previous && previous.items.length > 0) {
            return previous;
          }
          return {
            mode: sessionData.session.mode,
            phase: summaryData.phase,
            votingType: summaryData.votingType ?? sessionData.session.votingType,
            participantCount: summaryData.participantCount,
            items: summaryData.items,
            themes: summaryData.themes,
          };
        });
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
  }, [code, router]);

  useEffect(() => {
    if (!themeResults) {
      setViewMode('alle');
      viewModeInitialized.current = false;
      return;
    }

    if (themeResults.themes.length > 0) {
      if (!viewModeInitialized.current) {
        setViewMode('temaer');
        viewModeInitialized.current = true;
      }
      return;
    }

    setViewMode('alle');
    viewModeInitialized.current = true;
  }, [themeResults]);

  if (!resultsVisible) {
    return (
      <main className="bg-[#f8fafc] px-4 py-8 pb-16">
        <section className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 p-6 text-center">
          <div className="flex gap-2" aria-hidden>
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-2 w-2 animate-bounce rounded-full bg-slate-300"
                style={{ animationDelay: `${index * 150}ms` }}
              />
            ))}
          </div>

          <h2 className="text-xl font-semibold text-slate-700">
            {sessionStatus === 'closed' ? 'Sesjonen er avsluttet' : 'Fasilitator åpner resultatene snart...'}
          </h2>

          <p className="text-sm text-slate-400">Siden oppdateres automatisk</p>

          <a href={`/delta/${code}`} className="mt-4 text-xs text-slate-400 hover:text-slate-600">
            ← Tilbake
          </a>
        </section>
        <TimerBanner 
  timerEndsAt={timerEndsAt}
  timerLabel={timerLabel}
/>
      </main>
    );
  }

  if (error || (!results && sessionMode !== 'aapne-innspill')) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 pb-16">
        <section className="w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0f172a]">Kunne ikke laste resultater</h1>
          {error ? <p className="mt-3 text-sm text-[#64748b]">{error}</p> : null}
        </section>
        <TimerBanner 
  timerEndsAt={timerEndsAt}
  timerLabel={timerLabel}
/>
      </main>
    );
  }

  if (sessionMode === 'aapne-innspill' && themeResults) {
    const hasThemes = themeResults.themes.length > 0;
    const themedInnspill = themeResults.themes.flatMap((theme) => theme.innspill);
    const allInnspillById = new Map<string, (typeof themeResults.ungrouped)[number]>();

    for (const entry of themedInnspill) {
      allInnspillById.set(entry.id, entry);
    }

    for (const entry of themeResults.ungrouped) {
      allInnspillById.set(entry.id, entry);
    }

    const allInnspill = Array.from(allInnspillById.values());
    const shouldShowToggle = hasThemes && themeResults.ungrouped.length > 0;

    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-8 pb-16">
        <div className="mx-auto max-w-4xl space-y-4">
          <h1 className="text-center text-2xl font-semibold text-[#0f172a]">{title}</h1>

          {hasThemes ? <h2 className="text-xl font-semibold text-[#0f172a]">Tematiserte innspill</h2> : <h2 className="text-xl font-semibold text-[#0f172a]">Alle innspill</h2>}

          {shouldShowToggle ? (
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('temaer')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${viewMode === 'temaer' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Temaer
              </button>
              <button
                type="button"
                onClick={() => setViewMode('alle')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${viewMode === 'alle' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Alle innspill
              </button>
            </div>
          ) : null}

          {hasThemes && viewMode === 'temaer' ? (
            <>
              <div className={themeResults.themes.length > 2 ? 'grid grid-cols-1 gap-4 md:grid-cols-2' : 'space-y-4'}>
                {themeResults.themes.map((theme) => (
                  <section key={theme.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" style={{ borderLeft: `4px solid ${theme.color}` }}>
                    <h3 style={{ color: theme.color }} className="text-lg font-semibold">{theme.name}</h3>
                    {theme.description ? <p className="text-sm text-slate-500">{theme.description}</p> : null}
                    <div className="mt-3 space-y-2">
                      {theme.innspill.map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                          <p className="font-medium text-slate-800">{entry.text}</p>
                          {entry.detaljer ? <p className="mt-1 text-sm text-slate-500">{entry.detaljer}</p> : null}
                          <p className="mt-2 text-right text-xs text-slate-400">♥ {entry.likes ?? 0}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              {themeResults.ungrouped.length > 0 ? (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <h3 className="mb-3 text-sm font-medium text-slate-400">Andre innspill ({themeResults.ungrouped.length})</h3>
                  {themeResults.ungrouped.map((entry) => (
                    <div key={entry.id} className="mb-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                      <p className="font-medium text-slate-800">{entry.text}</p>
                      {entry.detaljer ? <p className="mt-1 text-sm text-slate-500">{entry.detaljer}</p> : null}
                      <p className="mt-2 text-right text-xs text-slate-400">♥ {entry.likes ?? 0}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <section>
              <div className="mt-3 space-y-2">
                {allInnspill.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <p className="font-medium text-slate-800">{entry.text}</p>
                    {entry.detaljer ? <p className="mt-1 text-sm text-slate-500">{entry.detaljer}</p> : null}
                    <p className="mt-2 text-right text-xs text-slate-400">♥ {entry.likes ?? 0}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        <TimerBanner 
  timerEndsAt={timerEndsAt}
  timerLabel={timerLabel}
/>
      </main>
    );
  }

  if (!results) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 pb-16">
        <section className="w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0f172a]">Ingen resultater enda</h1>
        </section>
        <TimerBanner 
  timerEndsAt={timerEndsAt}
  timerLabel={timerLabel}
/>
      </main>
    );
  }

  const kartleggingItems = results.items
    .filter((item): item is KartleggingSummaryItem => 'tagCounts' in item)
    .filter((item) => !item.excluded);
  const filteredItems = kartleggingItems.filter((item) => {
    if (activeFilter === 'alle') return true;
    if (activeFilter === 'usikker') return (item.uncertainCount ?? 0) > 0;
    const tagEntries = Object.entries(item.tagCounts ?? {})
      .filter(([tag]) => tag !== 'uklart_flag')
      .map(([tag, count]) => ({ tag, count: count as number }));
    const total = tagEntries.reduce((sum, entry) => sum + entry.count, 0);
    const maxCount = total > 0 ? Math.max(...tagEntries.map((entry) => entry.count)) : 0;
    const share = total > 0 ? maxCount / total : 0;
    if (activeFilter === 'uenighet') return share < 0.67;
    if (activeFilter === 'konsensus') return share >= 0.67;
    return true;
  });
  const mainKartleggingItems = filteredItems.filter((item) => !item.is_new);
  const newKartleggingItems = filteredItems.filter((item) => item.is_new);
  const groupedKartleggingItems = mainKartleggingItems.reduce<Record<string, KartleggingSummaryItem[]>>((acc, item) => {
    const tag = getDisplayTag(item) || 'Ikke kategorisert';
    if (!acc[tag]) {
      acc[tag] = [];
    }
    acc[tag].push(item);
    return acc;
  }, {});
  const sortedGroups = Object.entries(groupedKartleggingItems).sort(([a], [b]) => {
    if (a === 'Ikke kategorisert') return 1;
    if (b === 'Ikke kategorisert') return -1;
    return a.localeCompare(b, 'no');
  });
  const totalDots = results.items.reduce((sum, item) => sum + ('averageScore' in item ? item.averageScore * item.voteCount : 0), 0);
  const themedDotResults = [...(results.themes ?? [])].sort((a, b) => b.totalDots - a.totalDots);
  const maxThemeDots = Math.max(...themedDotResults.map((theme) => theme.totalDots), 1);

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
  const filterLabels: Record<string, string> = {
    uenighet: '🔴 Uenighet',
    usikker: '💬 Usikker',
    konsensus: '🟢 Konsensus',
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 pb-16">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-center text-2xl font-semibold text-[#0f172a]">{title}</h1>
        {results.phase === 'kartlegging' && activeFilter !== 'alle' ? (
          <p className="mb-4 text-center text-xs text-slate-400">
            Fasilitator viser: {filterLabels[activeFilter]}
          </p>
        ) : null}

        {results.mode === 'rangering' ? (
          <>
            <h2 className="text-xl font-semibold text-[#0f172a]">Rangering-resultater</h2>
            <div className="space-y-3">
              {rankingItems.map((item, index) => (
                (() => {
                  const totalItems = Math.max(rankingItems.length, 1);
                  const spread = item.minPosition !== null && item.maxPosition !== null ? item.maxPosition - item.minPosition : totalItems - 1;
                  const consensusScore = totalItems > 1 ? 1 - spread / (totalItems - 1) : 1;
                  const label = consensusMeta(consensusScore);
                  return (
                    <article key={item.id} className="mb-2 flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
                      <div className="w-8 flex-shrink-0 text-2xl font-bold text-slate-200">{index + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">{item.text}</div>
                        <div className="mt-0.5 text-xs text-slate-400">Snitt posisjon: {item.average_position.toFixed(1)}</div>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full transition-all" style={{ width: `${consensusScore * 100}%`, background: label.color }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: label.color }}>{label.text}</span>
                      </div>
                    </article>
                  );
                })()
              ))}
            </div>
          </>
        ) : results.phase === 'kartlegging' ? (
          <>
            <h2 className="text-xl font-semibold text-[#0f172a]">Kartlegging-resultater</h2>
            <div className="space-y-4">
              {sortedGroups.map(([groupName, items]) => {
                const groupColor = groupName === 'Ikke kategorisert' ? '#cbd5e1' : (CONSENSUS_TAG_COLORS[groupName.toLowerCase()] ?? '#cbd5e1');
                return (
                  <section key={groupName} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <h3 className="border-l-4 pl-3 text-lg font-semibold text-slate-900" style={{ borderColor: groupColor }}>
                      {groupName}
                    </h3>
                    <div className="mt-3 space-y-3">
                      {items.map((item) => {
                        const voteRows = Object.entries(item.tagCounts).filter(([, count]) => count > 0);
                        const totalVotes = voteRows.reduce((sum, [, count]) => sum + count, 0);
                        return (
                          <article key={item.id} className="rounded-xl border border-slate-100 bg-white p-3">
                            <p className="font-semibold text-slate-800">{item.text}</p>
                            {item.description ? <p className="mt-1 text-sm text-slate-400">{item.description}</p> : null}
                            {totalVotes === 0 ? (
                              <>
                                <div className="mt-3 h-2 w-full rounded-full bg-slate-200" />
                                <p className="mt-2 text-sm text-slate-500">Ingen stemmer</p>
                              </>
                            ) : (
                              <>
                                <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                  {voteRows.map(([tag, count]) => (
                                    <div
                                      key={`${item.id}-${tag}`}
                                      className="h-full"
                                      style={{
                                        width: `${(count / totalVotes) * 100}%`,
                                        backgroundColor: CONSENSUS_TAG_COLORS[tag.toLowerCase()] ?? '#cbd5e1',
                                      }}
                                    />
                                  ))}
                                </div>
                                <p className="mt-2 text-sm text-slate-500">
                                  {voteRows.map(([tag, count], index) => (
                                    <span key={`${item.id}-${tag}-label`}>
                                      {index > 0 ? ' / ' : ''}
                                      {tag}: {count}
                                    </span>
                                  ))}
                                </p>
                              </>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
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
                ? themedDotResults.length > 0
                  ? themedDotResults.map((theme) => (
                      <div key={theme.id} style={{ borderLeft: `4px solid ${theme.color}` }} className="mb-3 rounded-r-xl bg-white py-3 pl-4 shadow-sm">
                        <div className="mb-2 flex items-center justify-between pr-3">
                          <span className="font-semibold text-slate-900">{theme.name}</span>
                          <span className="text-sm text-slate-500">{theme.totalDots} ●</span>
                        </div>
                        <div className="mb-3 mr-3 h-1.5 rounded-full bg-slate-100">
                          <div className="h-full rounded-full transition-all" style={{ width: `${(theme.totalDots / maxThemeDots) * 100}%`, background: theme.color }} />
                        </div>
                        <div className="flex flex-col gap-1 pr-3">
                          {theme.topInnspill.map((entry, index) => (
                            <div key={entry.id} className="flex items-center gap-2 text-xs text-slate-500">
                              <span>{index + 1}.</span>
                              <span className="flex-1 truncate">{entry.text}</span>
                              <span>{'●'.repeat(Math.min(entry.dots, 5))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  : dotItems.map((item) => (
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
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-800">{item.text}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((n) => {
                                const stars = Math.round(item.averageScore);
                                return (
                                  <span key={n} className={`text-sm ${n <= stars ? 'text-amber-400' : 'text-slate-200'}`}>
                                    ★
                                  </span>
                                );
                              })}
                            </div>
                            <span className={`text-xs font-semibold ${getScoreClass(item.averageScore)}`}>{item.averageScore.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: item.stdDev < 1 ? '#22c55e' : item.stdDev < 1.5 ? '#f59e0b' : '#ef4444' }}
                          />
                          <span
                            className="text-xs"
                            style={{ color: item.stdDev < 1 ? '#22c55e' : item.stdDev < 1.5 ? '#f59e0b' : '#ef4444' }}
                          >
                            {item.stdDev < 1 ? 'Enige' : item.stdDev < 1.5 ? 'Delte meninger' : 'Uenige'}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
            </div>
          </>
        )}
      </div>
      <TimerBanner 
  timerEndsAt={timerEndsAt}
  timerLabel={timerLabel}
/>
    </main>
  );
}
