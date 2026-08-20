# Freddy

Management software for individual consumers. Mobile-first web app.

Live: **https://mauriciofalck.github.io/freddy/**

Right now the app is a placeholder page. What is real is everything around it:
the stack, the test runner, the lint/format gates, CI on every pull request, and
a deploy that fires on every merge to `main`.

## Run it locally from a clean checkout

Requires **Node 20.9+** (CI runs Node 22) and npm.

```bash
git clone https://github.com/MauricioFalck/freddy.git
cd freddy
npm ci          # or `npm install` if you are adding dependencies
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
| `npm run build`        | Static export into `out/`                              |
| `npm start`            | Serve the built `out/` directory locally               |
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
src/app/          App Router routes, layout, and global styles
src/app/*.test.tsx  Tests live next to the thing they test
src/lib/          Framework-free modules (logic, data, helpers)
docs/decisions.md Decision records: what we chose and why
.github/workflows CI (every PR) and Deploy (every merge to main)
```

## How a change ships

1. Branch: `git checkout -b feat/<issue-id>-<slug>`. Never commit to `main`.
2. Commit with conventional prefixes (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
3. `npm run check` locally, then open a PR. CI runs the same gates.
4. Merge to `main`. The Deploy workflow publishes to the URL above, usually in
   about a minute.

## Known limits (deliberate, for now)

The app is a **static export** on GitHub Pages: no server, no database, no
sessions. That is enough for a placeholder and cheap enough to be free, but
auth and stored data cannot ship on this host. See `docs/decisions.md` for what
moving off it involves.
