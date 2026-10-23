---
name: security-check
description: Security checklist for every change in gameWE web (Next.js, admin with TOTP, SQL via src/lib/db.ts, behind nginx). Use before finishing, committing or opening a PR for any page, route, server action, lib, config or packaging change.
---

# Security check for a change (gameWE web)

Scope: the current diff (`git diff` plus staged and untracked files). Walk
the points below, only as deep as the diff reaches, and report the result.

## Steps

1. Read the diff: `git status --short`, `git diff HEAD`.
2. List new or changed entry points: `page.tsx`, `layout.tsx`, `route.ts(x)`,
   files with `"use server"`. Each one is reachable by anyone who knows the
   URL or the action id.
3. For each point below that the diff touches, check it in the code.
4. Run `npm run lint` and `npm run build`.
5. Quick secret grep on the diff:
   `git diff HEAD | grep -nEi '(password|secret|token|apikey|api_key|BEGIN [A-Z ]*PRIVATE KEY)\s*[:=]'`
   and `git diff HEAD | grep -n 'NEXT_PUBLIC_'`.
6. Fix what you find, then report: touched points, findings with
   file:line, what you fixed, what is left.

## The checklist, adapted to gameWE web

1. **Secrets / keys:** env only via `src/lib/env.ts` on the server; no
   secret in a client component, `NEXT_PUBLIC_*`, `next.config.ts env`
   (that block is baked into the bundle: only `BASE_PATH` belongs there).
2. **Least privilege (RLS equivalent):** public pages use `query()` with
   the SELECT-only user; admin code uses `adminQuery`/`adminExec`. New
   tables or columns with personal data: check the collector's grant file
   (`schema/init/03_grants.sql` in gameWE-collector) and say if it needs a
   change there.
3. **IDOR:** ids from the URL (`players/[id]`, `servers/[id]`, `sig/[file]`,
   admin `[entity]/[id]`) are parsed strictly (digits only, length limit)
   and the row is checked against the current game and visibility
   (hidden players, hidden servers). Admin: the entity comes from
   `getEntity()` and the row from `getRow()` with its `fixed` filter.
4. **Git secrets:** see step 5; `.env*` (except `.env.example`) stays in
   `.gitignore` and `.dockerignore`.
5. **Admin routes:** every new admin page and every server action calls
   `requireAdmin(level)` with the right level (100 for games, servers,
   users and anything that can lock out or change other admins). Check
   that an `[entity]` with sensitive rows (e.g. `hlstats_Options` holds the
   encrypted TOTP secrets `gamewe_totp*`) cannot be edited by level 80.
6. **User isolation:** an admin can only change their own TOTP and
   password flow; actions with a username in the form check it against
   the session user where needed (`id === user.username` guards).
7. **Rate limits:** login has an in-memory limit per IP; the IP must come
   from a header the client cannot forge (see CLAUDE.md), maps must stay
   bounded. Expensive public routes (`/sig`, Steam profile fetches, search)
   need caching or limits.
8. **Storage:** the app writes only `.next/cache`; no file paths built from
   input; `/sig` loads remote images only from Steam's avatar host.
9. **Input validation:** `searchParams`, `params`, form data: type, length,
   allowlists (`lang` only `de`/`en`, sort keys only from `rankingSorts`),
   LIKE wildcards escaped as in `admin-data.ts`.
10. **Unauthenticated routes:** list every public route the diff adds and
    confirm it shows only public data; `/healthz` returns no details.
11. **SQL injection:** placeholders only; `${...}` in SQL only for
    constants, helper output (`sinceDays`, `likeOp`, `upsert`) or allowlisted
    identifiers. Check every `${` in changed SQL strings.
12. **Sensitive logs:** access log keeps escaping; no passwords, TOTP codes,
    cookies or session payloads in `console.*`; DB error text does not go
    to public pages (admin redirects with `msg=` are admin-only).
13. **Field tampering:** server actions only write fields defined in the
    entity (`saveRow` ignores `readonly`, `virtual`, `createOnly`), hidden
    form fields (`__entity`, `__id`) are re-checked on the server, select
    values are checked against the allowlist.
14. **Uploads:** none today. If one is added: size and type limits, no
    storage under `public/`, no path from the client.
15. **Server logic:** permissions, rankings and points are decided on the
    server; nothing security-relevant depends on client components.
16. **Trim responses:** queries select only the columns the page shows; no
    `SELECT *` on players, users, servers; `rcon_password`, IPs, password
    hashes and secrets are never read for public pages.
17. **Auth sessions:** cookie signed with HMAC (`ADMIN_SECRET` >= 32
    chars), expiry checked, user re-read on each request, TOTP codes used
    once, `httpOnly`, `sameSite: strict`, `secure` behind HTTPS. Changes to
    `auth.ts`/`totp.ts` need a second careful read.
18. **Dependencies:** a change in `package.json`/`package-lock.json` →
    `npm audit --omit=dev` and say what changed.
19. **Record access:** list and detail queries filter by game and
    visibility; admin delete only through `deleteRow` after `getRow`.
20. **Attack your own change:** try one hostile input on the changed code
    (`../`, `'`, `%`, very long strings, negative or huge numbers, a forged
    `X-Forwarded-For`, a direct POST to the server action without a
    session) and check or test it.
