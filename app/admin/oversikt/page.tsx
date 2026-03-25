import Link from 'next/link';
import { desc } from 'drizzle-orm';

import { getDb } from '@/db';
import { sessions, type SessionMode, type SessionStatus } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const modeLabels: Record<SessionMode, string> = {
  kartlegging: 'Kartlegging',
  stemming: 'Stemming',
  'aapne-innspill': 'Åpne innspill',
  rangering: 'Rangering',
};

const statusLabels: Record<SessionStatus, string> = {
  setup: 'Oppsett',
  active: 'Aktiv',
  paused: 'Pauset',
  closed: 'Lukket',
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

export default async function AdminOverviewPage() {
  const db = getDb();

  const allSessions = await db
    .select({
      id: sessions.id,
      code: sessions.code,
      title: sessions.title,
      mode: sessions.mode,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .orderBy(desc(sessions.createdAt));

  const groupedSessions = statusOrder.map((status) => ({
    status,
    sessions: allSessions.filter((session) => session.status === status),
  }));

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

        {groupedSessions.map((group) => (
          <section key={group.status} className={`rounded-2xl border p-4 sm:p-5 ${statusSectionStyles[group.status]}`}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">{statusLabels[group.status]}</h2>
              <span className="text-xs text-slate-300">{group.sessions.length} sesjoner</span>
            </div>

            {group.sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                Ingen sesjoner i denne statusen.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.sessions.map((session) => (
                  <article key={session.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 shadow-sm shadow-slate-950/30">
                    <div className="space-y-2">
                      <h3 className="line-clamp-2 text-base font-semibold text-white">{session.title}</h3>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Kode: {session.code}</p>
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
                      }).format(session.createdAt)}
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
          </section>
        ))}
      </div>
    </main>
  );
}
