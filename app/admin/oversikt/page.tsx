'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type SessionMode, type SessionStatus } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SessionListItem = {
  id: string;
  code: string;
  title: string;
  mode: SessionMode;
  status: SessionStatus;
  createdAt: string;
};

function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function ChevronIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const modeLabels: Record<SessionMode, string> = {
  kartlegging: 'Kartlegging',
  stemming: 'Stemming',
  'aapne-innspill': 'Åpne innspill',
  rangering: 'Rangering',
};

const statusLabels: Record<SessionStatus, string> = {
  setup: 'Ikke startet',
  active: 'Aktiv',
  paused: 'Innsamling avsluttet',
  closed: 'Avsluttet',
};

const statusOrder: SessionStatus[] = ['active', 'paused', 'setup', 'closed'];

const statusSectionStyles: Record<SessionStatus, string> = {
  active: 'border-emerald-600/40 bg-emerald-950/20',
  paused: 'border-amber-500/40 bg-amber-950/20',
  setup: 'border-slate-700 bg-slate-900/60',
  closed: 'border-slate-800 bg-slate-950/60',
};

const statusBadgeStyles: Record<SessionStatus, string> = {
  active: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200',
  paused: 'border-amber-500/50 bg-amber-500/15 text-amber-200',
  setup: 'border-slate-500/50 bg-slate-500/15 text-slate-200',
  closed: 'border-slate-700/70 bg-slate-700/30 text-slate-300',
};

