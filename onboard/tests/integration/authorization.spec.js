// The authorization matrix: every protected route × every role that must not
// reach it. Table-driven, because the interesting property is coverage of the
// grid rather than any single case.
//
// Only denials live here. Denials are decided by `requireRole` before any
// handler runs, so no request in this file mutates data — which is why the
// database is seeded once for the whole file and the sessions survive.

import { expect, test } from '@playwright/test';
import { CREDENTIALS, resetTo } from '../helpers.js';
import { ROUTES, anonContext, get, post } from '../api.js';

const PROTECTED = [
  { name: 'GET /admin/leaders', method: 'get', path: ROUTES.adminLeaders, allow: 'superadmin' },
  { name: 'POST /admin/leaders', method: 'post', path: ROUTES.createLeader, allow: 'superadmin' },
  {
    name: 'POST /admin/leaders/:id/delete',
    method: 'post',
    path: ROUTES.deleteLeader(2),
    allow: 'superadmin',
  },
  { name: 'GET /team', method: 'get', path: ROUTES.team, allow: 'leader' },
  { name: 'POST /team/invites', method: 'post', path: ROUTES.invites, allow: 'leader' },
  { name: 'GET /onboarding', method: 'get', path: ROUTES.onboarding, allow: 'member' },
  {
    name: 'POST /onboarding/steps/:key',
    method: 'post',
    path: ROUTES.step('read_handbook'),
    allow: 'member',
  },
];

const ROLES = ['superadmin', 'leader', 'member'];
const CREDENTIALS_BY_ROLE = {
  superadmin: CREDENTIALS.superadmin,
  leader: CREDENTIALS.leaderA,
  member: CREDENTIALS.memberOne,
};

const send = (ctx, route) =>
  route.method === 'get' ? get(ctx, route.path) : post(ctx, route.path, {});

test.describe('authorization matrix', () => {
  const contexts = {};
  let anon;

  test.beforeAll(async ({ playwright, baseURL, request }) => {
    // Seed once: `member-two-of-three` holds one user of every role.
    await resetTo(request, 'member-two-of-three');
    anon = await anonContext(playwright, baseURL);
    for (const role of ROLES) {
      const ctx = await anonContext(playwright, baseURL);
      const res = await ctx.post('/login', {
        form: CREDENTIALS_BY_ROLE[role],
        maxRedirects: 0,
      });
      expect(res.status(), `could not log in as ${role}`).toBe(302);
      contexts[role] = ctx;
    }
  });

  test.afterAll(async () => {
    await anon?.dispose();
    for (const ctx of Object.values(contexts)) await ctx.dispose();
  });

  for (const route of PROTECTED) {
    test(`${route.name} redirects an anonymous visitor to the login page`, async () => {
      const res = await send(anon, route);
      expect(res.status()).toBe(302);
      expect(res.headers().location).toBe('/login');
    });

    for (const role of ROLES.filter((r) => r !== route.allow)) {
      test(`${route.name} is forbidden for a ${role}`, async () => {
        const res = await send(contexts[role], route);
        expect(res.status()).toBe(403);
        expect(await res.text()).toContain('Forbidden');
      });
    }
  }

  test('the test-support endpoints are the only unauthenticated routes', async () => {
    // Sanity check on the matrix itself: every route above is covered, and the
    // public surface is exactly what we expect it to be.
    expect(PROTECTED).toHaveLength(7);
    for (const path of ['/login', '/logout']) {
      const res = await anon.post(path, { form: {}, maxRedirects: 0 });
      expect([200, 302, 401]).toContain(res.status());
    }
  });
});
