import { getVisibility, type VisibilityConfig } from './getVisibility'

const SESSION_STATUSES = ['setup', 'active', 'paused', 'closed'] as const

export type NormalizedSession = {
  id: string
  code: string
  title: string
  moduleType: 'kartlegging' | 'stemming' | 'aapne-innspill' | 'rangering'
  status: (typeof SESSION_STATUSES)[number]
  tags: string[] | null
  allowNewItems: boolean
  dotBudget: number
  votingType: 'scale' | 'dots'
  allowMultipleDots: boolean
  maxRankItems: number
  // Derived from visibility.participant.showAggregated — kept for backward compat with InnspillView
  showOthersInnspill: boolean
  showTagHeaders: boolean
  innspillMode: string
  innspillMaxChars: number
  anonymousInnspill: boolean
  includesStemming: boolean
  votingTarget: string | null
  activeFilter: 'alle' | 'uenighet' | 'usikker' | 'konsensus'
  createdAt: string
  timerEndsAt: string | null
  timerLabel: string | null
  // Backward-compat: legacy admin payload consumers read this directly
  resultsVisible: boolean
  visibility: VisibilityConfig
}

export { type VisibilityConfig }

export function normalizeSession(raw: Record<string, unknown>): NormalizedSession {
  const timerRaw = raw.timer_ends_at ?? raw.timerEndsAt ?? null

  // Backward-compat: if visibility jsonb is empty/absent, derive from legacy boolean columns
  const visibilityRaw = raw.visibility
  const visibilityIsEmpty =
    !visibilityRaw ||
    typeof visibilityRaw !== 'object' ||
    Array.isArray(visibilityRaw) ||
    Object.keys(visibilityRaw as object).length === 0

  const legacyResultsVisible = Boolean(raw.results_visible ?? raw.resultsVisible ?? false)
  const legacyShowOthers = Boolean(raw.show_others_innspill ?? raw.showOthersInnspill ?? true)

  const visibility = visibilityIsEmpty
    ? getVisibility({
        participant: {
          showResults: legacyResultsVisible,
          showAggregated: legacyShowOthers,
        },
      })
    : getVisibility(visibilityRaw)

  return {
    id: String(raw.id ?? ''),
    code: String(raw.code ?? ''),
    title: String(raw.title ?? ''),
    moduleType: (() => {
      const raw_mode = raw.mode ?? raw.phase ?? raw.module_type ?? 'kartlegging'
      // Map legacy v1 value 'innspill' → canonical v2 value 'aapne-innspill'
      return (raw_mode === 'innspill' ? 'aapne-innspill' : raw_mode) as NormalizedSession['moduleType']
    })(),
    status: (() => {
      const s = raw.status
      if (typeof s === 'string' && SESSION_STATUSES.includes(s as (typeof SESSION_STATUSES)[number])) {
        return s as NormalizedSession['status']
      }
      if (s !== null && s !== undefined) {
        throw new Error(`normalizeSession: unexpected status value "${s}" for session ${raw.id}`)
      }
      return 'setup' as const
    })(),
    tags: (raw.tags ?? null) as string[] | null,
    allowNewItems: Boolean(raw.allow_new_items ?? raw.allowNewItems ?? true),
    dotBudget: Number(raw.dot_budget ?? raw.dotBudget ?? 5),
    votingType: (raw.voting_type ?? raw.votingType ?? 'dots') as NormalizedSession['votingType'],
    allowMultipleDots: Boolean(raw.allow_multiple_dots ?? raw.allowMultipleDots ?? true),
    maxRankItems: Number(raw.max_rank_items ?? raw.maxRankItems ?? 0),
    showOthersInnspill: visibility.participant.showAggregated,
    showTagHeaders: Boolean(raw.show_tag_headers ?? raw.showTagHeaders ?? false),
    innspillMode: String(raw.innspill_mode ?? raw.innspillMode ?? 'enkel'),
    innspillMaxChars: Number(raw.innspill_max_chars ?? raw.innspillMaxChars ?? 200),
    anonymousInnspill: Boolean(raw.anonymous_innspill ?? raw.anonymousInnspill ?? false),
    includesStemming: Boolean(raw.includes_stemming ?? raw.includesStemming ?? false),
    votingTarget: (raw.voting_target ?? raw.votingTarget ?? null) as string | null,
    activeFilter: (raw.active_filter ?? raw.activeFilter ?? 'alle') as NormalizedSession['activeFilter'],
    createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
    timerEndsAt: timerRaw !== null ? String(timerRaw) : null,
    timerLabel: (raw.timer_label ?? raw.timerLabel ?? null) as string | null,
    resultsVisible: visibility.participant.showResults,
    visibility,
  }
}
