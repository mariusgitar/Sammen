'use client';

import { useMemo, useState } from 'react';

type KartleggingItem = {
  id: string;
  text: string;
  excluded: boolean;
  is_new?: boolean;
  created_by?: string | null;
};

type KartleggingResponse = {
  itemId: string;
  value: string;
};

type KartleggingResultsProps = {
  items: KartleggingItem[];
  responses: KartleggingResponse[];
  tags: string[];
  participantCount: number;
};

type ViewMode = 'element' | 'tag' | 'uenighet' | 'nye';

function makeBar(count: number, total: number, width = 6) {
  if (total <= 0) {
    return '░'.repeat(width);
  }

  const filled = Math.round((count / total) * width);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
}

export function KartleggingResults({ items, responses, tags, participantCount }: KartleggingResultsProps) {
  const [view, setView] = useState<ViewMode>('element');

  const includedItems = useMemo(() => items.filter((item) => !item.excluded), [items]);


  const countsByItem = useMemo(() => {
    const byItem = new Map<string, Record<string, number>>();

    for (const response of responses) {
      const current = byItem.get(response.itemId) ?? {};
      current[response.value] = (current[response.value] ?? 0) + 1;
      byItem.set(response.itemId, current);
    }

    return byItem;
  }, [responses]);

  const allTags = useMemo(() => {
    const responseTags = new Set(responses.map((entry) => entry.value));
    return [...new Set([...tags, ...responseTags])];
  }, [responses, tags]);

  const itemStats = useMemo(() => {
    return includedItems.map((item) => {
      const counts = countsByItem.get(item.id) ?? {};
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      const untagged = Math.max(0, participantCount - total);
      const maxCount = Object.values(counts).reduce((max, count) => Math.max(max, count), 0);
      const topTags = Object.entries(counts)
        .filter(([, count]) => count === maxCount && count > 0)
        .map(([tag]) => tag);

      const disagreementScore = total > 0 ? 1 - maxCount / total : 0;
      const hasMajority = total > 0 && maxCount / total > 0.5;

      return {
        item,
        counts,
        total,
        untagged,
        maxCount,
        topTags,
        disagreementScore,
        hasMajority,
      };
    });
  }, [countsByItem, includedItems]);

  const perTagData = useMemo(() => {
    const grouped = new Map<string, { itemId: string; text: string; count: number }[]>();

    for (const tag of tags) {
      const rows = itemStats
        .map((entry) => ({
          itemId: entry.item.id,
          text: entry.item.text,
          count: entry.counts[tag] ?? 0,
        }))
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count);

      grouped.set(tag, rows);
    }

    return grouped;
  }, [itemStats, tags]);

  const newItems = useMemo(() => includedItems.filter((item) => item.is_new === true), [includedItems]);

  const untaggedRows = useMemo(
    () =>
      itemStats
        .filter((entry) => entry.untagged > 0)
        .map((entry) => ({
          itemId: entry.item.id,
          text: entry.item.text,
          count: entry.untagged,
        }))
        .sort((a, b) => b.count - a.count),
    [itemStats],
  );

  const itemStatsById = useMemo(
    () =>
      new Map(
        itemStats.map((entry) => [
          entry.item.id,
          {
            counts: entry.counts,
            untagged: entry.untagged,
          },
        ]),
      ),
    [itemStats],
  );

  const disagreementSorted = useMemo(
    () => [...itemStats].sort((a, b) => b.disagreementScore - a.disagreementScore),
    [itemStats],
  );

  const renderTagBreakdown = (counts: Record<string, number>, untagged: number) => (
    <div className="mt-2 space-y-1 text-sm text-slate-700">
      {allTags.length > 0 ? (
        <>
          {allTags.map((tag) => {
            const count = counts[tag] ?? 0;
            return (
              <p key={tag}>
                {tag} {makeBar(count, participantCount)} {count} av {participantCount}
              </p>
            );
          })}
          {untagged > 0 ? (
            <p className="text-slate-500">
              Ingen tag: {untagged} av {participantCount}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p>Ingen tagger registrert.</p>
          {untagged > 0 ? (
            <p className="text-slate-500">
              Ingen tag: {untagged} av {participantCount}
            </p>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Kartlegging-resultater</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView('element')}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
            view === 'element'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
          }`}
        >
          Per element
        </button>
        <button
          type="button"
          onClick={() => setView('tag')}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
            view === 'tag'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
          }`}
        >
          Per tag
        </button>
        <button
          type="button"
          onClick={() => setView('uenighet')}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
            view === 'uenighet'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
          }`}
        >
          Uenighet først
        </button>
        <button
          type="button"
          onClick={() => setView('nye')}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
            view === 'nye'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
          }`}
        >
          Nye forslag
        </button>
      </div>

      {view === 'element' ? (
        <div className="mt-4 space-y-4">
          {itemStats.map((entry) => (
            <article key={entry.item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{entry.item.text}</p>
                {!entry.hasMajority && entry.total > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Uenighet</span>
                ) : null}
              </div>
              {renderTagBreakdown(entry.counts, entry.untagged)}
            </article>
          ))}
        </div>
      ) : null}

      {view === 'tag' ? (
        <div className="mt-4 space-y-5">
          {tags.map((tag) => {
            const rows = perTagData.get(tag) ?? [];
            return (
              <article key={tag} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{tag}</h3>
                {rows.length > 0 ? (
                  <ul className="mt-2 space-y-2 text-sm text-slate-800">
                    {rows.map((row) => (
                      <li key={`${tag}-${row.itemId}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                        <p className="font-medium text-slate-900">{row.text}</p>
                        <p className="text-slate-700">
                          {row.count} av {participantCount}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Ingen elementer med denne taggen.</p>
                )}
              </article>
            );
          })}

          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ingen tag</h3>
            {untaggedRows.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {untaggedRows.map((row) => (
                  <li key={`untagged-${row.itemId}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <p className="font-medium text-slate-800">{row.text}</p>
                    <p className="text-slate-500">
                      {row.count} av {participantCount}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Alle elementer har tagger.</p>
            )}
          </article>
        </div>
      ) : null}

      {view === 'uenighet' ? (
        <div className="mt-4 space-y-4">
          {disagreementSorted.map((entry) => {
            const indicator =
              entry.disagreementScore > 0.4
                ? {
                    text: 'Høy uenighet',
                    classes: 'bg-orange-100 text-orange-800',
                  }
                : entry.disagreementScore >= 0.2
                  ? {
                      text: 'Noe uenighet',
                      classes: 'bg-yellow-100 text-yellow-800',
                    }
                  : {
                      text: 'Enighet',
                      classes: 'bg-emerald-100 text-emerald-800',
                    };

            return (
              <article key={entry.item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{entry.item.text}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${indicator.classes}`}>{indicator.text}</span>
                </div>
                {renderTagBreakdown(entry.counts, entry.untagged)}
              </article>
            );
          })}
        </div>
      ) : null}

      {view === 'nye' ? (
        <div className="mt-4 space-y-4">
          {newItems.length > 0 ? (
            newItems.map((item) => {
              const stats = itemStatsById.get(item.id);
              return (
                <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-medium">{item.text}</p>
                  <p className="mt-1 text-sm text-slate-700">Foreslått av: {item.created_by ?? 'Ukjent'}</p>
                  {renderTagBreakdown(stats?.counts ?? {}, stats?.untagged ?? participantCount)}
                </article>
              );
            })
          ) : (
            <p className="text-sm text-slate-600">Ingen nye forslag i denne sesjonen.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
