import { expect, test } from '@playwright/test';
import { CREDENTIALS, dumpDatabase, expectDatabaseMatches, login, resetTo } from '../helpers.js';

test('a leader with a member is deleted', async ({ page, request }) => {
  await resetTo(request, 'two-leaders-one-with-member');

  const before = await dumpDatabase(request);
  expect(before.users).toHaveLength(4);
  expect(before.teams).toHaveLength(2);
  expect(before.onboarding_progress).toHaveLength(1);

  await login(page, CREDENTIALS.superadmin);
  await expect(page.getByTestId('leader-row')).toHaveCount(2);

  const doomed = page.locator(`[data-testid=leader-row][data-email="${CREDENTIALS.leaderA.email}"]`);
  await expect(doomed).toContainText('1'); // one member
  await doomed.getByTestId('remove-leader').click();

  await expect(page.getByTestId('leader-row')).toHaveCount(1);
  await expect(doomed).toHaveCount(0);
  await expect(
    page.locator(`[data-testid=leader-row][data-email="${CREDENTIALS.leaderB.email}"]`),
  ).toBeVisible();

  const dump = await dumpDatabase(request);

  // Documented decision: removing a Leader CASCADE-deletes the Leader's team,
  // that team's Members, their onboarding progress, and the team's invitations.
  // Nothing is kept. See the comment block at the top of src/schema.sql.
  expect(dump.users.map((u) => [u.email, u.role])).toEqual([
    [CREDENTIALS.superadmin.email, 'superadmin'],
    [CREDENTIALS.leaderB.email, 'leader'],
  ]);
  expect(dump.users.some((u) => u.email === CREDENTIALS.leaderA.email)).toBeFalsy();
  expect(dump.users.some((u) => u.email === CREDENTIALS.memberOne.email)).toBeFalsy();

  // Only the surviving Leader's (empty) team remains.
  expect(dump.teams).toHaveLength(1);
  expect(dump.teams[0]).toMatchObject({ id: 2, leader_id: 3 });

  expect(dump.invitations).toHaveLength(0);
  expect(dump.onboarding_progress).toHaveLength(0);

  expectDatabaseMatches('03-leader-with-member-is-deleted', dump);
});
