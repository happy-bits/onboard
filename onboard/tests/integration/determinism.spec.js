// The whole snapshot approach in tests/e2e rests on seeds being reproducible.
// These tests guard that property directly, so a stray NOW() or random() shows
// up here as a clear failure instead of as a puzzling dump diff later.

import { expect, test } from '@playwright/test';
import { CREDENTIALS, dumpDatabase, resetTo } from '../helpers.js';
import { SEED_NAMES } from '../../src/seed.js';
import { DUMPED_TABLES } from '../../src/dump.js';
import { ROUTES, loginAs, post } from '../api.js';

test('every seed produces an identical dump when applied twice', async ({ request }) => {
  for (const seed of SEED_NAMES) {
    await resetTo(request, seed);
    const first = await dumpDatabase(request);
    await resetTo(request, seed);
    const second = await dumpDatabase(request);
    expect(second, `seed "${seed}" is not reproducible`).toEqual(first);
  }
});

test('no seeded timestamp comes from the real clock', async ({ request }) => {
  const currentYear = String(new Date().getUTCFullYear());

  for (const seed of SEED_NAMES) {
    await resetTo(request, seed);
    const serialised = JSON.stringify(await dumpDatabase(request));
    expect(serialised, `seed "${seed}" contains a real timestamp`).not.toContain(currentYear);
  }
});

test('rows created through the app also use the fixed clock', async ({
  playwright,
  baseURL,
  request,
}) => {
  await resetTo(request, 'superadmin-and-leader');
  const leader = await loginAs(playwright, baseURL, CREDENTIALS.leaderA, '/team');
  await post(leader, ROUTES.invites, { email: 'invited-one@onboard.test' });

  const dump = await dumpDatabase(request);
  expect(dump.invitations[0].created_at).toBe('2024-01-01 00:00:00+00');
});

test('an invitation token is reproducible across resets', async ({
  playwright,
  baseURL,
  request,
}) => {
  const tokens = [];
  for (let run = 0; run < 2; run += 1) {
    await resetTo(request, 'superadmin-and-leader');
    const leader = await loginAs(playwright, baseURL, CREDENTIALS.leaderA, '/team');
    await post(leader, ROUTES.invites, { email: 'invited-one@onboard.test' });
    tokens.push((await dumpDatabase(request)).invitations[0].token);
  }
  expect(tokens[0]).toBe(tokens[1]);
});

test('the dump covers every table and orders rows by id', async ({ request }) => {
  await resetTo(request, 'leader-with-three-members');
  const dump = await dumpDatabase(request);

  expect(Object.keys(dump)).toEqual(DUMPED_TABLES);
  for (const [table, rows] of Object.entries(dump)) {
    const ids = rows.map((r) => r.id);
    expect(ids, `${table} is not ordered by id`).toEqual([...ids].sort((a, b) => a - b));
  }
});

test('the base seed contains only the superadmin', async ({ request }) => {
  await resetTo(request, 'base');
  const dump = await dumpDatabase(request);

  expect(dump.users).toHaveLength(1);
  expect(dump.users[0]).toMatchObject({ role: 'superadmin', team_id: null });
  expect(dump.teams).toEqual([]);
  expect(dump.invitations).toEqual([]);
  expect(dump.onboarding_progress).toEqual([]);
});

test('resetting truncates data left by a previous test', async ({
  playwright,
  baseURL,
  request,
}) => {
  await resetTo(request, 'base');
  const admin = await loginAs(playwright, baseURL, CREDENTIALS.superadmin, '/admin/leaders');
  await post(admin, ROUTES.createLeader, { email: 'temp@onboard.test', password: 'temp-pass' });
  expect((await dumpDatabase(request)).users).toHaveLength(2);

  await resetTo(request, 'base');
  expect((await dumpDatabase(request)).users).toHaveLength(1);
});
