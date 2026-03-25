'use client';

import { useEffect, useMemo, useState } from 'react';

type Question = {
  id: string;
  text: string;
  questionStatus: 'inactive' | 'active' | 'locked';
};

type SessionInfo = {
  id: string;
  code: string;
  title: string;
};

type Entry = { id: string; text: string; nickname: string; likes: number; participant_id: string };

export function InnspillView({ session, items }: { session: SessionInfo; items: Question[] }) {
  const [nickname, setNickname] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [participantId, setParticipantId] = useState('');
  const [inputText, setInputText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [myInnspill, setMyInnspill] = useState<Record<string, Array<{ id: string; text: string; likes: number; likedByMe: boolean }>>>({});
  const [allInnspill, setAllInnspill] = useState<Record<string, Array<{ id: string; text: string; nickname: string; likes: number; likedByMe: boolean }>>>({});
  const [showOthers, setShowOthers] = useState(false);
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

  async function fetchInnspill() {
    const response = await fetch(`/api/delta/${session.code}/innspill`, { cache: 'no-store' });
    const data = (await response.json()) as { questions?: Array<{ id: string; text: string; question_status: string; innspill: Entry[] }> };

    if (!response.ok || !data.questions) {
      return;
    }

    const mine: Record<string, Array<{ id: string; text: string; likes: number; likedByMe: boolean }>> = {};
    const others: Record<string, Array<{ id: string; text: string; nickname: string; likes: number; likedByMe: boolean }>> = {};

    for (const question of data.questions) {
      mine[question.id] = [];
      others[question.id] = [];

      for (const entry of question.innspill) {
        const likedByMe = false;
        if (entry.participant_id === participantId) {
          mine[question.id].push({ id: entry.id, text: entry.text, likes: entry.likes, likedByMe });
        } else {
          others[question.id].push({ id: entry.id, text: entry.text, nickname: entry.nickname, likes: entry.likes, likedByMe });
        }
      }
    }

    setMyInnspill(mine);
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
      items.filter((item) => item.questionStatus === 'active' || (myInnspill[item.id] ?? []).length > 0 || (allInnspill[item.id] ?? []).length > 0),
    [allInnspill, items, myInnspill],
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
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-2xl font-semibold">{session.title}</h1>
          <p className="mt-2 text-sm text-slate-300">Velg et visningsnavn for innspill.</p>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            className="mt-4 w-full rounded border border-slate-700 bg-slate-950 p-2"
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
            className="mt-4 w-full rounded bg-white px-4 py-2 font-medium text-slate-950 disabled:opacity-60"
          >
            Bli med
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold">{session.title}</h1>

        {visibleQuestions.length === 0 ? <p className="rounded-xl border border-slate-800 bg-slate-900 p-4">Vent på at fasilitator åpner neste spørsmål...</p> : null}

        {visibleQuestions.map((question) => (
          <section key={question.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-xl font-semibold">{question.text}</h2>
            {question.questionStatus === 'active' ? (
              <>
                <textarea
                  value={inputText[question.id] ?? ''}
                  onChange={(event) => setInputText((current) => ({ ...current, [question.id]: event.target.value }))}
                  placeholder="Skriv ditt innspill..."
                  className="mt-3 w-full rounded border border-slate-700 bg-slate-950 p-2"
                  rows={3}
                />
                <button
                  type="button"
                  onClick={() => submit(question.id)}
                  disabled={submitting[question.id]}
                  className="mt-2 rounded bg-white px-3 py-1.5 text-sm font-medium text-slate-950"
                >
                  {submitting[question.id] ? 'Lagrer...' : 'Legg til'}
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Dette spørsmålet er lukket for nye innspill.</p>
            )}

            <div className="mt-5">
              <p className="text-sm font-medium text-slate-300">Dine innspill:</p>
              <div className="mt-2 space-y-2">
                {(myInnspill[question.id] ?? []).map((entry) => (
                  <div key={entry.id} className="rounded border border-slate-700 p-3 text-sm">
                    <p>{entry.text}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                      <span>{entry.likes} likes</span>
                      <button type="button" onClick={() => deleteInnspill(entry.id)} className="text-rose-300">Slett</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button type="button" onClick={() => setShowOthers((current) => !current)} className="mt-5 text-sm text-slate-300 underline">
              {showOthers ? 'Skjul andres innspill' : `Vis andres innspill (${(allInnspill[question.id] ?? []).length})`}
            </button>

            {showOthers ? (
              <div className="mt-2 space-y-2">
                {(allInnspill[question.id] ?? []).map((entry) => (
                  <div key={entry.id} className="rounded border border-slate-700 p-3 text-sm">
                    <p>{entry.text}</p>
                    <p className="mt-1 text-xs text-slate-400">{entry.nickname}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                      <span>{entry.likes} likes</span>
                      <button type="button" onClick={() => toggleLike(entry.id)} className="text-emerald-300">👍</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  );
}
