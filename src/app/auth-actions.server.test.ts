import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase, setDb } from "@/lib/db/index.ts";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/sessions.ts";
import { authenticate, createUser } from "@/lib/auth/users.ts";
import { clearOutbox, readOutbox } from "@/lib/mail/outbox.ts";
import { listItems } from "@/lib/data/items.ts";

/**
 * The server actions end to end: the wiring between a submitted form, the
 * session cookie, and the database.
 *
 * `next/headers` and `next/navigation` are stubbed because they need a request
 * context; everything below them is the real implementation against a real
 * (in-memory) database.
 */

/** Stand-in for Next's cookie jar, so we can assert on what was set. */
class FakeCookieJar {
  private store = new Map<string, string>();

  get(name: string) {
    const value = this.store.get(name);
    return value === undefined ? undefined : { name, value };
  }
  set(name: string, value: string) {
    this.store.set(name, value);
  }
  delete(name: string) {
    this.store.delete(name);
  }
}

let jar: FakeCookieJar;

/** Thrown by the stubbed `redirect`, mirroring how Next signals a redirect. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock("next/headers", () => ({ cookies: async () => jar }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

const {
  logInAction,
  logOutAction,
  requestPasswordResetAction,
  resetPasswordAction,
  signUpAction,
} = await import("./auth-actions.ts");

let db: DatabaseSync;

beforeEach(() => {
  db = openDatabase(":memory:");
  setDb(db);
  jar = new FakeCookieJar();
  clearOutbox();
});

afterEach(() => {
  setDb(null);
});

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

/** Runs an action that is expected to redirect, and returns where to. */
async function expectRedirect(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Redirected) return error.to;
    throw error;
  }
  throw new Error("expected a redirect, but the action returned normally");
}

function currentSessionUser() {
  return resolveSession(db, jar.get(SESSION_COOKIE)?.value);
}

describe("sign-up action", () => {
  it("creates the account, sets a session cookie, and lands on home", async () => {
    const to = await expectRedirect(() =>
      signUpAction({}, form({ email: "new@example.test", password: "password12345" })),
    );

    expect(to).toBe("/");
    expect(currentSessionUser()?.email).toBe("new@example.test");
  });

  it("shows an error and sets no cookie when the password is too short", async () => {
    const state = await signUpAction(
      {},
      form({ email: "new@example.test", password: "short" }),
    );

    expect(state.error).toMatch(/at least 8/i);
    expect(jar.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("shows an error and sets no cookie when the email is taken", async () => {
    await createUser(db, "taken@example.test", "password12345");

    const state = await signUpAction(
      {},
      form({ email: "taken@example.test", password: "password12345" }),
    );

    expect(state.error).toMatch(/already registered/i);
    expect(jar.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("gives a new account an empty home screen", async () => {
    const other = await createUser(db, "other@example.test", "password12345");
    db.prepare(
      "INSERT INTO items (id, user_id, title, note, created_at, updated_at) VALUES ('x', ?, 'Theirs', '', 1, 1)",
    ).run(other.id);

    await expectRedirect(() =>
      signUpAction({}, form({ email: "new@example.test", password: "password12345" })),
    );

    const user = currentSessionUser()!;
    expect(listItems(db, user.id)).toEqual([]);
  });
});

describe("log-in and log-out actions", () => {
  beforeEach(async () => {
    await createUser(db, "ada@example.test", "password12345");
  });

  it("logs a user in and out again", async () => {
    const toHome = await expectRedirect(() =>
      logInAction({}, form({ email: "ada@example.test", password: "password12345" })),
    );
    expect(toHome).toBe("/");
    expect(currentSessionUser()?.email).toBe("ada@example.test");

    const token = jar.get(SESSION_COOKIE)!.value;
    const toLogin = await expectRedirect(() => logOutAction());

    expect(toLogin).toBe("/login");
    expect(jar.get(SESSION_COOKIE)).toBeUndefined();
    // The session is gone server-side too, not just the cookie.
    expect(resolveSession(db, token)).toBeNull();
  });

  it("rejects a wrong password without setting a cookie", async () => {
    const state = await logInAction(
      {},
      form({ email: "ada@example.test", password: "wrong-password" }),
    );

    expect(state.error).toMatch(/incorrect/i);
    expect(jar.get(SESSION_COOKIE)).toBeUndefined();
  });
});

describe("password reset actions", () => {
  beforeEach(async () => {
    await createUser(db, "ada@example.test", "password12345");
  });

  it("emails a working reset link and lets the user set a new password", async () => {
    const state = await requestPasswordResetAction(
      {},
      form({ email: "ada@example.test" }),
    );
    expect(state.notice).toMatch(/on its way/i);

    const body = readOutbox()[0]!.body;
    const token = new URL(body.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

    const to = await expectRedirect(() =>
      resetPasswordAction(
        {},
        form({
          token,
          password: "brand-new-password",
          confirmPassword: "brand-new-password",
        }),
      ),
    );

    expect(to).toBe("/login?reset=1");
    await expect(
      authenticate(db, "ada@example.test", "brand-new-password"),
    ).resolves.toBeTruthy();
  });

  it("says the same thing for an unknown email, and sends nothing", async () => {
    const known = await requestPasswordResetAction(
      {},
      form({ email: "ada@example.test" }),
    );
    clearOutbox();
    const unknown = await requestPasswordResetAction(
      {},
      form({ email: "nobody@example.test" }),
    );

    expect(unknown.notice).toBe(known.notice);
    expect(readOutbox()).toHaveLength(0);
  });

  it("refuses when the two new passwords differ", async () => {
    await requestPasswordResetAction({}, form({ email: "ada@example.test" }));
    const body = readOutbox()[0]!.body;
    const token = new URL(body.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

    const state = await resetPasswordAction(
      {},
      form({
        token,
        password: "brand-new-password",
        confirmPassword: "something-else",
      }),
    );

    expect(state.error).toMatch(/do not match/i);
    // The old password still works, so nothing was changed.
    await expect(
      authenticate(db, "ada@example.test", "password12345"),
    ).resolves.toBeTruthy();
  });

  it("refuses a reused reset link", async () => {
    await requestPasswordResetAction({}, form({ email: "ada@example.test" }));
    const body = readOutbox()[0]!.body;
    const token = new URL(body.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;
    const fields = {
      token,
      password: "brand-new-password",
      confirmPassword: "brand-new-password",
    };

    await expectRedirect(() => resetPasswordAction({}, form(fields)));
    const state = await resetPasswordAction({}, form(fields));

    expect(state.error).toMatch(/already been used/i);
  });
});
