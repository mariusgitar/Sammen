'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ParticipantEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function handleJoin() {
    const normalizedCode = code.trim().toUpperCase();

    if (normalizedCode.length < 3) {
      setError('Skriv inn en gyldig kode');
      return;
    }

    setError('');
    router.push(`/delta/${normalizedCode}`);
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Bli med i en sesjon</h1>

        <div className="mt-5 space-y-3">
          <input
            type="text"
            value={code}
            maxLength={6}
            placeholder="Sesjonskode (f.eks. KSBZGV)"
            onChange={(event) => {
              setCode(event.target.value);
              if (error) {
                setError('');
              }
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="button"
            onClick={handleJoin}
            className="inline-flex items-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white disabled:opacity-50"
          >
            Bli med →
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-400">Få koden av din fasilitator</p>
      </div>
    </main>
  );
}
