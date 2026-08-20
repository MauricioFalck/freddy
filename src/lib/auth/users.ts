import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "./password.ts";

/** A user account, without the password hash. */
export interface User {
  id: string;
  email: string;
  createdAt: number;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
}

/** Reasons account creation or sign-in can fail, for mapping to messages. */
export type AuthError =
  "invalid_email" | "weak_password" | "email_taken" | "invalid_credentials";

export class AuthFailure extends Error {
  readonly reason: AuthError;

  constructor(reason: AuthError) {
    super(reason);
    this.name = "AuthFailure";
    this.reason = reason;
  }
}

/**
 * Normalises an email for uniqueness comparison.
 *
 * Case-insensitive only. We deliberately do not strip dots or `+tags`: those
 * rules are provider-specific, and guessing them wrong silently merges or
 * splits accounts.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * A deliberately permissive email check. Real validation is delivery; this
 * only rejects input that cannot be an address at all.
 */
export function isPlausibleEmail(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  if (/\s/.test(trimmed)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(trimmed);
}

function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

/** Looks up a user by id. Returns null when there is no such user. */
export function findUserById(db: DatabaseSync, id: string): User | null {
  const row = db
    .prepare("SELECT id, email, password_hash, created_at FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

/** Looks up a user by email, matching case-insensitively. */
export function findUserByEmail(db: DatabaseSync, email: string): User | null {
  const row = db
    .prepare(
      "SELECT id, email, password_hash, created_at FROM users WHERE email_key = ?",
    )
    .get(normaliseEmail(email)) as UserRow | undefined;
  return row ? toUser(row) : null;
}

/**
 * Creates an account.
 *
 * Throws `AuthFailure` for anything the user can fix by retyping. The unique
 * index on `email_key` is what actually prevents duplicates — the pre-check is
 * only there to produce a nicer message, and the constraint catches the race.
 */
export async function createUser(
  db: DatabaseSync,
  email: string,
  password: string,
  now: number = Date.now(),
): Promise<User> {
  if (!isPlausibleEmail(email)) throw new AuthFailure("invalid_email");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthFailure("weak_password");
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    db.prepare(
      `INSERT INTO users (id, email, email_key, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, email.trim(), normaliseEmail(email), passwordHash, now);
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new AuthFailure("email_taken");
    throw error;
  }

  return { id, email: email.trim(), createdAt: now };
}

/**
 * Verifies an email and password pair.
 *
 * Always performs a password hash comparison, even when the email is unknown,
 * so response timing does not reveal which accounts exist.
 */
export async function authenticate(
  db: DatabaseSync,
  email: string,
  password: string,
): Promise<User> {
  const row = db
    .prepare(
      "SELECT id, email, password_hash, created_at FROM users WHERE email_key = ?",
    )
    .get(normaliseEmail(email)) as UserRow | undefined;

  const storedHash = row?.password_hash ?? DUMMY_HASH;
  const ok = await verifyPassword(password, storedHash);

  if (!row || !ok) throw new AuthFailure("invalid_credentials");
  return toUser(row);
}

/**
 * Hashes a candidate password, rejecting ones that are too short.
 *
 * Kept separate from the write so callers can do the slow, async hashing
 * *before* opening a transaction on the shared synchronous connection.
 */
export async function prepareNewPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthFailure("weak_password");
  }
  return hashPassword(password);
}

/** Writes an already-computed password hash. Synchronous, transaction-safe. */
export function setPasswordHash(db: DatabaseSync, userId: string, hash: string): void {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
}

/** Replaces a user's password. Convenience wrapper outside transactions. */
export async function setPassword(
  db: DatabaseSync,
  userId: string,
  password: string,
): Promise<void> {
  setPasswordHash(db, userId, await prepareNewPassword(password));
}

/**
 * A real scrypt hash of an unguessable value, compared against when the email
 * is unknown so that the work done is the same either way.
 */
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "d2sNzsRPmGH1V3fSTHhuBqBMOKjxjKctuRUn1sWSGmRQ2yb4qF3vXGXeQ2Rl0eXvS8bYbCJ0oTVc8fWmVQ9GAA==";
