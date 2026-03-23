const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

type AdminPageProps = {
  params: {
    code: string;
  };
};

type SessionPayload = {
  session: {
    title: string;
    code: string;
    mode: string;
    status: string;
  };
  items: Array<{
    id: string;
    text: string;
  }>;
};

async function getSession(code: string) {
  const response = await fetch(`${baseUrl}/api/sessions/${code}`, {
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch session');
  }

  return (await response.json()) as SessionPayload;
}

export default async function AdminSessionPage({ params }: AdminPageProps) {
  const data = await getSession(params.code);

  if (!data) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sesjon ikke funnet</h1>
          <p className="mt-2 text-sm text-slate-300">Kontroller koden og prøv igjen.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-lg space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{data.session.title}</h1>
          <p className="mt-2 text-sm text-slate-300">Dette er en enkel admin-visning for å bekrefte at sesjonen ble lagret.</p>
        </div>

        <dl className="space-y-3 text-sm text-slate-200">
          <div>
            <dt className="font-medium text-slate-400">Kode</dt>
            <dd>{data.session.code}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-400">Modus</dt>
            <dd>{data.session.mode}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-400">Status</dt>
            <dd>{data.session.status}</dd>
          </div>
        </dl>

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Elementer</h2>
          {data.items.length > 0 ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-100">
              {data.items.map((item) => (
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
