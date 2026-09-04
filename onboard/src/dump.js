// Whole-database dump: every table, every row, deterministically ordered.
// Used by `npm run dump`, the GET /__test/dump endpoint, and the e2e assertions.

import { all } from './db.js';

export const DUMPED_TABLES = ['users', 'teams', 'invitations', 'onboarding_progress'];

export async function dumpDatabase() {
  const dump = {};
  for (const table of DUMPED_TABLES) {
    // Table names come from the constant above, never from user input.
    dump[table] = await all(`SELECT * FROM ${table} ORDER BY id`);
  }
  return dump;
}
