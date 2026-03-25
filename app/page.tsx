import Link from 'next/link';
import { desc } from 'drizzle-orm';

import { getDb } from '@/db';
import { sessions, type SessionPhase, type SessionStatus } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const sessionStatusOrder: SessionStatus[] = ['active', 'setup', 'paused', 'closed'];

const sessionStatusLabel: Record<SessionStatus, string> = {
  setup: 'Setup',
  active: 'Aktiv',
  paused: 'Pauset',
  closed: 'Lukket',
};

const sessionStatusClassName: Record<SessionStatus, string> = {
  setup: 'bg-slate-700/70 text-slate-200',
  active: 'bg-emerald-500/20 text-emerald-300',
  paused: 'bg-amber-500/20 text-amber-300',
  closed: 'bg-slate-800 text-slate-400',
};

const getModeBadgeLabel = (mode: 'kartlegging' | 'stemming' | 'aapne-innspill' | 'rangering', phase: SessionPhase) => {
  if (mode === 'stemming') {
    return 'Stemming';
  }

  if (mode === 'aapne-innspill') {
    return 'Åpne innspill';
  }

  if (mode === 'rangering') {
    return 'Rangering';
  }

  if (phase === 'stemming') {
    return 'Kartlegging → Stemming';
  }

  return 'Kartlegging';
};

const norwegianDateFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export default async function HomePage() {
  const db = getDb();

  const allSessions = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      code: sessions.code,
      mode: sessions.mode,
      phase: sessions.phase,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .orderBy(desc(sessions.createdAt));

  const groupedSessions = sessionStatusOrder.flatMap((status) =>
    allSessions.filter((session) => session.status === status),
  );

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <section className="space-y-5">
          <h1 className="text-5xl font-semibold tracking-tight text-white">Sammen</h1>
          <p className="text-lg text-slate-300">Verktøy for workshop-fasilitatorer</p>
          <Link
            href="/ny"
            className="inline-flex items-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white"
          >
            Opprett ny sesjon
          </Link>
        </section>

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Sesjoner</h2>

          {groupedSessions.length > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {groupedSessions.map((session) => (
                <article
                  key={session.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-slate-950/20"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold tracking-tight text-white">{session.title}</h3>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                      {getModeBadgeLabel(session.mode, session.phase)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${sessionStatusClassName[session.status]}`}
                    >
                      {sessionStatusLabel[session.status]}
                    </span>
                  </div>

                  <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-slate-500">{session.code}</p>
                  <p className="mt-3 text-sm text-slate-400">
                    Opprettet {norwegianDateFormatter.format(new Date(session.createdAt))}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    <Link href={`/admin/${session.code}`} className="font-medium text-slate-100 transition hover:text-white">
                      Admin →
                    </Link>
                    <Link href={`/delta/${session.code}`} className="font-medium text-slate-300 transition hover:text-slate-100">
                      Delta →
                    </Link>
                    {session.status === 'closed' ? (
                      <Link
                        href={`/admin/${session.code}/results`}
                        className="font-medium text-slate-300 transition hover:text-slate-100"
                      >
                        Se resultater →
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300 shadow-xl shadow-slate-950/20">
              Ingen sesjoner ennå. Opprett din første sesjon.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
