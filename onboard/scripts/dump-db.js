import fs from 'node:fs';
import { dumpDatabase } from '../src/dump.js';
import { pool } from '../src/db.js';

const out = process.argv[2];
const dump = await dumpDatabase();
const json = `${JSON.stringify(dump, null, 2)}\n`;

if (out) {
  fs.writeFileSync(out, json);
  console.log(`wrote ${out}`);
} else {
  process.stdout.write(json);
}

await pool.end();
