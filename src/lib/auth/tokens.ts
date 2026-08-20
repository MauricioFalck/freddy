import { createHash, randomBytes } from "node:crypto";

/**
 * Opaque bearer tokens for sessions and password resets.
 *
 * The raw token goes to the user (cookie or reset link); only its SHA-256
 * digest is stored. Tokens are 256 bits of CSPRNG output, so the digest needs
 * no salt or stretching — there is nothing to brute force.
 */

const TOKEN_BYTES = 32;

/** Generates a new URL-safe random token. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Digests a token into the value stored in the database. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
