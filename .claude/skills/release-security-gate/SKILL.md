---
name: release-security-gate
description: Full security pass over gameWE web before release-relevant commits are pushed to main (semantic-release then bumps, tags and releases). Use whenever a release is being prepared; ends with a go/no-go report and never tags or pushes on its own.
---

# Release security gate (gameWE web)

Run all steps over the whole repository, not only the last diff. Report a
table with the 20 points (ok / finding / n.a.) and a go/no-go.

Releases are made by semantic-release in CI: every push to `main` that
contains a `feat`, `fix` or breaking-change commit (Conventional Commits)
bumps the version, writes `CHANGELOG.md`, tags `vX.Y.Z` and publishes the
GitHub release (and, where there is one, the container image). So this gate
runs **before pushing release-relevant commits to `main`**, without asking
first. Never tag by hand, never edit the version files or `CHANGELOG.md` by
hand, and do not push to `main` yourself: report the gate result and the
version semantic-release will make (`feat` → minor, `fix` → patch,
`!`/`BREAKING CHANGE` → major), then ask Dennis for the go.

## Steps

1. **Clean tree and version:** `git status` is clean; `VERSION`,
   `package.json` and the top `CHANGELOG.md` entry agree with the latest
   tag (`git describe --tags --abbrev=0`).
2. **Build:** `npm ci`, `npm run lint`, `npm run build`.
3. **Secrets in the whole history:** prefer
   `gitleaks detect --source . --log-opts="--all"` (or
   `trufflehog git file://. --only-verified`). Without those tools:
   `git log -p --all | grep -nEi '(password|secret|token|BEGIN [A-Z ]*PRIVATE KEY)\s*[:=]' | grep -v change-me`.
   Also check the built client bundle:
   `grep -rEl 'ADMIN_SECRET|DB_PASSWORD|DB_ADMIN' .next/static || echo clean`.
4. **Dependencies:** `npm audit --omit=dev` (and `npm outdated`); report
   each advisory with package, severity and fixed version.
5. **Route inventory:** list all `page.tsx`, `route.ts(x)` and
   `"use server"` exports (`grep -rln '"use server"' src`). For each admin
   page and action confirm `requireAdmin` with the right level; for each
   public route confirm it shows only public data.
6. **SQL:** `grep -rn '\${' src/lib src/app | grep -Ei 'select|insert|update|delete|where|order by|from'`
   and confirm every hit is a constant, helper or allowlisted identifier.
7. **Attack the running app** (local `npm run build && npm start`, or the
   test instance behind nginx):
   - admin URLs and a server action POST without cookie → redirect to login;
   - login brute force with changing `X-Forwarded-For` → still blocked;
   - `/players/abc`, `/players/-1`, `/sig/..%2f..`, very long `q=` → 404 or
     clean error, no stack trace;
   - hidden player id in `/players/<id>` and `/sig/<id>.png` → not shown;
   - response headers: no `X-Powered-By`, admin cookie flags correct.
8. **Packaging:** `packaging/gamewe-web.service` keeps `HOSTNAME=127.0.0.1`
   and the systemd hardening; Dockerfile runs as non-root; `.env.example`
   contains only placeholders; nginx example passes `X-Forwarded-Proto`
   and a trustworthy client IP header.
9. **The 20 points:** go through the `security-check` skill's list for the
   whole code base, with extra attention on changes since the last tag
   (`git log --oneline <last-tag>..HEAD`).
10. **Report:** go/no-go, findings with file:line and fix, the version semantic-release will make, then ask Dennis
    for the go to push to `main`.
