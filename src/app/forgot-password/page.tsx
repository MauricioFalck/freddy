import { AuthShell, TextLink } from "@/components/auth-shell.tsx";
import { ForgotPasswordForm } from "@/components/auth-forms.tsx";
import { isOutboxTransport } from "@/lib/mail/outbox.ts";
import { requestPasswordResetAction } from "../auth-actions.ts";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we will send you a link to choose a new password."
      footer={
        <div className="flex flex-col gap-2">
          <TextLink href="/login">Back to log in</TextLink>
          {isOutboxTransport() ? (
            <span className="text-xs">
              Development build: no email is actually sent. Find the link in{" "}
              <TextLink href="/dev/outbox">the dev outbox</TextLink>.
            </span>
          ) : null}
        </div>
      }
    >
      <ForgotPasswordForm action={requestPasswordResetAction} />
    </AuthShell>
  );
}
