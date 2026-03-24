'use client';

import { useMemo, useState } from 'react';

type ExportFormat = 'liste' | 'referat';

type ExportButtonProps = {
  session: {
    title: string;
    code: string;
    mode: string;
    phase: string;
    created_at: Date;
  };
  items: Array<{
    id: string;
    text: string;
    is_new: boolean;
    created_by: string;
    excluded: boolean;
  }>;
  responses: Array<{
    item_id: string;
    participant_id: string;
    value: string;
  }>;
  tags: string[];
};

type VoteDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

export function ExportButton({ session, items, responses, tags }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('liste');
  const [copied, setCopied] = useState(false);

  const includedItems = useMemo(() => items.filter((item) => !item.excluded), [items]);
  const participantCount = useMemo(() => new Set(responses.map((entry) => entry.participant_id)).size, [responses]);

  const listText = useMemo(() => includedItems.map((item) => item.text).join('\n'), [includedItems]);

  const reportText = useMemo(() => {
    const createdDate = new Intl.DateTimeFormat('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(session.created_at));

    const mappingResponses = responses.filter((entry) => {
      const vote = Number(entry.value);
      return !Number.isInteger(vote) || vote < 1 || vote > 5;
    });

    const numericResponses = responses.filter((entry) => {
      const vote = Number(entry.value);
      return Number.isInteger(vote) && vote >= 1 && vote <= 5;
    });

    const mappingByItem = new Map<string, Record<string, number>>();
    for (const response of mappingResponses) {
      const existing = mappingByItem.get(response.item_id) ?? {};
      existing[response.value] = (existing[response.value] ?? 0) + 1;
      mappingByItem.set(response.item_id, existing);
    }

    const kartleggingLines = includedItems.flatMap((item) => {
      const counts = mappingByItem.get(item.id) ?? {};
      const tagLines = tags.map((tag) => `  ${tag}: ${counts[tag] ?? 0} av ${participantCount}`);
      const taggedTotal = tags.reduce((sum, tag) => sum + (counts[tag] ?? 0), 0);
      const untaggedCount = Math.max(0, participantCount - taggedTotal);
      const untaggedLine = untaggedCount > 0 ? [`  (ingen tag): ${untaggedCount} av ${participantCount}`] : [];
      const proposedLine = item.is_new ? [`  ★ Foreslått av ${item.created_by}`] : [];

      return [item.text, ...tagLines, ...untaggedLine, ...proposedLine, ''];
    });

    const votesByItem = new Map<string, number[]>();
    for (const response of numericResponses) {
      const vote = Number(response.value);
      const current = votesByItem.get(response.item_id) ?? [];
      current.push(vote);
      votesByItem.set(response.item_id, current);
    }

    const voteLines = includedItems
      .map((item) => {
        const votes = votesByItem.get(item.id) ?? [];
        const distribution: VoteDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

        for (const vote of votes) {
          distribution[String(vote) as keyof VoteDistribution] += 1;
        }

        const count = votes.length;
        const avg = count > 0 ? votes.reduce((sum, value) => sum + value, 0) / count : 0;

        return {
          text: item.text,
          count,
          avg,
          distribution,
        };
      })
      .sort((a, b) => b.avg - a.avg)
      .flatMap((item) => [
        `${item.text} — snitt ${item.avg.toFixed(1)} (${item.count} stemmer)`,
        `Fordeling: 1:${item.distribution['1']}  2:${item.distribution['2']}  3:${item.distribution['3']}  4:${item.distribution['4']}  5:${item.distribution['5']}`,
        '',
      ]);

    return [
      `${session.title} — Resultater`,
      `Sesjonskode: ${session.code}`,
      `Dato: ${createdDate}`,
      '',
      `KARTLEGGING (${participantCount} deltakere)`,
      '──────────────────────────────────────────',
      ...kartleggingLines,
      'STEMMING',
      '──────────────────────────────────────────',
      ...(numericResponses.length > 0 ? voteLines : []),
    ].join('\n');
  }, [includedItems, participantCount, responses, session.code, session.created_at, session.title, tags]);

  const exportText = format === 'liste' ? listText : reportText;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black print:hidden"
      >
        Eksporter liste
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 print:hidden">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">Eksporter liste</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Lukk"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('liste')}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  format === 'liste'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                Til ny sesjon
              </button>
              <button
                type="button"
                onClick={() => setFormat('referat')}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  format === 'referat'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                Til referat
              </button>
            </div>

            <textarea
              readOnly
              value={exportText}
              className="mt-3 h-72 w-full rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-sm text-slate-900"
            />

            {format === 'liste' ? (
              <p className="mt-2 text-xs text-slate-600">Lim inn i ny sesjon under Kriterier / elementer</p>
            ) : null}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-black"
              >
                Kopier
              </button>
              {copied ? <p className="text-xs font-medium text-emerald-700">Kopiert!</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
