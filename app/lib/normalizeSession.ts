export type NormalizedSession = {
  id: string
  code: string
  title: string
  mode: 'kartlegging' | 'stemming' | 'aapne-innspill' | 'rangering'
  status: 'setup' | 'active' | 'paused' | 'closed'
  tags: string[] | null
  allowNewItems: boolean
  phase: 'kartlegging' | 'stemming' | 'innspill' | 'rangering'
  dotBudget: number
  votingType: 'scale' | 'dots'
  allowMultipleDots: boolean
  visibilityMode: string
  maxRankItems: number
  resultsVisible: boolean
  showOthersInnspill: boolean
  showTagHeaders: boolean
  innspillMode: string
  innspillMaxChars: number
  includesStemming: boolean
  votingTarget: string | null
  activeFilter: 'alle' | 'uenighet' | 'usikker' | 'konsensus'
  createdAt: string
  timerEndsAt: string | null
  timerLabel: string | null
}

export function normalizeSession(raw: Record<string, unknown>): NormalizedSession {
  const timerRaw = raw.timer_ends_at ?? raw.timerEndsAt ?? null

  return {
    id: String(raw.id ?? ''),
    code: String(raw.code ?? ''),
    title: String(raw.title ?? ''),
    mode: (raw.mode ?? 'kartlegging') as NormalizedSession['mode'],
    status: (raw.status ?? 'setup') as NormalizedSession['status'],
    tags: (raw.tags ?? null) as string[] | null,
    allowNewItems: Boolean(raw.allow_new_items ?? raw.allowNewItems ?? true),
    phase: (raw.phase ?? 'kartlegging') as NormalizedSession['phase'],
    dotBudget: Number(raw.dot_budget ?? raw.dotBudget ?? 5),
    votingType: (raw.voting_type ?? raw.votingType ?? 'dots') as NormalizedSession['votingType'],
    allowMultipleDots: Boolean(raw.allow_multiple_dots ?? raw.allowMultipleDots ?? true),
    visibilityMode: String(raw.visibility_mode ?? raw.visibilityMode ?? 'manual'),
    maxRankItems: Number(raw.max_rank_items ?? raw.maxRankItems ?? 0),
    resultsVisible: Boolean(raw.results_visible ?? raw.resultsVisible ?? false),
    showOthersInnspill: Boolean(raw.show_others_innspill ?? raw.showOthersInnspill ?? false),
    showTagHeaders: Boolean(raw.show_tag_headers ?? raw.showTagHeaders ?? false),
    innspillMode: String(raw.innspill_mode ?? raw.innspillMode ?? 'enkel'),
    innspillMaxChars: Number(raw.innspill_max_chars ?? raw.innspillMaxChars ?? 200),
    includesStemming: Boolean(raw.includes_stemming ?? raw.includesStemming ?? false),
    votingTarget: (raw.voting_target ?? raw.votingTarget ?? null) as string | null,
    activeFilter: (raw.active_filter ?? raw.activeFilter ?? 'alle') as NormalizedSession['activeFilter'],
    createdAt: String(raw.created_at ?? raw.createdAt ?? ''),
    timerEndsAt: timerRaw !== null ? String(timerRaw) : null,
    timerLabel: (raw.timer_label ?? raw.timerLabel ?? null) as string | null,
  }
}
