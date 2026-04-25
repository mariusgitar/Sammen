import type { NormalizedSession } from './normalizeSession'

type AdminPrimaryAction = {
  label: string
  description: string
}

type AdminSecondaryAction = {
  label: string
  description: string
}

type AdminUiSections = {
  showFlowStepper: boolean
  showKartleggingCuration: boolean
  showInnspillCuration: boolean
  showInnspillThemePanel: boolean
  showInnspillStemmingSetup: boolean
  showParticipantsPanel: boolean
  showLiveOverviewPanel: boolean
  showResultsToggleInMainControls: boolean
}

type AdminViewBase = {
  facilitatorViewLabel: string
  primaryAction: AdminPrimaryAction
  secondaryActions: AdminSecondaryAction[]
  sections: AdminUiSections
}

export type AdminViewState =
  | ({ state: 'setup' } & AdminViewBase)
  | ({ state: 'collecting' } & AdminViewBase)
  | ({ state: 'paused-kartlegging' } & AdminViewBase)
  | ({ state: 'paused-innspill' } & AdminViewBase)
  | ({ state: 'stemming-setup' } & AdminViewBase)
  | ({ state: 'stemming-active' } & AdminViewBase)
  | ({ state: 'rangering-active' } & AdminViewBase)
  | ({ state: 'closed' } & AdminViewBase)
  | ({ state: 'paused-generic' } & AdminViewBase)

const DEFAULT_SECTIONS: AdminUiSections = {
  showFlowStepper: false,
  showKartleggingCuration: false,
  showInnspillCuration: false,
  showInnspillThemePanel: false,
  showInnspillStemmingSetup: false,
  showParticipantsPanel: true,
  showLiveOverviewPanel: true,
  showResultsToggleInMainControls: true,
}

type SessionPhase = 'kartlegging' | 'stemming' | 'innspill' | 'rangering'

function getSessionPhase(session: NormalizedSession): SessionPhase {
  const maybePhase = (session as NormalizedSession & { phase?: unknown }).phase

  if (maybePhase === 'kartlegging' || maybePhase === 'stemming' || maybePhase === 'innspill' || maybePhase === 'rangering') {
    return maybePhase
  }

  if (session.moduleType === 'rangering') {
    return 'rangering'
  }

  if (session.moduleType === 'stemming') {
    return 'stemming'
  }

  if (session.moduleType === 'aapne-innspill') {
    return 'innspill'
  }

  return 'kartlegging'
}

