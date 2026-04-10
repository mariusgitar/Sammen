'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { NormalizedSession } from '@/app/lib/normalizeSession';

type SessionItem = {
  id: string;
  text: string;
  isQuestion?: boolean;
};

type StemmingViewProps = {
  session: NormalizedSession;
  items: SessionItem[];
};

type SubmitResponsesResult =
  | {
      ok: true;
    }
  | {
      error: string;
    };

const scoreOptions = [1, 2, 3, 4, 5] as const;

export function StemmingView({ session, items }: StemmingViewProps) {
  const [nickname, setNickname] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [participantId, setParticipantId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hoveredDot, setHoveredDot] = useState<{ itemId: string; value: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const votesHydratedRef = useRef(false);
  const participantStorageKey = 'samen_participant_id';
  const nicknameStorageKey = `samen_nickname_${session.code}`;
  const votesStorageKey = `samen_stemming_votes_${session.code}`;

  const votableItems = useMemo(() => items.filter((item) => !item.isQuestion), [items]);
  const isDotVoting = session.votingType === 'dots' && session.dotBudget > 0;
  const allItemsVoted = useMemo(
    () => votableItems.every((item) => typeof votes[item.id] === 'number'),
    [votableItems, votes],
  );
  const dotsUsed = useMemo(
    () => votableItems.reduce((sum, item) => sum + (votes[item.id] ?? 0), 0),
    [votableItems, votes],
  );
  const dotsRemaining = Math.max(0, session.dotBudget - dotsUsed);
  const canSubmit = isDotVoting ? dotsUsed === session.dotBudget : allItemsVoted;

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const storedVotes = localStorage.getItem(votesStorageKey);
    if (!storedVotes) {
      return;
    }

    try {
      const parsed = JSON.parse(storedVotes) as Record<string, number>;
      const validVotes = votableItems.reduce<Record<string, number>>((acc, item) => {
        const value = parsed[item.id];
        if (typeof value === 'number') {
          acc[item.id] = value;
        }
        return acc;
      }, {});
      setVotes(validVotes);
    } catch {
      // noop
    } finally {
      votesHydratedRef.current = true;
    }
  }, [votesStorageKey, votableItems]);

  useEffect(() => {
    if (!votesHydratedRef.current) {
      return;
    }

    localStorage.setItem(votesStorageKey, JSON.stringify(votes));
  }, [votes, votesStorageKey]);

  useEffect(() => {
    const storedId = localStorage.getItem(participantStorageKey);
    const storedNick = localStorage.getItem(nicknameStorageKey);

    if (storedId) {
      setParticipantId(storedId);
    } else {
      const newId = crypto.randomUUID();
      localStorage.setItem(participantStorageKey, newId);
      setParticipantId(newId);
    }

    if (storedNick) {
      setNickname(storedNick);
      setHasJoined(true);
    }
  }, [nicknameStorageKey]);

  useEffect(() => {
    return () => {
      if (toastTimeout.current) {
        clearTimeout(toastTimeout.current);
      }
    };
  }, []);

  // Phase transitions are detected by the parent page poll — no secondary poll needed here.

  function showToast(message: string) {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }

    setToastMessage(message);
    setIsToastVisible(true);

    toastTimeout.current = setTimeout(() => {
      setIsToastVisible(false);
      setTimeout(() => setToastMessage(null), 200);
    }, 2500);
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      return;
    }

    localStorage.setItem(nicknameStorageKey, trimmedNickname);
    localStorage.setItem(participantStorageKey, participantId);

    try {
      await fetch(`/api/delta/${session.code}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId,
          nickname: trimmedNickname,
        }),
      });
    } catch {
      // noop
    }

    setHasJoined(true);
  }

  async function handleSubmitVotes() {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          participantId,
          nickname: nickname.trim(),
          responses: votableItems.map((item) => ({
            itemId: item.id,
            value: String(votes[item.id] ?? 0),
          })),
        }),
      });

      const data = (await response.json()) as SubmitResponsesResult;

      if (!response.ok || !('ok' in data)) {
        setError('Noe gikk galt. Prøv igjen.');
        return;
      }

      localStorage.setItem(`samen_stemming_done_${session.code}`, 'true');
      setSubmitted(true);
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!hasJoined) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#0f172a]">{session.title}</h1>
          </div>

          <form className="space-y-6" onSubmit={handleJoin}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 mb-1.5 block" htmlFor="nickname">
                Skriv inn kallenavnet ditt
              </label>
              <input
                required
                id="nickname"
                name="nickname"
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#3b5bdb] transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={!nickname.trim()}
              className="w-full bg-[#0f172a] text-white rounded-full px-6 py-3 font-semibold hover:bg-[#1e293b] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            >
              Bli med
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-bold text-[#0f172a]">Takk for dine svar, {nickname.trim()}!</h2>
            <p className="text-slate-500">Vent på fasilitator for neste steg.</p>
            <a
              href={`/delta/${session.code}/resultater`}
              className="mt-4 inline-block rounded-full bg-[#0f172a] px-6 py-3 text-sm font-medium text-white"
            >
              Se resultater →
            </a>
            <p className="text-xs text-slate-400">Resultater vises når fasilitator åpner dem</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#0f172a]">{session.title}</h1>
          <p className="mt-2 text-sm text-[#64748b]">Hei, {nickname.trim()}</p>
          {isDotVoting ? (
            <>
              <p className="mt-3 text-sm text-[#64748b]">
                Fordel {session.dotBudget} prikker på kriteriene under.
              </p>
              <p className="text-sm text-[#64748b]">Trykk på prikkene for å fordele budsjettet ditt.</p>
              <p className="mt-2 text-sm text-[#0f172a]">
                Brukt: {dotsUsed}/{session.dotBudget} · Gjenstår: {dotsRemaining}
              </p>
              {session.dotBudget <= 10 ? (
                <div className="mt-2 flex items-center gap-1.5" aria-hidden>
                  {Array.from({ length: session.dotBudget }, (_, index) => {
                    const isFilled = index < dotsUsed;

                    return (
                      <span
                        key={index}
                        className={`h-5 w-5 rounded-full ${
                          isFilled
                            ? 'bg-[#3b5bdb]'
                            : 'border border-[#e2e8f0] bg-white'
                        }`}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#64748b]">Budsjett: {session.dotBudget} prikker</p>
              )}
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-[#64748b]">Gi hvert kriterium en score fra 1 til 5</p>
              <p className="text-sm text-[#64748b]">1 = lite viktig, 5 = svært viktig</p>
            </>
          )}
        </div>

        <div className="space-y-4">
          {votableItems.map((item) => {
            const currentDots = votes[item.id] ?? 0;
            const totalUsed = Object.values(votes).reduce((sum, value) => sum + value, 0);
            const remainingBudget = session.dotBudget - totalUsed;
            const visibleDots = session.allowMultipleDots
              ? Math.max(1, Math.min(session.dotBudget, currentDots + remainingBudget))
              : 1;
            const hoveredValue = hoveredDot?.itemId === item.id ? hoveredDot.value : 0;

            return (
              <section key={item.id} className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm">
                <p className="text-base font-medium text-[#0f172a]">{item.text}</p>
                {isDotVoting ? (
                  <div
                    className="mt-4 flex flex-wrap gap-1.5"
                    onMouseLeave={session.allowMultipleDots ? () => setHoveredDot(null) : undefined}
                  >
                    {Array.from({ length: visibleDots }, (_, index) => {
                      const isFilled = index < currentDots;
                      const isHovered = session.allowMultipleDots && index < hoveredValue;

                      return (
                        <button
                          key={index}
                          type="button"
                          onMouseEnter={
                            session.allowMultipleDots
                              ? () => setHoveredDot({ itemId: item.id, value: index + 1 })
                              : undefined
                          }
                          onClick={() => {
                            setVotes((current) => {
                              const currentValue = current[item.id] ?? 0;
                              const totalWithoutCurrent = votableItems.reduce(
                                (sum, currentItem) =>
                                  sum + (currentItem.id === item.id ? 0 : (current[currentItem.id] ?? 0)),
                                0,
                              );
                              const requestedValue = session.allowMultipleDots
                                ? index === currentValue - 1
                                  ? 0
                                  : index + 1
                                : currentValue === 1
                                  ? 0
                                  : 1;

                              if (totalWithoutCurrent + requestedValue > session.dotBudget) {
                                const totalCurrent = Object.values(current).reduce((sum, value) => sum + value, 0);
                                const currentRemainingBudget = session.dotBudget - totalCurrent;

                                if (currentRemainingBudget === 0 && requestedValue > currentValue) {
                                  showToast(
                                    'Du har brukt alle prikkene dine. Fjern en prikk fra et annet element for å stemme her.',
                                  );
                                }

                                return current;
                              }

                              if (currentValue === requestedValue) {
                                return current;
                              }

                              return {
                                ...current,
                                [item.id]: requestedValue,
                              };
                            });
                          }}
                          className={`h-5 w-5 rounded-full transition ${
                            session.allowMultipleDots && hoveredValue > 0
                              ? isHovered
                                ? 'bg-[#3b5bdb]/60'
                                : 'border border-[#e2e8f0] bg-white'
                              : isFilled
                                ? 'bg-[#3b5bdb]'
                                : 'border border-[#e2e8f0] bg-white'
                          }`}
                          aria-label={`Sett ${index + 1} prikker`}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {scoreOptions.map((score) => {
                      const selected = votes[item.id] === score;

                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => {
                            setVotes((current) => ({
                              ...current,
                              [item.id]: score,
                            }));
                          }}
                          className={`rounded-full border px-3 py-1 text-sm transition ${
                            selected
                              ? 'border-[#3b5bdb] bg-[#3b5bdb] text-white'
                              : 'border-[#e2e8f0] bg-white text-[#0f172a] hover:border-[#cbd5e1]'
                          }`}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {error ? <p className="mt-4 text-sm text-amber-500">{error}</p> : null}

        <button
          type="button"
          onClick={handleSubmitVotes}
          disabled={!canSubmit || isSubmitting}
          className="mt-8 w-full rounded-full bg-[#0f172a] px-4 py-3 font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-70"
        >
          Send inn stemmer
        </button>
      </div>

      {toastMessage ? (
        <div
          className={`fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl bg-[#0f172a] px-4 py-3 text-sm text-white shadow-md transition-all duration-200 ${
            isToastVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
          }`}
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      ) : null}
    </main>
  );
}
