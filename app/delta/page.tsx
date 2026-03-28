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
    <main className="flex min-h-screen items-center justify-center bg-[#ffffff] px-4">
      <section className="w-full max-w-sm space-y-8">
        <p className="text-2xl font-bold text-[#0f172a]">●&nbsp;&nbsp;Sammen</p>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-[#0f172a]">Skriv inn koden for å bli med</h1>
          <p className="text-sm text-[#64748b]">Koden finner du på skjermen foran deg</p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={code}
            maxLength={6}
            placeholder="f.eks. KSBZGV"
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              if (error) {
                setError('');
              }
            }}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#3b5bdb] transition-colors text-sm text-center font-bold uppercase tracking-widest"
          />
          {error ? <p className="text-sm text-amber-500">{error}</p> : null}

          <button
            type="button"
            onClick={handleJoin}
            className="w-full rounded-full bg-[#0f172a] text-white px-6 py-3 font-semibold hover:bg-[#1e293b] transition-colors"
          >
            Bli med →
          </button>
        </div>
      </section>
    </main>
  );
}
