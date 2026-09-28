// Usage: node scripts/reset-db.js [base|with-leader]
import { pool } from '../src/db/pool.js';
import { resetDatabase } from '../src/db/seed.js';

const scenario = process.argv[2] ?? 'base';
await resetDatabase(pool, scenario);
await pool.end();
console.log(`Database reset with seed scenario "${scenario}".`);
