"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ToggleButton from "@/app/components/ui/ToggleButton";
import StyledSelect from "@/app/components/ui/StyledSelect";
import type {
  InnspillMode,
  SessionMode,
  VisibilityMode,
  VotingType,
} from "@/db/schema";

type NewSessionMode = SessionMode | "innspill+stemming";

type CreateSessionResponse =
  | {
      session: {
        code: string;
      };
    }
  | {
      error: string;
    };

type KartleggingItemDraft = {
  id: string;
  name: string;
  tag: string | null;
  description: string | null;
  showDescription: boolean;
};

function createDraftItem(): KartleggingItemDraft {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name: "",
    tag: null,
    description: null,
    showDescription: false,
  };
}

const modeCards: Array<{
  value: NewSessionMode;
  icon: string;
  title: string;
  description: string;
  badge?: string;
}> = [
  {
    value: "innspill+stemming",
    icon: "💬",
    title: "Innspill + Stemming",
    description: "Anbefalt",
    badge: "Anbefalt",
  },
  {
    value: "stemming",
    icon: "🗳️",
    title: "Stemming på liste",
    description: "Vurder ferdige elementer",
  },
  {
    value: "kartlegging",
    icon: "🗂️",
    title: "Kartlegging med tags",
    description: "Sorter forslag med kategorier",
  },
  {
    value: "rangering",
    icon: "📊",
    title: "Rangering",
    description: "Prioriter toppvalg",
  },
];

const dotBudgetOptions = [
  { value: "3", label: "3" },
  { value: "5", label: "5 (standard)" },
  { value: "7", label: "7" },
  { value: "10", label: "10" },
];

const innspillMaxCharsOptions = [
  { value: "60", label: "60 tegn" },
  { value: "100", label: "100 tegn (standard)" },
  { value: "200", label: "200 tegn" },
];

const maxRankItemsOptions = [
  { value: "all", label: "Alle" },
  { value: "3", label: "3" },
  { value: "5", label: "5" },
  { value: "10", label: "10" },
];

const defaults = {
  visibilityMode: "all" as VisibilityMode,
  showOthersInnspill: true,
  innspillMode: "enkel" as InnspillMode,
  innspillMaxChars: 100,
  votingType: "dots" as VotingType,
  allowMultipleDots: true,
  dotBudget: 5,
  allowNewItems: true,
  maxRankItemsInput: "all",
};

