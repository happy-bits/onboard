import { expect, test } from '@playwright/test';
import { CREDENTIALS, dumpDatabase, outbox, resetTo } from '../helpers.js';
import { inviteToken } from '../../src/invitations.js';
import {
  ROUTES,
  anonContext,
  expectRedirect,
  get,
  linkFromLatestEmail,
  loginAs,
  post,
  tokenFromLink,
} from '../api.js';

const INVITEE = 'invited-one@onboard.test';
const PASSWORD = 'invited-one-pass';

test.describe('sending invitations', () => {
  let leader;

  test.beforeEach(async ({ playwright, baseURL, request }) => {
    await resetTo(request, 'superadmin-and-leader');
    leader = await loginAs(playwright, baseURL, CREDENTIALS.leaderA, '/team');
  });

  test('an invitation is stored as pending and emailed with a matching link', async ({
    request,
  }) => {
    expectRedirect(await post(leader, ROUTES.invites, { email: INVITEE }));

    const dump = await dumpDatabase(request);
    expect(dump.invitations).toHaveLength(1);
    expect(dump.invitations[0]).toMatchObject({
      email: INVITEE,
      team_id: 1,
      status: 'pending',
      accepted_at: null,
    });

    const emails = await outbox(request);
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(INVITEE);
    // The emailed token must be the one in the database, not a re-derivation.
    expect(tokenFromLink(linkFromLatestEmail(emails))).toBe(dump.invitations[0].token);
  });

  test('the invitation token matches the documented derivation', async ({ request }) => {
    await post(leader, ROUTES.invites, { email: INVITEE });
    const dump = await dumpDatabase(request);
    expect(dump.invitations[0].token).toBe(inviteToken(1, INVITEE, 0));
  });

  test('inviting the same address twice while pending is rejected', async ({ request }) => {
    await post(leader, ROUTES.invites, { email: INVITEE });
    const res = await post(leader, ROUTES.invites, { email: INVITEE });

    expect(res.headers().location).toContain('error=');
    expect((await dumpDatabase(request)).invitations).toHaveLength(1);
    expect(await outbox(request)).toHaveLength(1);
  });

  test('inviting someone who already has an account is rejected', async ({ request }) => {
    const res = await post(leader, ROUTES.invites, { email: CREDENTIALS.superadmin.email });
    expect(res.headers().location).toContain('error=');
    expect((await dumpDatabase(request)).invitations).toHaveLength(0);
    expect(await outbox(request)).toHaveLength(0);
  });

  test('an empty email address is rejected', async ({ request }) => {
    const res = await post(leader, ROUTES.invites, { email: '   ' });
    expect(res.headers().location).toContain('error=');
    expect((await dumpDatabase(request)).invitations).toHaveLength(0);
  });

  test('the invited address is lowercased and trimmed', async ({ request }) => {
    await post(leader, ROUTES.invites, { email: '  INVITED-One@Onboard.TEST ' });
    expect((await dumpDatabase(request)).invitations[0].email).toBe(INVITEE);
  });

  test('two different invitations produce two emails and two rows', async ({ request }) => {
    await post(leader, ROUTES.invites, { email: INVITEE });
    await post(leader, ROUTES.invites, { email: 'invited-two@onboard.test' });

    const dump = await dumpDatabase(request);
    expect(dump.invitations.map((i) => i.email)).toEqual([INVITEE, 'invited-two@onboard.test']);
    expect(new Set(dump.invitations.map((i) => i.token)).size).toBe(2);
    expect((await outbox(request)).map((m) => m.to)).toEqual([
      INVITEE,
      'invited-two@onboard.test',
    ]);
  });
});

