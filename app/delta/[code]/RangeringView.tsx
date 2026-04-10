'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { NormalizedSession } from '@/app/lib/normalizeSession';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type RangeringViewProps = {
  session: NormalizedSession;
  items: Array<{
    id: string;
    text: string;
    description: string | null;
  }>;
};

type RankedItem = {
  id: string;
  text: string;
  description: string | null;
};

function SortableRankItem({
  item,
  index,
  expanded,
  onToggleDescription,
}: {
  item: RankedItem;
  index: number;
  expanded: boolean;
  onToggleDescription: (itemId: string) => void;
}) {
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
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[#0f172a]">{item.text}</p>
            {item.description?.trim() ? (
              <button
                type="button"
                onClick={() => onToggleDescription(item.id)}
                className="text-sm text-slate-500 transition hover:text-slate-700"
                aria-expanded={expanded}
                aria-label={`Vis beskrivelse for ${item.text}`}
              >
                {expanded ? '▼' : 'ℹ️'}
              </button>
            ) : null}
          </div>
          {item.description?.trim() && expanded ? <p className="mt-1 text-sm text-slate-500">{item.description}</p> : null}
        </div>
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
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

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

  // Phase transitions are detected by the parent page poll — no secondary poll needed here.

  const visibleRankedItems = useMemo(() => {
    if (session.maxRankItems && session.maxRankItems > 0) {
      return rankedItems.slice(0, session.maxRankItems);
    }

    return rankedItems;
  }, [rankedItems, session.maxRankItems]);

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      return;
    }

    localStorage.setItem(nicknameStorageKey, trimmedNickname);
    localStorage.setItem(participantStorageKey, participantId);

    try {
      await fetch(`/api/delta/${session.code}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId,
          nickname: trimmedNickname,
        }),
      });
    } catch {
      // noop
    }

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

  function toggleDescription(itemId: string) {
    setExpandedDescriptions((current) => ({ ...current, [itemId]: !current[itemId] }));
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
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#0f172a]">{session.title}</h1>
          </div>

          <form className="space-y-6" onSubmit={handleJoin}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 mb-1.5 block" htmlFor="nickname">
                Skriv inn kallenavnet ditt
              </label>
              <input
                required
                id="nickname"
                name="nickname"
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#3b5bdb] transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={!nickname.trim()}
              className="w-full bg-[#0f172a] text-white rounded-full px-6 py-3 font-semibold hover:bg-[#1e293b] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
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
      <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-bold text-[#0f172a]">Takk for dine svar, {nickname.trim()}!</h2>
            <p className="text-slate-500">Vent på fasilitator for neste steg.</p>
            <a
              href={`/delta/${session.code}/resultater`}
              className="mt-4 inline-block rounded-full bg-[#0f172a] px-6 py-3 text-sm font-medium text-white"
            >
              Se resultater →
            </a>
            <p className="text-xs text-slate-400">Resultater vises når fasilitator åpner dem</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 pb-16 sm:px-6">
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
                <SortableRankItem
                  key={item.id}
                  item={item}
                  index={index}
                  expanded={expandedDescriptions[item.id] ?? false}
                  onToggleDescription={toggleDescription}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={submitRanking}
          disabled={submitting}
          className="mt-6 w-full bg-[#0f172a] text-white rounded-full px-6 py-3 font-semibold hover:bg-[#1e293b] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Sender…' : 'Send inn rangering'}
        </button>

        {error ? <p className="mt-3 text-sm text-amber-500">{error}</p> : null}
      </div>
    </main>
  );
}
