# Decision records

Short records of technical decisions that are expensive to reverse. One
paragraph each: what we chose, and why.

## 1. Stack — Next.js (App Router) + TypeScript + Tailwind

**Chosen:** Next.js 16 with the App Router, TypeScript in strict mode, Tailwind
CSS v4, Vitest + Testing Library for tests, ESLint + Prettier as the gates.

**Why:** One engineer, a mobile-first consumer web app, and an unchosen product
vertical — the dominant risk is churn, not scale. React with TypeScript is the
most boring, most hireable, best-documented choice available, and Next.js means
the day we need a server (auth, a database, API routes, server-rendered pages)
we add it inside the framework we already have instead of migrating to one. It
also lets us start as a pure static export today and turn the server on later
without rewriting components or routes. Tailwind is chosen for the same reason:
mobile-first breakpoints and spacing come with the framework, so interaction
quality does not depend on me hand-rolling a design system before we know what
the product is. Vitest over Jest because it needs no transform configuration to
run TypeScript and JSX, which keeps the feedback loop short.

**Cost we accept:** Next.js is a heavier framework than this placeholder needs,
and its release cadence is fast enough that upgrades will occasionally cost a
day. Worth it to avoid a framework migration the first time we need a server.

## 2. Hosting — GitHub Pages (explicitly temporary)

**Chosen:** Static export deployed to GitHub Pages by a workflow that runs on
every merge to `main`. Public URL: https://mauriciofalck.github.io/freddy/.

**Why:** The issue's bar is that a person can open a URL on their phone and see
the app, and Pages is the only host I can stand up end to end with the
credentials the company already has — no new account, no card, no vendor
decision made by an engineer on a Tuesday. It gives us a real deploy pipeline
(build, artifact, publish, environment URL) rather than a manual upload, so the
mechanics are already correct when we swap the target.

**Cost we accept, and this one has a deadline:** GitHub Pages serves files. It
cannot run auth, sessions, or database queries. **Any issue that needs a logged-
in user cannot be deployed on this host.** Before FRE-3 (auth) can be
demonstrated in a running environment, the CEO needs to approve a hosting
account — my recommendation is Vercel (native Next.js, free tier is enough for
pre-launch, one-click Git integration) with Neon or Vercel Postgres for the
database. Moving is a host swap, not a rewrite: delete `output: "export"` from
`next.config.ts`, point the new host at the repo, retire `deploy.yml`. Budget a
day, most of it spent on accounts and DNS rather than code.

## 3. Database — none yet, and no migration machinery until there is data

**Chosen:** No database in this issue. The recorded intent for the first
data-backed slice is **Postgres** (managed, on whatever host we land on), with
the schema defined as plain SQL/ORM models and **no migration files** until
there is production data worth protecting.

**Why:** The product vertical is not chosen, so any schema I write today is a
guess, and a guessed schema with migration history attached is worse than no
schema — it makes the guess expensive to abandon. Postgres is the default for
the same reason as the rest of the stack: boring, portable between hosts,
supported by every ORM, and free at our size. Until real user data exists, a
schema change is an edit plus a database reset; the first deploy to an
environment with data we care about is when we generate a baseline migration
and require a migration file for every change after that.

**Cost we accept:** Some rework when the vertical is chosen. That rework is
cheaper than the wrong entity model, and far cheaper than a migration chain
built on top of the wrong entity model.
