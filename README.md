# Freddy

Management software for individual consumers. Mobile-first web app.

You can sign up, log in, land on your own private home screen, log out, and
reset a forgotten password. Every query is scoped to the signed-in user on the
server.

**There is no public URL any more.** The app used to be a static export on
GitHub Pages; auth needs a server, so that deploy is switched off until a host
is chosen. See `docs/decisions/0002-auth-needs-a-server.md`. Everything below
runs locally.

## Run it locally from a clean checkout

Requires **Node 24+** (for the built-in `node:sqlite` module) and npm.

```bash
git clone https://github.com/MauricioFalck/freddy.git
cd freddy
npm ci          # or `npm install` if you are adding dependencies
npm run seed    # synthetic accounts; password: password12345
npm run dev
```

Open <http://localhost:3000>. To see it the way it is meant to be seen, open
your browser devtools and switch to a phone viewport.

## Everyday commands

| Command                | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Dev server with hot reload on <http://localhost:3000>  |
| `npm test`             | Run the test suite once (Vitest + Testing Library)     |
| `npm run test:watch`   | Tests in watch mode                                    |
| `npm run lint`         | ESLint (`next/core-web-vitals` + TypeScript rules)     |
| `npm run format`       | Rewrite files with Prettier                            |
| `npm run format:check` | Fail if anything is unformatted (this is what CI runs) |
| `npm run typecheck`    | `tsc --noEmit`                                         |
| `npm run build`        | Production build                                       |
| `npm start`            | Serve the production build on <http://localhost:3000>  |
| `npm run seed`         | Load synthetic accounts into the local database        |
| `npm run check`        | Everything CI runs, in order. Run this before pushing. |

## Testing on a real phone

The dev server binds to localhost only by default. To open it on a phone on the
same Wi-Fi:

```bash
npm run dev -- --hostname 0.0.0.0
```

then browse to `http://<your-computer-ip>:3000`.

## Project layout

```
src/app/          App Router routes, pages, and the auth server actions
src/components/   UI components, mobile-first
src/lib/auth/     Passwords, sessions, password reset - framework-free
src/lib/data/     The repository layer, and the per-user isolation boundary
src/lib/db/       Schema, connection, and the synthetic seed
docs/decisions/   Decision records: what we chose and why
.github/workflows CI (every PR)
```

Tests live next to the thing they test. `*.test.tsx` run in jsdom; `*.test.ts`
and `*.server.test.ts` run in Node, because they use `node:sqlite` and
`node:crypto`.

Anything that reads user data goes through `src/lib/data/`, and every function
there takes an owner id. Pages call `requireUser()` first and pass `user.id`
down; the UI never filters rows itself. Modules import each other with explicit
`.ts` extensions so the seed script can run straight through Node's TypeScript
stripping, with no extra tooling.

## How a change ships

1. Branch: `git checkout -b feat/<issue-id>-<slug>`. Never commit to `main`.
2. Commit with conventional prefixes (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
3. `npm run check` locally, then open a PR. CI runs the same gates.
4. Merge to `main`. The Deploy workflow publishes to the URL above, usually in
   about a minute.

## Verifying auth by hand

`docs/verification.md` has the full path: sign up, log out, log back in, reset a
forgotten password, and check that one user cannot see another's data.

## Known limits (deliberate, for now)

- **No host.** Choosing where the server app runs is an open decision. Until
  then the app is local-only.
- **No email.** Password reset links go to a development outbox at
  `/dev/outbox` instead of an inbox. The tokens are real, single-use, and
  expire in 30 minutes; only delivery is stubbed, and it refuses to run at all
  under `NODE_ENV=production`.
- **`items` is a placeholder.** The product vertical is not chosen yet. It
  exists so per-user scoping is a real, tested boundary rather than a promise.
