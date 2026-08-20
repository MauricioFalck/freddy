"use client";

import { useActionState } from "react";
import { Field, FormError, FormNotice, SubmitButton } from "./auth-shell.tsx";
import type { FormState } from "@/app/auth-actions.ts";

/**
 * The four auth forms.
 *
 * Client components only so the submit button can show pending state; all the
 * work happens in the server actions passed in as props.
 */

type Action = (state: FormState, data: FormData) => Promise<FormState>;

const EMPTY: FormState = {};

export function SignUpForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, EMPTY);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <FormError>{state.error}</FormError> : null}
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
      />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}

export function LogInForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, EMPTY);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <FormError>{state.error}</FormError> : null}
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <SubmitButton pending={pending}>Log in</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, EMPTY);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.notice ? <FormNotice>{state.notice}</FormNotice> : null}
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({
  action,
  token,
}: {
  action: Action;
  token: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <FormError>{state.error}</FormError> : null}
      <input type="hidden" name="token" value={token} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
      />
      <SubmitButton pending={pending}>Set new password</SubmitButton>
    </form>
  );
}
