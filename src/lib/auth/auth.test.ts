import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../db/index.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { AuthFailure, authenticate, createUser, findUserByEmail } from "./users.ts";
import {
  SESSION_TTL_MS,
  createSession,
  destroyAllSessionsForUser,
  destroySession,
  resolveSession,
} from "./sessions.ts";
import {
  RESET_TTL_MS,
  ResetFailure,
  checkResetToken,
  completePasswordReset,
  issuePasswordReset,
} from "./password-reset.ts";

let db: DatabaseSync;

beforeEach(() => {
  db = openDatabase(":memory:");
});

async function makeUser(email = "alice@example.test", password = "correct-horse-1") {
  return createUser(db, email, password);
}

describe("passwords", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct-horse-1");
    expect(await verifyPassword("correct-horse-1", hash)).toBe(true);
    expect(await verifyPassword("correct-horse-2", hash)).toBe(false);
  });

  it("never stores the password itself", async () => {
    const hash = await hashPassword("correct-horse-1");
    expect(hash).not.toContain("correct-horse-1");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("produces a different hash each time for the same password", async () => {
    expect(await hashPassword("correct-horse-1")).not.toBe(
      await hashPassword("correct-horse-1"),
    );
  });

  it("treats a malformed stored hash as a failed login, not an error", async () => {
    expect(await verifyPassword("anything", "")).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$1$2$3$$")).toBe(false);
  });
});

describe("sign-up", () => {
  it("creates an account that can then sign in", async () => {
    const user = await makeUser();
    const signedIn = await authenticate(db, "alice@example.test", "correct-horse-1");
    expect(signedIn.id).toBe(user.id);
  });

  it("treats email as case-insensitive", async () => {
    await makeUser("Alice@Example.test");
    expect(findUserByEmail(db, "alice@example.TEST")).not.toBeNull();
    await expect(makeUser("ALICE@EXAMPLE.TEST")).rejects.toMatchObject({
      reason: "email_taken",
    });
  });

  it("rejects a duplicate email", async () => {
    await makeUser();
    await expect(makeUser()).rejects.toBeInstanceOf(AuthFailure);
  });

  it("rejects an implausible email and a short password", async () => {
    await expect(makeUser("not-an-email", "correct-horse-1")).rejects.toMatchObject({
      reason: "invalid_email",
    });
    await expect(makeUser("new@example.test", "short")).rejects.toMatchObject({
      reason: "weak_password",
    });
  });
});

describe("sign-in", () => {
  it("rejects a wrong password", async () => {
    await makeUser();
    await expect(
      authenticate(db, "alice@example.test", "wrong-password"),
    ).rejects.toMatchObject({ reason: "invalid_credentials" });
  });

  it("gives the same error for an unknown email as for a wrong password", async () => {
    await makeUser();
    const unknown = await authenticate(db, "nobody@example.test", "x").catch(
      (e: AuthFailure) => e.reason,
    );
    const wrong = await authenticate(db, "alice@example.test", "x").catch(
      (e: AuthFailure) => e.reason,
    );
    expect(unknown).toBe("invalid_credentials");
    expect(wrong).toBe("invalid_credentials");
  });
});

describe("sessions", () => {
  it("resolves a fresh session to its user", async () => {
    const user = await makeUser();
    const { token } = createSession(db, user.id);
    expect(resolveSession(db, token)?.id).toBe(user.id);
  });

  it("rejects a missing, unknown, or tampered token", async () => {
    const user = await makeUser();
    const { token } = createSession(db, user.id);

    expect(resolveSession(db, undefined)).toBeNull();
    expect(resolveSession(db, "not-a-real-token")).toBeNull();
    expect(resolveSession(db, `${token}x`)).toBeNull();
  });

  it("stores the token only as a hash", async () => {
    const user = await makeUser();
    const { token } = createSession(db, user.id);
    const stored = db.prepare("SELECT id FROM sessions").get() as { id: string };
    expect(stored.id).not.toBe(token);
  });

  it("stops resolving after logout", async () => {
    const user = await makeUser();
    const { token } = createSession(db, user.id);
    destroySession(db, token);
    expect(resolveSession(db, token)).toBeNull();
  });

  it("stops resolving after expiry", async () => {
    const user = await makeUser();
    const now = Date.now();
    const { token } = createSession(db, user.id, now);
    expect(resolveSession(db, token, now + SESSION_TTL_MS - 1)).not.toBeNull();
    expect(resolveSession(db, token, now + SESSION_TTL_MS)).toBeNull();
  });

  it("does not let one user's logout end another user's session", async () => {
    const alice = await makeUser("alice@example.test");
    const bob = await makeUser("bob@example.test", "correct-horse-2");
    const aliceSession = createSession(db, alice.id);
    const bobSession = createSession(db, bob.id);

    destroySession(db, aliceSession.token);

    expect(resolveSession(db, aliceSession.token)).toBeNull();
    expect(resolveSession(db, bobSession.token)?.id).toBe(bob.id);
  });

  it("revokes all of a user's sessions without touching another user's", async () => {
    const alice = await makeUser("alice@example.test");
    const bob = await makeUser("bob@example.test", "correct-horse-2");
    const phone = createSession(db, alice.id);
    const laptop = createSession(db, alice.id);
    const bobSession = createSession(db, bob.id);

    destroyAllSessionsForUser(db, alice.id);

    expect(resolveSession(db, phone.token)).toBeNull();
    expect(resolveSession(db, laptop.token)).toBeNull();
    expect(resolveSession(db, bobSession.token)?.id).toBe(bob.id);
  });
});

