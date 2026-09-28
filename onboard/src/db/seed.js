import fs from 'node:fs';
import { hashPassword } from '../passwords.js';

// Seed data must be identical on every run: fixed ids, fixed timestamps and
// fixed password salts (no randomness, no "now").
export const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export const SUPERADMIN = {
  id: 1,
  email: 'superadmin@onboard.local',
  name: 'Super Admin',
  password: 'superadmin',
};

export const SEED_LEADER = {
  id: 2,
  email: 'leader@onboard.local',
  name: 'Lena Leader',
  password: 'leader',
  teamId: 1,
  teamName: "Lena Leader's team",
};

export const seedPasswordHash = (user) => hashPassword(user.password, `seed-${user.email}`);

const schemaSql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export async function createSchema(db) {
  await db.query(schemaSql);
}

export async function truncateAll(db) {
  await db.query('TRUNCATE onboarding_steps, invitations, users, teams RESTART IDENTITY CASCADE');
}

async function syncSequences(db) {
  for (const table of ['users', 'teams', 'invitations']) {
    await db.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`,
    );
  }
}

/**
 * Scenarios:
 *  - "base":        only the Superadmin (the initial state of a fresh database)
 *  - "with-leader": Superadmin + one Leader with a team
 */
export async function seed(db, scenario = 'base') {
  await db.query(
    `INSERT INTO users (id, email, name, password_hash, role, team_id, created_at)
     VALUES ($1, $2, $3, $4, 'superadmin', NULL, $5)`,
    [SUPERADMIN.id, SUPERADMIN.email, SUPERADMIN.name, seedPasswordHash(SUPERADMIN), SEED_TIMESTAMP],
  );

  if (scenario === 'with-leader') {
    await db.query(`INSERT INTO teams (id, name, created_at) VALUES ($1, $2, $3)`, [
      SEED_LEADER.teamId,
      SEED_LEADER.teamName,
      SEED_TIMESTAMP,
    ]);
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, role, team_id, created_at)
       VALUES ($1, $2, $3, $4, 'leader', $5, $6)`,
      [SEED_LEADER.id, SEED_LEADER.email, SEED_LEADER.name, seedPasswordHash(SEED_LEADER), SEED_LEADER.teamId, SEED_TIMESTAMP],
    );
  } else if (scenario !== 'base') {
    throw new Error(`Unknown seed scenario: ${scenario}`);
  }

  await syncSequences(db);
}

export async function resetDatabase(db, scenario = 'base') {
  await createSchema(db);
  await truncateAll(db);
  await seed(db, scenario);
}
