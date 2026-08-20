import type { DatabaseSync } from "node:sqlite";
import { generateToken, hashToken } from "./tokens.ts";
import { destroyAllSessionsForUser } from "./sessions.ts";
import { findUserByEmail, prepareNewPassword, setPasswordHash } from "./users.ts";

/**
 * Forgotten-password flow.
 *
 * Tokens are single-use, short-lived, stored only as a hash, and invalidate
 * every other outstanding token for that user when issued. Completing a reset
 * also logs out every existing session.
 */

/** How long a reset link stays usable: 30 minutes. */
export const RESET_TTL_MS = 1000 * 60 * 30;

/** Why a reset token was rejected. */
export type ResetRejection = "invalid" | "expired" | "used";

export class ResetFailure extends Error {
  readonly reason: ResetRejection;

  constructor(reason: ResetRejection) {
    super(reason);
    this.name = "ResetFailure";
    this.reason = reason;
  }
}

/**
 * Issues a reset token for an email address.
 *
 * Returns null when no account matches. Callers must show the same response
 * either way — whether an address has an account here is not public
 * information.
 */
export function issuePasswordReset(
  db: DatabaseSync,
  email: string,
  now: number = Date.now(),
): { token: string; userId: string; expiresAt: number } | null {
  const user = findUserByEmail(db, email);
  if (!user) return null;

  // Requesting a new link invalidates any earlier one.
  db.prepare("DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL").run(
    user.id,
  );

  const token = generateToken();
  const expiresAt = now + RESET_TTL_MS;
  db.prepare(
    `INSERT INTO password_resets (id, user_id, created_at, expires_at, used_at)
     VALUES (?, ?, ?, ?, NULL)`,
  ).run(hashToken(token), user.id, now, expiresAt);

  return { token, userId: user.id, expiresAt };
}

/** Checks a token without consuming it, so the form can be shown or refused. */
export function checkResetToken(
  db: DatabaseSync,
  token: string,
  now: number = Date.now(),
): { userId: string } {
  const row = db
    .prepare("SELECT user_id, expires_at, used_at FROM password_resets WHERE id = ?")
    .get(hashToken(token)) as
    { user_id: string; expires_at: number; used_at: number | null } | undefined;

  if (!row) throw new ResetFailure("invalid");
  if (row.used_at !== null) throw new ResetFailure("used");
  if (row.expires_at <= now) throw new ResetFailure("expired");
  return { userId: row.user_id };
}

/**
 * Consumes a reset token and sets the new password.
 *
 * Marking the token used and changing the password happen in one transaction,
 * so a token can never be spent without the password actually changing.
 */
export async function completePasswordReset(
  db: DatabaseSync,
  token: string,
  newPassword: string,
  now: number = Date.now(),
): Promise<{ userId: string }> {
  const { userId } = checkResetToken(db, token, now);

  // Hash before opening the transaction: `node:sqlite` is synchronous and the
  // connection is shared, so awaiting mid-transaction would hold it open
  // across other requests' queries.
  const hash = await prepareNewPassword(newPassword);

  db.exec("BEGIN IMMEDIATE");
  try {
    // Re-check inside the transaction so two concurrent submissions of the
    // same link cannot both succeed.
    const claimed = db
      .prepare(
        "UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL",
      )
      .run(now, hashToken(token));
    if (claimed.changes !== 1) throw new ResetFailure("used");

    setPasswordHash(db, userId, hash);
    destroyAllSessionsForUser(db, userId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { userId };
}

/** Removes reset tokens that are spent or past their expiry. */
export function pruneResetTokens(db: DatabaseSync, now: number = Date.now()): void {
  db.prepare(
    "DELETE FROM password_resets WHERE used_at IS NOT NULL OR expires_at <= ?",
  ).run(now);
}
