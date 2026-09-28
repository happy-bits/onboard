import { SEED_TIMESTAMP, SUPERADMIN, seedPasswordHash } from '../src/db/seed.js';
import { anyPasswordHash, anyTimestamp, expect, test } from './helpers/fixtures';

test('superadmin logs in and creates two leaders', async ({ page, db }) => {
  await db.reset('base');

  await page.goto('/');
  await page.getByLabel('Email').fill(SUPERADMIN.email);
  await page.getByLabel('Password').fill(SUPERADMIN.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Leaders' })).toBeVisible();
  await expect(page.getByText('No leaders yet.')).toBeVisible();

  const leaders = [
    { name: 'Alice Andersson', email: 'alice@example.com', password: 'alice-password' },
    { name: 'Bob Berg', email: 'bob@example.com', password: 'bob-password' },
  ];
  for (const leader of leaders) {
    await page.getByLabel('Name').fill(leader.name);
    await page.getByLabel('Email').fill(leader.email);
    await page.getByLabel('Initial password').fill(leader.password);
    await page.getByRole('button', { name: 'Create leader' }).click();
    await expect(page.getByRole('status')).toHaveText(`Leader ${leader.name} created.`);
  }

  const rows = page.getByRole('table', { name: 'Leaders' }).getByRole('row');
  await expect(rows).toHaveCount(3); // header + 2 leaders
  await expect(rows.nth(1)).toContainText('Alice Andersson');
  await expect(rows.nth(1)).toContainText("Alice Andersson's team");
  await expect(rows.nth(2)).toContainText('bob@example.com');

  expect(await db.dump()).toEqual({
    invitations: [],
    onboarding_steps: [],
    teams: [
      { id: 1, name: "Alice Andersson's team", created_at: anyTimestamp() },
      { id: 2, name: "Bob Berg's team", created_at: anyTimestamp() },
    ],
    users: [
      {
        id: 1,
        email: SUPERADMIN.email,
        name: SUPERADMIN.name,
        password_hash: seedPasswordHash(SUPERADMIN),
        role: 'superadmin',
        team_id: null,
        created_at: SEED_TIMESTAMP,
      },
      {
        id: 2,
        email: 'alice@example.com',
        name: 'Alice Andersson',
        password_hash: anyPasswordHash(),
        role: 'leader',
        team_id: 1,
        created_at: anyTimestamp(),
      },
      {
        id: 3,
        email: 'bob@example.com',
        name: 'Bob Berg',
        password_hash: anyPasswordHash(),
        role: 'leader',
        team_id: 2,
        created_at: anyTimestamp(),
      },
    ],
  });
});
