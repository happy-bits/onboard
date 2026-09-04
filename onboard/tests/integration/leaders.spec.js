import { expect, test } from '@playwright/test';
import { CREDENTIALS, dumpDatabase, resetTo } from '../helpers.js';
import { ROUTES, expectRedirect, get, loginAs, post } from '../api.js';

const NEW_LEADER = { email: 'new-leader@onboard.test', password: 'new-leader-pass' };

test.describe('superadmin manages leaders', () => {
  let admin;

  test.beforeEach(async ({ playwright, baseURL, request }) => {
    await resetTo(request, 'base');
    admin = await loginAs(playwright, baseURL, CREDENTIALS.superadmin, '/admin/leaders');
  });

  test('creating a leader also creates exactly one team for them', async ({ request }) => {
    expectRedirect(await post(admin, ROUTES.createLeader, NEW_LEADER), '/admin/leaders');

    const dump = await dumpDatabase(request);
    expect(dump.users).toHaveLength(2);
    expect(dump.users[1]).toMatchObject({
      email: NEW_LEADER.email,
      role: 'leader',
      // A Leader owns a team but is not a member of one.
      team_id: null,
    });
    expect(dump.teams).toHaveLength(1);
    expect(dump.teams[0]).toMatchObject({
      leader_id: dump.users[1].id,
      name: `${NEW_LEADER.email}'s team`,
    });
  });

  test('the new leader can log in with the password that was set', async ({
    playwright,
    baseURL,
  }) => {
    await post(admin, ROUTES.createLeader, NEW_LEADER);
    await loginAs(playwright, baseURL, NEW_LEADER, '/team');
  });

  test('a duplicate email is rejected and creates nothing', async ({ request }) => {
    await post(admin, ROUTES.createLeader, NEW_LEADER);
    const res = await post(admin, ROUTES.createLeader, NEW_LEADER);

    expect(res.status()).toBe(302);
    expect(res.headers().location).toContain('error=');

    const dump = await dumpDatabase(request);
    expect(dump.users.filter((u) => u.email === NEW_LEADER.email)).toHaveLength(1);
    expect(dump.teams).toHaveLength(1);
  });

  test('the superadmin email cannot be reused for a leader', async ({ request }) => {
    const res = await post(admin, ROUTES.createLeader, {
      email: CREDENTIALS.superadmin.email,
      password: 'whatever-pass',
    });
    expect(res.headers().location).toContain('error=');
    expect((await dumpDatabase(request)).users).toHaveLength(1);
  });

  test('a missing email or password is rejected', async ({ request }) => {
    for (const form of [
      { email: '', password: 'x-pass' },
      { email: 'x@onboard.test', password: '' },
      {},
    ]) {
      const res = await post(admin, ROUTES.createLeader, form);
      expect(res.headers().location).toContain('error=');
    }
    expect((await dumpDatabase(request)).users).toHaveLength(1);
  });

  test('the email is stored lowercased and trimmed', async ({ request }) => {
    await post(admin, ROUTES.createLeader, {
      email: '  MiXeD@Onboard.TEST  ',
      password: 'mixed-pass',
    });
    const dump = await dumpDatabase(request);
    expect(dump.users[1].email).toBe('mixed@onboard.test');
  });

  test('the leader list shows each leader and their member count', async ({
    playwright,
    baseURL,
    request,
  }) => {
    // Reset before logging in: /__test/reset also clears server-side sessions.
    await resetTo(request, 'two-leaders-one-with-member');
    const ctx = await loginAs(playwright, baseURL, CREDENTIALS.superadmin, '/admin/leaders');

    const body = await (await get(ctx, ROUTES.adminLeaders)).text();
    expect(body).toContain(CREDENTIALS.leaderA.email);
    expect(body).toContain(CREDENTIALS.leaderB.email);
    // Leader A has one member, Leader B has none.
    expect(body).toMatch(/leader-a@onboard\.test[\s\S]*?<td>1<\/td>/);
    expect(body).toMatch(/leader-b@onboard\.test[\s\S]*?<td>0<\/td>/);
  });

  test('removing a leader deletes them and their team', async ({ request }) => {
    await post(admin, ROUTES.createLeader, NEW_LEADER);
    const created = (await dumpDatabase(request)).users[1];

    expectRedirect(await post(admin, ROUTES.deleteLeader(created.id)), '/admin/leaders');

    const dump = await dumpDatabase(request);
    expect(dump.users).toHaveLength(1);
    expect(dump.users[0].role).toBe('superadmin');
    expect(dump.teams).toHaveLength(0);
  });

  test('removing a non-existent leader is a harmless no-op', async ({ request }) => {
    expectRedirect(await post(admin, ROUTES.deleteLeader(9999)), '/admin/leaders');
    expect((await dumpDatabase(request)).users).toHaveLength(1);
  });

  test('the delete route refuses to remove a member', async ({
    playwright,
    baseURL,
    request,
  }) => {
    await resetTo(request, 'two-leaders-one-with-member');
    const ctx = await loginAs(playwright, baseURL, CREDENTIALS.superadmin, '/admin/leaders');

    const member = (await dumpDatabase(request)).users.find((u) => u.role === 'member');
    expect(member).toBeDefined();

    // The route filters on role = 'leader', so a member id must be inert —
    // no deletion, and no cascade of their progress.
    expectRedirect(await post(ctx, ROUTES.deleteLeader(member.id)), '/admin/leaders');

    const dump = await dumpDatabase(request);
    expect(dump.users).toHaveLength(4);
    expect(dump.users.some((u) => u.id === member.id)).toBeTruthy();
    expect(dump.onboarding_progress).toHaveLength(1);
  });

  test('the delete route refuses to remove the superadmin', async ({
    playwright,
    baseURL,
    request,
  }) => {
    const self = await loginAs(playwright, baseURL, CREDENTIALS.superadmin, '/admin/leaders');
    const admins = (await dumpDatabase(request)).users.filter((u) => u.role === 'superadmin');

    // The route filters on role = 'leader', so this must not delete anything.
    expectRedirect(await post(self, ROUTES.deleteLeader(admins[0].id)), '/admin/leaders');
    expect((await dumpDatabase(request)).users).toHaveLength(1);
  });
});
