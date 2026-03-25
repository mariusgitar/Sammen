'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { SessionMode, VisibilityMode, VotingType } from '@/db/schema';

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
  { label: 'Åpne innspill', value: 'aapne-innspill' },
  { label: 'Rangering', value: 'rangering' },
];

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<SessionMode>('kartlegging');
  const [items, setItems] = useState('');
  const [tags, setTags] = useState('');
  const [allowNewItems, setAllowNewItems] = useState(true);
  const [maxRankItemsInput, setMaxRankItemsInput] = useState('');
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('all');
  const [votingType, setVotingType] = useState<VotingType>('scale');
  const [dotBudget, setDotBudget] = useState(5);
  const [allowMultipleDots, setAllowMultipleDots] = useState(true);
  const [error, setError] = useState('');
  const [titleError, setTitleError] = useState('');
  const [itemsError, setItemsError] = useState('');
  const [maxRankItemsError, setMaxRankItemsError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isInnspillMode = mode === 'aapne-innspill';
  const isRangeringMode = mode === 'rangering';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setTitleError('');
    setItemsError('');
    setMaxRankItemsError('');

    if (!title.trim()) {
      setTitleError('Tittel er påkrevd');
      titleInputRef.current?.focus();
      return;
    }

    const parsedItems = items
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    if (parsedItems.length === 0) {
      setItemsError(isInnspillMode ? 'Legg til minst ett spørsmål' : 'Legg til minst ett element');
      return;
    }

    const parsedTags = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const parsedMaxRankItems = maxRankItemsInput.trim() === '' ? null : Number(maxRankItemsInput);

    if (isRangeringMode && parsedMaxRankItems !== null && (!Number.isInteger(parsedMaxRankItems) || parsedMaxRankItems < 2)) {
      setMaxRankItemsError('Maks antall å rangere må være et heltall på minst 2');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          mode,
          voting_type: mode === 'stemming' ? votingType : 'scale',
          dot_budget: mode === 'stemming' && votingType === 'dots' ? dotBudget : 5,
          allow_multiple_dots: mode === 'stemming' && votingType === 'dots' ? allowMultipleDots : true,
          visibility_mode: isInnspillMode ? visibilityMode : 'manual',
          max_rank_items: isRangeringMode ? parsedMaxRankItems : null,
          items: parsedItems,
          tags: isInnspillMode || isRangeringMode ? [] : parsedTags,
          allow_new_items: isInnspillMode || isRangeringMode ? true : allowNewItems,
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
              ref={titleInputRef}
              id="title"
              name="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-50 outline-none transition focus:border-slate-500"
            />
            {titleError ? <p className="text-sm text-red-400">{titleError}</p> : null}
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

          {mode === 'stemming' ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-slate-100">Stemmetype</legend>
              <div className="space-y-2">
                <label className="flex items-center gap-3 rounded border border-slate-800 p-3 text-sm text-slate-200">
                  <input
                    required
                    type="radio"
                    name="voting-type"
                    value="scale"
                    checked={votingType === 'scale'}
                    onChange={() => setVotingType('scale')}
                    className="h-4 w-4 border-slate-600 bg-slate-950 text-slate-100"
                  />
                  <span>Skala 1-5</span>
                </label>
                <label className="flex items-center gap-3 rounded border border-slate-800 p-3 text-sm text-slate-200">
                  <input
                    required
                    type="radio"
                    name="voting-type"
                    value="dots"
                    checked={votingType === 'dots'}
                    onChange={() => setVotingType('dots')}
                    className="h-4 w-4 border-slate-600 bg-slate-950 text-slate-100"
                  />
                  <span>Dot voting</span>
                </label>
              </div>
            </fieldset>
          ) : null}

          {mode === 'stemming' && votingType === 'dots' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-100" htmlFor="dot-budget">
                  Antall prikker per deltaker
                </label>
                <input
                  id="dot-budget"
                  name="dot-budget"
                  type="number"
                  min={3}
                  max={20}
                  value={dotBudget}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) {
                      return;
                    }

                    setDotBudget(Math.max(3, Math.min(20, value)));
                  }}
                  className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-50 outline-none transition focus:border-slate-500"
                />
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-slate-100">Fordeling av prikker</legend>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 rounded border border-slate-800 p-3 text-sm text-slate-200">
                    <input
                      required
                      type="radio"
                      name="dot-distribution"
                      checked={allowMultipleDots}
                      onChange={() => setAllowMultipleDots(true)}
                      className="h-4 w-4 border-slate-600 bg-slate-950 text-slate-100"
                    />
                    <span>Deltakere kan stable prikker på samme element</span>
                  </label>
                  <label className="flex items-center gap-3 rounded border border-slate-800 p-3 text-sm text-slate-200">
                    <input
                      required
                      type="radio"
                      name="dot-distribution"
                      checked={!allowMultipleDots}
                      onChange={() => setAllowMultipleDots(false)}
                      className="h-4 w-4 border-slate-600 bg-slate-950 text-slate-100"
                    />
                    <span>Deltakere må spre prikkene (maks 1 per element)</span>
                  </label>
                </div>
              </fieldset>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-100" htmlFor="items">
              {isInnspillMode ? 'Spørsmål / seksjoner' : isRangeringMode ? 'Elementer å rangere' : 'Kriterier / elementer'}
            </label>
            <textarea
              required
              id="items"
              name="items"
              value={items}
              onChange={(event) => setItems(event.target.value)}
              placeholder={isInnspillMode ? 'Ett spørsmål per linje' : 'Én per linje'}
              rows={6}
              className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-50 outline-none transition focus:border-slate-500"
            />
            <p className="text-sm text-slate-400">
              {isInnspillMode ? 'Hvert spørsmål blir en seksjon deltakerne svarer under' : 'Skriv ett element per linje'}
            </p>
            {itemsError ? <p className="text-sm text-red-400">{itemsError}</p> : null}
          </div>

          {isRangeringMode ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-100" htmlFor="max-rank-items">
                Maks antall å rangere (valgfritt)
              </label>
              <input
                id="max-rank-items"
                name="max-rank-items"
                type="number"
                min={2}
                placeholder="Alle"
                value={maxRankItemsInput}
                onChange={(event) => setMaxRankItemsInput(event.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-50 outline-none transition focus:border-slate-500"
              />
              <p className="text-sm text-slate-400">
                Sett grense hvis listen er lang, f.eks. 5 = deltakerne rangerer kun topp 5
              </p>
              {maxRankItemsError ? <p className="text-sm text-red-400">{maxRankItemsError}</p> : null}
            </div>
          ) : null}

          {isInnspillMode ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-slate-100">Synlighet</legend>
              <div className="space-y-2">
                <label className="flex items-center gap-3 rounded border border-slate-800 p-3 text-sm text-slate-200">
                  <input
                    required
                    type="radio"
                    name="visibility-mode"
                    value="manual"
                    checked={visibilityMode === 'manual'}
                    onChange={() => setVisibilityMode('manual')}
                    className="h-4 w-4 border-slate-600 bg-slate-950 text-slate-100"
                  />
                  <span>Manuell styring (fasilitator aktiverer spørsmål enkeltvis)</span>
                </label>
                <label className="flex items-center gap-3 rounded border border-slate-800 p-3 text-sm text-slate-200">
                  <input
                    required
                    type="radio"
                    name="visibility-mode"
                    value="all"
                    checked={visibilityMode === 'all'}
                    onChange={() => setVisibilityMode('all')}
                    className="h-4 w-4 border-slate-600 bg-slate-950 text-slate-100"
                  />
                  <span>Alle synlige fra start</span>
                </label>
              </div>
            </fieldset>
          ) : isRangeringMode ? null : (
            <>
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
            </>
          )}

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
