import pg from 'pg';

export const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://onboard:onboard@127.0.0.1:5473/onboard';

// Return timestamptz as the raw string Postgres sends so the JSON dump does not
// depend on the machine's local timezone.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => v);

export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

export function query(text, params) {
  return pool.query(text, params);
}

export async function one(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
}

export async function all(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}
