"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/index.ts";
import { AuthFailure, authenticate, createUser } from "@/lib/auth/users.ts";
import { SESSION_COOKIE, createSession, destroySession } from "@/lib/auth/sessions.ts";
import { sessionCookieOptions } from "@/lib/auth/current-user.ts";
import {
  ResetFailure,
  completePasswordReset,
  issuePasswordReset,
} from "@/lib/auth/password-reset.ts";
import { sendMail } from "@/lib/mail/outbox.ts";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password.ts";

/**
 * Server actions for the auth flows.
 *
 * These run only on the server. Each returns a `FormState` for the form to
 * render, or redirects on success. Error messages are deliberately vague about
 * whether an account exists.
 */

export interface FormState {
  error?: string;
  notice?: string;
}

const MESSAGES: Record<string, string> = {
  invalid_email: "That does not look like an email address.",
  weak_password: `Please use at least ${MIN_PASSWORD_LENGTH} characters.`,
  email_taken: "That email is already registered. Try logging in instead.",
  invalid_credentials: "Email or password is incorrect.",
};

const RESET_MESSAGES: Record<string, string> = {
  invalid: "That reset link is not valid. Request a new one.",
  expired: "That reset link has expired. Request a new one.",
  used: "That reset link has already been used. Request a new one.",
};

function field(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = createSession(getDb(), userId);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

/** Creates an account and signs the new user straight in. */
export async function signUpAction(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const email = field(data, "email");
  const password = field(data, "password");

  try {
    const user = await createUser(getDb(), email, password);
    await startSession(user.id);
  } catch (error) {
    if (error instanceof AuthFailure) {
      return { error: MESSAGES[error.reason] ?? "Could not create that account." };
    }
    throw error;
  }

  redirect("/");
}

/** Signs an existing user in. */
export async function logInAction(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const email = field(data, "email");
  const password = field(data, "password");

  try {
    const user = await authenticate(getDb(), email, password);
    await startSession(user.id);
  } catch (error) {
    if (error instanceof AuthFailure) {
      return { error: MESSAGES[error.reason] ?? "Could not log you in." };
    }
    throw error;
  }

  redirect("/");
}

/** Ends the current session and clears the cookie. */
export async function logOutAction(): Promise<void> {
  const jar = await cookies();
  destroySession(getDb(), jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

/**
 * Starts a password reset.
 *
 * Always reports the same thing, whether or not the address has an account.
 */
export async function requestPasswordResetAction(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const email = field(data, "email");
  const issued = issuePasswordReset(getDb(), email);

  if (issued) {
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const link = `${base}/reset-password?token=${encodeURIComponent(issued.token)}`;
    sendMail({
      to: email.trim(),
      subject: "Reset your Freddy password",
      body: `Open this link to choose a new password. It expires in 30 minutes.\n\n${link}\n`,
    });
  }

  return {
    notice:
      "If that email has an account, a reset link is on its way. The link expires in 30 minutes.",
  };
}

/** Completes a password reset and sends the user to log in with the new one. */
export async function resetPasswordAction(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const token = field(data, "token");
  const password = field(data, "password");
  const confirm = field(data, "confirmPassword");

  if (password !== confirm) {
    return { error: "Those passwords do not match." };
  }

  try {
    await completePasswordReset(getDb(), token, password);
  } catch (error) {
    if (error instanceof ResetFailure) {
      return { error: RESET_MESSAGES[error.reason] ?? "That reset link is not valid." };
    }
    if (error instanceof AuthFailure) {
      return { error: MESSAGES[error.reason] ?? "Could not change your password." };
    }
    throw error;
  }

  redirect("/login?reset=1");
}
