import { expect, test } from '@playwright/test';
import { CREDENTIALS, dumpDatabase, expectDatabaseMatches, login, resetTo } from '../helpers.js';

test('superadmin can create leaders in an empty system', async ({ page, request }) => {
  await resetTo(request, 'base');

  // The database starts empty except for the Superadmin.
  const before = await dumpDatabase(request);
  expect(before.users).toHaveLength(1);
  expect(before.users[0]).toMatchObject({ email: CREDENTIALS.superadmin.email, role: 'superadmin' });
  expect(before.teams).toHaveLength(0);

  await login(page, CREDENTIALS.superadmin);
  await expect(page).toHaveURL(/\/admin\/leaders$/);
  await expect(page.getByTestId('no-leaders')).toBeVisible();

  for (const leader of [CREDENTIALS.leaderA, CREDENTIALS.leaderB]) {
    await page.fill('#email', leader.email);
    await page.fill('#password', leader.password);
    await page.getByTestId('create-leader').click();
    await expect(page.locator(`[data-testid=leader-row][data-email="${leader.email}"]`)).toBeVisible();
  }

  await expect(page.getByTestId('leader-row')).toHaveCount(2);

  const dump = await dumpDatabase(request);

  expect(dump.users).toHaveLength(3);
  expect(dump.users.map((u) => [u.email, u.role])).toEqual([
    [CREDENTIALS.superadmin.email, 'superadmin'],
    [CREDENTIALS.leaderA.email, 'leader'],
    [CREDENTIALS.leaderB.email, 'leader'],
  ]);
  // Each new Leader gets exactly one team, and Leaders are not team members.
  expect(dump.teams).toHaveLength(2);
  expect(dump.teams.map((t) => t.leader_id).sort()).toEqual([2, 3]);
  expect(dump.users.every((u) => u.team_id === null)).toBeTruthy();
  expect(dump.invitations).toHaveLength(0);
  expect(dump.onboarding_progress).toHaveLength(0);

  expectDatabaseMatches('01-superadmin-creates-leaders', dump);
});