export function resolveAdminView(session: NormalizedSession): AdminViewState {
  const phase = getSessionPhase(session)
  const isInnspillModule = session.moduleType === 'aapne-innspill'
  const isMultiPhaseMode = session.moduleType === 'kartlegging' || isInnspillModule

  if (session.status === 'closed') {
    return {
      state: 'closed',
      facilitatorViewLabel: 'Sesjon avsluttet',
      primaryAction: { label: 'Åpne igjen', description: 'Setter sesjonen tilbake til aktiv.' },
      secondaryActions: [],
      sections: {
        ...DEFAULT_SECTIONS,
        showFlowStepper: isMultiPhaseMode,
        showInnspillCuration: isInnspillModule,
        showParticipantsPanel: !isInnspillModule,
        showLiveOverviewPanel: !isInnspillModule,
      },
    }
  }

  if (session.moduleType === 'rangering' && session.status === 'active' && phase !== 'stemming') {
    return {
      state: 'rangering-active',
      facilitatorViewLabel: 'Rangering pågår',
      primaryAction: { label: 'Avslutt innsamling', description: 'Pausér rangering for videre oppfølging.' },
      secondaryActions: [],
      sections: {
        ...DEFAULT_SECTIONS,
        showFlowStepper: isMultiPhaseMode,
        showInnspillCuration: isInnspillModule,
      },
    }
  }

  if (phase === 'stemming' && session.status === 'active') {
    return {
      state: session.moduleType === 'rangering' ? 'rangering-active' : 'stemming-active',
      facilitatorViewLabel: session.moduleType === 'rangering' ? 'Rangering pågår' : 'Stemming pågår',
      primaryAction: {
        label: session.moduleType === 'rangering' ? 'Avslutt rangering' : 'Avslutt stemming',
        description: 'Lukker aktiv stemmefase.',
      },
      secondaryActions: [],
      sections: {
        ...DEFAULT_SECTIONS,
        showFlowStepper: isMultiPhaseMode,
        showInnspillCuration: isInnspillModule,
        showParticipantsPanel: !isInnspillModule,
        showLiveOverviewPanel: !isInnspillModule,
      },
    }
  }

  if (session.status === 'setup') {
    return {
      state: 'setup',
      facilitatorViewLabel: 'Klar til oppstart',
      primaryAction: { label: 'Åpne for deltakere →', description: 'Starter innsamling for deltakere.' },
      secondaryActions: [],
      sections: {
        ...DEFAULT_SECTIONS,
        showFlowStepper: isMultiPhaseMode,
        showInnspillCuration: isInnspillModule,
        showResultsToggleInMainControls: false,
        showParticipantsPanel: !isInnspillModule,
        showLiveOverviewPanel: !isInnspillModule,
      },
    }
  }

  if (session.status === 'paused' && session.moduleType === 'kartlegging') {
    return {
      state: phase === 'stemming' ? 'stemming-setup' : 'paused-kartlegging',
      facilitatorViewLabel: 'Kuratér før stemming',
      primaryAction: { label: 'Åpne for stemming', description: 'Starter stemmefasen fra kuratert liste.' },
      secondaryActions: [
        { label: 'Åpne kartlegging igjen', description: 'Gjenåpner innsamling i kartlegging.' },
        { label: 'Avslutt sesjon', description: 'Lukker sesjonen permanent.' },
      ],
      sections: {
        ...DEFAULT_SECTIONS,
        showFlowStepper: isMultiPhaseMode,
        showKartleggingCuration: true,
      },
    }
  }

  if (session.status === 'paused' && session.moduleType === 'aapne-innspill') {
    return {
      state: 'paused-innspill',
      facilitatorViewLabel: 'Velg innspill før stemming',
      primaryAction: { label: 'Gå til stemmeoppsett ↓', description: 'Går til seksjonen for å starte stemming.' },
      secondaryActions: [
        { label: 'Åpne innsamling igjen', description: 'Gjenåpner innspill-innsamling.' },
        { label: 'Avslutt sesjon', description: 'Lukker sesjonen permanent.' },
      ],
      sections: {
        ...DEFAULT_SECTIONS,
        showFlowStepper: isMultiPhaseMode,
        showInnspillCuration: true,
        showInnspillThemePanel: true,
        showInnspillStemmingSetup: true,
        showParticipantsPanel: false,
        showLiveOverviewPanel: false,
        showResultsToggleInMainControls: false,
      },
    }
  }

  if (session.status === 'paused') {
    return {
      state: 'paused-generic',
      facilitatorViewLabel: 'Innsamling pauset',
      primaryAction: { label: 'Fortsett', description: 'Setter sesjonen tilbake til aktiv.' },
      secondaryActions: [{ label: 'Avslutt sesjon', description: 'Lukker sesjonen permanent.' }],
      sections: {
        ...DEFAULT_SECTIONS,
        showFlowStepper: isMultiPhaseMode,
        showInnspillCuration: isInnspillModule,
        showParticipantsPanel: !isInnspillModule,
        showLiveOverviewPanel: !isInnspillModule,
      },
    }
  }

  return {
    state: 'collecting',
    facilitatorViewLabel: 'Innsamling pågår',
    primaryAction: { label: 'Avslutt innsamling', description: 'Pausér innsamlingen og gå videre i flyten.' },
    secondaryActions: [],
    sections: {
      ...DEFAULT_SECTIONS,
      showFlowStepper: isMultiPhaseMode,
      showInnspillCuration: isInnspillModule,
      showParticipantsPanel: !isInnspillModule,
      showLiveOverviewPanel: !isInnspillModule,
    },
  }
}