export default function NewSessionPage() {
  const router = useRouter();
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<NewSessionMode>("innspill+stemming");
  const [items, setItems] = useState("");
  const [kartleggingItems, setKartleggingItems] = useState<KartleggingItemDraft[]>([createDraftItem()]);
  const [invalidKartleggingItemIds, setInvalidKartleggingItemIds] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [tags, setTags] = useState("");

  const [allowNewItems, setAllowNewItems] = useState(defaults.allowNewItems);
  const [maxRankItemsInput, setMaxRankItemsInput] = useState(
    defaults.maxRankItemsInput,
  );
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>(
    defaults.visibilityMode,
  );
  const [votingType, setVotingType] = useState<VotingType>(defaults.votingType);
  const [dotBudget, setDotBudget] = useState(defaults.dotBudget);
  const [allowMultipleDots, setAllowMultipleDots] = useState(
    defaults.allowMultipleDots,
  );
  const [showOthersInnspill, setShowOthersInnspill] = useState(
    defaults.showOthersInnspill,
  );
  const [innspillMode, setInnspillMode] = useState<InnspillMode>(
    defaults.innspillMode,
  );
  const [innspillMaxChars, setInnspillMaxChars] = useState(
    defaults.innspillMaxChars,
  );

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedReady, setAdvancedReady] = useState(false);

  const [error, setError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [itemsError, setItemsError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isInnspillMode = mode === "aapne-innspill" || mode === "innspill+stemming";
  const hasStemming = mode === "stemming" || mode === "innspill+stemming";
  const isKartlegging = mode === "kartlegging";
  const isRangering = mode === "rangering";

  useEffect(() => {
    const stored = localStorage.getItem("sammen_ny_advanced_open");
    setAdvancedOpen(stored === "true");
    setAdvancedReady(true);
  }, []);

  useEffect(() => {
    if (!advancedReady) {
      return;
    }

    localStorage.setItem("sammen_ny_advanced_open", advancedOpen ? "true" : "false");
  }, [advancedOpen, advancedReady]);

  const advancedChanges = useMemo(() => {
    let changes = 0;

    if (isInnspillMode) {
      if (visibilityMode !== defaults.visibilityMode) {
        changes += 1;
      }

      if (showOthersInnspill !== defaults.showOthersInnspill) {
        changes += 1;
      }

      if (innspillMode !== defaults.innspillMode) {
        changes += 1;
      }

      if (innspillMaxChars !== defaults.innspillMaxChars) {
        changes += 1;
      }
    }

    if (hasStemming) {
      if (votingType !== defaults.votingType) {
        changes += 1;
      }

      if (votingType === "dots") {
        if (allowMultipleDots !== defaults.allowMultipleDots) {
          changes += 1;
        }

        if (dotBudget !== defaults.dotBudget) {
          changes += 1;
        }
      }
    }

    if (isKartlegging && allowNewItems !== defaults.allowNewItems) {
      changes += 1;
    }

    if (isRangering && maxRankItemsInput !== defaults.maxRankItemsInput) {
      changes += 1;
    }

    return changes;
  }, [
    allowMultipleDots,
    allowNewItems,
    dotBudget,
    hasStemming,
    innspillMaxChars,
    innspillMode,
    isInnspillMode,
    isKartlegging,
    isRangering,
    maxRankItemsInput,
    showOthersInnspill,
    visibilityMode,
    votingType,
  ]);

  const parsedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .filter((tag, index, allTags) => {
          const normalizedTag = tag.toLowerCase();
          return allTags.findIndex((candidate) => candidate.toLowerCase() === normalizedTag) === index;
        }),
    [tags],
  );

  const availableTags = useMemo(
    () =>
      [...parsedTags, ...kartleggingItems.map((item) => item.tag).filter((tag): tag is string => Boolean(tag))]
        .map((tag) => tag.trim())
        .filter(Boolean)
        .filter((tag, index, allTags) => {
          const normalizedTag = tag.toLowerCase();
          return allTags.findIndex((candidate) => candidate.toLowerCase() === normalizedTag) === index;
        }),
    [kartleggingItems, parsedTags],
  );

  useEffect(() => {
    const usedTags = kartleggingItems
      .map((item) => item.tag)
      .filter((tag): tag is string => Boolean(tag))
      .filter(
        (tag, index, allTags) =>
          allTags.findIndex((candidate) => candidate.toLowerCase().trim() === tag.toLowerCase().trim()) === index,
      )
      .map((tag) => tag.trim());

    if (usedTags.length > 0) {
      setTags(usedTags.join(", "));
    }
  }, [kartleggingItems]);

  function updateKartleggingItem(
    itemId: string,
    updates: Partial<Pick<KartleggingItemDraft, "name" | "tag" | "description" | "showDescription">>,
  ) {
    setKartleggingItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  }

  function importFromText() {
    const tagMap = new Map(parsedTags.map((tag) => [tag.toLowerCase(), tag]));
    const parsedElements = importText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(";").map((value) => value.trim());
        const name = parts[0] ?? "";

        if (!name.trim()) {
          return null;
        }

        const matchedTag = parts[1]
          ? (tagMap.get(parts[1].toLowerCase()) ?? parts[1].trim() ?? null)
          : null;
        const description = parts.slice(2).join(";").trim() || null;

        return {
          ...createDraftItem(),
          name,
          tag: matchedTag,
          description,
        };
      })
      .filter((entry): entry is KartleggingItemDraft => entry !== null);

    const importedTags = parsedElements
      .map((el) => el.tag)
      .filter(Boolean)
      .filter(
        (tag, i, arr) => arr.findIndex((t) => t.toLowerCase().trim() === tag.toLowerCase().trim()) === i,
      )
      .map((tag) => tag.trim());

    if (importedTags.length > 0) {
      const existingTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const allTags = [...new Set([...existingTags, ...importedTags])];
      setTags(allTags.join(", "));
    }

    setKartleggingItems((current) => [...current, ...parsedElements]);
    setInvalidKartleggingItemIds([]);
    setImportText("");
    setImportOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTitleError("");
    setItemsError("");

    if (!title.trim()) {
      setTitleError("Tittel er påkrevd");
      titleInputRef.current?.focus();
      return;
    }

    const parsedItems = items
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const parsedKartleggingItems = kartleggingItems.map((item) => ({
      name: item.name.trim(),
      tag: item.tag,
      description: item.description?.trim() || null,
    }));

    if (isKartlegging) {
      const invalidIds = kartleggingItems.filter((item) => item.name.trim().length === 0).map((item) => item.id);

      if (invalidIds.length > 0) {
        setInvalidKartleggingItemIds(invalidIds);
        setItemsError("Fyll ut elementnavn for alle rader før lagring.");
        return;
      }
    }

    if ((isKartlegging ? parsedKartleggingItems : parsedItems).length === 0) {
      setItemsError(isInnspillMode ? "Legg til minst ett spørsmål" : "Legg til minst ett element");
      return;
    }

    const parsedMaxRankItems =
      isRangering && maxRankItemsInput !== "all" ? Number(maxRankItemsInput) : null;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          mode,
          voting_type: hasStemming ? votingType : "scale",
          dot_budget: hasStemming && votingType === "dots" ? dotBudget : 5,
          allow_multiple_dots:
            hasStemming && votingType === "dots" ? allowMultipleDots : true,
          visibility_mode: isInnspillMode ? visibilityMode : "manual",
          show_others_innspill: isInnspillMode ? showOthersInnspill : true,
          innspill_mode: isInnspillMode ? innspillMode : "enkel",
          innspill_max_chars: isInnspillMode ? innspillMaxChars : 100,
          max_rank_items: isRangering ? parsedMaxRankItems : null,
          items: isKartlegging ? parsedKartleggingItems : parsedItems,
          tags: isKartlegging ? parsedTags : [],
          allow_new_items: isKartlegging ? allowNewItems : true,
        }),
      });

      const data = (await response.json()) as CreateSessionResponse;

      if (!response.ok || !("session" in data)) {
        setError("error" in data ? data.error : "Kunne ikke opprette sesjonen.");
        return;
      }

      router.push(`/admin/${data.session.code}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Kunne ikke opprette sesjonen.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const contentLabel = isInnspillMode
    ? "Spørsmål / seksjoner"
    : isKartlegging
      ? "Elementer å kartlegge"
      : isRangering
        ? "Elementer å rangere"
        : "Elementer å stemme på";

  const contentPlaceholder = isInnspillMode
    ? "Én per linje — f.eks. 'Hva fungerer bra?'"
    : isKartlegging
      ? "Én per linje. Legg til ; og tagnavn for forhåndsvalg.\nValgfri beskrivelse: Elementnavn; tag; beskrivelse\nEks:\nKriterie 1; Kriterie; Kort forklaring\nKriterie 2; Kriterie\nNoe uklart"
      : isRangering
        ? "Én per linje. Valgfri beskrivelse: Elementnavn; tag; beskrivelse"
      : "Én per linje";

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Opprett ny sesjon</h1>
          <p className="text-sm text-slate-600">Start enkelt og åpne flere valg ved behov.</p>
        </header>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">1. Basics</h2>

            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="title">
                Sesjonstittel
              </label>
              <input
                ref={titleInputRef}
                id="title"
                name="title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="F.eks. 'Kriterieverksted mai 2026'"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-[#3b5bdb] focus:ring-2 focus:ring-[#3b5bdb]/20"
              />
              {titleError ? <p className="text-sm text-red-600">{titleError}</p> : null}
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-sm font-medium text-slate-700">Modus</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {modeCards.map((card) => {
                  const active = mode === card.value;

                  return (
                    <button
                      key={card.value}
                      type="button"
                      onClick={() => setMode(card.value)}
                      className={`relative rounded-2xl p-4 text-left transition ${
                        active
                          ? "border-2 border-[#3b5bdb] bg-[#eef2ff]"
                          : "border border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      {card.badge ? (
                        <span className="absolute right-3 top-3 rounded-full bg-[#3b5bdb] px-2 py-0.5 text-xs font-medium text-white">
                          {card.badge}
                        </span>
                      ) : null}
                      <p className="text-3xl" aria-hidden>
                        {card.icon}
                      </p>
                      <p className="mt-3 text-base font-semibold text-slate-900">{card.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{card.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">2. Innhold</h2>
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="items">
                {contentLabel}
              </label>
              {isKartlegging ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setImportOpen((current) => !current)}
                    className="text-sm font-medium text-[#3b5bdb] transition hover:text-[#2f4bc7]"
                  >
                    Importer fritekst ↓
                  </button>

                  {importOpen ? (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <textarea
                        value={importText}
                        onChange={(event) => setImportText(event.target.value)}
                        rows={5}
                        placeholder="Én per linje: Elementnavn; tag; beskrivelse"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#3b5bdb] focus:ring-2 focus:ring-[#3b5bdb]/20"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={importFromText}
                          className="rounded-lg bg-[#3b5bdb] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#2f4bc7]"
                        >
                          Importer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImportOpen(false);
                            setImportText("");
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                        >
                          Avbryt
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {kartleggingItems.map((item) => (
                      <div key={item.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={item.name}
                            onChange={(event) => {
                              updateKartleggingItem(item.id, { name: event.target.value });
                              setInvalidKartleggingItemIds((current) => current.filter((entry) => entry !== item.id));
                            }}
                            placeholder="Elementnavn..."
                            className={`min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#3b5bdb] focus:ring-2 focus:ring-[#3b5bdb]/20 ${
                              invalidKartleggingItemIds.includes(item.id) ? "border-red-500" : "border-slate-200"
                            }`}
                          />
                          <select
                            value={item.tag ?? ""}
                            onChange={(event) =>
                              updateKartleggingItem(item.id, { tag: event.target.value.length > 0 ? event.target.value : null })
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#3b5bdb] focus:ring-2 focus:ring-[#3b5bdb]/20"
                          >
                            <option value="">Ingen tag</option>
                            {availableTags.map((tag) => (
                              <option key={tag} value={tag}>
                                {tag}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => updateKartleggingItem(item.id, { showDescription: !item.showDescription })}
                            className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 transition hover:border-slate-300"
                            aria-label="Vis eller skjul beskrivelse"
                          >
                            ℹ️
                          </button>
                          <button
                            type="button"
                            onClick={() => setKartleggingItems((current) => current.filter((entry) => entry.id !== item.id))}
                            className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 transition hover:border-red-300 hover:text-red-600"
                            aria-label="Slett rad"
                          >
                            🗑️
                          </button>
                        </div>
                        {item.showDescription ? (
                          <textarea
                            value={item.description ?? ""}
                            onChange={(event) =>
                              updateKartleggingItem(item.id, { description: event.target.value.trim() || null })
                            }
                            placeholder="Valgfri beskrivelse..."
                            rows={3}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#3b5bdb] focus:ring-2 focus:ring-[#3b5bdb]/20"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setKartleggingItems((current) => [...current, createDraftItem()])}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                  >
                    + Legg til element
                  </button>
                </div>
              ) : (
                <textarea
                  id="items"
                  name="items"
                  value={items}
                  onChange={(event) => setItems(event.target.value)}
                  placeholder={contentPlaceholder}
                  rows={7}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#3b5bdb] focus:ring-2 focus:ring-[#3b5bdb]/20"
                />
              )}
              {isRangering ? <p className="text-xs text-slate-500">Valgfri beskrivelse: Elementnavn; tag; beskrivelse</p> : null}
              {itemsError ? <p className="text-sm text-red-600">{itemsError}</p> : null}
            </div>

            {isKartlegging ? (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="tags">
                  Tags (kommaseparert)
                </label>
                <input
                  id="tags"
                  name="tags"
                  type="text"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="F.eks. Flytt til behov, Fjern"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#3b5bdb] focus:ring-2 focus:ring-[#3b5bdb]/20"
                />
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setAdvancedOpen((current) => !current)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-lg font-semibold text-slate-900">
                ⚙️ Tilpasninger
                {advancedChanges > 0 ? ` · ${advancedChanges} endringer` : ""}
              </span>
              <span className={`text-slate-500 transition-transform ${advancedOpen ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>

            <div
              className={`transition-[max-height] duration-300 ${advancedOpen ? "mt-5 max-h-[2200px]" : "max-h-0"}`}
              style={{ overflow: advancedOpen ? "visible" : "hidden" }}
            >
              <div className="space-y-6 border-t border-slate-100 pt-5">
                {isInnspillMode ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Spørsmålssynlighet</p>
                      <ToggleButton
                        options={[
                          { value: "all", label: "Alle synlige" },
                          {
                            value: "manual",
                            label: "Manuell styring",
                            helper: "Manuell: du åpner spørsmål ett om gangen",
                          },
                        ]}
                        value={visibilityMode}
                        onChange={(value) => setVisibilityMode(value as VisibilityMode)}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Gruppetenk-beskyttelse</p>
                      <ToggleButton
                        options={[
                          { value: "on", label: "Av" },
                          {
                            value: "off",
                            label: "På",
                            helper: "På: deltakere ser ikke hverandres innspill",
                          },
                        ]}
                        value={showOthersInnspill ? "on" : "off"}
                        onChange={(value) => setShowOthersInnspill(value === "on")}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Innspill-format</p>
                      <ToggleButton
                        options={[
                          { value: "enkel", label: "Enkel" },
                          { value: "detaljert", label: "Med detaljer" },
                        ]}
                        value={innspillMode}
                        onChange={(value) => setInnspillMode(value as InnspillMode)}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Maks tegn per innspill</p>
                      <StyledSelect
                        options={innspillMaxCharsOptions}
                        value={String(innspillMaxChars)}
                        onChange={(value) => setInnspillMaxChars(Number(value))}
                      />
                    </div>
                  </div>
                ) : null}

                {hasStemming ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Stemmetype</p>
                      <ToggleButton
                        options={[
                          {
                            value: "dots",
                            label: "Dot voting ●●●",
                            helper:
                              "Deltakere fordeler prikker fritt — viser energi og prioritet",
                          },
                          {
                            value: "scale",
                            label: "Skala 1–5",
                            helper:
                              "Alle vurderer hvert element — viser konsensus og spredning",
                          },
                        ]}
                        value={votingType}
                        onChange={(value) => setVotingType(value as VotingType)}
                      />
                    </div>

                    {votingType === "dots" ? (
                      <>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-700">Dot voting — fordeling</p>
                          <ToggleButton
                            options={[
                              { value: "free", label: "Fri (stable)" },
                              { value: "spread", label: "Spre (maks 1 per element)" },
                            ]}
                            value={allowMultipleDots ? "free" : "spread"}
                            onChange={(value) => setAllowMultipleDots(value === "free")}
                          />
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-700">Antall prikker</p>
                          <StyledSelect
                            options={dotBudgetOptions}
                            value={String(dotBudget)}
                            onChange={(value) => setDotBudget(Number(value))}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {isKartlegging ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Tillat nye forslag</p>
                    <ToggleButton
                      options={[
                        { value: "yes", label: "Ja" },
                        { value: "no", label: "Nei" },
                      ]}
                      value={allowNewItems ? "yes" : "no"}
                      onChange={(value) => setAllowNewItems(value === "yes")}
                    />
                  </div>
                ) : null}

                {isRangering ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Maks antall å rangere</p>
                    <StyledSelect
                      options={maxRankItemsOptions}
                      value={maxRankItemsInput}
                      onChange={setMaxRankItemsInput}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#0f172a] py-4 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Oppretter..." : "Opprett sesjon →"}
          </button>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </div>
    </main>
  );
}
