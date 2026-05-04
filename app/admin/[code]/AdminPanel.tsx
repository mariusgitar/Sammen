'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import ToggleButton from '@/app/components/ui/ToggleButton';
import { type NormalizedSession } from '@/app/lib/normalizeSession';
import { resolveAdminView } from '@/app/lib/resolveAdminView';

import { InnspillAdmin } from './InnspillAdmin';
import { ThemePanel } from './ThemePanel';

type SessionView = {
  id: string;
  title: string;
  code: string;
  mode: string;
  votingType: 'scale' | 'dots';
  dotBudget: number;
  phase: 'kartlegging' | 'stemming' | 'innspill' | 'rangering';
  status: 'setup' | 'active' | 'paused' | 'closed';
  resultsVisible: boolean;
  allowNewItems: boolean;
  showTagHeaders: boolean | null;
  showOthersInnspill: boolean;
  innspillMaxChars: number;
  anonymousInnspill?: boolean;
  tags: string[];
  timerEndsAt: string | Date | null;
  timerLabel: string | null;
  activeFilter?: KartleggingFilter | null;
};

type SessionItem = {
  id: string;
  text: string;
  description?: string | null;
  isNew: boolean;
  excluded: boolean;
  createdBy: string;
  isQuestion?: boolean;
  questionStatus?: 'inactive' | 'active' | 'locked';
  finalTag?: string | null;
};

type KartleggingSummaryItem = {
  id: string;
  text: string;
  description: string | null;
  is_new: boolean;
  created_by: string;
  excluded: boolean;
  defaultTag: string | null;
  finalTag: string | null;
  changedCount: number;
  tagCounts: Record<string, number>;
  untaggedCount: number;
  uncertainCount: number;
};

