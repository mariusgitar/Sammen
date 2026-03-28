'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

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
  const [participantId, setParticipantId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showProposalInput, setShowProposalInput] = useState(false);
  const [proposalText, setProposalText] = useState('');
  const [proposalSubmitting, setProposalSubmitting] = useState(false);
  const [proposedItems, setProposedItems] = useState<ProposedItem[]>([]);
  const participantStorageKey = 'samen_participant_id';
  const nicknameStorageKey = `samen_nickname_${session.code}`;

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
    if (!submitted) {
      return;
    }

    const checkSession = async () => {
      const response = await fetch(`/api/sessions/${session.code}`, { cache: 'no-store' });
      const data = (await response.json()) as {
        session?: {
          status?: string;
          phase?: string;
        };
      };

      if (data.session?.status === 'active' && data.session?.phase === 'stemming') {
        window.location.reload();
      }
    };

    const interval = setInterval(() => {
      void checkSession();
    }, 5_000);

    return () => clearInterval(interval);
  }, [submitted, session.code]);

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

    localStorage.setItem(nicknameStorageKey, nickname.trim());
    localStorage.setItem(participantStorageKey, participantId);
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
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#0f172a]">{session.title}</h1>
          </div>

          <form className="space-y-6" onSubmit={handleJoin}>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#64748b]" htmlFor="nickname">
                Skriv inn kallenavnet ditt
              </label>
              <input
                required
                id="nickname"
                name="nickname"
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full rounded-xl border border-[#e2e8f0] bg-white p-3 text-[#0f172a] outline-none transition focus:border-[#3b5bdb]"
              />
            </div>

            <button
              type="submit"
              disabled={!nickname.trim()}
              className="w-full rounded-full bg-[#0f172a] px-4 py-3 font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-70"
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
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 sm:px-6">
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
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#0f172a]">{session.title}</h1>
          <p className="mt-2 text-sm text-[#64748b]">Hei, {nickname.trim()}</p>
          <p className="mt-2 text-sm text-[#64748b]">
            Tagg elementene du vil kategorisere. Du kan sende inn uten å tagge alle.
          </p>
        </div>

        <div className="space-y-4">
          {originalItems.map((item) => (
            <section key={item.id} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
              <p className="text-base font-medium text-[#0f172a]">{item.text}</p>
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
                          ? 'border-[#0f172a] bg-[#0f172a] text-white'
                          : 'border-[#e2e8f0] bg-white text-[#0f172a] hover:border-[#cbd5e1]'
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
            <section key={item.id} className="rounded-2xl border border-[#c7d2fe] bg-[#eef2ff] p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[#93c5fd] bg-[#e0f2fe] px-2 py-0.5 text-xs text-[#0369a1]">
                  Ny
                </span>
                <p className="text-base font-medium text-[#0f172a]">{item.text}</p>
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
                          ? 'border-[#0f172a] bg-[#0f172a] text-white'
                          : 'border-[#e2e8f0] bg-white text-[#0f172a] hover:border-[#cbd5e1]'
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
                className="text-sm text-[#64748b] transition hover:text-[#0f172a]"
              >
                + Foreslå nytt element
              </button>
            ) : (
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <label htmlFor="proposal" className="text-sm text-[#64748b]">
                  Skriv nytt forslag
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="proposal"
                    type="text"
                    value={proposalText}
                    onChange={(event) => setProposalText(event.target.value)}
                    placeholder="F.eks. Mer involvering i oppstartsmøter"
                    className="w-full rounded-xl border border-[#e2e8f0] bg-white p-2 text-sm text-[#0f172a] outline-none transition focus:border-[#3b5bdb]"
                  />
                  <button
                    type="button"
                    onClick={handleProposeItem}
                    disabled={!proposalText.trim() || proposalSubmitting}
                    className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-70"
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
            className="w-full rounded-full bg-[#0f172a] px-4 py-3 font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Sender inn...' : 'Send inn svar'}
          </button>

          {error ? <p className="text-sm text-amber-500">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
