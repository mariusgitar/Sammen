'use client';

import { useMemo, useState } from 'react';

type ExportListModalProps = {
  items: string[];
};

export function ExportListModal({ items }: ExportListModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportText = useMemo(() => items.join('\n'), [items]);

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

            <textarea
              readOnly
              value={exportText}
              className="mt-3 h-72 w-full rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-sm text-slate-900"
            />

            <p className="mt-2 text-xs text-slate-600">Lim inn i ny sesjon under Kriterier / elementer</p>

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
