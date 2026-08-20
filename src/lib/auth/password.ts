import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing.
 *
 * scrypt from `node:crypto` — memory-hard, in the standard library, and no
 * native build step. Parameters are stored alongside each hash so they can be
 * raised later without invalidating existing passwords.
 */

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Minimum password length we accept at sign-up. */
export const MIN_PASSWORD_LENGTH = 8;

/** Hashes a password into a self-describing `scrypt$N$r$p$salt$hash` string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash: a corrupt row must
 * not become an authentication bypass or a 500.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4] as string, "base64");
    expected = Buffer.from(parts[5] as string, "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await scryptAsync(password, salt, expected.length, {
    N,
    r,
    p,
    maxmem: PARAMS.maxmem,
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
