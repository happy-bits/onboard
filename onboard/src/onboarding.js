// The three hardcoded onboarding steps (MVP).
export const ONBOARDING_STEPS = [
  { key: 'read_handbook', label: 'Read the employee handbook' },
  { key: 'setup_accounts', label: 'Set up your accounts and tools' },
  { key: 'meet_team', label: 'Meet your team' },
];

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

export function isStepKey(key) {
  return ONBOARDING_STEPS.some((s) => s.key === key);
}
