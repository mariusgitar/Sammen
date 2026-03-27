'use client';

import { useEffect, useMemo, useState } from 'react';

type SessionView = {
  id: string;
};

type InnspillEntry = {
  id: string;
  text: string;
  detaljer?: string | null;
  nickname: string;
  likes: number;
  created_at: string;
};

type Theme = {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  order_index: number;
  innspill: InnspillEntry[];
};

type ThemePanelProps = {
  session: SessionView;
  code: string;
};

export function ThemePanel({ code, session }: ThemePanelProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [ungrouped, setUngrouped] = useState<InnspillEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [editingTheme, setEditingTheme] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasThemes = themes.length > 0;

  async function fetchThemes() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/${code}/themes`, { cache: 'no-store' });
      const data = (await response.json()) as { themes?: Theme[]; ungrouped?: InnspillEntry[]; error?: string };

      if (!response.ok) {
        setError(data.error ?? 'Kunne ikke hente temaer');
        return;
      }

      setThemes(data.themes ?? []);
      setUngrouped(data.ungrouped ?? []);
      setError(null);
    } catch {
      setError('Kunne ikke hente temaer');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void fetchThemes();
  }, [code, session.id]);

  async function handleSuggestThemes() {
    if (hasThemes) {
      const shouldContinue = window.confirm('Dette erstatter eksisterende temaer. Fortsett?');
      if (!shouldContinue) {
        return;
      }
    }

    setIsSuggesting(true);
    setError(null);

    try {
      const suggestResponse = await fetch(`/api/admin/${code}/suggest-themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const suggestData = (await suggestResponse.json()) as {
        themes?: Array<{ name: string; description?: string; color: string; innspill_ids: string[] }>;
        error?: string;
      };

      if (!suggestResponse.ok || !suggestData.themes) {
        setError(suggestData.error ?? 'Kunne ikke foreslå temaer');
        return;
      }

      const saveResponse = await fetch(`/api/admin/${code}/themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themes: suggestData.themes }),
      });

      const saveData = (await saveResponse.json()) as { error?: string };

      if (!saveResponse.ok) {
        setError(saveData.error ?? 'Kunne ikke lagre temaer');
        return;
      }

      await fetchThemes();
    } catch {
      setError('Kunne ikke foreslå temaer');
    } finally {
      setIsSuggesting(false);
    }
  }

  async function handleSaveEdit(themeId: string) {
    const response = await fetch(`/api/admin/${code}/themes/${themeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingName, description: editingDescription }),
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error ?? 'Kunne ikke oppdatere tema');
      return;
    }

    setEditingTheme(null);
    await fetchThemes();
  }

  async function handleDeleteTheme(themeId: string) {
    const confirmed = window.confirm('Slette temaet? Innspillene blir ikke gruppert.');
    if (!confirmed) return;

    const response = await fetch(`/api/admin/${code}/themes/${themeId}`, { method: 'DELETE' });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error ?? 'Kunne ikke slette tema');
      return;
    }

    await fetchThemes();
  }

  async function moveInnspill(innspillId: string, themeId: string | null) {
    const response = await fetch(`/api/innspill/${innspillId}/theme`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_id: themeId }),
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error ?? 'Kunne ikke flytte innspill');
      return;
    }

    await fetchThemes();
  }

  async function handleCreateTheme() {
    const name = window.prompt('Navn på nytt tema');
    if (!name || !name.trim()) {
      return;
    }

    const existingThemePayload = themes.map((theme) => ({
      name: theme.name,
      description: theme.description ?? '',
      color: theme.color,
      innspill_ids: theme.innspill.map((entry) => entry.id),
    }));

    const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    const color = palette[themes.length % palette.length];

    const response = await fetch(`/api/admin/${code}/themes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        themes: [
          ...existingThemePayload,
          {
            name: name.trim(),
            description: '',
            color,
            innspill_ids: [],
          },
        ],
      }),
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error ?? 'Kunne ikke opprette tema');
      return;
    }

    await fetchThemes();
  }

  const totalInnspill = useMemo(() => themes.reduce((sum, theme) => sum + theme.innspill.length, 0) + ungrouped.length, [themes, ungrouped.length]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Tematisering</h2>

      {isLoading ? <p className="mt-4 text-sm text-slate-300">Laster temaer...</p> : null}

      {isSuggesting ? (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-100">Analyserer innspillene dine...</p>
          <p className="text-xs text-slate-400">Dette tar noen sekunder</p>
        </div>
      ) : null}

      {!isLoading && !hasThemes && !isSuggesting ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-center">
          <p className="text-3xl" aria-hidden>🧩</p>
          <p className="mt-3 text-sm text-slate-300">
            Grupper innspillene i temaer for å skape oversikt og dra ut innsikt
          </p>
          <button
            type="button"
            onClick={() => void handleSuggestThemes()}
            className="mt-4 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-white"
          >
            ✨ Foreslå temaer med AI
          </button>
          <button
            type="button"
            onClick={() => void handleCreateTheme()}
            className="mt-3 block w-full text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            Opprett tema manuelt
          </button>
        </div>
      ) : null}

      {hasThemes ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-300">{themes.length} temaer · {totalInnspill} innspill</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSuggestThemes()}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-400"
              >
                🔄 Foreslå på nytt
              </button>
              <button
                type="button"
                onClick={() => void handleCreateTheme()}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-400"
              >
                + Nytt tema
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {themes.map((theme) => (
              <article key={theme.id} style={{ borderTop: `3px solid ${theme.color}` }} className="rounded-2xl bg-white p-4 text-slate-900 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: theme.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold" style={{ color: theme.color }}>{theme.name}</p>
                    {theme.description ? <p className="mt-0.5 text-sm text-white/50">{theme.description}</p> : null}
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">{theme.innspill.length}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTheme(theme.id);
                      setEditingName(theme.name);
                      setEditingDescription(theme.description ?? '');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-900"
                    aria-label="Rediger tema"
                  >
                    ✏️
                  </button>
                  <button type="button" onClick={() => void handleDeleteTheme(theme.id)} className="text-xs text-rose-500 hover:text-rose-700" aria-label="Slett tema">🗑️</button>
                </div>

                {editingTheme === theme.id ? (
                  <div className="mt-3 space-y-2">
                    <input value={editingName} onChange={(event) => setEditingName(event.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                    <input value={editingDescription} onChange={(event) => setEditingDescription(event.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void handleSaveEdit(theme.id)} className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white">Lagre</button>
                      <button type="button" onClick={() => setEditingTheme(null)} className="rounded border border-slate-300 px-2 py-1 text-xs">Avbryt</button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  {theme.innspill.slice(0, 5).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border-l-2 bg-white/5 px-3 py-2"
                      style={{ borderColor: `${theme.color}60` }}
                    >
                      <span className="truncate">{entry.text.slice(0, 50)}</span>
                      <button type="button" onClick={() => void moveInnspill(entry.id, null)} className="text-slate-500 hover:text-slate-900">×</button>
                    </div>
                  ))}
                  {theme.innspill.length > 5 ? <p className="text-xs text-slate-500">og {theme.innspill.length - 5} til...</p> : null}
                </div>
              </article>
            ))}
          </div>

          {ungrouped.length > 0 ? (
            <div className="mt-6 rounded-2xl border-2 border-dashed border-white/20 p-4">
              <h3 className="text-sm font-semibold text-slate-200">Ikke gruppert ({ungrouped.length})</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {ungrouped.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">
                    <span className="max-w-[220px] truncate">{entry.text.slice(0, 50)}</span>
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        const value = event.target.value || null;
                        if (value) {
                          void moveInnspill(entry.id, value);
                        }
                      }}
                      className="rounded bg-slate-800 px-1 py-0.5 text-xs text-slate-100"
                    >
                      <option value="">+</option>
                      {themes.map((theme) => (
                        <option key={theme.id} value={theme.id}>{theme.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
