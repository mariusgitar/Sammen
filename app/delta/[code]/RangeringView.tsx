'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type RangeringViewProps = {
  session: {
    id: string;
    code: string;
    title: string;
    maxRankItems: number | null;
  };
  items: Array<{
    id: string;
    text: string;
  }>;
};

type RankedItem = {
  id: string;
  text: string;
};

function SortableRankItem({ item, index }: { item: RankedItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-4 ${
        isDragging ? 'scale-105 shadow-lg shadow-slate-950/60' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="min-w-8 text-3xl font-semibold text-slate-500">{index + 1}</span>
        <p className="flex-1 text-slate-100">{item.text}</p>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="rounded border border-slate-700 px-2 py-1 text-lg leading-none text-slate-300"
          aria-label={`Dra for å flytte ${item.text}`}
        >
          ≡
        </button>
      </div>
    </article>
  );
}

export function RangeringView({ session, items }: RangeringViewProps) {
  const [nickname, setNickname] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [participantId, setParticipantId] = useState('');
  const [rankedItems, setRankedItems] = useState<RankedItem[]>(items);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const participantStorageKey = 'samen_participant_id';
  const nicknameStorageKey = `samen_nickname_${session.code}`;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    const storedId = localStorage.getItem(participantStorageKey);
    const storedNick = localStorage.getItem(nicknameStorageKey);

    if (storedId) {
      setParticipantId(storedId);
    } else {
      const newId = crypto.randomUUID();
      localStorage.setItem(participantStorageKey, newId);
      setParticipantId(newId);
    }

    if (storedNick) {
      setNickname(storedNick);
      setHasJoined(true);
    }
  }, [nicknameStorageKey]);

  useEffect(() => {
    setRankedItems(items);
  }, [items]);

  const visibleRankedItems = useMemo(() => {
    if (session.maxRankItems && session.maxRankItems > 0) {
      return rankedItems.slice(0, session.maxRankItems);
    }

    return rankedItems;
  }, [rankedItems, session.maxRankItems]);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nickname.trim()) {
      return;
    }

    localStorage.setItem(nicknameStorageKey, nickname.trim());
    localStorage.setItem(participantStorageKey, participantId);
    setHasJoined(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setRankedItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);

      if (oldIndex < 0 || newIndex < 0) {
        return current;
      }

      return arrayMove(current, oldIndex, newIndex);
    });
  }

  async function submitRanking() {
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          participantId,
          nickname: nickname.trim(),
          responses: visibleRankedItems.map((item, index) => ({
            itemId: item.id,
            value: String(index + 1),
          })),
        }),
      });

      const data = (await response.json()) as { ok: true } | { error: string };

      if (!response.ok || !('ok' in data)) {
        setError('Kunne ikke sende inn rangeringen. Prøv igjen.');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Kunne ikke sende inn rangeringen. Prøv igjen.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasJoined) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{session.title}</h1>
          </div>

          <form className="space-y-6" onSubmit={handleJoin}>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-100" htmlFor="nickname">
                Skriv inn kallenavnet ditt
              </label>
              <input
                required
                id="nickname"
                name="nickname"
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-50 outline-none transition focus:border-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={!nickname.trim()}
              className="w-full rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              Bli med
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Takk for din rangering, {nickname.trim()}!</h1>
          <Link
            href={`/delta/${session.code}/resultater`}
            className="mt-5 inline-flex rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white"
          >
            Se resultater →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-slate-950/20">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{session.title}</h1>
        <p className="mt-2 text-sm text-slate-300">Hei, {nickname.trim()}</p>

        {session.maxRankItems ? (
          <p className="mt-3 text-sm text-slate-200">
            Ranger de {session.maxRankItems} viktigste elementene ved å dra dem i ønsket rekkefølge.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-200">
            Ranger alle elementene ved å dra dem i ønsket rekkefølge. Øverst = viktigst.
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleRankedItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-6 space-y-3">
              {visibleRankedItems.map((item, index) => (
                <SortableRankItem key={item.id} item={item} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={submitRanking}
          disabled={submitting}
          className="mt-6 w-full rounded bg-slate-100 px-4 py-2 font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Sender…' : 'Send inn rangering'}
        </button>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </div>
    </main>
  );
}
