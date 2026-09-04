import { expect, test } from '@playwright/test';
import { inviteToken } from '../../src/invitations.js';
import { CREDENTIALS, dumpDatabase, expectDatabaseMatches, resetTo } from '../helpers.js';

const INVITED = 'invited-one@onboard.test';
const MEMBER_PASSWORD = 'invited-one-pass';

// Same deterministic derivation the seed uses: team 1, first invitation for this
// address. No randomness, so the test knows the link up front.
const TOKEN = inviteToken(1, INVITED, 0);

test('an invite link can only be used once', async ({ page, request }) => {
  await resetTo(request, 'pending-invitation');

  const before = await dumpDatabase(request);
  expect(before.invitations).toHaveLength(1);
  expect(before.invitations[0]).toMatchObject({ email: INVITED, token: TOKEN, status: 'pending' });

  await page.goto(`/invite/${TOKEN}`);
  await expect(page.getByTestId('invited-email')).toHaveText(INVITED);
  await page.fill('#password', MEMBER_PASSWORD);
  await page.getByTestId('create-account').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByTestId('step-checkbox')).toHaveCount(3);

  // Second visit to the very same link: no second account, and the user is told
  // the invitation is already used.
  await page.goto(`/invite/${TOKEN}`);
  await expect(page.getByTestId('invite-unavailable')).toContainText('already been used');
  await expect(page.getByTestId('create-account')).toHaveCount(0);

  // Even posting straight to the link is refused.
  const replay = await request.post(`/invite/${TOKEN}`, { form: { password: 'another-pass' } });
  expect(replay.status()).toBe(410);

  const dump = await dumpDatabase(request);

  const members = dump.users.filter((u) => u.role === 'member');
  expect(members).toHaveLength(1);
  expect(members[0]).toMatchObject({ email: INVITED, team_id: 1 });
  expect(dump.users.map((u) => u.email)).toEqual([
    CREDENTIALS.superadmin.email,
    CREDENTIALS.leaderA.email,
    INVITED,
  ]);

  expect(dump.invitations).toHaveLength(1);
  expect(dump.invitations[0].status).toBe('accepted');
  expect(dump.invitations[0].accepted_at).not.toBeNull();

  expectDatabaseMatches('05-invite-link-single-use', dump);
});
