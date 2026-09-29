export type MFAStatus = 'checking' | 'needs_enrollment' | 'pending' | 'verified' | 'none' | 'error';

type AssuranceLevels = {
  readonly currentLevel: 'aal1' | 'aal2';
  readonly nextLevel: 'aal1' | 'aal2';
};

export function resolveMfaStatus(required: boolean, assurance: AssuranceLevels): MFAStatus {
  if (assurance.nextLevel === 'aal2') {
    return assurance.currentLevel === 'aal2' ? 'verified' : 'pending';
  }
  return required ? 'needs_enrollment' : 'none';
}
