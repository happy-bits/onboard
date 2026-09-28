// Creates the database in DATABASE_URL if it does not exist and applies the schema.
// If the database is empty it is seeded with the Superadmin.
import pg from 'pg';
import { config } from '../src/config.js';
import { createSchema, seed } from '../src/db/seed.js';

const url = new URL(config.databaseUrl);
const dbName = url.pathname.slice(1);

const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
if (!rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
await admin.end();

const db = new pg.Client({ connectionString: config.databaseUrl });
await db.connect();
await createSchema(db);
const { rows } = await db.query('SELECT count(*)::int AS n FROM users');
if (rows[0].n === 0) await seed(db, 'base');
await db.end();
console.log(`Database "${dbName}" ready.`);
