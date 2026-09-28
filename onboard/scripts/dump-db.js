// Usage: node scripts/dump-db.js [output.json]
import fs from 'node:fs';
import { pool } from '../src/db/pool.js';
import { dumpDatabase } from '../src/db/dump.js';

const out = process.argv[2] ?? 'db-dump.json';
const dump = await dumpDatabase(pool);
await pool.end();
fs.writeFileSync(out, JSON.stringify(dump, null, 2) + '\n');
console.log(`Wrote ${out}`);
