# 0001 — Auth and session design

**Issue:** FRE-3 · **Date:** 2026-08-20 · **Status:** accepted

We built accounts ourselves rather than adopting an auth provider or library.
Passwords are hashed with scrypt from `node:crypto` (memory-hard, standard
library, no native build); sessions are opaque 256-bit random tokens stored in
a `sessions` table and carried in an `httpOnly`, `SameSite=Lax` cookie. Only the
SHA-256 digest of each token is stored, so a database leak yields no usable
cookies or reset links. Session state lives server-side rather than in a signed
JWT, which means logout, expiry, and revocation take effect immediately —
worth far more to us right now than the statelessness a JWT would buy.

The alternative was a hosted provider (Auth0, Clerk, Supabase Auth). We declined
for three reasons: it is a paid dependency and a spend decision we do not own;
it puts end-user personal data in a third party before the company has a privacy
and retention position; and email+password for a single-product consumer app is
genuinely small — the implementation is a few hundred lines and fully tested.
This is worth revisiting when we want social login or 2FA, both explicitly out
of scope here.

Per-user isolation is enforced in one place: the repository layer in
`src/lib/data/`. Every function takes an owner id and every statement filters on
`user_id`; there is deliberately no unscoped accessor to call by mistake.
Ownership checks live in the `WHERE` clause of the mutation itself, not in a
separate read, so there is no check-then-write window. Misses return
`null`/`false` rather than throwing, so a foreign row is indistinguishable from
a nonexistent one and callers cannot leak an existence oracle.
