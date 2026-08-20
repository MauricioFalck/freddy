/**
 * Database schema.
 *
 * There is no persistent production data yet, so there is deliberately no
 * migration machinery: this file *is* the schema, and a schema change means
 * resetting the local database. That changes the first time we deploy to an
 * environment with data worth keeping.
 */

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  email_key      TEXT NOT NULL UNIQUE, -- normalised email; the uniqueness key
  password_hash  TEXT NOT NULL,
  created_at     INTEGER NOT NULL
);

-- Session ids stored here are SHA-256 hashes of the cookie value. A database
-- leak therefore does not hand an attacker usable session cookies.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

-- Same treatment for reset tokens: the raw token only ever exists in the link
-- we send to the user.
CREATE TABLE IF NOT EXISTS password_resets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);

CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets(user_id);

-- Placeholder entity. The product vertical is not chosen yet; this exists so
-- that per-user scoping is a real, exercised boundary rather than a promise.
CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS items_user_id_idx ON items(user_id, created_at DESC);
`;
