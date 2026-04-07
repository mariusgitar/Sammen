import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, sessions } from '@/db/schema';

import { AdminPanel } from './AdminPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AdminPageProps = {
  params: {
    code: string;
  };
};

export default async function AdminSessionPage({ params }: AdminPageProps) {
  const db = getDb();
  const code = params.code.toUpperCase();

  const [session] = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      code: sessions.code,
      mode: sessions.mode,
      phase: sessions.phase,
      status: sessions.status,
      resultsVisible: sessions.resultsVisible,
      showOthersInnspill: sessions.showOthersInnspill,
      tags: sessions.tags,
      timerEndsAt: sessions.timerEndsAt,
      timerLabel: sessions.timerLabel,
    })
    .from(sessions)
    .where(eq(sessions.code, code))
    .limit(1);

  if (!session) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sesjon ikke funnet</h1>
          <p className="mt-2 text-sm text-slate-300">Kontroller koden og prøv igjen.</p>
        </div>
      </main>
    );
  }

  const sessionItems = await db
    .select({
      id: items.id,
      text: items.text,
      description: items.description,
      isNew: items.isNew,
      excluded: items.excluded,
      createdBy: items.createdBy,
      isQuestion: items.isQuestion,
      questionStatus: items.questionStatus,
      finalTag: items.finalTag,
    })
    .from(items)
    .where(eq(items.sessionId, session.id))
    .orderBy(asc(items.orderIndex), asc(items.createdAt));

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <Link href="/admin/oversikt" className="mb-4 inline-flex text-sm font-medium text-slate-300 transition hover:text-slate-100">
          ← Tilbake til oversikt
        </Link>
        <AdminPanel session={session} items={sessionItems} />
      </div>
    </main>
  );
}
