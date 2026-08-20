/**
 * Browser smoke test for the auth flows.
 *
 * Drives a real headless Chrome over the DevTools Protocol — no test-runner
 * plugin, no driver dependency, just Node's built-in WebSocket. It clicks
 * through exactly what the issue asks a person to do: sign up on a phone-sized
 * viewport, land on an empty home screen, log out, log back in, and reset a
 * forgotten password.
 *
 * Usage:
 *   npm run build && npm start        # in one terminal
 *   node scripts/smoke.mjs            # in another
 *
 * Set BASE_URL to point somewhere other than http://localhost:3000.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "google-chrome";
const PHONE = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };

const profile = mkdtempSync(join(tmpdir(), "freddy-smoke-"));
let chrome;
let socket;
let nextId = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function startChrome() {
  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(
      () => reject(new Error("Chrome did not report a debugging URL")),
      20000,
    );
    chrome.stderr.on("data", (chunk) => {
      buffer += chunk;
      const match = buffer.match(/ws:\/\/\S+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    chrome.on("exit", (code) => reject(new Error(`Chrome exited with ${code}`)));
  });

  socket = new WebSocket(wsUrl);
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    message.error
      ? waiter.reject(new Error(message.error.message))
      : waiter.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

/** Opens a tab and returns helpers bound to its CDP session. */
async function newPage() {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });

  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", PHONE, sessionId);

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (exceptionDetails)
      throw new Error(exceptionDetails.exception?.description ?? "eval failed");
    return result.value;
  };

  const goto = async (path) => {
    await send("Page.navigate", { url: `${BASE}${path}` }, sessionId);
    await settle(evaluate);
  };

  return { evaluate, goto };
}

/** Waits for the document to be interactive and the network to go quiet. */
async function settle(evaluate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await new Promise((r) => setTimeout(r, 100));
    const ready = await evaluate("document.readyState === 'complete'").catch(
      () => false,
    );
    if (ready) return;
  }
  throw new Error("page never finished loading");
}

/** Fills inputs by name, submits, and waits for the result to render. */
async function submit(page, values) {
  const assignments = Object.entries(values)
    .map(
      ([name, value]) =>
        `set(document.querySelector('[name="${name}"]'), ${JSON.stringify(value)});`,
    )
    .join("\n");

  await page.evaluate(`
    (() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      const set = (el, v) => { setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
      ${assignments}
      document.querySelector('form button[type="submit"]').click();
    })()
  `);

  // Server actions resolve over the network; poll until the page changes.
  await new Promise((r) => setTimeout(r, 1500));
  await settle(page.evaluate);
}

const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

const url = (page) => page.evaluate("location.pathname + location.search");
const text = (page) => page.evaluate("document.body.innerText");

async function main() {
  await startChrome();
  const page = await newPage();
  const email = `smoke-${Date.now()}@example.test`;
  const password = "password12345";

  // 1. Signed out, the home screen is not reachable.
  await page.goto("/");
  check("signed out, / redirects to /login", (await url(page)) === "/login");

  // 2. Sign up.
  await page.goto("/signup");
  await submit(page, { email, password });
  check("sign-up lands on the home screen", (await url(page)) === "/");

  const home = await text(page);
  check("home shows the new user's email", home.includes(email));
  check("home is empty for a new user", home.includes("Nothing here yet"));
  check(
    "home shows no other user's data",
    !home.includes("Renew passport") && !home.includes("Service the car"),
  );

  // 3. Log out.
  await page.evaluate(`document.querySelector('form button[type="submit"]').click()`);
  await new Promise((r) => setTimeout(r, 1500));
  await settle(page.evaluate);
  check("log out returns to /login", (await url(page)) === "/login");

  await page.goto("/");
  check("after logout, / redirects to /login again", (await url(page)) === "/login");

  // 4. Log back in.
  await submit(page, { email, password });
  check("log in lands on the home screen", (await url(page)) === "/");
  check("home still belongs to the same user", (await text(page)).includes(email));

  // 5. Reset a forgotten password.
  await page.goto("/forgot-password");
  await submit(page, { email });
  check("reset request is acknowledged", (await text(page)).includes("on its way"));

  await page.goto("/dev/outbox");
  const outbox = await text(page);
  const link = outbox.match(/https?:\/\/\S+reset-password\S+/)?.[0];
  check("a reset link was delivered to the dev outbox", Boolean(link));

  if (link) {
    const newPassword = "brand-new-password";
    await page.goto(new URL(link).pathname + new URL(link).search);
    await submit(page, { password: newPassword, confirmPassword: newPassword });
    check(
      "reset sends the user back to log in",
      (await url(page)).startsWith("/login"),
    );

    await submit(page, { email, password: newPassword });
    check("the new password works", (await url(page)) === "/");

    // The old password must not.
    await page.evaluate(`document.querySelector('form button[type="submit"]').click()`);
    await new Promise((r) => setTimeout(r, 1500));
    await page.goto("/login");
    await submit(page, { email, password });
    check(
      "the old password no longer works",
      (await url(page)) === "/login",
      await url(page),
    );
  }
}

try {
  await main();
} catch (error) {
  console.error("smoke test crashed:", error);
  process.exitCode = 1;
} finally {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    // Wait for Chrome to actually go away; it writes to its profile on the way
    // out, and removing the directory underneath it fails with ENOTEMPTY.
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill();
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
  }
  // Best-effort: a leftover temp profile is not worth failing the run over.
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
