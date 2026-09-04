import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ONBOARDING_STEPS, TOTAL_STEPS, isStepKey } from '../../src/onboarding.js';

test('there are exactly three onboarding steps', () => {
  assert.equal(ONBOARDING_STEPS.length, 3);
  assert.equal(TOTAL_STEPS, 3);
});

test('step keys are unique and non-empty', () => {
  const keys = ONBOARDING_STEPS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every((k) => k.length > 0));
});

test('every step has a human-readable label', () => {
  assert.ok(ONBOARDING_STEPS.every((s) => typeof s.label === 'string' && s.label.length > 0));
});

test('isStepKey accepts known keys and rejects everything else', () => {
  for (const step of ONBOARDING_STEPS) assert.equal(isStepKey(step.key), true);
  for (const bad of ['', 'nope', 'READ_HANDBOOK', '../etc/passwd', null, undefined]) {
    assert.equal(isStepKey(bad), false, `should reject ${JSON.stringify(bad)}`);
  }
});
