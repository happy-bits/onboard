import { expect, test } from '@playwright/test';
import { CREDENTIALS, STEPS, dumpDatabase, resetTo } from '../helpers.js';
import { ROUTES, checkStep, get, loginAs, post, uncheckStep } from '../api.js';

const progressOf = (dump, userId) =>
  dump.onboarding_progress.filter((p) => p.user_id === userId);

test.describe('onboarding progress', () => {
  let member;

  test.beforeEach(async ({ playwright, baseURL, request }) => {
    await resetTo(request, 'superadmin-and-leader');
    // Build a fresh Member through the real invitation flow so this file does
    // not depend on a seed with pre-existing progress.
    const leader = await loginAs(playwright, baseURL, CREDENTIALS.leaderA, '/team');
    await post(leader, ROUTES.invites, { email: 'invited-one@onboard.test' });
    const { invitations } = await dumpDatabase(request);
    const anon = await playwright.request.newContext({ baseURL });
    await anon.post(ROUTES.invite(invitations[0].token), {
      form: { password: 'invited-one-pass' },
      maxRedirects: 0,
    });
    member = anon;
  });

  test('a fresh member starts with no progress rows', async ({ request }) => {
    expect((await dumpDatabase(request)).onboarding_progress).toHaveLength(0);
    expect(await (await get(member, ROUTES.onboarding)).text()).toContain('0/3 completed');
  });

  test('checking a step writes exactly one row', async ({ request }) => {
    await checkStep(member, 'read_handbook');

    const dump = await dumpDatabase(request);
    expect(dump.onboarding_progress).toHaveLength(1);
    expect(dump.onboarding_progress[0]).toMatchObject({ step_key: 'read_handbook' });
  });

  test('checking all three steps writes three rows and reports completion', async ({
    request,
  }) => {
    for (const step of STEPS) await checkStep(member, step);

    const dump = await dumpDatabase(request);
    expect(dump.onboarding_progress.map((p) => p.step_key)).toEqual(STEPS);
    expect(await (await get(member, ROUTES.onboarding)).text()).toContain('Onboarding complete');
  });

  test('re-checking an already-checked step is idempotent', async ({ request }) => {
    await checkStep(member, 'read_handbook');
    const first = (await dumpDatabase(request)).onboarding_progress[0];

    await checkStep(member, 'read_handbook');

    const dump = await dumpDatabase(request);
    expect(dump.onboarding_progress).toHaveLength(1);
    // ON CONFLICT DO NOTHING: the original row is untouched, not replaced.
    expect(dump.onboarding_progress[0].id).toBe(first.id);
  });

  test('a double-submitted step still yields one row', async ({ request }) => {
    // Two concurrent writes, as a double-click would produce.
    await Promise.all([
      post(member, ROUTES.step('setup_accounts'), { checked: 'on' }),
      post(member, ROUTES.step('setup_accounts'), { checked: 'on' }),
    ]);

    expect((await dumpDatabase(request)).onboarding_progress).toHaveLength(1);
  });

  test('unchecking a step deletes its row', async ({ request }) => {
    await checkStep(member, 'read_handbook');
    await uncheckStep(member, 'read_handbook');

    expect((await dumpDatabase(request)).onboarding_progress).toHaveLength(0);
  });

  test('unchecking a step that was never checked is harmless', async ({ request }) => {
    await uncheckStep(member, 'meet_team');
    expect((await dumpDatabase(request)).onboarding_progress).toHaveLength(0);
  });

  test('re-checking after unchecking creates a new row', async ({ request }) => {
    await checkStep(member, 'read_handbook');
    const original = (await dumpDatabase(request)).onboarding_progress[0];

    await uncheckStep(member, 'read_handbook');
    await checkStep(member, 'read_handbook');

    const dump = await dumpDatabase(request);
    expect(dump.onboarding_progress).toHaveLength(1);
    expect(dump.onboarding_progress[0].id).toBeGreaterThan(original.id);
  });

  test('unchecking one step leaves the others alone', async ({ request }) => {
    for (const step of STEPS) await checkStep(member, step);
    await uncheckStep(member, 'setup_accounts');

    const dump = await dumpDatabase(request);
    expect(dump.onboarding_progress.map((p) => p.step_key)).toEqual([
      'read_handbook',
      'meet_team',
    ]);
  });

  test('an unknown step key is rejected and writes nothing', async ({ request }) => {
    for (const key of ['nope', 'READ_HANDBOOK', '..%2Fetc']) {
      const res = await post(member, ROUTES.step(key), { checked: 'on' });
      expect(res.status(), `should reject ${key}`).toBe(404);
    }
    expect((await dumpDatabase(request)).onboarding_progress).toHaveLength(0);
  });

  test('progress is attributed to the session user, not to request input', async ({ request }) => {
    const { users } = await dumpDatabase(request);
    const me = users.find((u) => u.role === 'member');

    // user_id is taken from the session; a forged body field must be ignored.
    await post(member, ROUTES.step('read_handbook'), { checked: 'on', user_id: '1' });

    const dump = await dumpDatabase(request);
    expect(progressOf(dump, me.id)).toHaveLength(1);
    expect(progressOf(dump, 1)).toHaveLength(0);
  });

  test('the leader sees the member progress count update', async ({
    playwright,
    baseURL,
    request,
  }) => {
    const leader = await loginAs(playwright, baseURL, CREDENTIALS.leaderA, '/team');
    expect(await (await get(leader, ROUTES.team)).text()).toContain('0/3');

    await checkStep(member, 'read_handbook');
    await checkStep(member, 'setup_accounts');

    const body = await (await get(leader, ROUTES.team)).text();
    expect(body).toContain('2/3');
    expect((await dumpDatabase(request)).onboarding_progress).toHaveLength(2);
  });

  test('a leader does not see members of another team', async ({ playwright, baseURL, request }) => {
    await resetTo(request, 'leader-with-three-members');
    const leaderB = await loginAs(playwright, baseURL, CREDENTIALS.leaderB, '/team');

    const body = await (await get(leaderB, ROUTES.team)).text();
    expect(body).toContain('No members have joined yet');
    for (const email of [CREDENTIALS.memberOne.email, CREDENTIALS.memberThree.email]) {
      expect(body).not.toContain(email);
    }
  });
});
