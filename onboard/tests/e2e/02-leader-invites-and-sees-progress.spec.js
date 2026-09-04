import { expect, test } from '@playwright/test';
import {
  CREDENTIALS,
  STEPS,
  checkStep,
  dumpDatabase,
  expectDatabaseMatches,
  inviteUrlFrom,
  login,
  outbox,
  resetTo,
  stepCheckbox,
} from '../helpers.js';

const INVITED_ACCEPTS = 'invited-one@onboard.test';
const INVITED_IGNORES = 'invited-two@onboard.test';
const MEMBER_PASSWORD = 'invited-one-pass';

test('a leader invites a member and sees their progress', async ({ browser, request }) => {
  await resetTo(request, 'superadmin-and-leader');

  const leaderContext = await browser.newContext();
  const leaderPage = await leaderContext.newPage();
  await login(leaderPage, CREDENTIALS.leaderA);
  await expect(leaderPage).toHaveURL(/\/team$/);
  await expect(leaderPage.getByTestId('no-members')).toBeVisible();

  for (const email of [INVITED_ACCEPTS, INVITED_IGNORES]) {
    await leaderPage.fill('#email', email);
    await leaderPage.getByTestId('send-invite').click();
    await expect(
      leaderPage.locator(`[data-testid=invitation-row][data-email="${email}"]`),
    ).toBeVisible();
  }
  await expect(leaderPage.getByTestId('invitation-row')).toHaveCount(2);

  // Both invitations went out as (faked) emails; only the first is followed.
  const emails = await outbox(request);
  expect(emails.map((m) => m.to)).toEqual([INVITED_ACCEPTS, INVITED_IGNORES]);
  const inviteUrl = inviteUrlFrom(emails[0]);

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await memberPage.goto(inviteUrl);
  await expect(memberPage.getByTestId('invited-email')).toHaveText(INVITED_ACCEPTS);
  await memberPage.fill('#password', MEMBER_PASSWORD);
  await memberPage.getByTestId('create-account').click();

  await expect(memberPage).toHaveURL(/\/onboarding$/);
  await expect(memberPage.getByTestId('step-checkbox')).toHaveCount(3);
  for (const step of STEPS) {
    await expect(stepCheckbox(memberPage, step)).not.toBeChecked();
  }

  // The Member checks the boxes one by one; the Leader sees each update.
  const memberRow = leaderPage.locator(
    `[data-testid=member-row][data-email="${INVITED_ACCEPTS}"]`,
  );

  await leaderPage.reload();
  await expect(memberRow.getByTestId('member-progress')).toHaveText('0/3');

  for (const [index, step] of STEPS.entries()) {
    await checkStep(memberPage, step);
    await leaderPage.reload();
    await expect(memberRow.getByTestId('member-progress')).toHaveText(`${index + 1}/3`);
    await expect(memberRow.locator(`[data-step="${step}"]`)).toHaveAttribute('data-done', 'true');
  }

  // The invitation nobody followed is still pending and listed as such.
  await expect(
    leaderPage.locator(`[data-testid=invitation-row][data-email="${INVITED_IGNORES}"]`),
  ).toBeVisible();
  await expect(leaderPage.getByTestId('invitation-row')).toHaveCount(1);

  const dump = await dumpDatabase(request);

  expect(dump.users.map((u) => [u.email, u.role, u.team_id])).toEqual([
    [CREDENTIALS.superadmin.email, 'superadmin', null],
    [CREDENTIALS.leaderA.email, 'leader', null],
    [INVITED_ACCEPTS, 'member', 1],
  ]);
  expect(dump.invitations.map((i) => [i.email, i.status])).toEqual([
    [INVITED_ACCEPTS, 'accepted'],
    [INVITED_IGNORES, 'pending'],
  ]);
  expect(dump.invitations[0].accepted_at).not.toBeNull();
  expect(dump.invitations[1].accepted_at).toBeNull();
  expect(dump.onboarding_progress.map((p) => p.step_key)).toEqual(STEPS);
  expect(dump.onboarding_progress.every((p) => p.user_id === 3)).toBeTruthy();

  expectDatabaseMatches('02-leader-invites-and-sees-progress', dump);

  await memberContext.close();
  await leaderContext.close();
});
