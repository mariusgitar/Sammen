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
      className={`rounded-2xl border border-[#e2e8f0] bg-white px-4 py-4 shadow-sm ${
        isDragging ? 'scale-105 border-[#3b5bdb] shadow-md' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="min-w-8 text-3xl font-semibold text-[#94a3b8]">{index + 1}</span>
        <p className="flex-1 text-[#0f172a]">{item.text}</p>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="rounded-full border border-[#e2e8f0] px-2 py-1 text-lg leading-none text-[#94a3b8]"
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
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#0f172a]">{session.title}</h1>
          </div>

          <form className="space-y-6" onSubmit={handleJoin}>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#64748b]" htmlFor="nickname">
                Skriv inn kallenavnet ditt
              </label>
              <input
                required
                id="nickname"
                name="nickname"
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full rounded-xl border border-[#e2e8f0] bg-white p-3 text-[#0f172a] outline-none transition focus:border-[#3b5bdb]"
              />
            </div>

            <button
              type="submit"
              disabled={!nickname.trim()}
              className="w-full rounded-full bg-[#0f172a] px-4 py-3 font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-70"
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
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0f172a]">Takk for din rangering, {nickname.trim()}!</h1>
          <Link
            href={`/delta/${session.code}/resultater`}
            className="mt-5 inline-flex rounded-full bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e293b]"
          >
            Se resultater →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#0f172a]">{session.title}</h1>
        <p className="mt-2 text-sm text-[#64748b]">Hei, {nickname.trim()}</p>

        {session.maxRankItems ? (
          <p className="mt-3 text-sm text-[#64748b]">
            Ranger de {session.maxRankItems} viktigste elementene ved å dra dem i ønsket rekkefølge.
          </p>
        ) : (
          <p className="mt-3 text-sm text-[#64748b]">
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
          className="mt-6 w-full rounded-full bg-[#0f172a] px-4 py-3 font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Sender…' : 'Send inn rangering'}
        </button>

        {error ? <p className="mt-3 text-sm text-amber-500">{error}</p> : null}
      </div>
    </main>
  );
}
