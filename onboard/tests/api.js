// Helpers for the integration layer: real Postgres, real HTTP, no browser.
//
// Each role gets its own APIRequestContext, i.e. its own cookie jar, so a test
// can act as several users at once without a browser in sight.

import { expect } from '@playwright/test';

export const ROUTES = {
  adminLeaders: '/admin/leaders',
  createLeader: '/admin/leaders',
  deleteLeader: (id) => `/admin/leaders/${id}/delete`,
  team: '/team',
  invites: '/team/invites',
  onboarding: '/onboarding',
  step: (key) => `/onboarding/steps/${key}`,
  invite: (token) => `/invite/${token}`,
};

/** A logged-out client with its own cookie jar. */
export function anonContext(playwright, baseURL) {
  return playwright.request.newContext({ baseURL });
}

/** A client logged in as the given user, verified by the redirect it gets. */
export async function loginAs(playwright, baseURL, credentials, expectedHome) {
  const ctx = await anonContext(playwright, baseURL);
  const res = await ctx.post('/login', { form: credentials, maxRedirects: 0 });
  expect(res.status(), `login failed for ${credentials.email}`).toBe(302);
  if (expectedHome) expect(res.headers().location).toBe(expectedHome);
  return ctx;
}

/** Follow no redirects, so a 302 stays a 302 instead of becoming the target. */
export const NO_REDIRECT = { maxRedirects: 0 };

export async function get(ctx, path) {
  return ctx.get(path, NO_REDIRECT);
}

export async function post(ctx, path, form = {}) {
  return ctx.post(path, { form, ...NO_REDIRECT });
}

/** Assert a response redirected to `location`. */
export function expectRedirect(res, location) {
  expect(res.status()).toBe(302);
  if (location) expect(res.headers().location).toBe(location);
}

/** Check one onboarding step as the given client. */
export async function checkStep(ctx, stepKey) {
  const res = await post(ctx, ROUTES.step(stepKey), { checked: 'on' });
  expectRedirect(res, '/onboarding');
  return res;
}

export async function uncheckStep(ctx, stepKey) {
  const res = await post(ctx, ROUTES.step(stepKey), { checked: 'off' });
  expectRedirect(res, '/onboarding');
  return res;
}

/** Pull the invitation link out of the newest fake email. */
export function linkFromLatestEmail(emails) {
  expect(emails.length, 'no email was sent').toBeGreaterThan(0);
  const match = emails.at(-1).text.match(/http\S+/);
  expect(match, 'no link in the email body').not.toBeNull();
  return match[0];
}

export function tokenFromLink(link) {
  const match = link.match(/\/invite\/([a-f0-9]+)$/);
  expect(match, `not an invite link: ${link}`).not.toBeNull();
  return match[1];
}
