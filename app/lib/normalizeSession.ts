export type NormalizedSession = {
  id: string
  code: string
  title: string
  mode: 'kartlegging' | 'stemming' | 'aapne-innspill' | 'rangering'
  status: 'setup' | 'active' | 'paused' | 'closed'
  phase: 'kartlegging' | 'stemming' | 'innspill' | 'rangering'
  tags: string[] | null
  allowNewItems: boolean
  showTagHeaders: boolean
  dotBudget: number
  votingType: 'scale' | 'dots'
  allowMultipleDots: boolean
  visibilityMode: string
  maxRankItems: number | null
  resultsVisible: boolean
  showOthersInnspill: boolean
  innspillMode: 'enkel' | 'detaljert'
  innspillMaxChars: number
  includesStemming: boolean
  votingTarget: string | null
  timerEndsAt: string | null
  timerLabel: string | null
  createdAt: string
}

export function normalizeSession(raw: Record<string, unknown>): NormalizedSession {
  return {
    id: String(raw.id ?? ''),
    code: String(raw.code ?? ''),
    title: String(raw.title ?? ''),
    mode: (raw.mode ?? 'kartlegging') as NormalizedSession['mode'],
    status: (raw.status ?? 'setup') as NormalizedSession['status'],
    phase: (raw.phase ?? 'kartlegging') as NormalizedSession['phase'],
    tags: (raw.tags ?? null) as string[] | null,
    allowNewItems: Boolean(raw.allow_new_items ?? raw.allowNewItems ?? true),
    showTagHeaders: Boolean(raw.show_tag_headers ?? raw.showTagHeaders ?? false),
    dotBudget: Number(raw.dot_budget ?? raw.dotBudget ?? 5),
    votingType: (raw.voting_type ?? raw.votingType ?? 'dots') as NormalizedSession['votingType'],
    allowMultipleDots: Boolean(raw.allow_multiple_dots ?? raw.allowMultipleDots ?? false),
    visibilityMode: String(raw.visibility_mode ?? raw.visibilityMode ?? 'manual'),
    maxRankItems: (raw.max_rank_items ?? raw.maxRankItems ?? null) as number | null,
    resultsVisible: Boolean(raw.results_visible ?? raw.resultsVisible ?? false),
    showOthersInnspill: Boolean(raw.show_others_innspill ?? raw.showOthersInnspill ?? false),
    innspillMode: (raw.innspill_mode ?? raw.innspillMode ?? 'enkel') as NormalizedSession['innspillMode'],
    innspillMaxChars: Number(raw.innspill_max_chars ?? raw.innspillMaxChars ?? 500),
    includesStemming: Boolean(raw.includes_stemming ?? raw.includesStemming ?? false),
    votingTarget: (raw.voting_target ?? raw.votingTarget ?? null) as string | null,
    timerEndsAt: (raw.timer_ends_at ?? raw.timerEndsAt ?? null) as string | null,
    timerLabel: (raw.timer_label ?? raw.timerLabel ?? null) as string | null,
    createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
  }
}
