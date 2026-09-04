// The delete cascade is the most intricate piece of the schema: users.team_id
// and teams.leader_id reference each other, so a single DELETE has to unwind
// two tables in a cycle plus two dependents. These tests pin the documented
// behaviour from the top of src/schema.sql.

import { expect, test } from '@playwright/test';
import { CREDENTIALS, dumpDatabase, resetTo } from '../helpers.js';
import { ROUTES, expectRedirect, loginAs, post } from '../api.js';

const LEADER_A_ID = 2;
const LEADER_B_ID = 3;

test.describe('deleting a leader', () => {
  let admin;

  test.beforeEach(async ({ playwright, baseURL, request }) => {
    await resetTo(request, 'leader-with-three-members');
    admin = await loginAs(playwright, baseURL, CREDENTIALS.superadmin, '/admin/leaders');
  });

  test('the fixture starts in the expected shape', async ({ request }) => {
    const dump = await dumpDatabase(request);
    expect(dump.users).toHaveLength(6); // superadmin + 2 leaders + 3 members
    expect(dump.teams).toHaveLength(2);
    expect(dump.invitations).toHaveLength(3);
    expect(dump.onboarding_progress).toHaveLength(4); // 0 + 1 + 3
  });

  test('a leader with three members takes their whole team with them', async ({ request }) => {
    expectRedirect(await post(admin, ROUTES.deleteLeader(LEADER_A_ID)), '/admin/leaders');

    const dump = await dumpDatabase(request);
    // Superadmin and Leader B survive; the Leader and all three Members are gone.
    expect(dump.users.map((u) => u.role)).toEqual(['superadmin', 'leader']);
    expect(dump.users.some((u) => u.id === LEADER_A_ID)).toBeFalsy();
    expect(dump.teams).toHaveLength(1);
    expect(dump.teams[0].leader_id).toBe(LEADER_B_ID);
    // Their invitations and progress cascade too — no orphans anywhere.
    expect(dump.invitations).toHaveLength(0);
    expect(dump.onboarding_progress).toHaveLength(0);
  });

  test('progress rows disappear regardless of how far along the member was', async ({
    request,
  }) => {
    // The fixture deliberately mixes 0, 1 and 3 completed steps.
    const before = await dumpDatabase(request);
    expect(new Set(before.onboarding_progress.map((p) => p.user_id)).size).toBe(2);

    await post(admin, ROUTES.deleteLeader(LEADER_A_ID));

    expect((await dumpDatabase(request)).onboarding_progress).toEqual([]);
  });

  test('the other leader team is untouched', async ({ request }) => {
    await post(admin, ROUTES.deleteLeader(LEADER_A_ID));

    const dump = await dumpDatabase(request);
    const survivor = dump.users.find((u) => u.id === LEADER_B_ID);
    expect(survivor).toMatchObject({ email: CREDENTIALS.leaderB.email, role: 'leader' });
    expect(dump.teams).toEqual([
      expect.objectContaining({ id: 2, leader_id: LEADER_B_ID }),
    ]);
  });

  test('deleting the childless leader leaves the populated team intact', async ({ request }) => {
    expectRedirect(await post(admin, ROUTES.deleteLeader(LEADER_B_ID)), '/admin/leaders');

    const dump = await dumpDatabase(request);
    expect(dump.users).toHaveLength(5); // only Leader B removed
    expect(dump.teams).toHaveLength(1);
    expect(dump.teams[0].leader_id).toBe(LEADER_A_ID);
    expect(dump.onboarding_progress).toHaveLength(4);
  });

  test('deleting both leaders empties everything but the superadmin', async ({ request }) => {
    await post(admin, ROUTES.deleteLeader(LEADER_A_ID));
    await post(admin, ROUTES.deleteLeader(LEADER_B_ID));

    const dump = await dumpDatabase(request);
    expect(dump.users.map((u) => u.role)).toEqual(['superadmin']);
    expect(dump.teams).toEqual([]);
    expect(dump.invitations).toEqual([]);
    expect(dump.onboarding_progress).toEqual([]);
  });

  test('a deleted leader can no longer log in', async ({ playwright, baseURL }) => {
    await post(admin, ROUTES.deleteLeader(LEADER_A_ID));

    const anon = await playwright.request.newContext({ baseURL });
    const res = await anon.post('/login', { form: CREDENTIALS.leaderA, maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });

  test('a member of a deleted team can no longer log in', async ({ playwright, baseURL }) => {
    await post(admin, ROUTES.deleteLeader(LEADER_A_ID));

    const anon = await playwright.request.newContext({ baseURL });
    const res = await anon.post('/login', { form: CREDENTIALS.memberThree, maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });
});
