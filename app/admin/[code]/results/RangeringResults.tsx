'use client';

type RangeringResultItem = {
  id: string;
  text: string;
  averagePosition: number;
  voteCount: number;
  minPosition: number | null;
  maxPosition: number | null;
};

type RangeringResultsProps = {
  items: RangeringResultItem[];
};

export function RangeringResults({ items }: RangeringResultsProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Rangering-resultater</h2>
      <div className="mt-4 space-y-2">
        {items.map((item, index) => {
          const totalItems = Math.max(items.length, 1);
          const spread = item.minPosition !== null && item.maxPosition !== null ? item.maxPosition - item.minPosition : totalItems - 1;
          const consensusScore = totalItems > 1 ? 1 - spread / (totalItems - 1) : 1;
          const consensusLabel =
            consensusScore > 0.7
              ? { text: 'Høy enighet', color: '#22c55e' }
              : consensusScore > 0.4
                ? { text: 'Noe uenighet', color: '#f59e0b' }
                : { text: 'Stor uenighet', color: '#ef4444' };

          return (
            <article key={item.id} className="mb-2 flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
              <div className="w-8 flex-shrink-0 text-2xl font-bold text-slate-200">{index + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-800">{item.text}</div>
                <div className="mt-0.5 text-xs text-slate-400">Snitt posisjon: {item.averagePosition.toFixed(1)}</div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all" style={{ width: `${consensusScore * 100}%`, background: consensusLabel.color }} />
                </div>
                <span className="text-xs font-medium" style={{ color: consensusLabel.color }}>
                  {consensusLabel.text}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <p className="font-mono text-sm whitespace-pre-wrap">
          {'RANGERING\n─────────\n'}
          {items
            .map(
              (item, index) =>
                `${index + 1}. ${item.text} — snitt posisjon ${item.averagePosition.toFixed(1)} (${item.voteCount} deltakere)`,
            )
            .join('\n')}
        </p>
      </div>
    </section>
  );
}