describe("password reset", () => {
  it("lets a user set a new password and sign in with it", async () => {
    const user = await makeUser();
    const issued = issuePasswordReset(db, "alice@example.test");
    expect(issued).not.toBeNull();

    await completePasswordReset(db, issued!.token, "brand-new-password");

    const signedIn = await authenticate(db, "alice@example.test", "brand-new-password");
    expect(signedIn.id).toBe(user.id);
    await expect(
      authenticate(db, "alice@example.test", "correct-horse-1"),
    ).rejects.toBeInstanceOf(AuthFailure);
  });

  it("returns nothing for an unknown email, without creating a token", () => {
    expect(issuePasswordReset(db, "nobody@example.test")).toBeNull();
    const count = db.prepare("SELECT COUNT(*) AS n FROM password_resets").get() as {
      n: number;
    };
    expect(count.n).toBe(0);
  });

  it("stores the reset token only as a hash", async () => {
    await makeUser();
    const issued = issuePasswordReset(db, "alice@example.test")!;
    const stored = db.prepare("SELECT id FROM password_resets").get() as {
      id: string;
    };
    expect(stored.id).not.toBe(issued.token);
  });

  it("refuses a token a second time", async () => {
    await makeUser();
    const issued = issuePasswordReset(db, "alice@example.test")!;
    await completePasswordReset(db, issued.token, "brand-new-password");

    await expect(
      completePasswordReset(db, issued.token, "another-password"),
    ).rejects.toMatchObject({ reason: "used" });
  });

  it("refuses an expired token", async () => {
    await makeUser();
    const now = Date.now();
    const issued = issuePasswordReset(db, "alice@example.test", now)!;

    expect(() =>
      checkResetToken(db, issued.token, now + RESET_TTL_MS - 1),
    ).not.toThrow();
    await expect(
      completePasswordReset(db, issued.token, "brand-new-password", now + RESET_TTL_MS),
    ).rejects.toMatchObject({ reason: "expired" });
  });

  it("refuses an unknown token", async () => {
    await expect(
      completePasswordReset(db, "made-up-token", "brand-new-password"),
    ).rejects.toBeInstanceOf(ResetFailure);
  });

  it("invalidates an earlier link when a new one is requested", async () => {
    await makeUser();
    const first = issuePasswordReset(db, "alice@example.test")!;
    const second = issuePasswordReset(db, "alice@example.test")!;

    await expect(
      completePasswordReset(db, first.token, "brand-new-password"),
    ).rejects.toMatchObject({ reason: "invalid" });
    await expect(
      completePasswordReset(db, second.token, "brand-new-password"),
    ).resolves.toBeTruthy();
  });

  it("logs out existing sessions when the password changes", async () => {
    const user = await makeUser();
    const { token: sessionToken } = createSession(db, user.id);
    const issued = issuePasswordReset(db, "alice@example.test")!;

    await completePasswordReset(db, issued.token, "brand-new-password");

    expect(resolveSession(db, sessionToken)).toBeNull();
  });

  it("does not let one user's reset token change another user's password", async () => {
    await makeUser("alice@example.test");
    const bob = await makeUser("bob@example.test", "correct-horse-2");
    const aliceReset = issuePasswordReset(db, "alice@example.test")!;

    // The token carries its own owner; Bob's password is unaffected.
    const { userId } = await completePasswordReset(
      db,
      aliceReset.token,
      "new-password",
    );
    expect(userId).not.toBe(bob.id);
    await expect(
      authenticate(db, "bob@example.test", "correct-horse-2"),
    ).resolves.toMatchObject({ id: bob.id });
  });
});
