import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, sessions } from '@/db/schema';

type AdminPageProps = {
  params: {
    code: string;
  };
};

export default async function AdminSessionPage({ params }: AdminPageProps) {
  const db = getDb();
  const [session] = await db.select().from(sessions).where(eq(sessions.code, params.code)).limit(1);

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

  const sessionItems = await db.select().from(items).where(eq(items.sessionId, session.id));

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-lg space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{session.title}</h1>
          <p className="mt-2 text-sm text-slate-300">Dette er en enkel admin-visning for å bekrefte at sesjonen ble lagret.</p>
        </div>

        <dl className="space-y-3 text-sm text-slate-200">
          <div>
            <dt className="font-medium text-slate-400">Kode</dt>
            <dd>{session.code}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-400">Modus</dt>
            <dd>{session.mode}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-400">Status</dt>
            <dd>{session.status}</dd>
          </div>
        </dl>

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Elementer</h2>
          {sessionItems.length > 0 ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-100">
              {sessionItems.map((item) => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-300">Ingen elementer registrert.</p>
          )}
        </section>
      </div>
    </main>
  );
}
