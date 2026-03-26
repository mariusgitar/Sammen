'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Question = {
  id: string;
  text: string;
  questionStatus: 'inactive' | 'active' | 'locked';
};

type SessionInfo = {
  id: string;
  code: string;
  title: string;
  show_others_innspill: boolean;
};

type Entry = { id: string; text: string; nickname: string; likes: number; participant_id: string };

type MyEntry = { id: string; text: string; likes: number; likedByMe: boolean };
type OtherEntry = { id: string; text: string; nickname: string; likes: number; likedByMe: boolean; participant_id: string };

const columnColors = [
  'border-t-[#3b5bdb]',
  'border-t-[#818cf8]',
  'border-t-[#0ea5e9]',
  'border-t-[#f59e0b]',
  'border-t-[#38bdf8]',
  'border-t-[#a78bfa]',
];

export function InnspillView({ session, items }: { session: SessionInfo; items: Question[] }) {
  const [nickname, setNickname] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [participantId, setParticipantId] = useState('');
  const [inputText, setInputText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [myInnspill, setMyInnspill] = useState<Record<string, MyEntry[]>>({});
  const [allInnspill, setAllInnspill] = useState<Record<string, OtherEntry[]>>({});
  const [showOthers, setShowOthers] = useState(false);
  const canSeeOthers = session.show_others_innspill;
  const initialized = useRef(false);
  const participantStorageKey = 'samen_participant_id';
  const nicknameStorageKey = `samen_nickname_${session.code}`;

  useEffect(() => {
    if (initialized.current) {
      return;
    }

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

    initialized.current = true;
  }, [nicknameStorageKey, participantStorageKey]);

  async function fetchInnspill() {
    const response = await fetch(`/api/delta/${session.code}/innspill`, { cache: 'no-store' });
    const data = (await response.json()) as { questions?: Array<{ id: string; text: string; question_status: string; innspill: Entry[] }> };

    if (!response.ok || !data.questions) {
      return;
    }
    if (data.questions.length === 0) {
      return;
    }

    const mine: Record<string, MyEntry[]> = {};
    const others: Record<string, OtherEntry[]> = {};

    for (const question of data.questions) {
      mine[question.id] = [];
      others[question.id] = [];

      for (const entry of question.innspill) {
        const likedByMe = false;
        if (entry.participant_id === participantId) {
          mine[question.id].push({ id: entry.id, text: entry.text, likes: entry.likes, likedByMe });
        } else {
          others[question.id].push({
            id: entry.id,
            text: entry.text,
            nickname: entry.nickname,
            likes: entry.likes,
            likedByMe,
            participant_id: entry.participant_id,
          });
        }
      }
    }

    setMyInnspill((prev) => {
      const merged = { ...prev };
      data.questions?.forEach((q) => {
        merged[q.id] = mine[q.id] ?? [];
      });
      return merged;
    });
    setAllInnspill((prev) => {
      const merged = { ...prev };
      data.questions?.forEach((q) => {
        if (others[q.id] && others[q.id].length > 0) {
          merged[q.id] = others[q.id];
        } else if (!merged[q.id]) {
          merged[q.id] = [];
        }
      });
      return merged;
    });
  }

  useEffect(() => {
    if (!hasJoined) {
      return;
    }

    void fetchInnspill();
    const timer = setInterval(() => {
      void fetchInnspill();
    }, 5_000);

    return () => clearInterval(timer);
  }, [hasJoined, participantId]);

  const visibleQuestions = useMemo(
    () =>
      items.filter(
        (item) =>
          item.questionStatus === 'active' ||
          (myInnspill[item.id] ?? []).length > 0 ||
          (canSeeOthers && (allInnspill[item.id] ?? []).length > 0),
      ),
    [allInnspill, canSeeOthers, items, myInnspill],
  );

  async function submit(questionId: string) {
    const text = (inputText[questionId] ?? '').trim();
    if (!text || !participantId || !nickname.trim()) {
      return;
    }

    setSubmitting((current) => ({ ...current, [questionId]: true }));

    try {
      const response = await fetch('/api/innspill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          questionId,
          participantId,
          nickname: nickname.trim(),
          text,
        }),
      });
      const responseBody = (await response.json()) as { innspill?: { id: string; text: string; likes: number } };

      if (!response.ok) {
        return;
      }

      if (responseBody.innspill) {
        setMyInnspill((prev) => {
          const current = prev ?? {};
          return {
            ...current,
            [questionId]: [
              ...(current[questionId] ?? []),
              {
                id: responseBody.innspill!.id,
                text: responseBody.innspill!.text,
                likes: 0,
                likedByMe: false,
              },
            ],
          };
        });
      }
      setInputText((current) => ({ ...current, [questionId]: '' }));
    } finally {
      setSubmitting((current) => ({ ...current, [questionId]: false }));
    }
  }

  async function deleteInnspill(id: string) {
    await fetch(`/api/innspill/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId }),
    });
    await fetchInnspill();
  }

  async function toggleLike(id: string) {
    await fetch(`/api/innspill/${id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId }),
    });
    await fetchInnspill();
  }

  if (!hasJoined) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 text-[#0f172a] sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">{session.title}</h1>
          <p className="mt-2 text-sm text-[#64748b]">Velg et visningsnavn for innspill.</p>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            className="mt-4 w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3"
            placeholder="Kallenavn"
          />
          <button
            type="button"
            disabled={!nickname.trim()}
            onClick={() => {
              localStorage.setItem(nicknameStorageKey, nickname.trim());
              localStorage.setItem(participantStorageKey, participantId);
              setHasJoined(true);
            }}
            className="mt-4 w-full rounded-full bg-[#0f172a] px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            Bli med
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 text-[#0f172a] sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <h1 className="text-2xl font-semibold">{session.title}</h1>

        {visibleQuestions.length === 0 ? <p className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm text-[#64748b]">Vent på at fasilitator åpner neste spørsmål...</p> : null}

        {visibleQuestions.length > 0 && canSeeOthers ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowOthers((current) => !current)}
              className="text-sm text-[#64748b] underline"
            >
              {showOthers ? 'Skjul andres innspill' : 'Vis andres innspill'}
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleQuestions.map((question, index) => {
            const mine = myInnspill[question.id] ?? [];
            const others = canSeeOthers ? (allInnspill[question.id] ?? []).filter((entry) => entry.participant_id !== participantId) : [];
            const innspillCount = mine.length + others.length;

            return (
              <section
                key={question.id}
                className={`flex min-h-[300px] w-full min-w-0 flex-col rounded-2xl border border-[#e2e8f0] border-t-2 bg-white shadow-sm ${columnColors[index % columnColors.length]}`}
              >
                <div className="sticky top-0 z-10 rounded-t-2xl border-b border-[#e2e8f0] bg-[#f8fafc] px-4 pb-3 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-[#0f172a]">{question.text}</h2>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#64748b] border border-[#e2e8f0]">{innspillCount}</span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  {mine.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] px-3 py-2 text-sm">
                      <p>{entry.text}</p>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-[#64748b]">
                        <span>Ditt innspill</span>
                        <button type="button" onClick={() => deleteInnspill(entry.id)} className="text-amber-500">
                          Slett
                        </button>
                      </div>
                    </div>
                  ))}

                  {canSeeOthers && showOthers
                    ? others.map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm">
                          <div>{entry.text}</div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs text-[#64748b]">{entry.nickname}</span>
                            <button type="button" onClick={() => toggleLike(entry.id)}>
                              {entry.likedByMe ? '♥' : '♡'} {entry.likes}
                            </button>
                          </div>
                        </div>
                      ))
                    : null}
                </div>

                <div className="border-t border-[#e2e8f0] p-3">
                  {question.questionStatus === 'active' ? (
                    <>
                      <textarea
                        className="w-full resize-none rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2 text-sm"
                        rows={2}
                        placeholder="Skriv ditt innspill..."
                        value={inputText[question.id] || ''}
                        onChange={(event) => setInputText((current) => ({ ...current, [question.id]: event.target.value }))}
                      />
                      <button
                        type="button"
                        className="mt-2 w-full rounded-full bg-[#0f172a] py-2 text-sm font-semibold text-white"
                        onClick={() => submit(question.id)}
                        disabled={submitting[question.id]}
                      >
                        {submitting[question.id] ? 'Lagrer...' : 'Legg til'}
                      </button>
                      {!canSeeOthers ? <p className="mt-2 text-xs text-[#64748b]">Du ser bare dine egne innspill under innsamlingen.</p> : null}
                    </>
                  ) : (
                    <p className="text-sm text-[#64748b]">Dette spørsmålet er lukket for nye innspill.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
