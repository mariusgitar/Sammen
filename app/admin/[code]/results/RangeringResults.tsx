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

function ordinal(rank: number) {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

export function RangeringResults({ items }: RangeringResultsProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Rangering-resultater</h2>
      <div className="mt-4 space-y-4">
        {items.map((item, index) => {
          const spread = item.minPosition !== null && item.maxPosition !== null ? item.maxPosition - item.minPosition : 0;
          const spreadWidth = 20 + spread * 18;

          return (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">{ordinal(index + 1)}</p>
              <p className="font-semibold text-slate-900">{item.text}</p>
              <p className="mt-1 text-sm text-slate-700">Snitt posisjon: {item.averagePosition.toFixed(1)}</p>
              <p className="text-sm text-slate-700">{item.voteCount} deltakere</p>
              <div className="mt-2">
                <p className="text-xs text-slate-500">Enighet (smal = høy, bred = lav)</p>
                <div className="mt-1 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-slate-700" style={{ width: `${Math.min(100, spreadWidth)}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Min: {item.minPosition ?? '–'} · Maks: {item.maxPosition ?? '–'}
                </p>
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
