import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db/index.ts";
import { SESSION_COOKIE, resolveSession } from "./sessions.ts";
import type { User } from "./users.ts";

/**
 * The single place a request's identity is established.
 *
 * `server-only` makes importing this from a client component a build error, so
 * the session cookie can never be read in the browser bundle. Page and action
 * code should call `requireUser()` and pass `user.id` down to the repository
 * layer — the UI never chooses which rows to show.
 */

/** Cookie options. `httpOnly` keeps the token away from any script on the page. */
export function sessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  };
}

/** Resolves the signed-in user, or null. Never throws for anonymous visitors. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return resolveSession(getDb(), token);
}

/**
 * Resolves the signed-in user or redirects to the login page.
 *
 * Every authenticated route calls this first. It is the server-side gate; there
 * is no client-side equivalent and no way to opt out of it from the UI.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
