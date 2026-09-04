import { expect, test } from '@playwright/test';
import {
  CREDENTIALS,
  STEPS,
  checkStep,
  dumpDatabase,
  expectDatabaseMatches,
  login,
  logout,
  resetTo,
  stepCheckbox,
} from '../helpers.js';

test('onboarding progress is stored in the database', async ({ page, request }) => {
  await resetTo(request, 'member-two-of-three');

  await login(page, CREDENTIALS.memberOne);
  await expect(page).toHaveURL(/\/onboarding$/);

  // The two seeded steps render as already checked, the third does not.
  await expect(stepCheckbox(page, 'read_handbook')).toBeChecked();
  await expect(stepCheckbox(page, 'setup_accounts')).toBeChecked();
  await expect(stepCheckbox(page, 'meet_team')).not.toBeChecked();
  await expect(page.getByTestId('progress')).toHaveText('2/3 completed');

  await checkStep(page, 'meet_team');
  await expect(page.getByTestId('progress')).toHaveText('3/3 completed');
  await expect(page.getByTestId('onboarding-complete')).toBeVisible();

  await logout(page);
  await login(page, CREDENTIALS.memberOne);
  await expect(page).toHaveURL(/\/onboarding$/);

  // All three survive a full round trip through the database.
  for (const step of STEPS) {
    await expect(stepCheckbox(page, step)).toBeChecked();
  }
  await expect(page.getByTestId('progress')).toHaveText('3/3 completed');

  const dump = await dumpDatabase(request);

  expect(dump.onboarding_progress).toHaveLength(3);
  expect(dump.onboarding_progress.map((p) => p.step_key)).toEqual(STEPS);
  expect(dump.onboarding_progress.every((p) => p.user_id === 3)).toBeTruthy();
  // No duplicates: one row per (user, step).
  expect(new Set(dump.onboarding_progress.map((p) => `${p.user_id}:${p.step_key}`)).size).toBe(3);

  expectDatabaseMatches('04-progress-is-persisted', dump);
});
