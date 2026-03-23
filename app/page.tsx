'use client';

import { useEffect, useState } from 'react';

type HealthResponse =
  | { ok: true }
  | { ok: false; error: string };

export default function HomePage() {
  const [status, setStatus] = useState('Sjekker database...');

  useEffect(() => {
    async function checkDatabase() {
      try {
        const response = await fetch('/api/health');
        const data = (await response.json()) as HealthResponse;

        if (data.ok) {
          setStatus('Database tilkoblet ✓');
          return;
        }

        setStatus(`Feil: ${data.error}`);
      } catch (error) {
        setStatus(error instanceof Error ? `Feil: ${error.message}` : 'Feil: Ukjent feil');
      }
    }

    void checkDatabase();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/70 p-10 shadow-2xl shadow-slate-950/30">
        <h1 className="text-4xl font-semibold tracking-tight">Sammen</h1>
        <p className="mt-4 text-base text-slate-300">{status}</p>
      </div>
    </main>
  );
}
