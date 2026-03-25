'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';

type SessionView = {
  id: string;
  code: string;
  title: string;
  tags: string[];
  allowNewItems: boolean;
};

type SessionItem = {
  id: string;
  text: string;
  isNew: boolean;
  orderIndex: number;
};

type ProposedItem = {
  id: string;
  text: string;
};

type KartleggingViewProps = {
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

type CreateItemResult =
  | {
      item: {
        id: string;
        text: string;
        is_new: boolean;
      };
    }
  | {
      error: string;
    };

export function KartleggingView({ session, items }: KartleggingViewProps) {
  const [nickname, setNickname] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [participantId] = useState(() => crypto.randomUUID());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showProposalInput, setShowProposalInput] = useState(false);
  const [proposalText, setProposalText] = useState('');
  const [proposalSubmitting, setProposalSubmitting] = useState(false);
  const [proposedItems, setProposedItems] = useState<ProposedItem[]>([]);

  const originalItems = useMemo(() => items.filter((item) => !item.isNew), [items]);
  const responseItems = useMemo(
    () => [...originalItems, ...proposedItems.map((item, index) => ({ ...item, orderIndex: index, isNew: true }))],
    [originalItems, proposedItems],
  );

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nickname.trim()) {
      return;
    }

    setHasJoined(true);
  }

  function handleSelectTag(itemId: string, value: string) {
    setResponses((current) => ({
      ...current,
      [itemId]: value,
    }));
  }

  async function handleProposeItem() {
    if (!proposalText.trim()) {
      return;
    }

    setProposalSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          text: proposalText.trim(),
          participantId,
          nickname: nickname.trim(),
        }),
      });

      const data = (await response.json()) as CreateItemResult;

      if (!response.ok || !('item' in data)) {
        setError('error' in data ? data.error : 'Kunne ikke sende inn forslag.');
        return;
      }

      setProposedItems((current) => [...current, { id: data.item.id, text: data.item.text }]);
      setResponses((current) => ({ ...current, [data.item.id]: '' }));
      setShowProposalInput(false);
      setProposalText('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Kunne ikke sende inn forslag.');
    } finally {
      setProposalSubmitting(false);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError('');

    try {
      const requestBody = {
        sessionId: session.id,
        participantId,
        nickname: nickname.trim(),
        responses: responseItems
          .map((item) => ({
            itemId: item.id,
            value: responses[item.id] ?? '',
          }))
          .filter((entry) => entry.value !== '' && entry.value !== null),
      };

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('POST /api/responses body', requestBody);
      }

      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
          <Link
            href={`/delta/${session.code}/resultater`}
            className="mt-5 inline-flex rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white"
          >
            Se resultater →
          </Link>
          <p className="mt-3 text-sm text-slate-300">Vent på at fasilitator åpner resultatene</p>
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
          <p className="mt-2 text-sm text-slate-300">
            Tagg elementene du vil kategorisere. Du kan sende inn uten å tagge alle.
          </p>
        </div>

        <div className="space-y-4">
          {originalItems.map((item) => (
            <section key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-base text-slate-100">{item.text}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {session.tags.map((tag) => {
                  const selected = responses[item.id] === tag;

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleSelectTag(item.id, tag)}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        selected
                          ? 'border-white bg-white text-black'
                          : 'border-white/30 text-white/70 hover:border-white/50 hover:text-white'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {proposedItems.map((item) => (
            <section key={item.id} className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-400/40 bg-emerald-400/20 px-2 py-0.5 text-xs text-emerald-200">
                  Ny
                </span>
                <p className="text-base text-slate-100">{item.text}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {session.tags.map((tag) => {
                  const selected = responses[item.id] === tag;

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleSelectTag(item.id, tag)}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        selected
                          ? 'border-white bg-white text-black'
                          : 'border-white/30 text-white/70 hover:border-white/50 hover:text-white'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {session.allowNewItems ? (
          <div className="mt-4 space-y-3">
            {!showProposalInput ? (
              <button
                type="button"
                onClick={() => setShowProposalInput(true)}
                className="text-sm text-slate-400 transition hover:text-slate-200"
              >
                + Foreslå nytt element
              </button>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <label htmlFor="proposal" className="text-sm text-slate-300">
                  Skriv nytt forslag
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="proposal"
                    type="text"
                    value={proposalText}
                    onChange={(event) => setProposalText(event.target.value)}
                    placeholder="F.eks. Mer involvering i oppstartsmøter"
                    className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-50 outline-none transition focus:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleProposeItem}
                    disabled={!proposalText.trim() || proposalSubmitting}
                    className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {proposalSubmitting ? 'Sender...' : 'Send forslag'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Sender inn...' : 'Send inn svar'}
          </button>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
