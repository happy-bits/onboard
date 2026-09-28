import { test as base, expect } from '@playwright/test';
import pg from 'pg';
import { TEST_DATABASE_URL } from '../../playwright.config';
import { dumpDatabase } from '../../src/db/dump.js';
import { resetDatabase } from '../../src/db/seed.js';

type Scenario = 'base' | 'with-leader';

type Fixtures = {
  db: {
    /** Truncates all tables, re-seeds the given scenario and empties the fake mailbox. */
    reset: (scenario: Scenario) => Promise<void>;
    /** Returns every table and row; also attaches the dump as JSON to the test report. */
    dump: () => Promise<Record<string, Record<string, unknown>[]>>;
  };
};

export const test = base.extend<Fixtures>({
  db: async ({ request }, use, testInfo) => {
    const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
    await use({
      reset: async (scenario) => {
        await resetDatabase(pool, scenario);
        expect((await request.delete('/dev/mailbox')).ok()).toBeTruthy();
      },
      dump: async () => {
        const dump = await dumpDatabase(pool);
        await testInfo.attach('db-dump.json', {
          body: JSON.stringify(dump, null, 2),
          contentType: 'application/json',
        });
        return dump;
      },
    });
    await pool.end();
  },
});

export { expect };

// Matchers for values that are legitimately generated at runtime.
export const anyTimestamp = () => expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
export const anyPasswordHash = () => expect.stringMatching(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
export const anyInviteToken = () => expect.stringMatching(/^[0-9a-f]{64}$/);
