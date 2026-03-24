import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, sessions } from '@/db/schema';

import { KartleggingView } from './KartleggingView';
import { StemmingView } from './StemmingView';

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
      phase: sessions.phase,
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

  const itemFilter =
    session.phase === 'stemming'
      ? and(eq(items.sessionId, session.id), eq(items.excluded, false))
      : eq(items.sessionId, session.id);

  const sessionItems = await db
    .select({
      id: items.id,
      text: items.text,
      isNew: items.isNew,
      excluded: items.excluded,
      orderIndex: items.orderIndex,
    })
    .from(items)
    .where(itemFilter)
    .orderBy(asc(items.orderIndex), asc(items.createdAt));

  if (session.phase === 'stemming' && session.status === 'active') {
    return (
      <StemmingView
        items={sessionItems.map((item) => ({ id: item.id, text: item.text }))}
        session={{
          id: session.id,
          title: session.title,
        }}
      />
    );
  }

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
