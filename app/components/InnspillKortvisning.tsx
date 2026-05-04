type InnspillKortvisningProps = {
  questions: Array<{
    id: string;
    text: string;
    innspill: Array<{ id: string; text: string; nickname?: string }>;
  }>;
  showNicknames?: boolean;
  colorScheme?: 'light' | 'dark';
};

const ACCENT_COLORS = ['#a78bfa', '#67e8f9', '#34d399', '#fb923c', '#f472b6'];

export default function InnspillKortvisning({
  questions,
  showNicknames = true,
  colorScheme = 'light',
}: InnspillKortvisningProps) {
  const showQuestionHeader = questions.length > 1;
  const cardClass =
    colorScheme === 'dark'
      ? 'bg-[#1e293b] text-white shadow-lg'
      : 'border border-slate-100 bg-white text-[#0f172a] shadow-sm';

  return (
    <div className="space-y-6">
      {questions.map((question, questionIndex) => (
        <section key={question.id} className="space-y-3">
          {showQuestionHeader ? (
            <h3 className={colorScheme === 'dark' ? 'text-sm font-semibold text-white/80' : 'text-sm font-semibold text-slate-600'}>
              {question.text}
            </h3>
          ) : null}

          <div className="columns-2 gap-3 md:columns-3">
            {question.innspill.map((entry) => (
              <article
                key={entry.id}
                className={`mb-3 break-inside-avoid rounded-2xl border-l-4 px-4 py-3 ${cardClass}`}
                style={{ borderLeftColor: ACCENT_COLORS[questionIndex % ACCENT_COLORS.length] }}
              >
                <p className="text-base font-medium leading-relaxed">{entry.text}</p>
                {showNicknames && entry.nickname?.trim() ? (
                  <p className="mt-2 text-xs text-slate-400">{entry.nickname}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
