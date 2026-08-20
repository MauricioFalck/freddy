# Verifying accounts and per-user isolation by hand (FRE-3)

Everything below runs locally. There is no public URL for the authenticated
app yet — see `docs/decisions/0002-auth-needs-a-server.md`.

## Setup

```bash
npm install
rm -rf data          # start from an empty database
npm run seed         # three synthetic accounts, password: password12345
npm run dev          # http://localhost:3000
```

To exercise a production build instead, use
`npm run build && ALLOW_DEV_OUTBOX=1 npm start`. The extra variable is
required on purpose: password-reset email has no real transport yet, and the
stub refuses to run under `NODE_ENV=production` unless you say so explicitly.

Seeded accounts (all fabricated, all on the reserved `.test` TLD):

| Email                | Items                        |
| -------------------- | ---------------------------- |
| `ada@example.test`   | Renew passport, Book dentist |
| `grace@example.test` | Service the car              |
| `empty@example.test` | none                         |

## The path from the issue

Open <http://localhost:3000> in a phone viewport (devtools → device toolbar), or
on a real phone with `npm run dev -- --hostname 0.0.0.0` and your machine's IP.

1. **Sign up.** You land on `/login` because you are not signed in. Tap
   _Create one_, enter a new email and a password of at least 8 characters.
   → You are signed in and land on **your own empty home screen**: "Nothing here
   yet". Not Ada's items, not Grace's.
2. **Log out.** Tap _Log out_ top right. → Back to `/login`.
3. **Log in.** Enter the same email and password. → Home screen again, still
   empty, still yours.
4. **Reset a forgotten password.** From `/login` tap _Forgot your password?_,
   enter `ada@example.test`, submit. → "If that email has an account, a reset
   link is on its way."
   We have no email provider, so open <http://localhost:3000/dev/outbox> to
   read the message and follow its link. Choose a new password.
   → You are sent to `/login` with a confirmation. Log in as
   `ada@example.test` with the **new** password. The old one no longer works.

## Checking isolation by hand

1. Log in as `ada@example.test` (password `password12345`, or whatever you reset
   it to). You see _Renew passport_ and _Book dentist_.
2. Log out, log in as `grace@example.test`. You see _Service the car_ and
   **neither of Ada's items**.
3. With Grace signed in, edit the session cookie in devtools (Application →
   Cookies → `freddy_session`) — change a character. Reload.
   → You are bounced to `/login`. A tampered cookie is just an unknown session.

## Things that should fail, and do

- Visiting `/` signed out → redirected to `/login`.
- Reusing a password-reset link a second time → "already been used".
- A reset link older than 30 minutes → "expired".
- Requesting a reset for an address with no account → same message as for one
  that has an account, and no email is sent.
- Signing up with an email that already exists → rejected, no session created.

## Automated coverage

```bash
npm test             # 48 tests, no browser needed
npm run smoke        # drives real headless Chrome against a running server
```

`npm run smoke` needs the app running (`npm run dev` in another terminal, or
`BASE_URL=... npm run smoke` to point elsewhere). It walks the exact path above
in a 390x844 phone viewport: sign up, land on an empty home screen, log out,
log back in, reset the password via the dev outbox, and confirm the old
password stops working.

48 server-side tests. The cross-user ones are in
`src/lib/data/items.isolation.test.ts` (user A cannot read, update, or delete
user B's rows, and cannot tell a foreign row apart from a missing one) and in
the session tests in `src/lib/auth/auth.test.ts` (one user's logout or password
reset never touches another user's sessions).
