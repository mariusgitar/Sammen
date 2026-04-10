export type SessionStatus = 'setup' | 'active' | 'paused' | 'closed';

export function isIllegalSetupReset(statusBefore: SessionStatus, requestedStatus?: SessionStatus): boolean {
  return requestedStatus === 'setup' && statusBefore !== 'setup';
}
