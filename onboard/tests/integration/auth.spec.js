// Integration layer: real Postgres, real HTTP, no browser.

import { expect, test } from '@playwright/test';
import { CREDENTIALS, dumpDatabase, resetTo } from '../helpers.js';
import { ROUTES, anonContext, expectRedirect, get, loginAs, post } from '../api.js';

test.beforeEach(async ({ request }) => {
  await resetTo(request, 'member-two-of-three');
});

test('the login page is reachable without a session', async ({ playwright, baseURL }) => {
  const anon = await anonContext(playwright, baseURL);
  const res = await get(anon, '/login');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('Log in');
});

test('each role is redirected to its own landing page', async ({ playwright, baseURL }) => {
  await loginAs(playwright, baseURL, CREDENTIALS.superadmin, '/admin/leaders');
  await loginAs(playwright, baseURL, CREDENTIALS.leaderA, '/team');
  await loginAs(playwright, baseURL, CREDENTIALS.memberOne, '/onboarding');
});

test('a session cookie is issued with a relative lifetime', async ({ playwright, baseURL }) => {
  const anon = await anonContext(playwright, baseURL);
  const res = await post(anon, '/login', CREDENTIALS.superadmin);
  const cookie = res.headers()['set-cookie'];
  expect(cookie).toContain('onboard_sid=');
  expect(cookie).toContain('HttpOnly');
  // Max-Age, not an absolute Expires derived from the fixed test clock —
  // see the warning in src/clock.js.
  expect(cookie).toContain('Max-Age=');
});

test('the wrong password is refused', async ({ playwright, baseURL }) => {
  const anon = await anonContext(playwright, baseURL);
  const res = await post(anon, '/login', {
    email: CREDENTIALS.superadmin.email,
    password: 'not-the-password',
  });
  expect(res.status()).toBe(401);
  expect(res.headers()['set-cookie']).toBeUndefined();
});

test('an unknown email is refused with the same message as a wrong password', async ({
  playwright,
  baseURL,
}) => {
  const anon = await anonContext(playwright, baseURL);
  const unknown = await post(anon, '/login', {
    email: 'nobody@onboard.test',
    password: 'whatever-pass',
  });
  const wrongPassword = await post(anon, '/login', {
    email: CREDENTIALS.superadmin.email,
    password: 'not-the-password',
  });

  const errorOf = (html) => html.match(/data-testid="error">([^<]*)</)?.[1]?.trim();

  expect(unknown.status()).toBe(wrongPassword.status());
  expect(unknown.status()).toBe(401);
  // The rendered message must be identical, so the form does not reveal which
  // addresses have accounts. (The two bodies as a whole differ, because the
  // form legitimately echoes back whatever email was submitted.)
  expect(errorOf(await unknown.text())).toBe(errorOf(await wrongPassword.text()));
  expect(errorOf(await unknown.text())).toBe('Wrong email or password.');
});

test('an empty password is refused', async ({ playwright, baseURL }) => {
  const anon = await anonContext(playwright, baseURL);
  const res = await post(anon, '/login', { email: CREDENTIALS.superadmin.email, password: '' });
  expect(res.status()).toBe(401);
});

test('the email address is matched case-insensitively', async ({ playwright, baseURL }) => {
  const anon = await anonContext(playwright, baseURL);
  const res = await post(anon, '/login', {
    email: CREDENTIALS.superadmin.email.toUpperCase(),
    password: CREDENTIALS.superadmin.password,
  });
  expectRedirect(res, '/admin/leaders');
});

test('surrounding whitespace in the email is ignored', async ({ playwright, baseURL }) => {
  const anon = await anonContext(playwright, baseURL);
  const res = await post(anon, '/login', {
    email: `  ${CREDENTIALS.superadmin.email}  `,
    password: CREDENTIALS.superadmin.password,
  });
  expectRedirect(res, '/admin/leaders');
});

test('the root path routes by role', async ({ playwright, baseURL }) => {
  const anon = await anonContext(playwright, baseURL);
  expectRedirect(await get(anon, '/'), '/login');

  const leader = await loginAs(playwright, baseURL, CREDENTIALS.leaderA);
  expectRedirect(await get(leader, '/'), '/team');
});

test('an already-logged-in visitor is bounced off the login page', async ({
  playwright,
  baseURL,
}) => {
  const member = await loginAs(playwright, baseURL, CREDENTIALS.memberOne);
  expectRedirect(await get(member, '/login'), '/onboarding');
});

test('logging out invalidates the session on the server, not just the cookie', async ({
  playwright,
  baseURL,
}) => {
  const member = await loginAs(playwright, baseURL, CREDENTIALS.memberOne);
  const stolen = await member.storageState();

  expectRedirect(await post(member, '/logout'), '/login');

  // Replay the pre-logout cookie from a fresh jar. The in-process session map
  // must have dropped it, so this cannot authenticate.
  const replay = await playwright.request.newContext({ baseURL, storageState: stolen });
  expectRedirect(await get(replay, ROUTES.onboarding), '/login');
  await replay.dispose();
});

test('a session whose user was cascade-deleted is logged out, not served an error', async ({
  playwright,
  baseURL,
  request,
}) => {
  await resetTo(request, 'two-leaders-one-with-member');

  const member = await loginAs(playwright, baseURL, CREDENTIALS.memberOne, '/onboarding');
  const admin = await loginAs(playwright, baseURL, CREDENTIALS.superadmin, '/admin/leaders');

  // Deleting the Leader cascades away the Member this session points at.
  expectRedirect(await post(admin, ROUTES.deleteLeader(2)), '/admin/leaders');
  expect((await dumpDatabase(request)).users).toHaveLength(2);

  const res = await get(member, ROUTES.onboarding);
  expect(res.status(), 'a dangling session must not produce a 500').toBe(302);
  expect(res.headers().location).toBe('/login');
});

test('an unknown path renders a 404 page', async ({ playwright, baseURL }) => {
  const anon = await anonContext(playwright, baseURL);
  const res = await get(anon, '/no-such-page');
  expect(res.status()).toBe(404);
  expect(await res.text()).toContain('Page not found');
});
