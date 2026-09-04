// Part of `npm run build`: compile every template so a syntax error in a view
// fails here — in seconds, naming the file — instead of surfacing later as an
// e2e timeout on an element that never rendered.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';

const views = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'views');
const files = fs.readdirSync(views).filter((f) => f.endsWith('.ejs'));

let failed = 0;
for (const file of files) {
  const full = path.join(views, file);
  try {
    ejs.compile(fs.readFileSync(full, 'utf8'), { filename: full });
  } catch (err) {
    failed += 1;
    console.error(`✗ ${file}: ${err.message.split('\n')[0]}`);
  }
}

if (failed > 0) {
  console.error(`${failed} of ${files.length} templates failed to compile`);
  process.exit(1);
}
console.log(`✓ ${files.length} templates compile`);
