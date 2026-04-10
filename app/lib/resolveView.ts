import type { NormalizedSession } from './normalizeSession'

export type ViewState =
  | { view: 'waiting'; reason: string }
  | { view: 'kartlegging' }
  | { view: 'stemming' }
  | { view: 'innspill' }
  | { view: 'rangering' }
  | { view: 'results' }
  | { view: 'closed' }

export function resolveView(session: NormalizedSession): ViewState {
  if (session.status === 'closed') {
    return { view: 'closed' }
  }
  if (session.visibility.participant.showResults) {
    return { view: 'results' }
  }
  if (session.status === 'paused') {
    return { view: 'waiting', reason: 'Sesjonen er midlertidig pauset.' }
  }
  if (session.status === 'setup') {
    return { view: 'waiting', reason: 'Sesjonen har ikke startet ennå.' }
  }
  // status === 'active'
  switch (session.moduleType) {
    case 'kartlegging': return { view: 'kartlegging' }
    case 'stemming':    return { view: 'stemming' }
    case 'aapne-innspill': return { view: 'innspill' }
    case 'rangering':   return { view: 'rangering' }
    default:            return { view: 'waiting', reason: 'Venter på fasilitator.' }
  }
}
