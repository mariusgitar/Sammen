'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

        <form className="space-y-3" onSubmit={handleSubmit}>
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
            className="w-full rounded-xl border-2 border-[#e2e8f0] p-4 text-center text-2xl font-bold uppercase tracking-widest text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#3b5bdb] focus:outline-none focus:ring-0"
          />
          {error ? <p className="text-sm text-amber-500">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-full bg-[#0f172a] py-4 text-lg font-semibold text-white transition hover:bg-[#1e293b]"
          >
            Bli med →
          </button>
        </form>

        <p className="text-xs text-[#94a3b8]">
          Fasilitator? <Link href="/logg-inn">Logg inn</Link>
        </p>
      </section>
    </main>
  );
}
