'use client';

import { useEffect, useMemo, useState } from 'react';

type Question = {
  id: string;
  text: string;
  questionStatus: 'inactive' | 'active' | 'locked';
};

type SummaryQuestion = {
  id: string;
  text: string;
  question_status: 'inactive' | 'active' | 'locked';
  innspill: Array<{ id: string; text: string; nickname: string; likes: number }>;
};

export function InnspillAdmin({ code, questions }: { code: string; questions: Question[] }) {
  const [rows, setRows] = useState<SummaryQuestion[]>([]);
  const [localQuestions, setLocalQuestions] = useState<Question[]>(questions);

  async function fetchSummary() {
    const response = await fetch(`/api/admin/${code}/innspill-summary`, { cache: 'no-store' });
    const data = (await response.json()) as { questions?: SummaryQuestion[] };
    if (response.ok && data.questions) {
      setRows(data.questions);
    }
  }

  useEffect(() => {
    void fetchSummary();
    const timer = setInterval(() => void fetchSummary(), 5_000);
    return () => clearInterval(timer);
  }, []);

  const merged = useMemo(() => {
    const map = new Map(rows.map((row) => [row.id, row]));
    return localQuestions.map((question) => map.get(question.id) ?? {
      id: question.id,
      text: question.text,
      question_status: question.questionStatus,
      innspill: [],
    });
  }, [localQuestions, rows]);

  async function toggleQuestionStatus(questionId: string, currentStatus: 'inactive' | 'active' | 'locked') {
    const newStatus: 'active' | 'locked' = currentStatus === 'active' ? 'locked' : 'active';
    const response = await fetch(`/api/items/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_status: newStatus }),
    });
    if (!response.ok) {
      return;
    }

    setLocalQuestions((current) => current.map((question) => (
      question.id === questionId
        ? { ...question, questionStatus: newStatus }
        : question
    )));
    setRows((current) => current.map((question) => (
      question.id === questionId
        ? { ...question, question_status: newStatus }
        : question
    )));
    await fetchSummary();
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20 space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Spørsmålskontroller</h2>
        <div className="mt-3 space-y-3">
          {merged.map((question) => (
            <article key={question.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-100">{question.text}</p>
                <span className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-300">{question.question_status === 'inactive' ? 'Inaktiv' : question.question_status === 'active' ? 'Aktiv' : 'Låst'}</span>
                <span className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-300">{question.innspill.length} innspill</span>
              </div>
              <div className="mt-3 flex gap-2">
                {question.question_status === 'inactive' ? <button onClick={() => void toggleQuestionStatus(question.id, question.question_status)} className="rounded bg-emerald-200 px-3 py-1 text-xs text-emerald-950">Åpne</button> : null}
                {question.question_status === 'active' ? <button onClick={() => void toggleQuestionStatus(question.id, question.question_status)} className="rounded bg-amber-200 px-3 py-1 text-xs text-amber-950">Lås</button> : null}
                {question.question_status === 'locked' ? <button onClick={() => void toggleQuestionStatus(question.id, question.question_status)} className="rounded bg-slate-200 px-3 py-1 text-xs text-slate-950">Åpne igjen</button> : null}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Live innspill</h2>
        <div className="mt-3 space-y-4">
          {merged.filter((question) => question.question_status !== 'inactive').map((question) => (
            <article key={question.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
              <h3 className="font-semibold text-slate-100">{question.text}</h3>
              <div className="mt-3 space-y-2">
                {question.innspill.map((entry, index) => (
                  <div key={entry.id} className={`rounded border p-3 text-sm ${index < 3 ? 'border-emerald-700/40 bg-emerald-950/20' : 'border-slate-700'}`}>
                    <p className="text-slate-100">{entry.text}</p>
                    <p className="mt-1 text-xs text-slate-400">{entry.nickname} · {entry.likes} likes</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
