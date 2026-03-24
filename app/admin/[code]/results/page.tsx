import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { items, responses, sessions } from '@/db/schema';

import { ExportButton } from './ExportButton';
import { KartleggingResults } from './KartleggingResults';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ResultsPageProps = {
  params: {
    code: string;
  };
};

type VoteDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

export default async function ResultsPage({ params }: ResultsPageProps) {
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
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.code, code))
    .limit(1);

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold">Sesjon ikke funnet</h1>
          <p className="mt-2 text-sm text-slate-600">Kontroller koden og prøv igjen.</p>
          <Link href="/" className="mt-4 inline-flex text-sm font-medium text-slate-700 underline">
            Tilbake til oversikt
          </Link>
        </div>
      </main>
    );
  }

  const allItems = await db
    .select({
      id: items.id,
      text: items.text,
      isNew: items.isNew,
      createdBy: items.createdBy,
      excluded: items.excluded,
      orderIndex: items.orderIndex,
      createdAt: items.createdAt,
    })
    .from(items)
    .where(eq(items.sessionId, session.id))
    .orderBy(asc(items.orderIndex), asc(items.createdAt));

  const allResponses = await db
    .select({
      itemId: responses.itemId,
      participantId: responses.participantId,
      value: responses.value,
    })
    .from(responses)
    .where(eq(responses.sessionId, session.id));

  const includedItems = allItems.filter((item) => !item.excluded);

  const numericResponses = allResponses.filter((entry) => {
    const vote = Number(entry.value);
    return Number.isInteger(vote) && vote >= 1 && vote <= 5;
  });

  const mappingResponses = allResponses.filter((entry) => {
    const vote = Number(entry.value);
    return !Number.isInteger(vote) || vote < 1 || vote > 5;
  });

  const hasKartlegging = session.mode === 'kartlegging';
  const hasStemming = numericResponses.length > 0;

  const mappingParticipantCount = Math.max(
    new Set(mappingResponses.map((entry) => entry.participantId)).size,
    new Set(allResponses.map((entry) => entry.participantId)).size,
  );

  const votesByItem = new Map<string, number[]>();
  for (const response of numericResponses) {
    const current = votesByItem.get(response.itemId) ?? [];
    current.push(Number(response.value));
    votesByItem.set(response.itemId, current);
  }

  const voteItems = includedItems
    .map((item) => {
      const votes = votesByItem.get(item.id) ?? [];
      const distribution: VoteDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

      for (const vote of votes) {
        distribution[String(vote) as keyof VoteDistribution] += 1;
      }

      const voteCount = votes.length;
      const averageScore = voteCount > 0 ? votes.reduce((sum, value) => sum + value, 0) / voteCount : 0;

      return {
        id: item.id,
        text: item.text,
        averageScore,
        voteCount,
        distribution,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/admin/${session.code}`} className="inline-flex text-sm font-medium text-slate-700 underline print:hidden">
            ← Tilbake til admin
          </Link>
          <ExportButton
            session={{
              title: session.title,
              code: session.code,
              mode: session.mode,
              phase: session.phase,
              created_at: session.createdAt,
            }}
            items={allItems.map((item) => ({
              id: item.id,
              text: item.text,
              is_new: item.isNew,
              created_by: item.createdBy,
              excluded: item.excluded,
            }))}
            responses={allResponses.map((entry) => ({
              item_id: entry.itemId,
              participant_id: entry.participantId,
              value: entry.value,
            }))}
            tags={session.tags}
          />
        </div>

        <header className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-3xl font-semibold tracking-tight">{session.title} — Resultater</h1>
          <p className="mt-2 text-sm text-slate-600">Sesjonskode: {session.code}</p>
        </header>

        {hasKartlegging ? (
          <KartleggingResults
            items={allItems.map((item) => ({
              id: item.id,
              text: item.text,
              excluded: item.excluded,
            }))}
            responses={mappingResponses.map((entry) => ({
              itemId: entry.itemId,
              value: entry.value,
            }))}
            tags={session.tags}
            participantCount={mappingParticipantCount}
          />
        ) : null}

        {hasStemming ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Stemming-resultater</h2>

            <div className="mt-4 space-y-4">
              {voteItems.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-medium">{item.text}</p>
                  <p className="mt-2 text-sm text-slate-700">
                    Snittscore: <span className="font-semibold text-slate-900">{item.averageScore.toFixed(1)}</span>
                  </p>
                  <p className="text-sm text-slate-700">Antall stemmer: {item.voteCount}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    1▪{item.distribution['1']} &nbsp; 2▪{item.distribution['2']} &nbsp; 3▪{item.distribution['3']} &nbsp;
                    4▪{item.distribution['4']} &nbsp; 5▪{item.distribution['5']}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
