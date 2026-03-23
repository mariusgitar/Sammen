'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { SessionMode } from '@/db/schema';

type CreateSessionResponse =
  | {
      session: {
        code: string;
      };
    }
  | {
      error: string;
    };

const modes: Array<{ label: string; value: SessionMode }> = [
  { label: 'Kartlegging', value: 'kartlegging' },
  { label: 'Stemming', value: 'stemming' },
];

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<SessionMode>('kartlegging');
  const [items, setItems] = useState('');
  const [tags, setTags] = useState('');
  const [allowNewItems, setAllowNewItems] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const parsedItems = items
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    const parsedTags = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          mode,
          items: parsedItems,
          tags: parsedTags,
          allow_new_items: allowNewItems,
        }),
      });

      const data = (await response.json()) as CreateSessionResponse;

      if (!response.ok || !('session' in data)) {
        setError('error' in data ? data.error : 'Kunne ikke opprette sesjonen.');
        return;
      }

      router.push(`/admin/${data.session.code}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Kunne ikke opprette sesjonen.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Opprett ny sesjon</h1>
          <p className="mt-2 text-sm text-slate-300">Sett opp en enkel fasilitatorøkt og gå videre til admin-siden.</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100" htmlFor="title">
              Sesjonstittel
            </label>
            <input
              required
              id="title"
              name="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-50 outline-none transition focus:border-slate-500"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-100">Modus</legend>
            <div className="space-y-2">
              {modes.map((option) => (
                <label key={option.value} className="flex items-center gap-3 rounded border border-slate-800 p-3 text-sm text-slate-200">
                  <input
                    required
                    type="radio"
                    name="mode"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={(event) => setMode(event.target.value as SessionMode)}
                    className="h-4 w-4 border-slate-600 bg-slate-950 text-slate-100"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100" htmlFor="items">
              Kriterier / elementer
            </label>
            <textarea
              required
              id="items"
              name="items"
              value={items}
              onChange={(event) => setItems(event.target.value)}
              placeholder="Én per linje"
              rows={6}
              className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-50 outline-none transition focus:border-slate-500"
            />
            <p className="text-sm text-slate-400">Skriv ett element per linje</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100" htmlFor="tags">
              Tags deltakerne kan velge
            </label>
            <input
              id="tags"
              name="tags"
              type="text"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Flytt til behov, Fjern"
              className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-50 outline-none transition focus:border-slate-500"
            />
            <p className="text-sm text-slate-400">Kommaseparert. Kun relevant for Kartlegging-modus.</p>
          </div>

          <label className="flex items-start gap-3 rounded border border-slate-800 p-3 text-sm text-slate-200">
            <input
              id="allow-new-items"
              name="allow-new-items"
              type="checkbox"
              checked={allowNewItems}
              onChange={(event) => setAllowNewItems(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 text-slate-100"
            />
            <span>Tillat deltakere å foreslå nye elementer</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Oppretter...' : 'Opprett sesjon'}
          </button>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </form>
      </div>
    </main>
  );
}
