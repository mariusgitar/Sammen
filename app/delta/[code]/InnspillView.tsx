"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Question = {
  id: string;
  text: string;
  questionStatus: "inactive" | "active" | "locked";
};

type SessionInfo = {
  id: string;
  code: string;
  title: string;
  show_others_innspill: boolean;
  innspill_mode: "enkel" | "detaljert";
  innspill_max_chars: number;
};

type Entry = {
  id: string;
  text: string;
  detaljer: string | null;
  nickname: string;
  likes: number;
  participant_id: string;
};

type MyEntry = {
  id: string;
  text: string;
  detaljer: string | null;
  likes: number;
  likedByMe: boolean;
};
type OtherEntry = {
  id: string;
  text: string;
  detaljer: string | null;
  nickname: string;
  likes: number;
  likedByMe: boolean;
  participant_id: string;
};

const columnColors = [
  "border-t-[#3b5bdb]",
  "border-t-[#818cf8]",
  "border-t-[#0ea5e9]",
  "border-t-[#f59e0b]",
  "border-t-[#38bdf8]",
  "border-t-[#a78bfa]",
];

export function InnspillView({
  session,
  items,
}: {
  session: SessionInfo;
  items: Question[];
}) {
  const [nickname, setNickname] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [participantId, setParticipantId] = useState("");
  const [inputText, setInputText] = useState<Record<string, string>>({});
  const [detailsText, setDetailsText] = useState<Record<string, string>>({});
  const [expandedDetails, setExpandedDetails] = useState<
    Record<string, boolean>
  >({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [myInnspill, setMyInnspill] = useState<Record<string, MyEntry[]>>({});
  const [allInnspill, setAllInnspill] = useState<Record<string, OtherEntry[]>>(
    {},
  );
  const [showOthers, setShowOthers] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const canSeeOthers = session.show_others_innspill;
  const initialized = useRef(false);
  const participantStorageKey = "samen_participant_id";
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
    const response = await fetch(`/api/delta/${session.code}/innspill`, {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      questions?: Array<{
        id: string;
        text: string;
        question_status: string;
        innspill: Entry[];
      }>;
    };

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
          mine[question.id].push({
            id: entry.id,
            text: entry.text,
            detaljer: entry.detaljer,
            likes: entry.likes,
            likedByMe,
          });
        } else {
          others[question.id].push({
            id: entry.id,
            text: entry.text,
            detaljer: entry.detaljer,
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

  useEffect(() => {
    if (!submitted) {
      return;
    }

    const checkSession = async () => {
      const response = await fetch(`/api/sessions/${session.code}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        session?: {
          status?: string;
          phase?: string;
        };
      };

      if (
        data.session?.status === "active" &&
        data.session?.phase === "stemming"
      ) {
        window.location.reload();
      }
    };

    const interval = setInterval(() => {
      void checkSession();
    }, 5_000);

    return () => clearInterval(interval);
  }, [submitted, session.code]);

  const visibleQuestions = useMemo(
    () =>
      items.filter(
        (item) =>
          item.questionStatus === "active" ||
          (myInnspill[item.id] ?? []).length > 0 ||
          (canSeeOthers && (allInnspill[item.id] ?? []).length > 0),
      ),
    [allInnspill, canSeeOthers, items, myInnspill],
  );
  const myInnspillCount = useMemo(
    () =>
      Object.values(myInnspill).reduce(
        (total, entries) => total + entries.length,
        0,
      ),
    [myInnspill],
  );

  function handleSubmit() {
    setSubmitted(true);
    setShowConfirm(false);
  }

  async function submit(questionId: string) {
    const text = (inputText[questionId] ?? "").trim();
    const detaljer = (detailsText[questionId] ?? "").trim();
    if (!text || !participantId || !nickname.trim()) {
      return;
    }
    if (text.length > session.innspill_max_chars) {
      return;
    }

    setSubmitting((current) => ({ ...current, [questionId]: true }));

    try {
      const response = await fetch("/api/innspill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          questionId,
          participantId,
          nickname: nickname.trim(),
          text,
          detaljer:
            session.innspill_mode === "detaljert" ? detaljer : undefined,
        }),
      });
      const responseBody = (await response.json()) as {
        innspill?: {
          id: string;
          text: string;
          detaljer: string | null;
          likes: number;
        };
      };

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
                detaljer: responseBody.innspill!.detaljer,
                likes: 0,
                likedByMe: false,
              },
            ],
          };
        });
      }
      setInputText((current) => ({ ...current, [questionId]: "" }));
      setDetailsText((current) => ({ ...current, [questionId]: "" }));
    } finally {
      setSubmitting((current) => ({ ...current, [questionId]: false }));
    }
  }

  async function deleteInnspill(id: string) {
    await fetch(`/api/innspill/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    await fetchInnspill();
  }

  async function toggleLike(id: string) {
    await fetch(`/api/innspill/${id}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    await fetchInnspill();
  }

  function getHvaPlaceholder() {
    if (session.innspill_max_chars <= 60) {
      return "Kort og konkret — én setning";
    }
    if (session.innspill_max_chars <= 100) {
      return "f.eks. 'Vi mangler felles rutiner for onboarding'";
    }
    return "Beskriv innspillet ditt";
  }

  function renderEntryText(entry: {
    id: string;
    text: string;
    detaljer: string | null;
  }) {
    const showDetailText =
      session.innspill_mode === "detaljert" && Boolean(entry.detaljer?.trim());
    const detailText = entry.detaljer?.trim() ?? "";
    const requiresToggle = detailText.length > 80;
    const isExpanded = expandedDetails[entry.id] ?? false;

    return (
      <>
        <p className="font-medium whitespace-normal break-words overflow-hidden text-[#0f172a]">
          {entry.text}
        </p>
        {showDetailText ? (
          requiresToggle ? (
            <div className="mt-1">
              <button
                type="button"
                onClick={() =>
                  setExpandedDetails((current) => ({
                    ...current,
                    [entry.id]: !isExpanded,
                  }))
                }
                className="text-xs text-[#64748b] underline"
              >
                {isExpanded ? "Skjul detaljer ↑" : "Les mer ↓"}
              </button>
              {isExpanded ? (
                <p className="mt-1 text-xs text-[#64748b]">{detailText}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-xs text-[#64748b]">{detailText}</p>
          )
        ) : null}
      </>
    );
  }

  if (!hasJoined) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 text-[#0f172a] sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">{session.title}</h1>
          <p className="mt-2 text-sm text-[#64748b]">
            Velg et visningsnavn for innspill.
          </p>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            className="mt-4 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#3b5bdb] transition-colors text-sm"
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
            className="mt-4 w-full bg-[#0f172a] text-white rounded-full px-6 py-3 font-semibold hover:bg-[#1e293b] transition-colors disabled:opacity-60"
          >
            Bli med
          </button>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 text-[#0f172a] sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-bold">Takk for dine svar, {nickname.trim()}!</h2>
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
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 pb-32 text-[#0f172a] sm:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <h1 className="text-2xl font-semibold">{session.title}</h1>

        {visibleQuestions.length === 0 ? (
          <p className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm text-[#64748b]">
            Vent på at fasilitator åpner neste spørsmål...
          </p>
        ) : null}

        {visibleQuestions.length > 0 && canSeeOthers ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowOthers((current) => !current)}
              className="text-sm text-[#64748b] underline"
            >
              {showOthers ? "Skjul andres innspill" : "Vis andres innspill"}
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleQuestions.map((question, index) => {
            const mine = myInnspill[question.id] ?? [];
            const others = canSeeOthers
              ? (allInnspill[question.id] ?? []).filter(
                  (entry) => entry.participant_id !== participantId,
                )
              : [];
            const innspillCount = mine.length + others.length;

            return (
              <section
                key={question.id}
                className={`flex min-h-[300px] w-full min-w-0 flex-col rounded-2xl border border-[#e2e8f0] border-t-2 bg-white shadow-sm ${columnColors[index % columnColors.length]}`}
              >
                <div className="sticky top-0 z-10 rounded-t-2xl border-b border-[#e2e8f0] bg-[#f8fafc] px-4 pb-3 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-[#0f172a]">
                      {question.text}
                    </h2>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#64748b] border border-[#e2e8f0]">
                      {innspillCount}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  {mine.map((entry) => (
                    <div
                      key={entry.id}
                      className="overflow-hidden rounded-xl border border-[#c7d2fe] bg-[#eef2ff] px-3 py-2 text-sm"
                    >
                      {renderEntryText(entry)}
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-[#64748b]">
                        <span>Ditt innspill</span>
                        <button
                          type="button"
                          onClick={() => deleteInnspill(entry.id)}
                          className="text-rose-500 hover:text-rose-600 text-sm"
                        >
                          Slett
                        </button>
                      </div>
                    </div>
                  ))}

                  {canSeeOthers && showOthers
                    ? others.map((entry) => (
                        <div
                          key={entry.id}
                          className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm"
                        >
                          {renderEntryText(entry)}
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs text-[#64748b]">
                              {entry.nickname}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleLike(entry.id)}
                            >
                              {entry.likedByMe ? "♥" : "♡"} {entry.likes}
                            </button>
                          </div>
                        </div>
                      ))
                    : null}
                </div>

                <div className="border-t border-[#e2e8f0] p-3">
                  {question.questionStatus === "active" ? (
                    <>
                      {(() => {
                        const currentLength = (inputText[question.id] ?? "")
                          .length;
                        const limit = session.innspill_max_chars;
                        const showCounter =
                          currentLength >= Math.ceil(limit * 0.6);
                        const ratio = currentLength / limit;
                        const counterColor =
                          ratio >= 1
                            ? "text-rose-500"
                            : ratio >= 0.85
                              ? "text-amber-500"
                              : "text-slate-400";
                        const showQuestionTip =
                          currentLength > 40 &&
                          (inputText[question.id] ?? "").includes("?");
                        const detailLength = (detailsText[question.id] ?? "")
                          .length;

                        return session.innspill_mode === "enkel" ? (
                          <>
                            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                              Ditt innspill
                            </label>
                            <textarea
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#3b5bdb] transition-colors text-sm resize-none"
                              rows={2}
                              placeholder="Skriv én ting — kort nok til å leses på 5 sekunder"
                              maxLength={session.innspill_max_chars}
                              value={inputText[question.id] || ""}
                              onChange={(event) =>
                                setInputText((current) => ({
                                  ...current,
                                  [question.id]: event.target.value,
                                }))
                              }
                            />
                            {showCounter ? (
                              <p className={`mt-1 text-xs ${counterColor}`}>
                                {currentLength} / {limit} tegn
                              </p>
                            ) : null}
                            {ratio >= 1 ? (
                              <p className="mt-1 text-xs text-rose-500">
                                Prøv å korte det ned — ett innspill, én ting
                              </p>
                            ) : null}
                            {ratio >= 0.85 && ratio < 1 ? (
                              <p className="mt-1 text-xs text-amber-500">
                                Nærmer deg grensen — prøv å si det kortere 😊
                              </p>
                            ) : null}
                            {showQuestionTip ? (
                              <p className="mt-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700">
                                Tips: innspill fungerer best som påstander.
                                F.eks. "Vi trenger X" i stedet for "Har vi X?"
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                Hva
                              </label>
                              <textarea
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#3b5bdb] transition-colors text-sm resize-none"
                                rows={2}
                                placeholder={getHvaPlaceholder()}
                                maxLength={session.innspill_max_chars}
                                value={inputText[question.id] || ""}
                                onChange={(event) =>
                                  setInputText((current) => ({
                                    ...current,
                                    [question.id]: event.target.value,
                                  }))
                                }
                              />
                              {showCounter ? (
                                <p className={`mt-1 text-xs ${counterColor}`}>
                                  {currentLength} / {limit} tegn
                                </p>
                              ) : null}
                              {ratio >= 1 ? (
                                <p className="mt-1 text-xs text-rose-500">
                                  Prøv å korte det ned — ett innspill, én ting
                                </p>
                              ) : null}
                              {ratio >= 0.85 && ratio < 1 ? (
                                <p className="mt-1 text-xs text-amber-500">
                                  Nærmer deg grensen — prøv å si det kortere 😊
                                </p>
                              ) : null}
                              {showQuestionTip ? (
                                <p className="mt-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700">
                                  Tips: innspill fungerer best som påstander.
                                  F.eks. "Vi trenger X" i stedet for "Har vi X?"
                                </p>
                              ) : null}
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                                Mer detaljer (valgfritt)
                              </label>
                              <textarea
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#3b5bdb] transition-colors text-sm resize-none"
                                rows={3}
                                placeholder="Utdyp gjerne — hva er bakgrunnen eller konteksten?"
                                maxLength={400}
                                value={detailsText[question.id] || ""}
                                onChange={(event) =>
                                  setDetailsText((current) => ({
                                    ...current,
                                    [question.id]: event.target.value,
                                  }))
                                }
                              />
                              {detailLength >= 300 ? (
                                <p className="mt-1 text-xs text-slate-400">
                                  {detailLength} / 400 tegn
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        className="mt-2 w-full bg-[#0f172a] text-white rounded-full px-6 py-3 font-semibold hover:bg-[#1e293b] transition-colors"
                        onClick={() => submit(question.id)}
                        disabled={
                          submitting[question.id] ||
                          (inputText[question.id] ?? "").trim().length >
                            session.innspill_max_chars
                        }
                      >
                        {submitting[question.id] ? "Lagrer..." : "Legg til"}
                      </button>
                      {!canSeeOthers ? (
                        <p className="mt-2 text-xs text-[#64748b]">
                          Du ser bare dine egne innspill under innsamlingen.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-[#64748b]">
                      Dette spørsmålet er lukket for nye innspill.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {myInnspillCount > 0 ? (
          showConfirm ? (
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-slate-100 p-4">
              <p className="text-sm font-medium text-slate-700 text-center mb-3">
                Er du ferdig med alle innspill?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Fortsett å redigere
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 rounded-full bg-[#0f172a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#1e293b]"
                >
                  Ja, lever svar
                </button>
              </div>
            </div>
          ) : (
            <div className="sticky bottom-0 border-t border-slate-100 bg-white/90 p-4 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="w-full bg-[#0f172a] text-white rounded-full px-6 py-3 font-semibold hover:bg-[#1e293b] transition-colors"
              >
                Lever svar ({myInnspillCount} innspill)
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">
                Du kan legge til flere innspill før du leverer
              </p>
            </div>
          )
        ) : null}
      </div>
    </main>
  );
}