test.describe('accepting invitations', () => {
  const TOKEN = inviteToken(1, INVITEE, 0);

  test.beforeEach(async ({ request }) => {
    await resetTo(request, 'pending-invitation');
  });

  test('the accept page names the invited address', async ({ playwright, baseURL }) => {
    const anon = await anonContext(playwright, baseURL);
    const res = await get(anon, ROUTES.invite(TOKEN));
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain(INVITEE);
  });

  test('accepting creates a member on the inviting leader team', async ({
    playwright,
    baseURL,
    request,
  }) => {
    const anon = await anonContext(playwright, baseURL);
    expectRedirect(await post(anon, ROUTES.invite(TOKEN), { password: PASSWORD }), '/onboarding');

    const dump = await dumpDatabase(request);
    const members = dump.users.filter((u) => u.role === 'member');
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ email: INVITEE, team_id: 1 });
    expect(dump.invitations[0]).toMatchObject({ status: 'accepted' });
    expect(dump.invitations[0].accepted_at).not.toBeNull();
  });

  test('accepting logs the new member straight in', async ({ playwright, baseURL }) => {
    const anon = await anonContext(playwright, baseURL);
    await post(anon, ROUTES.invite(TOKEN), { password: PASSWORD });
    const res = await get(anon, ROUTES.onboarding);
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('Your onboarding');
  });

  test('the account email comes from the invitation, not the request body', async ({
    playwright,
    baseURL,
    request,
  }) => {
    const anon = await anonContext(playwright, baseURL);
    // An attacker holding the link must not be able to choose the address.
    await post(anon, ROUTES.invite(TOKEN), {
      password: PASSWORD,
      email: 'attacker@evil.test',
      role: 'superadmin',
      team_id: '99',
    });

    const dump = await dumpDatabase(request);
    expect(dump.users.map((u) => u.email)).not.toContain('attacker@evil.test');
    const member = dump.users.find((u) => u.role === 'member');
    expect(member).toMatchObject({ email: INVITEE, role: 'member', team_id: 1 });
  });

  test('a short password is refused and leaves the invitation usable', async ({
    playwright,
    baseURL,
    request,
  }) => {
    const anon = await anonContext(playwright, baseURL);
    const res = await post(anon, ROUTES.invite(TOKEN), { password: 'short' });
    expect(res.status()).toBe(400);

    // Validation happens before the claim, so nothing was consumed.
    const dump = await dumpDatabase(request);
    expect(dump.users.filter((u) => u.role === 'member')).toHaveLength(0);
    expect(dump.invitations[0].status).toBe('pending');

    // And the link still works afterwards.
    expectRedirect(await post(anon, ROUTES.invite(TOKEN), { password: PASSWORD }), '/onboarding');
  });

  test('an unknown token is refused', async ({ playwright, baseURL, request }) => {
    const anon = await anonContext(playwright, baseURL);
    const res = await get(anon, ROUTES.invite('0'.repeat(32)));
    expect(res.status()).toBe(410);
    expect(await res.text()).toContain('not valid');
    expect((await dumpDatabase(request)).users.filter((u) => u.role === 'member')).toHaveLength(0);
  });

  test('a used token is refused with a distinct message', async ({ playwright, baseURL }) => {
    const anon = await anonContext(playwright, baseURL);
    await post(anon, ROUTES.invite(TOKEN), { password: PASSWORD });

    const res = await get(anon, ROUTES.invite(TOKEN));
    expect(res.status()).toBe(410);
    expect(await res.text()).toContain('already been used');
  });

  test('posting to a used token does not create a second account', async ({
    playwright,
    baseURL,
    request,
  }) => {
    const anon = await anonContext(playwright, baseURL);
    await post(anon, ROUTES.invite(TOKEN), { password: PASSWORD });

    const replay = await post(anon, ROUTES.invite(TOKEN), { password: 'second-pass' });
    expect(replay.status()).toBe(410);
    expect((await dumpDatabase(request)).users.filter((u) => u.role === 'member')).toHaveLength(1);
  });

  test('two simultaneous redemptions create exactly one member', async ({
    playwright,
    baseURL,
    request,
  }) => {
    const [a, b] = await Promise.all([
      anonContext(playwright, baseURL),
      anonContext(playwright, baseURL),
    ]);

    // This asserts the user-visible invariant only: whatever the interleaving,
    // one client is let in and the other is refused. It does NOT prove the
    // claim is atomic — measured, the race window is under a millisecond and
    // the second request is caught by the handler's pre-check, so this test
    // still passes with the `AND status = 'pending'` predicate deleted.
    // The atomicity itself is covered in invitation-claim.spec.js.
    const [first, second] = await Promise.all([
      post(a, ROUTES.invite(TOKEN), { password: 'race-one-pass' }),
      post(b, ROUTES.invite(TOKEN), { password: 'race-two-pass' }),
    ]);

    expect([first.status(), second.status()].sort()).toEqual([302, 410]);

    const dump = await dumpDatabase(request);
    expect(dump.users.filter((u) => u.role === 'member')).toHaveLength(1);
    expect(dump.invitations).toHaveLength(1);
    expect(dump.invitations[0].status).toBe('accepted');
  });
});
