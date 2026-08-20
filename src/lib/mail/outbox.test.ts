import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOutbox, readOutbox, sendMail } from "./outbox.ts";

/**
 * The point of these is the guard: the stub transport must not be able to
 * become production behaviour by accident, but must still be usable when
 * someone deliberately runs a production build on their own machine.
 */

beforeEach(() => {
  clearOutbox();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const message = { to: "ada@example.test", subject: "Hello", body: "Body" };

describe("dev outbox", () => {
  it("captures messages in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MAIL_TRANSPORT", undefined);

    sendMail(message);

    expect(readOutbox()).toHaveLength(1);
    expect(readOutbox()[0]).toMatchObject(message);
  });

  it("refuses to run in a production build with no transport configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MAIL_TRANSPORT", undefined);
    vi.stubEnv("ALLOW_DEV_OUTBOX", undefined);

    expect(() => sendMail(message)).toThrow(/no email transport configured/i);
    expect(readOutbox()).toHaveLength(0);
  });

  it("allows a production build to opt in explicitly", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MAIL_TRANSPORT", undefined);
    vi.stubEnv("ALLOW_DEV_OUTBOX", "1");

    expect(() => sendMail(message)).not.toThrow();
    expect(readOutbox()).toHaveLength(1);
  });

  it("keeps only the most recent messages", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (let i = 0; i < 25; i += 1) sendMail({ ...message, subject: `Message ${i}` });

    const outbox = readOutbox();
    expect(outbox).toHaveLength(20);
    // Newest first.
    expect(outbox[0]?.subject).toBe("Message 24");
  });
});
