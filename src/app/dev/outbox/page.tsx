import { notFound } from "next/navigation";
import { AuthShell, TextLink } from "@/components/auth-shell.tsx";
import { isOutboxTransport, readOutbox } from "@/lib/mail/outbox.ts";

/**
 * Development-only view of the stubbed mail transport.
 *
 * Returns 404 unless the outbox transport is active, so it cannot be reached
 * once a real email provider is configured.
 */

export const dynamic = "force-dynamic";

export const metadata = { title: "Dev outbox" };

export default function OutboxPage() {
  if (!isOutboxTransport()) notFound();

  const messages = readOutbox();

  return (
    <AuthShell
      title="Dev outbox"
      subtitle="Messages the app would have emailed. Development builds only."
      footer={<TextLink href="/login">Back to log in</TextLink>}
    >
      {messages.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Nothing sent yet. Request a password reset and it will show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {messages.map((message) => (
            <li
              key={`${message.sentAt}-${message.to}`}
              className="rounded-xl border border-black/10 px-4 py-3 dark:border-white/15"
            >
              <p className="text-sm font-medium">{message.subject}</p>
              <p className="text-xs text-black/60 dark:text-white/60">
                to {message.to}
              </p>
              <pre className="mt-2 text-xs break-all whitespace-pre-wrap">
                {message.body}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </AuthShell>
  );
}
