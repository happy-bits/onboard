import { SEED_LEADER, SEED_TIMESTAMP, SUPERADMIN, seedPasswordHash } from '../src/db/seed.js';
import { anyInviteToken, anyPasswordHash, anyTimestamp, expect, test } from './helpers/fixtures';

test('leader invites two people, one joins and completes onboarding', async ({ browser, db, request }) => {
  await db.reset('with-leader');

  // --- Leader logs in and invites two people ---------------------------------
  const leaderPage = await (await browser.newContext()).newPage();
  await leaderPage.goto('/login');
  await leaderPage.getByLabel('Email').fill(SEED_LEADER.email);
  await leaderPage.getByLabel('Password').fill(SEED_LEADER.password);
  await leaderPage.getByRole('button', { name: 'Log in' }).click();
  await expect(leaderPage.getByRole('heading', { name: SEED_LEADER.teamName })).toBeVisible();

  for (const email of ['anna@example.com', 'carl@example.com']) {
    await leaderPage.getByLabel('Email').fill(email);
    await leaderPage.getByRole('button', { name: 'Send invitation' }).click();
    await expect(leaderPage.getByRole('status')).toHaveText(`Invitation sent to ${email}.`);
  }
  const invitations = leaderPage.getByRole('table', { name: 'Invitations' });
  await expect(invitations.getByRole('row', { name: 'anna@example.com' })).toContainText('Pending');
  await expect(invitations.getByRole('row', { name: 'carl@example.com' })).toContainText('Pending');

  const mailbox = await (await request.get('/dev/mailbox.json')).json();
  expect(mailbox.map((m: { to: string }) => m.to)).toEqual(['anna@example.com', 'carl@example.com']);

  // --- Anna follows the link in her email and creates an account --------------
  const memberPage = await (await browser.newContext()).newPage();
  await memberPage.goto('/dev/mailbox');
  await memberPage
    .locator('article[data-email-to="anna@example.com"]')
    .getByRole('link', { name: 'Accept invitation' })
    .click();
  await expect(memberPage.getByRole('heading', { name: `Join ${SEED_LEADER.teamName}` })).toBeVisible();
  await memberPage.getByLabel('Your name').fill('Anna Svensson');
  await memberPage.getByLabel('Password').fill('anna-password');
  await memberPage.getByRole('button', { name: 'Create account' }).click();

  await expect(memberPage.getByRole('heading', { name: 'Welcome, Anna Svensson!' })).toBeVisible();
  const checkboxes = memberPage.getByRole('checkbox');
  await expect(checkboxes).toHaveCount(3);
  for (const checkbox of await checkboxes.all()) await expect(checkbox).not.toBeChecked();

  // --- The leader sees the new member (the team page refreshes by itself) -----
  const annaRow = leaderPage.getByRole('table', { name: 'Members' }).getByRole('row', { name: /Anna Svensson/ });
  const progress = annaRow.locator('[data-field=progress]');
  const status = annaRow.locator('[data-field=status]');
  await expect(progress).toHaveText('0/3');
  await expect(status).toHaveText('Not started');
  await expect(invitations.getByRole('row', { name: 'anna@example.com' })).toContainText('Accepted');

  // --- Anna checks the boxes one by one; the leader sees progress update ------
  const steps = ['Read the employee handbook', 'Set up your workstation', 'Meet your team'];
  const expectedStatus = ['In progress', 'In progress', 'Completed'];
  for (const [i, label] of steps.entries()) {
    await memberPage.getByRole('checkbox', { name: label }).check();
    await expect(memberPage.locator('#onboarding-status')).toHaveText(`${i + 1}/3 completed`);

    await expect(progress).toHaveText(`${i + 1}/3`);
    await expect(status).toHaveText(expectedStatus[i]);
  }

  // --- Verify the database --------------------------------------------------
  expect(await db.dump()).toEqual({
    invitations: [
      {
        id: 1,
        team_id: SEED_LEADER.teamId,
        email: 'anna@example.com',
        token: anyInviteToken(),
        invited_by: SEED_LEADER.id,
        accepted_user_id: 3,
        accepted_at: anyTimestamp(),
        created_at: anyTimestamp(),
      },
      {
        id: 2,
        team_id: SEED_LEADER.teamId,
        email: 'carl@example.com',
        token: anyInviteToken(),
        invited_by: SEED_LEADER.id,
        accepted_user_id: null,
        accepted_at: null,
        created_at: anyTimestamp(),
      },
    ],
    onboarding_steps: [
      { user_id: 3, step_key: 'meet_team', completed_at: anyTimestamp() },
      { user_id: 3, step_key: 'read_handbook', completed_at: anyTimestamp() },
      { user_id: 3, step_key: 'setup_workstation', completed_at: anyTimestamp() },
    ],
    teams: [{ id: SEED_LEADER.teamId, name: SEED_LEADER.teamName, created_at: SEED_TIMESTAMP }],
    users: [
      {
        id: SUPERADMIN.id,
        email: SUPERADMIN.email,
        name: SUPERADMIN.name,
        password_hash: seedPasswordHash(SUPERADMIN),
        role: 'superadmin',
        team_id: null,
        created_at: SEED_TIMESTAMP,
      },
      {
        id: SEED_LEADER.id,
        email: SEED_LEADER.email,
        name: SEED_LEADER.name,
        password_hash: seedPasswordHash(SEED_LEADER),
        role: 'leader',
        team_id: SEED_LEADER.teamId,
        created_at: SEED_TIMESTAMP,
      },
      {
        id: 3,
        email: 'anna@example.com',
        name: 'Anna Svensson',
        password_hash: anyPasswordHash(),
        role: 'member',
        team_id: SEED_LEADER.teamId,
        created_at: anyTimestamp(),
      },
    ],
  });
});
