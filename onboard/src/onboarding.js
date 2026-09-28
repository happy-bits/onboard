// Hardcoded onboarding checklist for the MVP.
export const ONBOARDING_STEPS = [
  { key: 'read_handbook', label: 'Read the employee handbook' },
  { key: 'setup_workstation', label: 'Set up your workstation' },
  { key: 'meet_team', label: 'Meet your team' },
];

export const isStepKey = (key) => ONBOARDING_STEPS.some((s) => s.key === key);

export function progressLabel(completed) {
  if (completed === 0) return 'Not started';
  if (completed === ONBOARDING_STEPS.length) return 'Completed';
  return 'In progress';
}
