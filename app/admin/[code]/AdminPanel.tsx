'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import ToggleButton from '@/app/components/ui/ToggleButton';

import { InnspillAdmin } from './InnspillAdmin';
import { ThemePanel } from './ThemePanel';

type SessionView = {
  id: string;
  title: string;
  code: string;
  mode: string;
  phase: 'kartlegging' | 'stemming' | 'innspill' | 'rangering';
  status: 'setup' | 'active' | 'paused' | 'closed';
  resultsVisible: boolean;
  showOthersInnspill: boolean;
};

type SessionItem = {
  id: string;
  text: string;
  isNew: boolean;
  excluded: boolean;
  createdBy: string;
  isQuestion?: boolean;
  questionStatus?: 'inactive' | 'active' | 'locked';
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
  stdDev: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
};

type RangeringSummaryItem = {
  id: string;
  text: string;
  is_new: boolean;
  created_by: string;
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

type SummaryResponse = {
  phase: 'kartlegging' | 'stemming' | 'innspill' | 'rangering';
  status: 'setup' | 'active' | 'paused' | 'closed';
  votingType?: 'scale' | 'dots';
  participantCount: number;
  items: Array<KartleggingSummaryItem | StemmingSummaryItem | RangeringSummaryItem>;
  themes?: ThemeSummaryItem[];
};

type InnspillQuestion = {
  id: string;
  text: string;
  question_status: 'inactive' | 'active' | 'locked';
  innspill: Array<{ id: string; text: string; nickname: string; likes: number }>;
};

type AdminPanelProps = {
  session: SessionView;
  items: SessionItem[];
};


const modeLabels: Record<string, string> = {
  kartlegging: 'Kartlegging',
  stemming: 'Stemming',
  'aapne-innspill': 'Åpne innspill',
  rangering: 'Rangering',
};

const statusLabels: Record<string, string> = {
  setup: 'Ikke startet',
  active: 'Aktiv',
  paused: 'Innsamling avsluttet',
  closed: 'Avsluttet',
};

const phaseLabels: Record<string, string> = {
  kartlegging: 'Kartlegging pågår',
  stemming: 'Stemming pågår',
  innspill: 'Innspill pågår',
  rangering: 'Rangering pågår',
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
  const PRIMARY_BUTTON_CLASS =
    'w-full py-3 px-4 rounded-xl font-semibold text-base bg-white text-[#0f172a] hover:bg-white/90 transition-colors disabled:opacity-70';
  const TERTIARY_BUTTON_CLASS =
    'text-sm text-white/40 hover:text-white/60 transition-colors underline-offset-2 hover:underline disabled:opacity-70';
  const DANGER_BUTTON_CLASS =
    'text-sm text-rose-400/60 hover:text-rose-400 transition-colors disabled:opacity-70';

  const [currentSession, setCurrentSession] = useState(session);
  const [sessionStatus, setSessionStatus] = useState<SessionView['status']>(session.status);
  const [sessionPhase, setSessionPhase] = useState<SessionView['phase']>(session.phase);
  const [resultsVisible, setResultsVisible] = useState(session.resultsVisible);
  const [summary, setSummary] = useState<SummaryResponse>({
    phase: session.phase,
    status: session.status,
    votingType: 'scale',
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
    themes: [],
  });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isOpeningVoting, setIsOpeningVoting] = useState(false);
  const [includeMap, setIncludeMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, !item.excluded])),
  );
  const [error, setError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [dotBudget, setDotBudget] = useState(5);
  const [allowMultipleDots, setAllowMultipleDots] = useState(true);
  const [showKartleggingDotOptions, setShowKartleggingDotOptions] = useState(false);
  const [innspillQuestions, setInnspillQuestions] = useState<InnspillQuestion[]>([]);
  const [selectedInnspill, setSelectedInnspill] = useState<Record<string, boolean>>({});
  const [showInnspillDotOptions, setShowInnspillDotOptions] = useState(false);
  const [kartleggingVotingType, setKartleggingVotingType] = useState<'scale' | 'dots'>('scale');
  const [innspillVotingType, setInnspillVotingType] = useState<'scale' | 'dots'>('scale');
  const [confirmClose, setConfirmClose] = useState(false);

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

  async function fetchInnspillSummary() {
    if (currentSession.mode !== 'aapne-innspill') {
      return;
    }

    try {
      const response = await fetch(`/api/admin/${currentSession.code}/innspill-summary`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as { questions?: InnspillQuestion[]; error?: string };

      const questions = data.questions ?? [];

      if (!response.ok || questions.length === 0) {
        return;
      }

      setInnspillQuestions(questions);
      setSelectedInnspill((current) => {
        const next = { ...current };

        for (const question of questions) {
          for (const entry of question.innspill) {
            if (typeof next[entry.id] === 'undefined') {
              next[entry.id] = entry.likes > 0;
            }
          }
        }

        return next;
      });
    } catch {
      // noop
    }
  }

  useEffect(() => {
    void fetchSummary();
    void fetchInnspillSummary();

    const timer = setInterval(() => {
      void fetchSummary();
      void fetchInnspillSummary();
    }, 10_000);

    return () => clearInterval(timer);
    // We intentionally run this only once on mount for initial fetch + polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setConfirmClose(false);
  }, [sessionStatus]);

  useEffect(() => {
    if (!confirmClose) {
      return;
    }

    const timer = setTimeout(() => {
      setConfirmClose(false);
    }, 5_000);

    return () => clearTimeout(timer);
  }, [confirmClose]);

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
            session: Pick<SessionView, 'status' | 'phase' | 'resultsVisible'>;
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
        resultsVisible: data.session.resultsVisible,
      }));
      setResultsVisible(data.session.resultsVisible);
    } catch {
      setError('Kunne ikke oppdatere sesjonen. Prøv igjen.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleToggleResults() {
    setIsUpdatingStatus(true);
    setError('');

    try {
      const response = await fetch(`/api/sessions/${currentSession.code}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ results_visible: !resultsVisible }),
      });

      const data = (await response.json()) as
        | {
            session: Pick<SessionView, 'status' | 'phase' | 'resultsVisible'>;
          }
        | { error: string };

      if (!response.ok || !('session' in data)) {
        setError('Kunne ikke oppdatere resultatvisning. Prøv igjen.');
        return;
      }

      setSessionStatus(data.session.status);
      setSessionPhase(data.session.phase);
      setResultsVisible(data.session.resultsVisible);
      setCurrentSession((current) => ({
        ...current,
        status: data.session.status,
        phase: data.session.phase,
        resultsVisible: data.session.resultsVisible,
      }));
    } catch {
      setError('Kunne ikke oppdatere resultatvisning. Prøv igjen.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  function scrollToStemming() {
    document.getElementById('stemming-oppsett')?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleReopenCollection() {
    void updateSessionStatus('active');
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

  async function handleCopyParticipantUrl(participantUrl: string) {
    try {
      await navigator.clipboard.writeText(participantUrl);
      setUrlCopied(true);
      setTimeout(() => {
        setUrlCopied(false);
      }, 2_000);
    } catch {
      setError('Kunne ikke kopiere deltakerlenken.');
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

  async function startStemming(votingType: 'scale' | 'dots', payloadItems?: Array<{ text: string; created_by: string }>) {
    setIsOpeningVoting(true);
    setError('');

    try {
      if (sessionPhase === 'kartlegging') {
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
      }

      const response = await fetch(`/api/sessions/${currentSession.code}/start-stemming`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voting_type: votingType,
          dot_budget: votingType === 'dots' ? dotBudget : undefined,
          allow_multiple_dots: votingType === 'dots' ? allowMultipleDots : undefined,
          items: payloadItems,
        }),
      });

      const data = (await response.json()) as
        | {
            session: Pick<SessionView, 'status' | 'phase' | 'resultsVisible' | 'mode'>;
          }
        | { error: string };

      if (!response.ok || !('session' in data)) {
        setError('error' in data ? data.error : 'Kunne ikke åpne for stemming.');
        return;
      }

      setSessionStatus(data.session.status);
      setSessionPhase(data.session.phase);
      setCurrentSession((current) => ({
        ...current,
        mode: data.session.mode,
        status: data.session.status,
        phase: data.session.phase,
        resultsVisible: data.session.resultsVisible,
      }));
      setResultsVisible(data.session.resultsVisible);
      await fetchSummary();
      await fetchInnspillSummary();
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Kunne ikke åpne for stemming.');
    } finally {
      setIsOpeningVoting(false);
      setShowKartleggingDotOptions(false);
      setShowInnspillDotOptions(false);
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

  const rankingResults = useMemo(
    () =>
      summary.items
        .filter((item): item is RangeringSummaryItem => 'average_position' in item)
        .sort((a, b) => a.average_position - b.average_position),
    [summary.items],
  );
  const themedDotResults = useMemo(
    () => [...(summary.themes ?? [])].sort((a, b) => b.totalDots - a.totalDots),
    [summary.themes],
  );
  const maxThemeDots = useMemo(
    () => Math.max(...themedDotResults.map((theme) => theme.totalDots), 1),
    [themedDotResults],
  );

  const participantUrl = typeof window !== 'undefined' ? `${window.location.origin}/delta/${currentSession.code}` : `/delta/${currentSession.code}`;

  const selectedInnspillEntries = useMemo(
    () =>
      innspillQuestions.flatMap((question) =>
        question.innspill
          .filter((entry) => selectedInnspill[entry.id])
          .map((entry) => ({ text: entry.text, created_by: entry.nickname })),
      ),
    [innspillQuestions, selectedInnspill],
  );

  const isMultiPhaseMode = currentSession.mode === 'kartlegging' || currentSession.mode === 'aapne-innspill';
  const flowSteps =
    currentSession.mode === 'aapne-innspill'
      ? ['Samle inn', 'Velg innspill', 'Stem']
      : ['Samle inn', 'Kuratér liste', 'Stem'];

  const currentFlowStep = useMemo(() => {
    if (sessionStatus === 'closed') {
      return 3;
    }

    if (sessionPhase === 'stemming' && sessionStatus === 'active') {
      return 3;
    }

    if (sessionStatus === 'paused' && sessionPhase !== 'stemming') {
      return 2;
    }

    return 1;
  }, [sessionPhase, sessionStatus]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Sesjonsinfo</h2>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{currentSession.title}</h1>
        {sessionStatus !== 'setup' ? (
          <Link
            href={`/admin/${currentSession.code}/results`}
            className="mt-2 inline-block text-sm text-white/40 transition-colors hover:text-white/60"
          >
            Se resultater →
          </Link>
        ) : null}
        <p className="mt-2 text-slate-300">Modus: {modeLabels[currentSession.mode] ?? currentSession.mode}</p>
        <p className="text-slate-300">Status: {statusLabels[sessionStatus] ?? sessionStatus}</p>
        <p className="text-slate-300">Fase: {phaseLabels[sessionPhase] ?? sessionPhase}</p>
        <Link
          href={`/vis/${currentSession.code}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm text-white/50 transition hover:text-white/70"
        >
          Åpne presentasjonsmodus →
        </Link>
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
              <button
                type="button"
                onClick={() => void handleCopyParticipantUrl(participantUrl)}
                className="mt-2 text-left text-xs text-white/40 transition-colors hover:text-white/70"
              >
                {urlCopied ? 'Kopiert! ✓' : participantUrl}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {isMultiPhaseMode ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Flyt</h2>
          <div className="mt-4 flex items-center">
            {flowSteps.map((stepLabel, index) => {
              const stepNumber = index + 1;
              const isClosed = sessionStatus === 'closed';
              const isCompleted = isClosed || stepNumber < currentFlowStep;
              const isCurrent = !isClosed && stepNumber === currentFlowStep;

              return (
                <div key={stepLabel} className="flex flex-1 items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        isCompleted
                          ? 'bg-violet-400 text-slate-950'
                          : isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'border border-white/20 text-white/60'
                      }`}
                    >
                      {isCurrent ? <span className="absolute inset-0 rounded-full ring-4 ring-blue-400/30 animate-pulse" /> : null}
                      <span className="relative">{isCompleted ? '✓' : stepNumber}</span>
                    </div>
                    <span
                      className={`text-sm ${
                        isCompleted
                          ? 'text-white/60 line-through'
                          : isCurrent
                            ? 'font-semibold text-white'
                            : 'text-white/40'
                      }`}
                    >
                      {stepLabel}
                    </span>
                  </div>
                  {index < flowSteps.length - 1 ? <div className="mx-2 h-px flex-1 bg-white/20" /> : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Flyt</h2>
          <p className="mt-3 text-sm text-white/70">{phaseLabels[sessionPhase] ?? sessionPhase}</p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">Sesjonskontroller</h2>
        <div className="mt-4 space-y-3">
          {sessionStatus === 'setup' ? (
            <>
              <p className="text-sm text-white/60">Klar til oppstart. Åpne sesjonen når deltakerne er klare.</p>
              <button
                type="button"
                onClick={() => updateSessionStatus('active')}
                disabled={isUpdatingStatus}
                className={PRIMARY_BUTTON_CLASS}
              >
                Åpne for deltakere →
              </button>
            </>
          ) : null}

          {sessionStatus === 'active' && sessionPhase !== 'stemming' ? (
            <>
              <p className="text-sm text-white/60">Innsamling pågår. Avslutt når dere er klare for neste steg.</p>
              <button
                type="button"
                onClick={() => updateSessionStatus('paused')}
                disabled={isUpdatingStatus}
                className={PRIMARY_BUTTON_CLASS}
              >
                Avslutt innsamling
              </button>
            </>
          ) : null}

          {sessionStatus === 'paused' && currentSession.mode === 'kartlegging' ? (
            <>
              <p className="text-sm text-white/60">
                Innsamling avsluttet. Kuratér listen nedenfor, velg stemmetype og start stemming.
              </p>
              <ToggleButton
                value={kartleggingVotingType}
                onChange={(value) => {
                  const next = value as 'scale' | 'dots';
                  setKartleggingVotingType(next);
                  setShowKartleggingDotOptions(next === 'dots');
                }}
                options={[
                  { value: 'scale', label: 'Skala 1-5' },
                  { value: 'dots', label: 'Dot voting' },
                ]}
              />
              {kartleggingVotingType === 'scale' ? (
                <button
                  type="button"
                  onClick={() => void startStemming('scale')}
                  disabled={isOpeningVoting}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  Åpne for stemming (skala 1-5) →
                </button>
              ) : null}
              {showKartleggingDotOptions ? (
                <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/60 p-4">
                  <label className="block text-sm text-slate-200">
                    Dot-budget per deltaker
                    <input
                      type="number"
                      min={1}
                      value={dotBudget}
                      onChange={(event) => setDotBudget(Math.max(1, Number(event.target.value) || 1))}
                      className="mt-1 block w-28 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={allowMultipleDots}
                      onChange={(event) => setAllowMultipleDots(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-500 bg-slate-900"
                    />
                    Tillat flere dots på samme element
                  </label>
                  <button
                    type="button"
                    onClick={() => void startStemming('dots')}
                    disabled={isOpeningVoting}
                    className="rounded bg-emerald-200 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-100 disabled:opacity-70"
                  >
                    Start dot voting
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => updateSessionStatus('active')}
                disabled={isUpdatingStatus}
                className={TERTIARY_BUTTON_CLASS}
              >
                Åpne kartlegging igjen
              </button>
              {confirmClose ? (
                <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 p-3">
                  <span className="text-sm text-rose-300">Er du sikker? Dette kan ikke angres.</span>
                  <button
                    type="button"
                    onClick={() => updateSessionStatus('closed')}
                    disabled={isUpdatingStatus}
                    className="text-sm font-medium text-rose-400"
                  >
                    Ja, avslutt
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClose(false)}
                    className="text-sm text-white/40"
                  >
                    Avbryt
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClose(true)}
                  className={DANGER_BUTTON_CLASS}
                >
                  Avslutt sesjon
                </button>
              )}
            </>
          ) : null}

          {sessionStatus === 'paused' && currentSession.mode === 'aapne-innspill' ? (
            <div className="space-y-4">
              <p className="text-sm text-white/60">
                Innsamling avsluttet. Velg innspill som skal tas med til stemming nedenfor.
              </p>

              <button
                type="button"
                onClick={scrollToStemming}
                className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#0f172a] transition-colors hover:bg-white/90"
              >
                Gå til stemmeoppsett ↓
              </button>

              <div className="border-t border-white/10" />

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleReopenCollection}
                  disabled={isUpdatingStatus}
                  className="flex items-center gap-2 text-left text-sm text-white/50 transition-colors hover:text-white/80 disabled:opacity-70"
                >
                  <span>↩</span> Åpne innsamling igjen
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClose(true)}
                  className="text-left text-sm text-rose-400/70 transition-colors hover:text-rose-400"
                >
                  Avslutt sesjon
                </button>
              </div>

              <div className="border-t border-white/10" />

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/70">Resultater synlige for deltakere</p>
                  <p className="mt-0.5 text-xs text-white/30">Deltakere kan se resultater på sin enhet</p>
                </div>
                <div className="flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleResults}
                    disabled={isUpdatingStatus}
                    aria-label="Bytt synlighet for resultater"
                    className={`
                      relative inline-flex h-5 w-9 flex-shrink-0
                      cursor-pointer rounded-full border-2 border-transparent 
                      transition-colors duration-200
                      ${resultsVisible ? 'bg-violet-400' : 'bg-white/20'}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-4 w-4
                        transform rounded-full bg-white shadow
                        transition-transform duration-200
                        ${resultsVisible ? 'translate-x-4' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {sessionPhase === 'stemming' && sessionStatus === 'active' ? (
            <>
              <p className="text-sm text-white/60">Stemming pågår.</p>
              <button
                type="button"
                onClick={() => updateSessionStatus('closed')}
                disabled={isUpdatingStatus}
                className={PRIMARY_BUTTON_CLASS}
              >
                Avslutt stemming
              </button>
            </>
          ) : null}

          {sessionStatus === 'closed' ? (
            <>
              <p className="text-sm text-white/60">Sesjonen er avsluttet.</p>
              <button
                type="button"
                onClick={() => updateSessionStatus('active')}
                disabled={isUpdatingStatus}
                className={TERTIARY_BUTTON_CLASS}
              >
                Åpne igjen
              </button>
            </>
          ) : null}

          {sessionStatus !== 'setup' && !(sessionStatus === 'paused' && currentSession.mode === 'aapne-innspill') ? (
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-white/10 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/70">Resultater synlige for deltakere</p>
                <p className="mt-0.5 text-xs text-white/30">Deltakere kan se resultater på sin enhet</p>
              </div>
              <div className="flex-shrink-0">
                <button
                  type="button"
                  onClick={handleToggleResults}
                  disabled={isUpdatingStatus}
                  aria-label="Bytt synlighet for resultater"
                  className={`
                    relative inline-flex h-5 w-9 flex-shrink-0
                    cursor-pointer rounded-full border-2 border-transparent 
                    transition-colors duration-200
                    ${resultsVisible ? 'bg-violet-400' : 'bg-white/20'}
                  `}
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-4 w-4
                      transform rounded-full bg-white shadow
                      transition-transform duration-200
                      ${resultsVisible ? 'translate-x-4' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      </section>

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

        </section>
      ) : null}

      {currentSession.mode === 'aapne-innspill' ? (
        <InnspillAdmin
          code={currentSession.code}
          showOthersInnspill={currentSession.showOthersInnspill}
          questions={items
            .filter((item) => item.isQuestion)
            .map((item) => ({
              id: item.id,
              text: item.text,
              questionStatus: item.questionStatus ?? 'inactive',
            }))}
        />
      ) : null}

      {currentSession.mode === 'aapne-innspill' && sessionStatus === 'paused' ? (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Tematisering</p>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <ThemePanel code={currentSession.code} session={currentSession} />
        </section>
      ) : null}

      {currentSession.mode === 'aapne-innspill' && sessionStatus === 'paused' ? (
        <section id="stemming-oppsett" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Gå videre til stemming</h2>
          <p className="mt-3 text-sm text-slate-300">
            Velg hvilke innspill som skal tas med til stemming. Deltakerne stemmer deretter på de utvalgte innspillene.
          </p>

          <div className="mt-4 space-y-4">
            {innspillQuestions.map((question) => (
              <article key={question.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                <h3 className="text-sm font-semibold text-slate-100">{question.text}</h3>
                <div className="mt-3 space-y-2">
                  {question.innspill.map((entry) => (
                    <label key={entry.id} className="flex items-start gap-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={selectedInnspill[entry.id] ?? false}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedInnspill((current) => ({ ...current, [entry.id]: checked }));
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900"
                      />
                      <span>
                        {entry.text} <span className="text-xs text-slate-400">({entry.nickname} · {entry.likes} likes)</span>
                      </span>
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <ToggleButton
              value={innspillVotingType}
              onChange={(value) => {
                const next = value as 'scale' | 'dots';
                setInnspillVotingType(next);
                setShowInnspillDotOptions(next === 'dots');
              }}
              options={[
                { value: 'scale', label: 'Skala 1-5' },
                { value: 'dots', label: 'Dot voting' },
              ]}
            />
            {innspillVotingType === 'scale' ? (
              <button
                type="button"
                onClick={() => void startStemming('scale', selectedInnspillEntries)}
                disabled={isOpeningVoting || selectedInnspillEntries.length === 0}
                className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white disabled:opacity-70"
              >
                Åpne for stemming (skala 1-5)
              </button>
            ) : null}
            {showInnspillDotOptions ? (
              <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4 space-y-3">
                <label className="block text-sm text-slate-200">
                  Dot-budget per deltaker
                  <input
                    type="number"
                    min={1}
                    value={dotBudget}
                    onChange={(event) => setDotBudget(Math.max(1, Number(event.target.value) || 1))}
                    className="mt-1 block w-28 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={allowMultipleDots}
                    onChange={(event) => setAllowMultipleDots(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-900"
                  />
                  Tillat flere dots på samme element
                </label>
                <button
                  type="button"
                  onClick={() => void startStemming('dots', selectedInnspillEntries)}
                  disabled={isOpeningVoting || selectedInnspillEntries.length === 0}
                  className="rounded bg-emerald-200 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-100 disabled:opacity-70"
                >
                  Start dot voting
                </button>
              </div>
            ) : null}
          </div>
          {selectedInnspillEntries.length === 0 ? <p className="mt-3 text-xs text-amber-300">Velg minst ett innspill for å starte stemming.</p> : null}
        </section>
      ) : null}

      {currentSession.mode !== 'aapne-innspill' ? (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Live oversikt</h2>
        {summaryError ? <p className="mt-2 text-xs text-amber-300">{summaryError}</p> : null}
        <p className="mt-3 text-slate-100">Antall deltakere som har sendt inn: {summary.participantCount}</p>

        {currentSession.mode === 'rangering' && (sessionPhase === 'rangering' || sessionPhase === 'stemming') ? (
          <div className="mt-4 space-y-3">
            {rankingResults.map((item, index) => {
              const totalItems = Math.max(rankingResults.length, 1);
              const spread = item.minPosition !== null && item.maxPosition !== null ? item.maxPosition - item.minPosition : totalItems - 1;
              const consensusScore = totalItems > 1 ? 1 - spread / (totalItems - 1) : 1;
              const consensusLabel =
                consensusScore > 0.7
                  ? { text: 'Høy enighet', color: '#22c55e' }
                  : consensusScore > 0.4
                    ? { text: 'Noe uenighet', color: '#f59e0b' }
                    : { text: 'Stor uenighet', color: '#ef4444' };

              return (
                <article key={item.id} className="mb-2 flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 text-slate-900">
                  <div className="w-8 flex-shrink-0 text-2xl font-bold text-slate-200">{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{item.text}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Snitt posisjon: {Number.isFinite(item.average_position) ? item.average_position.toFixed(1) : '–'}</p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full transition-all" style={{ width: `${consensusScore * 100}%`, background: consensusLabel.color }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: consensusLabel.color }}>{consensusLabel.text}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : sessionPhase === 'stemming' ? (
          summary.votingType === 'dots' && themedDotResults.length > 0 ? (
            <div className="mt-4 space-y-3">
              {themedDotResults.map((theme) => (
                <div key={theme.id} style={{ borderLeft: `4px solid ${theme.color}` }} className="mb-3 rounded-r-xl bg-white/5 py-3 pl-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-white">{theme.name}</span>
                    <span className="text-sm text-white/60">{theme.totalDots} ●</span>
                  </div>
                  <div className="mb-3 h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(theme.totalDots / maxThemeDots) * 100}%`, background: theme.color }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    {theme.topInnspill.map((entry, index) => (
                      <div key={entry.id} className="flex items-center gap-2 text-xs text-white/50">
                        <span>{index + 1}.</span>
                        <span className="flex-1 truncate">{entry.text}</span>
                        <span>{'●'.repeat(Math.min(entry.dots, 5))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
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
          )
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

      </section>
      ) : null}
    </div>
  );
}
