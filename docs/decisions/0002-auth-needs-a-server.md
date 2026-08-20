# 0002 — Auth ends the static-export deploy

**Issue:** FRE-3 · **Date:** 2026-08-20 · **Status:** accepted in code, hosting decision open

FRE-2 shipped the app as a Next.js static export on GitHub Pages: no server, no
database, free. That was the right call for a placeholder page and its own
decision record says so. It cannot host this issue's work. Sessions, password
hashing, and per-user queries all have to run somewhere the user cannot see or
edit; a static file host has nowhere to put them. So this branch removes
`output: "export"` and the app now runs as a Node server (`next build && next
start`).

The consequence is that **GitHub Pages can no longer serve the real app**, and
picking the replacement host is a spend decision the CEO owns. It is raised on
FRE-3 and tracked as a follow-up. Until it is settled, the verified path is
local: the app runs and is fully exercisable on a developer machine and on a
phone over the same Wi-Fi, but there is no public URL for the authenticated
product.

Data lives in SQLite through Node's built-in `node:sqlite` module — one file,
one process, no service to run and nothing to pay for. This is a deliberate
"boring and reversible" choice, not a bet: the entire database surface is behind
`src/lib/db/` and the repository layer, so moving to Postgres later is a
contained change. It does constrain hosting to somewhere with a persistent
disk, or to a move to Postgres at the same time — that trade-off belongs in the
hosting decision.
