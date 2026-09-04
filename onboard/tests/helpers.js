import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { ONBOARDING_STEPS } from '../src/onboarding.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_DIR = path.join(ROOT, 'tests', 'expected');
const ACTUAL_DIR = path.join(ROOT, 'var', 'dumps');

// Re-exported from the seeder rather than duplicated: a second copy of the
// credentials silently drifts out of date the moment a seed gains a user.
export { CREDENTIALS, INVITED } from '../src/seed.js';

export const STEPS = ONBOARDING_STEPS.map((step) => step.key);

/** Reset the database to a named deterministic seed. */
export async function resetTo(request, seed) {
  const res = await request.post(`/__test/reset?seed=${encodeURIComponent(seed)}`);
  expect(res.ok(), `reset to seed "${seed}" failed: ${res.status()}`).toBeTruthy();
}

export async function dumpDatabase(request) {
  const res = await request.get('/__test/dump');
  expect(res.ok(), `dump failed: ${res.status()}`).toBeTruthy();
  return res.json();
}

export async function outbox(request) {
  const res = await request.get('/__test/emails');
  expect(res.ok()).toBeTruthy();
  return res.json();
}

export function inviteUrlFrom(email) {
  const match = email.text.match(/http\S+/);
  expect(match, `no link found in email to ${email.to}`).not.toBeNull();
  return match[0];
}

/**
 * Compare the whole database against a checked-in expected dump.
 *
 * The expected file is NEVER written by the test run — a missing file is a
 * failure, not a cue to record one. That is deliberate: a snapshot helper that
 * self-heals on first run passes trivially and proves nothing. Regenerate
 * intentionally with `UPDATE_DUMPS=1 npx playwright test`, then read the diff.
 */
export function expectDatabaseMatches(name, dump) {
  fs.mkdirSync(ACTUAL_DIR, { recursive: true });
  const actualPath = path.join(ACTUAL_DIR, `${name}.json`);
  const actualJson = `${JSON.stringify(dump, null, 2)}\n`;
  fs.writeFileSync(actualPath, actualJson);

  const expectedPath = path.join(EXPECTED_DIR, `${name}.json`);

  if (process.env.UPDATE_DUMPS === '1') {
    fs.mkdirSync(EXPECTED_DIR, { recursive: true });
    fs.writeFileSync(expectedPath, actualJson);
    throw new Error(
      `Recorded expected dump ${path.relative(ROOT, expectedPath)}. ` +
        'Review it, then re-run without UPDATE_DUMPS=1.',
    );
  }

  expect(
    fs.existsSync(expectedPath),
    `Missing expected dump ${path.relative(ROOT, expectedPath)}. ` +
      'Record it with UPDATE_DUMPS=1 and review the result.',
  ).toBeTruthy();

  expect(dump).toEqual(JSON.parse(fs.readFileSync(expectedPath, 'utf8')));
}

// ------------------------------------------------------------------ page flows

export async function login(page, { email, password }) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await expect(page.getByTestId('current-user')).toContainText(email);
}

export async function logout(page) {
  await page.click('header button[type=submit]');
  await expect(page).toHaveURL(/\/login$/);
}

export function stepCheckbox(page, stepKey) {
  return page.locator(`[data-testid=step-checkbox][data-step="${stepKey}"]`);
}

/** Check one onboarding box and wait for the resulting navigation to settle. */
export async function checkStep(page, stepKey) {
  await Promise.all([
    page.waitForURL(/\/onboarding$/),
    stepCheckbox(page, stepKey).check(),
  ]);
  await expect(stepCheckbox(page, stepKey)).toBeChecked();
}
