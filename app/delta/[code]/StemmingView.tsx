'use client';

import { FormEvent, useMemo, useState } from 'react';

type SessionView = {
  id: string;
  title: string;
  votingType: 'scale' | 'dots';
  dotBudget: number;
  allowMultipleDots: boolean;
};

type SessionItem = {
  id: string;
  text: string;
};

type StemmingViewProps = {
  session: SessionView;
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
  const [participantId] = useState(() => crypto.randomUUID());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isDotVoting = session.votingType === 'dots' && session.dotBudget > 0;
  const allItemsVoted = useMemo(() => items.every((item) => typeof votes[item.id] === 'number'), [items, votes]);
  const dotsUsed = useMemo(
    () => items.reduce((sum, item) => sum + (votes[item.id] ?? 0), 0),
    [items, votes],
  );
  const dotsRemaining = Math.max(0, session.dotBudget - dotsUsed);
  const canSubmit = isDotVoting ? dotsUsed === session.dotBudget : allItemsVoted;

  function getDotLabel(value: number) {
    if (value === 0) {
      return '○';
    }

    if (value <= 5) {
      return '●'.repeat(value);
    }

    return `●●●●● +${value - 5}`;
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nickname.trim()) {
      return;
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
          responses: items.map((item) => ({
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

      setSubmitted(true);
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!hasJoined) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{session.title}</h1>
          </div>

          <form className="space-y-6" onSubmit={handleJoin}>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-100" htmlFor="nickname">
                Skriv inn kallenavnet ditt
              </label>
              <input
                required
                id="nickname"
                name="nickname"
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-50 outline-none transition focus:border-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={!nickname.trim()}
              className="w-full rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
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
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Takk for dine svar, {nickname.trim()}!</h1>
          <p className="mt-2 text-sm text-slate-300">Vent på at fasilitator fortsetter sesjonen.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{session.title}</h1>
          <p className="mt-2 text-sm text-slate-300">Hei, {nickname.trim()}</p>
          {isDotVoting ? (
            <>
              <p className="mt-3 text-sm text-slate-200">
                Fordel {session.dotBudget} prikker på kriteriene under.
              </p>
              <p className="text-sm text-slate-400">
                {session.allowMultipleDots
                  ? 'Du kan gi flere prikker til samme kriterium.'
                  : 'Du kan maksimalt gi én prikk per kriterium.'}
              </p>
              <p className="mt-2 text-sm text-slate-100">
                Brukt: {dotsUsed}/{session.dotBudget} · Gjenstår: {dotsRemaining}
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-slate-200">Gi hvert kriterium en score fra 1 til 5</p>
              <p className="text-sm text-slate-400">1 = lite viktig, 5 = svært viktig</p>
            </>
          )}
        </div>

        <div className="space-y-4">
          {items.map((item) => {
            const currentDots = votes[item.id] ?? 0;
            const remainingBudgetForItem = session.dotBudget - dotsUsed + currentDots;
            const maxReachableByBudget = Math.min(session.dotBudget, currentDots + remainingBudgetForItem);
            const maxDotsForItem = session.allowMultipleDots ? maxReachableByBudget : Math.min(1, maxReachableByBudget);
            const dotOptions = Array.from({ length: Math.max(0, maxDotsForItem) + 1 }, (_, index) => index);

            return (
              <section key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <p className="text-base text-slate-100">{item.text}</p>
                {isDotVoting ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {dotOptions.map((value) => {
                      const selected = currentDots === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setVotes((current) => {
                              const currentValue = current[item.id] ?? 0;
                              const totalWithoutCurrent = items.reduce(
                                (sum, currentItem) =>
                                  sum + (currentItem.id === item.id ? 0 : (current[currentItem.id] ?? 0)),
                                0,
                              );
                              const boundedValue = session.allowMultipleDots ? value : Math.min(1, value);

                              if (totalWithoutCurrent + boundedValue > session.dotBudget) {
                                return current;
                              }

                              if (currentValue === boundedValue) {
                                return current;
                              }

                              return {
                                ...current,
                                [item.id]: boundedValue,
                              };
                            });
                          }}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium transition ${
                            selected
                              ? 'border-indigo-500 bg-gradient-to-br from-indigo-500 to-violet-500 text-white'
                              : 'border-white/30 text-white/60 hover:border-white/50 hover:text-white/90'
                          }`}
                          aria-label={`${value} prikker`}
                        >
                          <span className="leading-none">{getDotLabel(value)}</span>
                        </button>
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
                              ? 'border-white bg-white text-black'
                              : 'border-white/30 text-white/70 hover:border-white/50 hover:text-white'
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

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        <button
          type="button"
          onClick={handleSubmitVotes}
          disabled={!canSubmit || isSubmitting}
          className="mt-8 w-full rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          Send inn stemmer
        </button>
      </div>
    </main>
  );
}
