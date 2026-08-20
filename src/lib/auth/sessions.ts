import type { DatabaseSync } from "node:sqlite";
import { generateToken, hashToken } from "./tokens.ts";
import { findUserById, type User } from "./users.ts";

/**
 * Server-side sessions.
 *
 * The cookie carries an opaque random token and nothing else — no user id, no
 * signed claims. Every request resolves the token against this table, so
 * logging out, expiring, or revoking a session takes effect immediately and a
 * tampered cookie is simply an unknown session.
 */

/** Name of the session cookie. */
export const SESSION_COOKIE = "freddy_session";

/** How long a session stays valid: 30 days. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** Creates a session for a user and returns the raw token for the cookie. */
export function createSession(
  db: DatabaseSync,
  userId: string,
  now: number = Date.now(),
): { token: string; expiresAt: number } {
  const token = generateToken();
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).run(hashToken(token), userId, now, expiresAt);
  return { token, expiresAt };
}

/**
 * Resolves a session token to its user.
 *
 * Returns null for unknown, tampered, or expired tokens. Expired rows are
 * deleted on sight so the table does not grow without bound.
 */
export function resolveSession(
  db: DatabaseSync,
  token: string | undefined,
  now: number = Date.now(),
): User | null {
  if (!token) return null;

  const id = hashToken(token);
  const row = db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?")
    .get(id) as { user_id: string; expires_at: number } | undefined;

  if (!row) return null;
  if (row.expires_at <= now) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }

  return findUserById(db, row.user_id);
}

/** Destroys a single session. Safe to call with an unknown token. */
export function destroySession(db: DatabaseSync, token: string | undefined): void {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token));
}

/**
 * Destroys every session belonging to a user.
 *
 * Called after a password reset: whoever forced the reset should not keep a
 * live session on another device.
 */
export function destroyAllSessionsForUser(db: DatabaseSync, userId: string): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
