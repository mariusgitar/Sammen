import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, sessions } from '@/db/schema';

import { KartleggingView } from './KartleggingView';

type ParticipantPageProps = {
  params: {
    code: string;
  };
};

export default async function ParticipantPage({ params }: ParticipantPageProps) {
  const db = getDb();
  const code = params.code.toUpperCase();

  const [session] = await db
    .select({
      id: sessions.id,
      code: sessions.code,
      title: sessions.title,
      mode: sessions.mode,
      status: sessions.status,
      tags: sessions.tags,
      allowNewItems: sessions.allowNewItems,
    })
    .from(sessions)
    .where(eq(sessions.code, code))
    .limit(1);

  if (!session) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sesjon ikke funnet</h1>
        </div>
      </main>
    );
  }

  if (session.status !== 'active') {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sesjonen er ikke åpen ennå.</h1>
          <p className="mt-2 text-sm text-slate-300">Vent på fasilitator.</p>
        </div>
      </main>
    );
  }

  const sessionItems = await db
    .select({
      id: items.id,
      text: items.text,
      isNew: items.isNew,
      orderIndex: items.orderIndex,
    })
    .from(items)
    .where(eq(items.sessionId, session.id))
    .orderBy(asc(items.orderIndex), asc(items.createdAt));

  return (
    <KartleggingView
      items={sessionItems}
      session={{
        id: session.id,
        title: session.title,
        tags: session.tags,
        allowNewItems: session.allowNewItems,
      }}
    />
  );
}
