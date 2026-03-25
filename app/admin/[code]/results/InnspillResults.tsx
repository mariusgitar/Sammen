'use client';

export function InnspillResults({
  questions,
}: {
  questions: Array<{
    id: string;
    text: string;
    innspill: Array<{ id: string; text: string; nickname: string; likes: number }>;
  }>;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
      <h2 className="text-xl font-semibold">Åpne innspill</h2>
      {questions.map((question) => (
        <article key={question.id}>
          <h3 className="font-semibold text-slate-900">{question.text}</h3>
          <ul className="mt-2 space-y-2">
            {question.innspill.map((entry) => (
              <li key={entry.id} className={`rounded border p-3 text-sm ${entry.likes > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <p>{entry.text}</p>
                <p className="text-xs text-slate-600 mt-1">{entry.nickname} ({entry.likes} likes)</p>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