type StemmingSummaryItem = {
  id: string;
  text: string;
  description: string | null;
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
  description: string | null;
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
  participants?: Array<{
    nickname: string;
    participantId: string;
    joinedAt: string;
  }>;
  submittedParticipantIds?: string[];
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

type PatchSessionResponse = {
  session: NormalizedSession;
  writeConsistency?: {
    requestedStatus: string | null;
    statusAfterWrite: SessionView['status'];
    statusAfterVerifyRead: SessionView['status'];
  };
};

type KartleggingFilter = 'alle' | 'uenighet' | 'usikker' | 'konsensus';

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

function isPatchSessionResponse(data: unknown): data is PatchSessionResponse {
  if (!data || typeof data !== 'object' || !('session' in data)) {
    return false;
  }

  const session = (data as { session?: unknown }).session;
  if (!session || typeof session !== 'object') {
    return false;
  }

  return typeof (session as { status?: unknown }).status === 'string';
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
    participants: [],
    submittedParticipantIds: [],
    items: items.map((item) => ({
      id: item.id,
      text: item.text,
      description: item.description ?? null,
      is_new: item.isNew,
      created_by: item.createdBy,
      excluded: item.excluded,
      defaultTag: null,
      finalTag: item.finalTag ?? null,
      changedCount: 0,
      tagCounts: {},
      untaggedCount: 0,
      uncertainCount: 0,
    })),
    themes: [],
  });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isOpeningVoting, setIsOpeningVoting] = useState(false);
  const [includeMap, setIncludeMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, true])),
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
  const [savingFinalTagByItem, setSavingFinalTagByItem] = useState<Record<string, boolean>>({});
  const [savingIncludeByItem, setSavingIncludeByItem] = useState<Record<string, boolean>>({});
  const [timerMinutes, setTimerMinutes] = useState(3);
  const [timerLabelInput, setTimerLabelInput] = useState(session.timerLabel ?? '');
  const [timerNow, setTimerNow] = useState(Date.now());
  const [settingsTitle, setSettingsTitle] = useState(session.title);
  const [settingsAllowNewItems, setSettingsAllowNewItems] = useState(session.allowNewItems);
  const [settingsShowOthersInnspill, setSettingsShowOthersInnspill] = useState(session.showOthersInnspill);
  const [settingsInnspillMaxChars, setSettingsInnspillMaxChars] = useState(session.innspillMaxChars);
  const [settingsDotBudget, setSettingsDotBudget] = useState(session.dotBudget);
  const [settingsShowTagHeaders, setSettingsShowTagHeaders] = useState(Boolean(session.showTagHeaders));
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [activeKartleggingFilter, setActiveKartleggingFilter] = useState<KartleggingFilter>(session.activeFilter ?? 'alle');
  const [activeTagFilter, setActiveTagFilter] = useState<string>('alle');

  function applySessionFromApi(nextSession: NormalizedSession) {
    const nextResultsVisible = nextSession.visibility.participant.showResults;

    setSessionStatus(nextSession.status);
    setResultsVisible(nextResultsVisible);
    setCurrentSession((current) => ({
      ...current,
      status: nextSession.status,
      resultsVisible: nextResultsVisible,
      timerEndsAt: nextSession.timerEndsAt,
      timerLabel: nextSession.timerLabel,
    }));
    setTimerLabelInput(nextSession.timerLabel ?? '');
  }

  async function verifySessionStatus(expectedStatus: SessionView['status']) {
    const verifyResponse = await fetch(`/api/sessions/${currentSession.code}`, { cache: 'no-store' });
    const verifyData = (await verifyResponse.json()) as { session?: NormalizedSession; error?: string };

    if (!verifyResponse.ok || !verifyData.session) {
      throw new Error('Kunne ikke verifisere sesjonsstatus etter oppdatering.');
    }

    applySessionFromApi(verifyData.session);

    if (verifyData.session.status !== expectedStatus) {
      throw new Error(
        `Sesjonen ble ikke persistert som ${expectedStatus}. Lest verdi er ${verifyData.session.status}.`,
      );
    }
  }

  const saveFilter = async (filter: KartleggingFilter) => {
    setActiveKartleggingFilter(filter);
    await fetch(`/api/sessions/${session.code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_filter: filter }),
    });
  };

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
            next[item.id] = true;
          }
        }

        return next;
      });
    } catch {
      setSummaryError('Feil ved henting av data');
    }
  }

  async function fetchInnspillSummary() {
    if (!isInnspillModule) {
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

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerNow(Date.now());
    }, 1_000);

    return () => clearInterval(interval);
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

      const data = (await response.json()) as PatchSessionResponse | { error: string };

      if (!response.ok || !isPatchSessionResponse(data)) {
        setError('Kunne ikke oppdatere sesjonen. Prøv igjen.');
        return;
      }

      applySessionFromApi(data.session);
      await verifySessionStatus(status);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Kunne ikke oppdatere sesjonen. Prøv igjen.',
      );
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

      const data = (await response.json()) as PatchSessionResponse | { error: string };

      if (!response.ok || !isPatchSessionResponse(data)) {
        setError('Kunne ikke oppdatere resultatvisning. Prøv igjen.');
        return;
      }

      applySessionFromApi(data.session);
    } catch {
      setError('Kunne ikke oppdatere resultatvisning. Prøv igjen.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function patchTimer(payload: { timer_ends_at: string | null; timer_label: string | null }) {
    setIsUpdatingStatus(true);
    setError('');

    try {
      const response = await fetch(`/api/sessions/${currentSession.code}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as PatchSessionResponse | { error: string };

      if (!response.ok || !isPatchSessionResponse(data)) {
        setError('Kunne ikke oppdatere timeren. Prøv igjen.');
        return;
      }

      applySessionFromApi(data.session);
    } catch {
      setError('Kunne ikke oppdatere timeren. Prøv igjen.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function saveSettings() {
    setError('');
    setIsSavingSettings(true);

    const payload: Record<string, string | number | boolean> = {};
    const trimmedTitle = settingsTitle.trim();

    if (trimmedTitle && trimmedTitle !== currentSession.title) {
      payload.title = trimmedTitle;
    }

    if (currentModuleType === 'kartlegging' && settingsAllowNewItems !== currentSession.allowNewItems) {
      payload.allow_new_items = settingsAllowNewItems;
    }

    if (currentModuleType === 'kartlegging' && settingsShowTagHeaders !== Boolean(currentSession.showTagHeaders)) {
      payload.show_tag_headers = settingsShowTagHeaders;
    }

    if (isInnspillModule && settingsShowOthersInnspill !== currentSession.showOthersInnspill) {
      payload.show_others_innspill = settingsShowOthersInnspill;
    }

    if (isInnspillModule && settingsInnspillMaxChars !== currentSession.innspillMaxChars) {
      payload.innspill_max_chars = settingsInnspillMaxChars;
    }

    if (summary.votingType === 'dots' && settingsDotBudget !== currentSession.dotBudget) {
      payload.dot_budget = settingsDotBudget;
    }

    if (Object.keys(payload).length === 0) {
      setIsSavingSettings(false);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${currentSession.code}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as PatchSessionResponse | { error: string };

      if (!response.ok || !isPatchSessionResponse(data)) {
        setError('Kunne ikke lagre innstillinger. Prøv igjen.');
        return;
      }

      applySessionFromApi(data.session);
      setCurrentSession((current) => ({
        ...current,
        title: data.session.title,
        dotBudget: data.session.dotBudget,
        allowNewItems: data.session.allowNewItems,
        showTagHeaders: data.session.showTagHeaders,
        showOthersInnspill: data.session.showOthersInnspill,
        innspillMaxChars: data.session.innspillMaxChars,
      }));
      setSettingsTitle(data.session.title);
      setSettingsAllowNewItems(data.session.allowNewItems);
      setSettingsShowTagHeaders(Boolean(data.session.showTagHeaders));
      setSettingsShowOthersInnspill(data.session.showOthersInnspill);
      setSettingsInnspillMaxChars(data.session.innspillMaxChars);
      setSettingsDotBudget(data.session.dotBudget);
      setSettingsSaved(true);
      setTimeout(() => {
        setSettingsSaved(false);
      }, 2_000);
    } catch {
      setError('Kunne ikke lagre innstillinger. Prøv igjen.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  function handleStartTimer() {
    const timerEndsAt = new Date(Date.now() + timerMinutes * 60_000).toISOString();
    void patchTimer({
      timer_ends_at: timerEndsAt,
      timer_label: timerLabelInput.trim() || null,
    });
  }

  function handleStopTimer() {
    void patchTimer({
      timer_ends_at: null,
      timer_label: null,
    });
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

  async function updateFinalTag(itemId: string, nextFinalTag: string | null) {
    setError('');

    const previousFinalTag =
      summary.items.find((item): item is KartleggingSummaryItem => 'tagCounts' in item && item.id === itemId)?.finalTag ?? null;

    setSavingFinalTagByItem((current) => ({ ...current, [itemId]: true }));

    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ final_tag: nextFinalTag }),
      });
      const data = (await response.json()) as
        | { item: { id: string; finalTag?: string | null; final_tag?: string | null } }
        | { error: string };

      if (!response.ok || !('item' in data)) {
        throw new Error('error' in data ? data.error : 'Kunne ikke lagre endelig tag.');
      }

      const persistedFinalTag = data.item.finalTag ?? data.item.final_tag ?? null;
      setSummary((current) => ({
        ...current,
        items: current.items.map((item) =>
          'tagCounts' in item && item.id === itemId
            ? {
                ...item,
                finalTag: persistedFinalTag,
              }
            : item,
        ),
      }));
    } catch (updateError) {
      setSummary((current) => ({
        ...current,
        items: current.items.map((item) =>
          'tagCounts' in item && item.id === itemId
            ? {
                ...item,
                finalTag: previousFinalTag,
              }
            : item,
        ),
      }));
      setError(updateError instanceof Error ? updateError.message : 'Kunne ikke lagre endelig tag.');
    } finally {
      setSavingFinalTagByItem((current) => ({ ...current, [itemId]: false }));
    }
  }

  function getConsensusTag(item: KartleggingSummaryItem) {
    const sortedTags = Object.entries(item.tagCounts).sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }

      const aSessionIndex = currentSession.tags.findIndex((tag) => tag === a[0]);
      const bSessionIndex = currentSession.tags.findIndex((tag) => tag === b[0]);

      if (aSessionIndex !== -1 && bSessionIndex !== -1) {
        return aSessionIndex - bSessionIndex;
      }

      return a[0].localeCompare(b[0]);
    });

    return sortedTags[0]?.[0] ?? null;
  }

  function getTopTag(item: KartleggingSummaryItem) {
    const entries = Object.entries(item.tagCounts ?? {})
      .filter(([tag]) => tag !== 'uklart_flag')
      .map(([tag, count]) => ({ tag, count: count as number }));

    if (entries.length === 0) return null;
    return entries.sort((a, b) => b.count - a.count)[0].tag;
  }

  function getTopTagShare(item: KartleggingSummaryItem) {
    const tagEntries = Object.entries(item.tagCounts ?? {})
      .filter(([tag]) => tag !== 'uklart_flag')
      .map(([tag, count]) => ({ tag, count: count as number }));

    if (tagEntries.length === 0) return 0;

    const total = tagEntries.reduce((sum, entry) => sum + entry.count, 0);
    if (total === 0) return 0;

    const maxCount = Math.max(...tagEntries.map((entry) => entry.count));
    return maxCount / total;
  }

  function getEffectiveFinalTag(item: KartleggingSummaryItem) {
    return item.finalTag ?? getTopTag(item) ?? getConsensusTag(item);
  }

  async function updateIncluded(itemId: string, include: boolean) {
    setError('');
    const previousValue = includeMap[itemId] ?? true;

    setIncludeMap((current) => ({ ...current, [itemId]: include }));
    setSavingIncludeByItem((current) => ({ ...current, [itemId]: true }));

    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ excluded: !include }),
      });

      const data = (await response.json()) as { item: { id: string; excluded: boolean } } | { error: string };

      if (!response.ok || !('item' in data)) {
        throw new Error('error' in data ? data.error : 'Kunne ikke oppdatere element.');
      }

      setIncludeMap((current) => ({
        ...current,
        [itemId]: !data.item.excluded,
      }));
    } catch (updateError) {
      setIncludeMap((current) => ({ ...current, [itemId]: previousValue }));
      setError(updateError instanceof Error ? updateError.message : 'Kunne ikke oppdatere element.');
    } finally {
      setSavingIncludeByItem((current) => ({ ...current, [itemId]: false }));
    }
  }

  async function setIncludedForTag(itemsInGroup: KartleggingSummaryItem[], tag: string, include: boolean) {
    const matchingItems = itemsInGroup.filter((item) => getEffectiveFinalTag(item) === tag);

    await Promise.all(matchingItems.map(async (item) => updateIncluded(item.id, include)));
  }

  async function startStemming(votingType: 'scale' | 'dots', payloadItems?: Array<{ text: string; created_by: string }>) {
    setIsOpeningVoting(true);
    setError('');

    try {
      if (currentPhase === 'kartlegging') {
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
  const tagOptions = useMemo(
    () => [
      'alle',
      ...Array.from(
        new Set(
          finalListItems
            .map((item) => item.finalTag ?? getTopTag(item))
            .filter((tag): tag is string => Boolean(tag)),
        ),
      ),
    ],
    [finalListItems],
  );
  const filteredFinalListItems = useMemo(
    () =>
      finalListItems.filter((item) => {
        const passesConsensus = (() => {
          if (activeKartleggingFilter === 'alle') return true;
          if (activeKartleggingFilter === 'usikker') return (item.uncertainCount ?? 0) > 0;
          const share = getTopTagShare(item);
          if (activeKartleggingFilter === 'uenighet') return share < 0.67;
          if (activeKartleggingFilter === 'konsensus') return share >= 0.67;
          return true;
        })();

        const passesTag = (() => {
          if (activeTagFilter === 'alle') return true;
          const effectiveTag = item.finalTag ?? getTopTag(item);
          return effectiveTag === activeTagFilter;
        })();

        return passesConsensus && passesTag;
      }),
    [activeKartleggingFilter, activeTagFilter, finalListItems],
  );

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
  const participantStatus = useMemo(() => {
    const submittedIds = new Set(summary.submittedParticipantIds ?? []);
    const submitted = (summary.participants ?? []).filter((participant) => submittedIds.has(participant.participantId));
    const pending = (summary.participants ?? []).filter((participant) => !submittedIds.has(participant.participantId));

    return { submitted, pending };
  }, [summary.participants, summary.submittedParticipantIds]);
  const maxThemeDots = useMemo(
    () => Math.max(...themedDotResults.map((theme) => theme.totalDots), 1),
    [themedDotResults],
  );

  const participantUrl = typeof window !== 'undefined' ? `${window.location.origin}/delta/${currentSession.code}` : `/delta/${currentSession.code}`;

  const currentModuleType = currentSession.mode as NormalizedSession['moduleType'];
  const currentPhase = sessionPhase;
  const currentStatus = sessionStatus;
  const isInnspillModule = currentModuleType === 'aapne-innspill';

  const selectedInnspillEntries = useMemo(
    () =>
      innspillQuestions.flatMap((question) =>
        question.innspill
          .filter((entry) => selectedInnspill[entry.id])
          .map((entry) => ({ text: entry.text, created_by: entry.nickname })),
      ),
    [innspillQuestions, selectedInnspill],
  );

  const flowSteps =
    isInnspillModule
      ? ['Samle inn', 'Velg innspill', 'Stem']
      : ['Samle inn', 'Kuratér liste', 'Stem'];
  const timerPresets = [2, 3, 5, 10];
  const remainingTimerMs = currentSession.timerEndsAt ? new Date(currentSession.timerEndsAt).getTime() - timerNow : 0;
  const isTimerRunning = remainingTimerMs > 0;
  const remainingSeconds = Math.max(0, Math.ceil(remainingTimerMs / 1000));
  const timerMinutesDisplay = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const timerSecondsDisplay = String(remainingSeconds % 60).padStart(2, '0');

  const currentFlowStep = useMemo(() => {
    if (currentStatus === 'closed') {
      return 3;
    }

    if (currentPhase === 'stemming' && currentStatus === 'active') {
      return 3;
    }

    if (currentStatus === 'paused' && currentPhase !== 'stemming') {
      return 2;
    }

    return 1;
  }, [sessionPhase, sessionStatus]);

  const normalizedSessionForAdminView = useMemo(
    () =>
      ({
        id: currentSession.id,
        code: currentSession.code,
        title: currentSession.title,
        moduleType: currentSession.mode as NormalizedSession['moduleType'],
        status: sessionStatus,
        tags: currentSession.tags,
        allowNewItems: currentSession.allowNewItems,
        dotBudget: currentSession.dotBudget,
        votingType: currentSession.votingType,
        allowMultipleDots,
        maxRankItems: 0,
        showOthersInnspill: currentSession.showOthersInnspill,
        showTagHeaders: Boolean(currentSession.showTagHeaders),
        innspillMode: 'enkel',
        innspillMaxChars: currentSession.innspillMaxChars,
        anonymousInnspill: Boolean(currentSession.anonymousInnspill),
        includesStemming: false,
        votingTarget: null,
        activeFilter: activeKartleggingFilter,
        createdAt: '',
        timerEndsAt: currentSession.timerEndsAt
          ? String(currentSession.timerEndsAt)
          : null,
        timerLabel: currentSession.timerLabel,
        resultsVisible,
        visibility: {
          facilitator: {
            showRawResponses: false,
            showDistribution: false,
            showParticipantIds: false,
          },
          participant: {
            showOwnResponses: false,
            showAggregated: currentSession.showOthersInnspill,
            showResults: resultsVisible,
          },
          presentation: {
            showResults: resultsVisible,
            pinnedItemIds: [],
          },
        },
        phase: sessionPhase,
      }) as NormalizedSession,
    [activeKartleggingFilter, allowMultipleDots, currentSession, resultsVisible, sessionPhase, sessionStatus],
  );
  const adminView = useMemo(
    () => resolveAdminView(normalizedSessionForAdminView),
    [normalizedSessionForAdminView],
  );

  return (
    <div className="space-y-6">
      {false && (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl shadow-slate-950/20">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Timer</p>
          <div className="flex flex-wrap items-center gap-2">
            {timerPresets.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setTimerMinutes(minutes)}
                className={`border border-slate-600 rounded-full px-3 py-1 text-xs ${timerMinutes === minutes ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-slate-100'}`}
              >
                {minutes} min
              </button>
            ))}
          </div>
          <input
            type="text"
            value={timerLabelInput}
            onChange={(event) => setTimerLabelInput(event.target.value)}
            placeholder="Hva jobber dere med nå?"
            className="h-8 min-w-[220px] rounded-full border border-slate-600 bg-slate-950 px-3 text-sm text-slate-200 placeholder:text-slate-500"
          />
          {isTimerRunning ? (
            <>
              <p className="text-sm font-mono text-white">
                {timerMinutesDisplay}:{timerSecondsDisplay}
              </p>
              <button
                type="button"
                onClick={handleStopTimer}
                disabled={isUpdatingStatus}
                className="text-sm font-medium text-red-400 transition hover:text-red-300 disabled:opacity-70"
              >
                Stopp
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStartTimer}
              disabled={isUpdatingStatus}
              className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200 disabled:opacity-70"
            >
              Start timer
            </button>
          )}
        </div>
      </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Sesjonsinfo</h2>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{currentSession.title}</h1>
        {adminView.state !== 'setup' ? (
          <Link
            href={`/admin/${currentSession.code}/results`}
            className="mt-2 inline-block text-sm text-white/40 transition-colors hover:text-white/60"
          >
            Se resultater →
          </Link>
        ) : null}
        <p className="mt-2 text-slate-300">Modus: {modeLabels[currentSession.mode] ?? currentSession.mode}</p>
        <p className="text-slate-300">Status: {statusLabels[currentStatus] ?? currentStatus}</p>
        <p className="text-slate-300">Fase: {phaseLabels[currentPhase] ?? currentPhase}</p>
        <Link
          href={`/vis/${currentSession.code}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm text-white/50 transition hover:text-white/70"
        >
          Åpne presentasjonsmodus →
        </Link>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => window.open(`/api/admin/${currentSession.code}/export`)}
            className="border border-slate-600 rounded-full px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-200"
          >
            Last ned rapport
          </button>
        </div>
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

      {adminView.sections.showFlowStepper ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Flyt</h2>
          <div className="mt-4 flex items-center">
            {flowSteps.map((stepLabel, index) => {
              const stepNumber = index + 1;
              const isClosed = adminView.state === 'closed';
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
          {(() => {
            switch (adminView.state) {
              case 'setup':
                return (
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
                );
              case 'collecting':
                return (
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
                );
              case 'paused-kartlegging':
              case 'stemming-setup':
                return (
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
                );
              case 'paused-innspill':
                return (
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
                );
              case 'stemming-active':
                return (
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
                );
              case 'rangering-active':
                return (
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
                );
              case 'closed':
                return (
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
                );
              case 'paused-generic':
                return (
                  <>
                    <p className="text-sm text-white/60">Innsamling er pauset.</p>
                    <button
                      type="button"
                      onClick={() => updateSessionStatus('active')}
                      disabled={isUpdatingStatus}
                      className={PRIMARY_BUTTON_CLASS}
                    >
                      Fortsett
                    </button>
                  </>
                );
              default: {
                const _exhaustive: never = adminView;
                return null;
              }
            }
          })()}

          {adminView.sections.showResultsToggleInMainControls ? (
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

      {adminView.sections.showKartleggingCuration ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Kuratér til stemming</h2>
          <p className="mt-2 text-sm text-slate-300">Grupper etter tag, velg endelig tag og om elementet tas med videre.</p>
          <div className="mt-4 space-y-6">
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => void saveFilter('alle')}
                className={
                  activeKartleggingFilter === 'alle'
                    ? 'rounded-full bg-violet-600 px-4 py-1.5 text-sm font-medium text-white'
                    : 'rounded-full border border-slate-600 px-4 py-1.5 text-sm text-slate-400'
                }
              >
                Alle
              </button>
              <button
                type="button"
                onClick={() => void saveFilter('uenighet')}
                className={
                  activeKartleggingFilter === 'uenighet'
                    ? 'rounded-full bg-violet-600 px-4 py-1.5 text-sm font-medium text-white'
                    : 'rounded-full border border-slate-600 px-4 py-1.5 text-sm text-slate-400'
                }
              >
                🔴 Uenighet
              </button>
              <button
                type="button"
                onClick={() => void saveFilter('usikker')}
                className={
                  activeKartleggingFilter === 'usikker'
                    ? 'rounded-full bg-violet-600 px-4 py-1.5 text-sm font-medium text-white'
                    : 'rounded-full border border-slate-600 px-4 py-1.5 text-sm text-slate-400'
                }
              >
                💬 Usikker
              </button>
              <button
                type="button"
                onClick={() => void saveFilter('konsensus')}
                className={
                  activeKartleggingFilter === 'konsensus'
                    ? 'rounded-full bg-violet-600 px-4 py-1.5 text-sm font-medium text-white'
                    : 'rounded-full border border-slate-600 px-4 py-1.5 text-sm text-slate-400'
                }
              >
                🟢 Konsensus
              </button>
            </div>
            <div className="mt-2 mb-4 flex flex-wrap gap-2">
              {tagOptions.map((tag) => (
                <button
                  key={`tag-filter-${tag}`}
                  type="button"
                  onClick={() => setActiveTagFilter(tag)}
                  className={
                    activeTagFilter === tag
                      ? 'rounded-full border border-cyan-600 bg-cyan-900 px-3 py-1 text-xs font-medium text-cyan-300'
                      : 'rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400'
                  }
                >
                  {tag === 'alle' ? 'Alle' : tag}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-700 my-4" />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void Promise.all(finalListItems.map(async (item) => updateIncluded(item.id, true)))}
                className="rounded border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
              >
                Velg alle
              </button>
              <button
                type="button"
                onClick={() => void Promise.all(finalListItems.map(async (item) => updateIncluded(item.id, false)))}
                className="rounded border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
              >
                Fjern alle
              </button>
              {currentSession.tags.map((tag) => (
                <div key={`global-${tag}`} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void setIncludedForTag(finalListItems, tag, true)}
                    className="rounded border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
                  >
                    Velg alle {tag}
                  </button>
                  <button
                    type="button"
                    onClick={() => void setIncludedForTag(finalListItems, tag, false)}
                    className="rounded border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800"
                  >
                    Fjern alle {tag}
                  </button>
                </div>
              ))}
            </div>

            {(() => {
              const TAG_COLORS = ['#818cf8', '#34d399', '#fb923c', '#f472b6', '#60a5fa', '#a78bfa', '#4ade80'];
              const tagColorMap: Record<string, string> = {};
              currentSession.tags.forEach((tag, i) => {
                tagColorMap[tag.toLowerCase()] = TAG_COLORS[i % TAG_COLORS.length];
              });

              const getStats = (item: KartleggingSummaryItem) => {
                const totalVotes = Object.values(item.tagCounts).reduce((sum, n) => sum + (n as number), 0);
                const ratio = totalVotes > 0 ? Math.max(...Object.values(item.tagCounts)) / totalVotes : 0;
                const consensusTag =
                  totalVotes > 0 ? Object.entries(item.tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null;
                const distributionEntries = Object.entries(item.tagCounts).sort((a, b) => b[1] - a[1]);
                return { totalVotes, ratio, consensusTag, distributionEntries };
              };

              const itemsWithStats = filteredFinalListItems.map((item) => ({
                item,
                stats: getStats(item),
              }));

              const groupedByTag = new Map<string, typeof itemsWithStats>();
              const unresolvedItems: typeof itemsWithStats = [];

              itemsWithStats.forEach((entry) => {
                const groupingTag =
                  entry.item.finalTag ?? (entry.stats.ratio >= 0.67 && entry.stats.totalVotes > 0 ? entry.stats.consensusTag : null);

                if (groupingTag) {
                  const existing = groupedByTag.get(groupingTag) ?? [];
                  groupedByTag.set(groupingTag, [...existing, entry]);
                  return;
                }

                unresolvedItems.push(entry);
              });

              const tagGroups = Array.from(groupedByTag.entries()).sort((a, b) => a[0].localeCompare(b[0]));

              return (
                <>
                  {itemsWithStats.length === 0 ? (
                    <p className="mt-8 text-center text-sm text-slate-500">Ingen elementer matcher dette filteret.</p>
                  ) : null}
                  {tagGroups.map(([tagName, groupItems], groupIndex) => (
                    <article
                      key={tagName}
                      className={`rounded-xl border border-slate-700 border-l-4 bg-slate-950/70 p-4 ${
                        groupIndex > 0 ? 'mt-8 border-t border-slate-700' : ''
                      }`}
                      style={{ borderLeftColor: tagColorMap[tagName.toLowerCase()] }}
                    >
                      <h3 className="text-lg font-bold text-white">{tagName}</h3>
                      <div className="mt-4 space-y-3">
                        {groupItems.map(({ item, stats }) => {
                          return (
                            <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3 transition-all duration-300">
                              <p className="text-sm font-semibold text-slate-100">{item.text}</p>
                              <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                {stats.totalVotes > 0
                                  ? stats.distributionEntries.map(([tag, count]) => {
                                    const widthPct = (count / stats.totalVotes) * 100;

                                    return (
                                      <div
                                        key={`${item.id}-segment-${tag}`}
                                        className="h-full"
                                        style={{
                                          width: `${widthPct}%`,
                                          backgroundColor: tagColorMap[tag.toLowerCase()] ?? '#64748b',
                                        }}
                                      />
                                    );
                                  })
                                  : null}
                              </div>
                              <p className="mt-1 text-xs text-slate-400">
                                {stats.distributionEntries.length > 0
                                  ? stats.distributionEntries.map(([tag, count], index) => (
                                      <span key={`${item.id}-distribution-${tag}`}>
                                        <span style={{ color: tagColorMap[tag.toLowerCase()] ?? '#94a3b8' }}>
                                          {tag}: {count}
                                        </span>
                                        {index < stats.distributionEntries.length - 1 ? (
                                          <span className="text-slate-500"> / </span>
                                        ) : null}
                                      </span>
                                    ))
                                  : 'Ingen tagger enda'}
                              </p>

                              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={item.finalTag ?? stats.consensusTag ?? ''}
                                    onChange={(event) =>
                                      void updateFinalTag(item.id, event.target.value === '' ? null : event.target.value)
                                    }
                                    disabled={Boolean(savingFinalTagByItem[item.id])}
                                    className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                                  >
                                    <option value="">Ingen tag</option>
                                    {currentSession.tags.map((tag) => (
                                      <option key={`${item.id}-final-tag-option-${tag}`} value={tag}>
                                        {tag}
                                      </option>
                                    ))}
                                  </select>
                                  {savingFinalTagByItem[item.id] ? <span className="text-xs text-slate-400">Lagrer tag…</span> : null}
                                </div>

                                <label className="flex items-center gap-2 text-sm text-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={includeMap[item.id] ?? !item.excluded}
                                    disabled={Boolean(savingIncludeByItem[item.id])}
                                    onChange={(event) => void updateIncluded(item.id, event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-500 bg-slate-900"
                                  />
                                  Ta med videre
                                  {savingIncludeByItem[item.id] ? <span className="text-xs text-slate-400">(Lagrer…)</span> : null}
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}

                  {itemsWithStats.length > 0 ? (
                    <article
                      className="mt-8 rounded-xl border border-amber-600/50 border-l-4 border-t border-slate-700 bg-amber-950/20 p-4"
                      style={{ borderLeftColor: '#f59e0b' }}
                    >
                      <h3 className="text-lg font-bold text-white">⚠️ Uavklart</h3>
                      <div className="mt-4 space-y-3">
                        {unresolvedItems.length === 0 ? <p className="text-sm text-slate-400">Ingen uavklarte elementer.</p> : null}
                        {unresolvedItems.map(({ item, stats }) => {
                          return (
                            <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3 transition-all duration-300">
                            <p className="text-sm font-semibold text-slate-100">{item.text}</p>
                            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                              {stats.totalVotes > 0
                                ? stats.distributionEntries.map(([tag, count]) => {
                                    const widthPct = (count / stats.totalVotes) * 100;

                                    return (
                                      <div
                                        key={`${item.id}-segment-${tag}`}
                                        className="h-full"
                                        style={{
                                          width: `${widthPct}%`,
                                          backgroundColor: tagColorMap[tag.toLowerCase()] ?? '#64748b',
                                        }}
                                      />
                                    );
                                  })
                                : null}
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              {stats.distributionEntries.length > 0
                                ? stats.distributionEntries.map(([tag, count], index) => (
                                    <span key={`${item.id}-unresolved-distribution-${tag}`}>
                                      <span style={{ color: tagColorMap[tag.toLowerCase()] ?? '#94a3b8' }}>
                                        {tag}: {count}
                                      </span>
                                      {index < stats.distributionEntries.length - 1 ? (
                                        <span className="text-slate-500"> / </span>
                                      ) : null}
                                    </span>
                                  ))
                                : 'Ingen tagger enda'}
                            </p>

                            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-2">
                                <select
                                  value={item.finalTag ?? ''}
                                  onChange={(event) =>
                                    void updateFinalTag(item.id, event.target.value === '' ? null : event.target.value)
                                  }
                                  disabled={Boolean(savingFinalTagByItem[item.id])}
                                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                                >
                                  <option value="">
                                    {stats.consensusTag ? `Ingen tag (forslag: ${stats.consensusTag})` : 'Ingen tag'}
                                  </option>
                                  {currentSession.tags.map((tag) => (
                                    <option key={`${item.id}-unresolved-final-tag-option-${tag}`} value={tag}>
                                      {tag}
                                    </option>
                                  ))}
                                </select>
                                {savingFinalTagByItem[item.id] ? <span className="text-xs text-slate-400">Lagrer tag…</span> : null}
                              </div>

                              <label className="flex items-center gap-2 text-sm text-slate-200">
                                <input
                                  type="checkbox"
                                  checked={includeMap[item.id] ?? !item.excluded}
                                  disabled={Boolean(savingIncludeByItem[item.id])}
                                  onChange={(event) => void updateIncluded(item.id, event.target.checked)}
                                  className="h-4 w-4 rounded border-slate-500 bg-slate-900"
                                />
                                Ta med videre
                                {savingIncludeByItem[item.id] ? <span className="text-xs text-slate-400">(Lagrer…)</span> : null}
                              </label>
                            </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ) : null}
                </>
              );
            })()}
          </div>
        </section>
      ) : null}

      {adminView.sections.showInnspillCuration ? (
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

      {adminView.sections.showInnspillThemePanel ? (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Tematisering</p>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <ThemePanel code={currentSession.code} session={currentSession} />
        </section>
      ) : null}

      {adminView.sections.showInnspillStemmingSetup ? (
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

      {adminView.sections.showParticipantsPanel ? (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Deltakere</h2>
        <div className="mt-3 grid gap-3 text-sm text-slate-200 md:grid-cols-2">
          <div>
            <p className="font-medium text-emerald-300">✅ Levert</p>
            <p className="mt-1 break-words text-slate-300">
              {participantStatus.submitted.length > 0 ? participantStatus.submitted.map((participant) => participant.nickname).join(', ') : 'Ingen'}
            </p>
          </div>
          <div>
            <p className="font-medium text-amber-300">⏳ Ikke levert ennå</p>
            <p className="mt-1 break-words text-slate-300">
              {participantStatus.pending.length > 0 ? participantStatus.pending.map((participant) => participant.nickname).join(', ') : 'Ingen'}
            </p>
          </div>
        </div>
      </section>
      ) : null}

      {adminView.sections.showLiveOverviewPanel ? (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Live oversikt</h2>
        {summaryError ? <p className="mt-2 text-xs text-amber-300">{summaryError}</p> : null}
        <p className="mt-3 text-slate-100">Antall deltakere som har sendt inn: {summary.participantCount}</p>

        {currentModuleType === 'rangering' && (currentPhase === 'rangering' || currentPhase === 'stemming') ? (
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
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">{item.text}</p>
                      {item.excluded ? (
                        <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          ikke stemt på
                        </span>
                      ) : null}
                    </div>
                    {item.description?.trim() ? <p className="mt-0.5 text-xs text-slate-400">{item.description}</p> : null}
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
        ) : currentPhase === 'stemming' ? (
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
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-50">{item.text}</p>
                    {item.excluded ? (
                      <span className="rounded-full border border-slate-500/40 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                        ikke stemt på
                      </span>
                    ) : null}
                  </div>
                  {item.description?.trim() ? <p className="mt-1 text-xs text-slate-400">{item.description}</p> : null}
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
                      {item.defaultTag && item.changedCount > 0 ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200">
                          {item.changedCount} endret forslag
                        </span>
                      ) : null}
                      {item.defaultTag && item.changedCount === 0 && Object.keys(item.tagCounts).length > 0 ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-200">
                          Alle enige
                        </span>
                      ) : null}
                      {item.uncertainCount > 0 ? (
                        <span className="bg-amber-100 text-amber-700 text-xs rounded-full px-2 py-0.5">💬 {item.uncertainCount} usikker(e)</span>
                      ) : null}
                    </div>
                    {item.description?.trim() ? <p className="mt-1 text-xs text-slate-400">{item.description}</p> : null}
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

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Innstillinger</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="settings-title" className="text-sm text-slate-200">
              Tittel
            </label>
            <input
              id="settings-title"
              type="text"
              value={settingsTitle}
              onChange={(event) => setSettingsTitle(event.target.value)}
              className="w-56 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
            />
          </div>

          {currentModuleType === 'kartlegging' ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-200">Tillat nye forslag</span>
              <ToggleButton
                value={settingsAllowNewItems ? 'yes' : 'no'}
                onChange={(value) => setSettingsAllowNewItems(value === 'yes')}
                options={[
                  { value: 'yes', label: 'Ja' },
                  { value: 'no', label: 'Nei' },
                ]}
              />
            </div>
          ) : null}

          {isInnspillModule ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-200">Vis andres innspill</span>
              <ToggleButton
                value={settingsShowOthersInnspill ? 'yes' : 'no'}
                onChange={(value) => setSettingsShowOthersInnspill(value === 'yes')}
                options={[
                  { value: 'yes', label: 'Ja' },
                  { value: 'no', label: 'Nei' },
                ]}
              />
            </div>
          ) : null}

          {isInnspillModule ? (
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="settings-innspill-max-chars" className="text-sm text-slate-200">
                Maks tegn på innspill
              </label>
              <input
                id="settings-innspill-max-chars"
                type="number"
                min={50}
                max={500}
                value={settingsInnspillMaxChars}
                onChange={(event) =>
                  setSettingsInnspillMaxChars(
                    Math.min(500, Math.max(50, Number(event.target.value) || 50)),
                  )
                }
                className="w-24 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
              />
            </div>
          ) : null}

          {summary.votingType === 'dots' ? (
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="settings-dot-budget" className="text-sm text-slate-200">
                Dot budget
              </label>
              <input
                id="settings-dot-budget"
                type="number"
                min={1}
                max={20}
                value={settingsDotBudget}
                onChange={(event) => setSettingsDotBudget(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
                className="w-24 rounded border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
              />
            </div>
          ) : null}

          {currentModuleType === 'kartlegging' ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-200">Vis tag-overskrifter</span>
              <ToggleButton
                value={settingsShowTagHeaders ? 'yes' : 'no'}
                onChange={(value) => setSettingsShowTagHeaders(value === 'yes')}
                options={[
                  { value: 'yes', label: 'Ja' },
                  { value: 'no', label: 'Nei' },
                ]}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={isSavingSettings}
            className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white disabled:opacity-70"
          >
            Lagre endringer
          </button>
          {settingsSaved ? <p className="text-sm text-emerald-300">Lagret</p> : null}
        </div>
      </section>
    </div>
  );
}
