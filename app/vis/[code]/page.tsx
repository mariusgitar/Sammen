'use client';

import { Inter } from 'next/font/google';
import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';

type SessionResponse = {
  session: {
    id: string;
    code: string;
    title: string;
    mode: 'kartlegging' | 'stemming' | 'aapne-innspill' | 'rangering';
    votingType: 'scale' | 'dots';
    phase: 'kartlegging' | 'stemming' | 'innspill' | 'rangering';
    status: 'setup' | 'active' | 'paused' | 'closed';
  };
  items: Array<{
    id: string;
    text: string;
    isQuestion: boolean;
    questionStatus: 'inactive' | 'active' | 'locked';
  }>;
};

type KartleggingSummaryItem = {
  id: string;
  text: string;
  final_tag?: string | null;
  tagCounts: Record<string, number>;
  untaggedCount: number;
};

type StemmingSummaryItem = {
  id: string;
  text: string;
  averageScore: number;
  voteCount: number;
  stdDev?: number;
};

type RangeringSummaryItem = {
  id: string;
  text: string;
  average_position: number;
  vote_count: number;
  position_distribution: Record<string, number>;
  minPosition?: number | null;
  maxPosition?: number | null;
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

type SummaryResponse = {
  phase: 'kartlegging' | 'stemming' | 'innspill' | 'rangering';
  status: 'setup' | 'active' | 'paused' | 'closed';
  participantCount: number;
  items: Array<KartleggingSummaryItem | StemmingSummaryItem | RangeringSummaryItem>;
  themes?: ThemeSummaryItem[];
};

type InnspillSummaryResponse = {
  questions: Array<{
    id: string;
    text: string;
    question_status: 'inactive' | 'active' | 'locked';
    innspill: Array<{
      id: string;
      text: string;
      detaljer?: string | null;
      nickname: string;
      likes: number;
      participant_id: string;
      created_at: string;
    }>;
  }>;
};

type ThemeResponse = {
  themes: Array<{
    id: string;
    name: string;
    description?: string | null;
    color: string;
    innspill: Array<{
      id: string;
      text: string;
      detaljer?: string | null;
      likes: number;
    }>;
  }>;
  ungrouped: Array<{
    id: string;
    text: string;
    detaljer?: string | null;
    likes: number;
  }>;
};

const inter = Inter({ subsets: ['latin'] });
const TAG_COLORS = ['#818cf8', '#34d399', '#fb923c', '#f472b6', '#60a5fa', '#a78bfa', '#4ade80'];

function modeLabel(mode: SessionResponse['session']['mode']) {
  if (mode === 'kartlegging') return 'Kartlegging';
  if (mode === 'stemming') return 'Stemming';
  if (mode === 'rangering') return 'Rangering';
  return 'Åpne innspill';
}

function colorForScore(score: number) {
  const normalized = Math.max(1, Math.min(5, score));
  const ratio = (normalized - 1) / 4;
  const from = { r: 249, g: 168, b: 212 };
  const to = { r: 167, g: 139, b: 250 };
  const r = Math.round(from.r + (to.r - from.r) * ratio);
  const g = Math.round(from.g + (to.g - from.g) * ratio);
  const b = Math.round(from.b + (to.b - from.b) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

function consensusWidth(distribution: Record<string, number>, voteCount: number) {
  if (voteCount <= 1) return 24;
  const maxBin = Math.max(...Object.values(distribution), 0);
  const agreement = maxBin / voteCount;
  return 24 + agreement * 76;
}

export default function PresentationPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const [sessionData, setSessionData] = useState<SessionResponse | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [innspillData, setInnspillData] = useState<InnspillSummaryResponse | null>(null);
  const [themeData, setThemeData] = useState<ThemeResponse | null>(null);
  const [visible, setVisible] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    let active = true;

    const fetchAll = async () => {
      try {
        const [sessionRes, summaryRes] = await Promise.all([
          fetch(`/api/sessions/${code}`, { cache: 'no-store' }),
          fetch(`/api/admin/${code}/summary`, { cache: 'no-store' }),
        ]);

        if (!active) return;

        const sessionJson = (await sessionRes.json()) as SessionResponse;
        const summaryJson = (await summaryRes.json()) as SummaryResponse;

        if (sessionRes.ok && sessionJson?.session) {
          setSessionData((current) => (sessionJson.items.length === 0 && current ? current : sessionJson));
        }

        if (summaryRes.ok && summaryJson?.items) {
          setSummaryData((current) => (summaryJson.items.length === 0 && current ? current : summaryJson));
        }

        if (sessionJson?.session?.mode === 'aapne-innspill') {
          const [innspillRes, themesRes] = await Promise.all([
            fetch(`/api/admin/${code}/innspill-summary`, { cache: 'no-store' }),
            fetch(`/api/admin/${code}/themes`, { cache: 'no-store' }),
          ]);
          const innspillJson = (await innspillRes.json()) as InnspillSummaryResponse;
          const themesJson = (await themesRes.json()) as ThemeResponse;
          if (innspillRes.ok && active) {
            setInnspillData((current) => (innspillJson.questions.length === 0 && current ? current : innspillJson));
          }
          if (themesRes.ok && active) {
            setThemeData(themesJson);
          }
        }

        if (!initialized.current) {
          initialized.current = true;
          setVisible(true);
        }
      } catch {
        // Intentionally silent in presentation mode.
      }
    };

    void fetchAll();
    const timer = setInterval(() => void fetchAll(), 3_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [code]);

  const session = sessionData?.session;
  const summary = summaryData;
  const waiting = !session || !summary || summary.status === 'setup';

  const kartleggingItems = useMemo(
    () => (summary?.items.filter((item): item is KartleggingSummaryItem => 'tagCounts' in item) ?? []),
    [summary?.items],
  );
  const uniqueFinalTags = useMemo(
    () =>
      Array.from(
        new Set(
          kartleggingItems
            .map((item) => item.final_tag?.trim())
            .filter((tag): tag is string => Boolean(tag)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'no')),
    [kartleggingItems],
  );
  const tagColorMap = useMemo(
    () =>
      uniqueFinalTags.reduce<Record<string, string>>((acc, tag, index) => {
        acc[tag.toLowerCase()] = TAG_COLORS[index % TAG_COLORS.length];
        return acc;
      }, {}),
    [uniqueFinalTags],
  );
  const groupedKartleggingItems = useMemo(() => {
    const grouped = kartleggingItems.reduce<Record<string, KartleggingSummaryItem[]>>((acc, item) => {
      const tag = item.final_tag?.trim() || 'Ikke kategorisert';
      if (!acc[tag]) {
        acc[tag] = [];
      }
      acc[tag].push(item);
      return acc;
    }, {});

    return Object.entries(grouped).sort(([a], [b]) => {
      if (a === 'Ikke kategorisert') return 1;
      if (b === 'Ikke kategorisert') return -1;
      return a.localeCompare(b, 'no');
    });
  }, [kartleggingItems]);

  const stemmingItems = useMemo(
    () =>
      (summary?.items.filter((item): item is StemmingSummaryItem => 'averageScore' in item) ?? []).sort(
        (a, b) => b.averageScore - a.averageScore,
      ),
    [summary?.items],
  );

  const rankingItems = useMemo(
    () =>
      (summary?.items.filter((item): item is RangeringSummaryItem => 'average_position' in item) ?? []).sort(
        (a, b) => a.average_position - b.average_position,
      ),
    [summary?.items],
  );

  const dotItems = useMemo(() => {
    const dotSource = stemmingItems
      .map((item) => ({ ...item, dots: Math.round(item.averageScore * item.voteCount) }))
      .sort((a, b) => b.dots - a.dots);
    const total = dotSource.reduce((sum, item) => sum + item.dots, 0);
    return { dotSource, total };
  }, [stemmingItems]);
  const themedDots = useMemo(() => [...(summary?.themes ?? [])].sort((a, b) => b.totalDots - a.totalDots), [summary?.themes]);
  const maxThemeDots = useMemo(() => Math.max(...themedDots.map((theme) => theme.totalDots), 1), [themedDots]);

  return (
    <main className={`${inter.className} min-h-screen bg-[#0a0a0f] p-12 text-white`}>
      <div
        className={`relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-[1800px] flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-12 transition-all duration-700 ease-out ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{session?.title ?? 'Presentasjonsmodus'}</h1>
            <span className="mt-4 inline-flex rounded-2xl border border-[#818cf8]/40 bg-[#818cf8]/10 px-4 py-1.5 text-sm font-semibold text-[#c7d2fe]">
              {session ? modeLabel(session.mode) : 'Laster...'}
            </span>
          </div>
          <div className="text-right">
            <p className="inline-flex items-center gap-2 text-lg text-white/80">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#67e8f9]" />
              {summary?.participantCount ?? 0} deltakere
            </p>
          </div>
        </header>

        <section className="relative flex-1">
          {waiting ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
              <p className="animate-pulse font-mono text-6xl tracking-[0.3em] text-white/30">{code}</p>
              <p className="text-xl text-white/20">samen-alene.vercel.app/delta/{code}</p>
              <div className="rounded-3xl border border-white/10 bg-white p-4">
                <QRCode value={`https://samen-alene.vercel.app/delta/${code}`} size={200} bgColor="#ffffff" fgColor="#000000" />
              </div>
            </div>
          ) : (
            <div className="transition-all duration-1000 ease-out opacity-100">
            {session?.phase === 'kartlegging' ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {groupedKartleggingItems.map(([groupName, items]) => {
                  const groupColor = groupName === 'Ikke kategorisert' ? '#94a3b8' : (tagColorMap[groupName.toLowerCase()] ?? TAG_COLORS[0]);
                  return (
                    <section key={groupName} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                      <h2 className="border-l-[6px] pl-4 text-2xl font-bold text-white" style={{ borderColor: groupColor }}>
                        {groupName}
                      </h2>
                      <div className="mt-5 space-y-4">
                        {items.map((item) => {
                          const voteRows = Object.entries(item.tagCounts).filter(([, count]) => count > 0);
                          const totalVotes = voteRows.reduce((sum, [, count]) => sum + count, 0);
                          return (
                            <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                              <p className="text-lg font-semibold text-white">{item.text}</p>
                              {totalVotes === 0 ? (
                                <>
                                  <div className="mt-3 h-[10px] w-full rounded-full bg-white/20" />
                                  <p className="mt-3 text-sm text-white/60">Ingen stemmer</p>
                                </>
                              ) : (
                                <>
                                  <div className="mt-3 flex h-[10px] w-full overflow-hidden rounded-full bg-white/10">
                                    {voteRows.map(([tag, count]) => (
                                      <div
                                        key={`${item.id}-${tag}`}
                                        className="h-full"
                                        style={{
                                          width: `${(count / totalVotes) * 100}%`,
                                          backgroundColor: tagColorMap[tag.toLowerCase()] ?? '#94a3b8',
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <p className="mt-3 text-sm">
                                    {voteRows.map(([tag, count], index) => (
                                      <span key={`${item.id}-${tag}-label`} style={{ color: tagColorMap[tag.toLowerCase()] ?? '#cbd5e1' }}>
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
            ) : null}

            {session?.phase === 'stemming' && session.votingType === 'scale' ? (
              <div className="space-y-4 pr-2">
                {stemmingItems.slice(0, 8).map((item, index) => {
                  const color = colorForScore(item.averageScore);
                  return (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <p className="text-lg font-medium text-white">{item.text}</p>
                        <div className="text-right">
                          <p className="text-2xl font-bold" style={{ color }}>{item.averageScore.toFixed(1)}</p>
                          <p className="text-sm text-white/40">{item.voteCount} stemmer</p>
                        </div>
                      </div>
                      <div className="h-10 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${Math.max(6, (item.averageScore / 5) * 100)}%`, backgroundColor: color, transitionDelay: `${index * 100}ms` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {session?.phase === 'stemming' && session.votingType === 'dots' ? (
              themedDots.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {themedDots.map((theme) => (
                    <div key={theme.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                      <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
                        <p className="text-lg font-semibold text-white">{theme.name}</p>
                        <p className="text-sm text-white/60">{theme.totalDots} ●</p>
                      </div>
                      <div className="mb-3 h-2 rounded-full bg-white/10">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(theme.totalDots / maxThemeDots) * 100}%`, background: theme.color }} />
                      </div>
                      <div className="space-y-2">
                        {theme.topInnspill.map((entry, index) => (
                          <div key={entry.id} className="rounded-xl bg-white/[0.03] px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate text-white/80">{index + 1}. {entry.text}</span>
                              <span className="text-white/60">{entry.dots}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-10">
                  <div className="grid grid-cols-3 items-end gap-6">
                    {[1, 0, 2].map((podiumIndex) => {
                      const item = dotItems.dotSource[podiumIndex];
                      const heights = ['h-48', 'h-64', 'h-40'];
                      const colors = ['#67e8f9', '#a78bfa', '#86efac'];
                      if (!item) return <div key={podiumIndex} className="rounded-2xl border border-white/10 bg-white/[0.02]" />;
                      return (
                        <div
                          key={item.id}
                          className={`flex ${heights[podiumIndex]} flex-col justify-between rounded-3xl border border-white/10 p-5 transition-all duration-700 ease-out`}
                          style={{ backgroundColor: `${colors[podiumIndex]}22` }}
                        >
                          <p className="line-clamp-3 text-lg font-semibold">{item.text}</p>
                          <div>
                            <p className="text-4xl font-black" style={{ color: colors[podiumIndex] }}>{item.dots}</p>
                            <p className="text-sm text-white/50">{dotItems.total > 0 ? Math.round((item.dots / dotItems.total) * 100) : 0}% av dots</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    {dotItems.dotSource.slice(3).map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-white/60">
                        <p className="truncate">{item.text}</p>
                        <p className="font-semibold">{item.dots}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : null}

            {session?.phase === 'rangering' ? (
              <div className="space-y-4">
                {rankingItems.map((item, index) => {
                  const top = index < 3;
                  const glow = ['#a78bfa', '#67e8f9', '#f9a8d4'][index] ?? '#94a3b8';
                  return (
                    <div
                      key={item.id}
                      className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-700 ease-out"
                      style={{
                        transitionDelay: `${index * 150}ms`,
                        filter: top ? `drop-shadow(0 0 14px ${glow}55)` : 'none',
                      }}
                    >
                      <p className="absolute left-4 top-1 text-6xl font-black text-white/10">{index + 1}</p>
                      <div className="relative ml-14">
                        <p className={`font-semibold ${top ? 'text-2xl' : 'text-xl'} text-white`}>{item.text}</p>
                        <p className="text-sm text-white/50">Snittplassering: {item.average_position.toFixed(2)}</p>
                        <div className="mt-3 h-1.5 rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-[#94a3b8] transition-all duration-700 ease-out" style={{ width: `${consensusWidth(item.position_distribution, item.vote_count)}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {session?.phase === 'innspill' ? (
              <>
                {session?.mode === 'aapne-innspill' && (themeData?.themes?.length ?? 0) > 0 ? (
                  <>
                    <div className="grid grid-cols-1 gap-6 md:h-full md:items-start md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {themeData?.themes.map((theme) => (
                        <div key={theme.id} className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                          <div className="border-b-2 pb-3" style={{ borderColor: theme.color }}>
                            <h2 className="text-2xl font-bold text-white">{theme.name}</h2>
                            {theme.description ? <p className="mt-1 text-sm text-white/50">{theme.description}</p> : null}
                            <span className="mt-1 block text-xs text-white/30">{theme.innspill.length} innspill</span>
                          </div>
                          <div className="flex flex-col gap-2 overflow-y-auto">
                            {theme.innspill.map((entry) => (
                              <div
                                key={entry.id}
                                className="min-h-[60px] rounded-xl p-4"
                                style={{ backgroundColor: `${theme.color}15`, borderLeft: `3px solid ${theme.color}` }}
                              >
                                <p className="text-base font-medium text-white">{entry.text}</p>
                                {entry.detaljer ? <p className="mt-1 text-xs text-white/50">{entry.detaljer}</p> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {(themeData?.ungrouped?.length ?? 0) > 0 ? (
                      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                        <h3 className="text-xl font-bold text-white/90">Andre innspill</h3>
                        <div className="mt-4 space-y-3">
                          {themeData?.ungrouped.map((entry) => (
                            <article key={entry.id} className="min-h-[60px] rounded-2xl border border-white/20 bg-white/[0.04] p-4">
                              <p className="text-base text-white/90">{entry.text}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                    {(innspillData?.questions ?? [])
                      .filter((question) => question.question_status === 'active')
                      .map((question) => {
                        const latest = [...question.innspill]
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .slice(0, 6);
                        return (
                          <div key={question.id} className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                            <h3 className="mb-4 text-xl font-bold">{question.text}</h3>
                            <div className="space-y-3">
                              {latest.map((entry, idx) => (
                                <article key={entry.id} className="rounded-2xl border border-[#818cf8]/20 bg-[#818cf8]/10 p-3 transition-all duration-700 ease-out" style={{ transitionDelay: `${idx * 80}ms` }}>
                                  <p className="text-base text-white/90">{entry.text}</p>
                                  <p className="mt-2 text-sm text-white/50">♥ {entry.likes}</p>
                                </article>
                              ))}
                              {question.innspill.length > 6 ? <p className="text-sm text-white/40">og {question.innspill.length - 6} til...</p> : null}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            ) : null}
            </div>
          )}
        </section>

        <p className="absolute bottom-6 right-8 font-mono text-sm text-white/20">Kode: {code}</p>
      </div>
    </main>
  );
}
