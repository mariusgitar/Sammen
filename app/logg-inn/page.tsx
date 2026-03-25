'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        window.location.assign('/');
        return;
      }

      if (response.status === 401) {
        setError('Feil passord. Prøv igjen.');
        return;
      }

      setError('Noe gikk galt. Prøv igjen.');
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ffffff] px-4">
      <section className="w-full max-w-sm space-y-8">
        <p className="text-2xl font-bold text-[#0f172a]">●&nbsp;&nbsp;Sammen</p>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-[#0f172a]">Logg inn som fasilitator</h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border-2 border-[#e2e8f0] p-4 text-center text-2xl font-bold tracking-wide text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#3b5bdb] focus:outline-none focus:ring-0"
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#0f172a] py-4 text-lg font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Logger inn...' : 'Logg inn'}
          </button>

          {error ? <p className="text-sm text-amber-500">{error}</p> : null}
        </form>

        <Link href="/" className="text-sm text-[#64748b]">
          ← Tilbake
        </Link>
      </section>
    </main>
  );
}
