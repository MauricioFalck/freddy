import { AuthShell, FormError, TextLink } from "@/components/auth-shell.tsx";
import { ResetPasswordForm } from "@/components/auth-forms.tsx";
import { getDb } from "@/lib/db/index.ts";
import { ResetFailure, checkResetToken } from "@/lib/auth/password-reset.ts";
import { resetPasswordAction } from "../auth-actions.ts";

export const metadata = { title: "Choose a new password" };

const REASONS: Record<string, string> = {
  invalid: "That reset link is not valid.",
  expired: "That reset link has expired.",
  used: "That reset link has already been used.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Check the token before rendering the form, so a dead link says so straight
  // away instead of after the user has typed a new password twice.
  let problem: string | null = null;
  if (!token) {
    problem = "That reset link is not valid.";
  } else {
    try {
      checkResetToken(getDb(), token);
    } catch (error) {
      problem =
        error instanceof ResetFailure
          ? (REASONS[error.reason] ?? "That reset link is not valid.")
          : "That reset link is not valid.";
    }
  }

  if (problem) {
    return (
      <AuthShell
        title="Choose a new password"
        footer={<TextLink href="/forgot-password">Request a new link</TextLink>}
      >
        <FormError>{problem}</FormError>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="This also logs you out everywhere else."
      footer={<TextLink href="/login">Back to log in</TextLink>}
    >
      <ResetPasswordForm action={resetPasswordAction} token={token as string} />
    </AuthShell>
  );
}
