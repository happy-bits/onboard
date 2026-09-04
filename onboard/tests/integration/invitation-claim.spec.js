// Atomicity of the single-use invitation claim.
//
// This cannot be tested over HTTP: the window between reading an invitation and
// committing the claim is well under a millisecond, so even ten parallel
// requests are serialised by request arrival and the second one is caught by
// the handler's cheap pre-check instead of by the claim itself. Measured — the
// HTTP-level race test in invitations.spec.js passes even when the
// `AND status = 'pending'` predicate is deleted.
//
// So this file drives two transactions directly and interleaves them by hand.
// Postgres row locking makes the ordering deterministic, and the test does fail
// when that predicate is removed.

import { expect, test } from '@playwright/test';
import { pool } from '../../src/db.js';
import { claimInvitation } from '../../src/invitations.js';
import { dumpDatabase, resetTo } from '../helpers.js';

test.afterAll(async () => {
  // The worker holds real DB clients here, unlike every other spec.
  await pool.end();
});

test('two interleaved transactions cannot both claim one invitation', async ({ request }) => {
  await resetTo(request, 'pending-invitation');
  const { invitations } = await dumpDatabase(request);
  const id = invitations[0].id;

  const first = await pool.connect();
  const second = await pool.connect();

  try {
    await first.query('BEGIN');
    await second.query('BEGIN');

    // The first transaction claims the row and holds the lock.
    const claimed = await claimInvitation(first, id);
    expect(claimed, 'the first transaction should win').not.toBeNull();
    expect(claimed.status).toBe('accepted');

    // The second now blocks on that lock. Do not await it yet.
    const contender = claimInvitation(second, id);

    await first.query('COMMIT');

    // Released, the second re-evaluates `status = 'pending'` against the
    // committed value, matches nothing, and comes back empty.
    expect(await contender, 'the second transaction must claim nothing').toBeNull();
    await second.query('COMMIT');
  } finally {
    first.release();
    second.release();
  }

  const dump = await dumpDatabase(request);
  expect(dump.invitations).toHaveLength(1);
  expect(dump.invitations[0].status).toBe('accepted');
});

test('claiming an already-accepted invitation returns nothing', async ({ request }) => {
  await resetTo(request, 'two-leaders-one-with-member');
  const { invitations } = await dumpDatabase(request);
  expect(invitations[0].status).toBe('accepted');

  const client = await pool.connect();
  try {
    expect(await claimInvitation(client, invitations[0].id)).toBeNull();
  } finally {
    client.release();
  }
});

test('claiming a non-existent invitation returns nothing', async () => {
  const client = await pool.connect();
  try {
    expect(await claimInvitation(client, 999_999)).toBeNull();
  } finally {
    client.release();
  }
});
