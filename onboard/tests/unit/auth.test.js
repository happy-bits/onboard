import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, homePathFor, verifyPassword } from '../../src/auth.js';

test('hashPassword is deterministic for the same email and password', () => {
  assert.equal(hashPassword('a@b.test', 'secret'), hashPassword('a@b.test', 'secret'));
});

test('hashPassword differs for the same password under different emails', () => {
  // This is the whole point of the (email-derived) salt.
  assert.notEqual(hashPassword('a@b.test', 'secret'), hashPassword('c@d.test', 'secret'));
});

test('hashPassword differs for different passwords', () => {
  assert.notEqual(hashPassword('a@b.test', 'secret'), hashPassword('a@b.test', 'secret2'));
});

test('hashPassword never stores the password in the clear', () => {
  assert.ok(!hashPassword('a@b.test', 'hunter2').includes('hunter2'));
});

test('verifyPassword accepts the right password and rejects wrong ones', () => {
  const user = { email: 'a@b.test', password_hash: hashPassword('a@b.test', 'secret') };
  assert.equal(verifyPassword(user, 'secret'), true);
  assert.equal(verifyPassword(user, 'Secret'), false);
  assert.equal(verifyPassword(user, ''), false);
  assert.equal(verifyPassword(user, 'secret '), false);
});

test('verifyPassword rejects a hash minted for a different email', () => {
  const user = { email: 'a@b.test', password_hash: hashPassword('c@d.test', 'secret') };
  assert.equal(verifyPassword(user, 'secret'), false);
});

test('homePathFor routes each role to its own landing page', () => {
  assert.equal(homePathFor({ role: 'superadmin' }), '/admin/leaders');
  assert.equal(homePathFor({ role: 'leader' }), '/team');
  assert.equal(homePathFor({ role: 'member' }), '/onboarding');
});

test('homePathFor sends anonymous visitors to the login page', () => {
  assert.equal(homePathFor(null), '/login');
  assert.equal(homePathFor(undefined), '/login');
});
