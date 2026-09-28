CREATE TABLE IF NOT EXISTS teams (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('superadmin', 'leader', 'member')),
  -- Leaders own a team (teams are created with the leader); members belong to one.
  team_id        INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A leader can have only one team for now.
CREATE UNIQUE INDEX IF NOT EXISTS users_one_team_per_leader
  ON users (team_id) WHERE role = 'leader';

CREATE TABLE IF NOT EXISTS invitations (
  id                SERIAL PRIMARY KEY,
  team_id           INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  token             TEXT NOT NULL UNIQUE,
  invited_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  accepted_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  accepted_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_steps (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_key      TEXT NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, step_key)
);
