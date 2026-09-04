import { resetDatabase, SEED_NAMES } from '../src/seed.js';
import { pool } from '../src/db.js';

const seed = process.argv[2] || 'base';

try {
  await resetDatabase(seed);
  console.log(`database reset with seed "${seed}"`);
} catch (err) {
  console.error(err.message);
  console.error(`available seeds: ${SEED_NAMES.join(', ')}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