export default function AdminOverviewPage() {
  const [allSessions, setAllSessions] = useState<SessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<'closed' | 'setup' | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<SessionStatus>>(new Set());
  const confirmDeleteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmBulkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groupedSessions = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        sessions: allSessions.filter((session) => session.status === status),
      })),
    [allSessions],
  );

  const closedCount = useMemo(() => allSessions.filter((session) => session.status === 'closed').length, [allSessions]);
  const setupCount = useMemo(() => allSessions.filter((session) => session.status === 'setup').length, [allSessions]);

  async function fetchSessions() {
    const response = await fetch('/api/admin/sessions', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Kunne ikke hente sesjoner');
    }

    const data = (await response.json()) as { sessions: SessionListItem[] };
    setAllSessions(data.sessions);
    setCollapsedGroups((previous) => {
      const next = new Set(previous);

      for (const status of statusOrder) {
        if (status === 'active') {
          continue;
        }

        const count = data.sessions.filter((session) => session.status === status).length;
        if (count > 3 && !previous.has(status)) {
          next.add(status);
        }
      }

      return next;
    });
  }

  useEffect(() => {
    const load = async () => {
      try {
        await fetchSessions();
      } finally {
        setIsLoading(false);
      }
    };

    void load();

    return () => {
      if (confirmDeleteTimeout.current) {
        clearTimeout(confirmDeleteTimeout.current);
      }
      if (confirmBulkTimeout.current) {
        clearTimeout(confirmBulkTimeout.current);
      }
    };
  }, []);

  function startDeleteConfirmation(code: string) {
    if (confirmDeleteTimeout.current) {
      clearTimeout(confirmDeleteTimeout.current);
    }

    setConfirmDelete(code);
    confirmDeleteTimeout.current = setTimeout(() => {
      setConfirmDelete((current) => (current === code ? null : current));
    }, 4000);
  }

  async function doDelete(code: string) {
    const response = await fetch(`/api/sessions/${code}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? 'Sletting feilet');
    }

    setAllSessions((current) => current.filter((session) => session.code !== code));
    setConfirmDelete(null);
  }

  async function handleBulkDelete(status: 'closed' | 'setup') {
    if (confirmBulk !== status) {
      if (confirmBulkTimeout.current) {
        clearTimeout(confirmBulkTimeout.current);
      }

      setConfirmBulk(status);
      confirmBulkTimeout.current = setTimeout(() => {
        setConfirmBulk((current) => (current === status ? null : current));
      }, 4000);
      return;
    }

    const response = await fetch('/api/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? 'Masse-sletting feilet');
    }

    setConfirmBulk(null);
    await fetchSessions();
  }

  function toggleGroup(status: SessionStatus) {
    if (status === 'active') {
      return;
    }

    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }

      return next;
    });
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Adminoversikt</h1>
            <p className="mt-2 text-sm text-slate-300">Alle sesjoner gruppert etter status.</p>
          </div>
          <Link
            href="/ny"
            className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-400 hover:text-white"
          >
            Ny sesjon →
          </Link>
        </div>

        {isLoading ? (
          <section className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 sm:p-5">
            <p className="text-sm text-slate-300">Laster sesjoner…</p>
          </section>
        ) : null}

        {!isLoading && (closedCount > 0 || setupCount > 0) ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
            <span className="text-sm text-white/50">Rydd opp i gamle sesjoner</span>
            <div className="flex flex-wrap items-center gap-2">
              {closedCount > 0 ? (
                <button
                  onClick={() => void handleBulkDelete('closed')}
                  className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-200 transition hover:border-rose-400 hover:text-rose-100"
                >
                  {confirmBulk === 'closed'
                    ? 'Er du sikker? Dette kan ikke angres.'
                    : `Slett ${closedCount} avsluttede`}
                </button>
              ) : null}
              {setupCount > 0 ? (
                <button
                  onClick={() => void handleBulkDelete('setup')}
                  className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-200 transition hover:border-rose-400 hover:text-rose-100"
                >
                  {confirmBulk === 'setup'
                    ? 'Er du sikker? Dette kan ikke angres.'
                    : `Slett ${setupCount} ikke-startede`}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {groupedSessions.map((group) => (
          <section key={group.status} className={`rounded-2xl border p-4 sm:p-5 ${statusSectionStyles[group.status]}`}>
            <button
              onClick={() => toggleGroup(group.status)}
              className="mb-4 flex w-full items-center justify-between gap-2 text-left"
              disabled={group.status === 'active'}
            >
              <h2 className="text-lg font-semibold text-white">{statusLabels[group.status]}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">{group.sessions.length} sesjoner</span>
                {group.status !== 'active' ? (
                  <ChevronIcon
                    size={16}
                    className={`text-white/50 transition-transform ${collapsedGroups.has(group.status) ? 'rotate-0' : 'rotate-180'}`}
                  />
                ) : null}
              </div>
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ${
                collapsedGroups.has(group.status) ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'
              }`}
            >
              {group.sessions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                  Ingen sesjoner i denne statusen.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.sessions.map((session) => (
                    <article
                      key={session.id}
                      className="group rounded-xl border border-slate-700 bg-slate-950/70 p-4 shadow-sm shadow-slate-950/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-2">
                          <h3 className="line-clamp-2 text-base font-semibold text-white">{session.title}</h3>
                          <p className="text-xs uppercase tracking-wide text-slate-400">Kode: {session.code}</p>
                        </div>
                        {confirmDelete === session.code ? (
                          <span className="text-xs text-rose-400">
                            Slett?{' '}
                            <button onClick={() => void doDelete(session.code)} className="underline hover:text-rose-300">
                              Ja
                            </button>{' '}
                            ·{' '}
                            <button onClick={() => setConfirmDelete(null)} className="underline hover:text-slate-200">
                              Nei
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => startDeleteConfirmation(session.code)}
                            className="rounded-lg p-1.5 text-white/30 opacity-0 transition-opacity hover:bg-white/10 hover:text-rose-400 group-hover:opacity-100 disabled:cursor-not-allowed disabled:text-white/20 disabled:hover:bg-transparent disabled:hover:text-white/20"
                            title={session.status === 'active' ? 'Avslutt sesjonen før sletting' : 'Slett sesjon'}
                            disabled={session.status === 'active'}
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}
                      </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-indigo-400/40 bg-indigo-500/15 px-2.5 py-1 text-indigo-100">
                        {modeLabels[session.mode]}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 ${statusBadgeStyles[session.status]}`}>
                        {statusLabels[session.status]}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-slate-400">
                      Opprettet:{' '}
                      {new Intl.DateTimeFormat('nb-NO', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(session.createdAt))}
                    </p>

                    <div className="mt-4 flex gap-4 text-sm">
                      <Link href={`/admin/${session.code}`} className="font-medium text-sky-300 transition hover:text-sky-100">
                        Admin →
                      </Link>
                      <Link href={`/delta/${session.code}`} className="font-medium text-slate-200 transition hover:text-white">
                        Delta →
                      </Link>
                    </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
