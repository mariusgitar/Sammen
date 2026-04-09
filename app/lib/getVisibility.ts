export type VisibilityConfig = {
  facilitator: {
    showRawResponses: boolean
    showDistribution: boolean
    showParticipantIds: boolean
  }
  participant: {
    showOwnResponses: boolean
    showAggregated: boolean  // replaces show_others_innspill
    showResults: boolean     // replaces results_visible
  }
  presentation: {
    showResults: boolean
    pinnedItemIds: string[]
  }
}

const defaults: VisibilityConfig = {
  facilitator: {
    showRawResponses: true,
    showDistribution: true,
    showParticipantIds: false,
  },
  participant: {
    showOwnResponses: true,
    showAggregated: true,  // mirrors show_others_innspill default of true
    showResults: false,    // participants don't see results until facilitator enables it
  },
  presentation: {
    showResults: false,
    pinnedItemIds: [],
  },
}

export function getVisibility(raw: unknown): VisibilityConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      facilitator: { ...defaults.facilitator },
      participant: { ...defaults.participant },
      presentation: { ...defaults.presentation, pinnedItemIds: [] },
    }
  }
  const r = raw as Record<string, unknown>
  return {
    facilitator: {
      ...defaults.facilitator,
      ...(r.facilitator && typeof r.facilitator === 'object' && !Array.isArray(r.facilitator)
        ? (r.facilitator as Partial<VisibilityConfig['facilitator']>)
        : {}),
    },
    participant: {
      ...defaults.participant,
      ...(r.participant && typeof r.participant === 'object' && !Array.isArray(r.participant)
        ? (r.participant as Partial<VisibilityConfig['participant']>)
        : {}),
    },
    presentation: {
      ...defaults.presentation,
      ...(r.presentation && typeof r.presentation === 'object' && !Array.isArray(r.presentation)
        ? (r.presentation as Partial<VisibilityConfig['presentation']>)
        : {}),
      pinnedItemIds: Array.isArray(
        (r.presentation as Record<string, unknown> | undefined)?.pinnedItemIds,
      )
        ? ((r.presentation as Record<string, unknown>).pinnedItemIds as string[])
        : [],
    },
  }
}
