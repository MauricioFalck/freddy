/**
 * Outgoing mail.
 *
 * We have no email provider — that is a spend decision the CEO owns — so the
 * default transport writes the message to the server log and an in-memory
 * outbox that a development-only page can read. The reset *flow* is real:
 * tokens are genuine, hashed, single-use, and expiring. Only the delivery is
 * stubbed, and `assertDeliverableInProduction` makes sure this stub cannot
 * quietly become the production behaviour.
 */

export interface OutboxMessage {
  to: string;
  subject: string;
  body: string;
  sentAt: number;
}

const MAX_RETAINED = 20;
const messages: OutboxMessage[] = [];

/** True when the dev outbox is the active transport. */
export function isOutboxTransport(): boolean {
  return (process.env.MAIL_TRANSPORT ?? "outbox") === "outbox";
}

/**
 * Fails fast if the stub transport is about to be used in a production build.
 *
 * `NODE_ENV=production` is the trigger because every real deploy sets it, with
 * no configuration required — a host that forgets to set `MAIL_TRANSPORT`
 * breaks loudly instead of silently swallowing reset emails. Running a
 * production build locally is the one legitimate case, and it has to say so
 * with `ALLOW_DEV_OUTBOX=1`: shipping the stub then takes a deliberate,
 * greppable act rather than an oversight.
 */
function assertDeliverableInProduction(): void {
  const escapeHatch = process.env.ALLOW_DEV_OUTBOX === "1";
  if (process.env.NODE_ENV === "production" && isOutboxTransport() && !escapeHatch) {
    throw new Error(
      "No email transport configured: MAIL_TRANSPORT=outbox is a development stub. " +
        "Set a real transport, or ALLOW_DEV_OUTBOX=1 to run a production build locally.",
    );
  }
}

/** "Sends" a message. */
export function sendMail(message: Omit<OutboxMessage, "sentAt">): void {
  assertDeliverableInProduction();

  const entry: OutboxMessage = { ...message, sentAt: Date.now() };
  messages.unshift(entry);
  if (messages.length > MAX_RETAINED) messages.length = MAX_RETAINED;

  console.info(
    `[outbox] to=${entry.to} subject=${JSON.stringify(entry.subject)}\n${entry.body}`,
  );
}

/** Most recent messages, newest first. Development only. */
export function readOutbox(): OutboxMessage[] {
  return [...messages];
}

/** Clears the outbox. Used by tests. */
export function clearOutbox(): void {
  messages.length = 0;
}
