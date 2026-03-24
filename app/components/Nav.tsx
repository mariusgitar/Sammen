import Link from 'next/link';

export function Nav() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/95 px-6 py-4">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-100 transition hover:text-white">
          Sammen
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/delta" className="text-sm font-medium text-slate-200 transition hover:text-white">
            Bli med
          </Link>
          <Link
            href="/ny"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Ny sesjon
          </Link>
        </div>
      </div>
    </header>
  );
}
