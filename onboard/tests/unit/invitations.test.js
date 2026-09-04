// Unit layer: pure functions, no database, no HTTP. Run with `node --test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inviteToken, inviteUrl } from '../../src/invitations.js';

test('inviteToken is deterministic for the same inputs', () => {
  assert.equal(inviteToken(1, 'a@b.test', 0), inviteToken(1, 'a@b.test', 0));
});

test('inviteToken is a 32-character hex string', () => {
  const token = inviteToken(1, 'a@b.test', 0);
  assert.match(token, /^[0-9a-f]{32}$/);
});

test('inviteToken varies with team, email and sequence number', () => {
  const base = inviteToken(1, 'a@b.test', 0);
  assert.notEqual(base, inviteToken(2, 'a@b.test', 0), 'team must matter');
  assert.notEqual(base, inviteToken(1, 'c@d.test', 0), 'email must matter');
  assert.notEqual(base, inviteToken(1, 'a@b.test', 1), 'sequence must matter');
});

test('inviteToken collisions are absent across a spread of inputs', () => {
  const tokens = new Set();
  for (let team = 1; team <= 20; team += 1) {
    for (let nth = 0; nth < 5; nth += 1) {
      tokens.add(inviteToken(team, `person-${team}@onboard.test`, nth));
    }
  }
  assert.equal(tokens.size, 100);
});

test('inviteUrl joins the base URL and token without a double slash', () => {
  assert.equal(inviteUrl('http://x.test', 'abc'), 'http://x.test/invite/abc');
});
