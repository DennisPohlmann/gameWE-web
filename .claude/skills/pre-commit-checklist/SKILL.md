---
name: pre-commit-checklist
description: Mandatory checklist before EVERY commit in gameWE web: README check, Conventional Commit message, dependency/toolchain update check (suggest only), third-party license check. Use before every git commit, together with security-check and security-privacy-audit.
---

# Pre-commit checklist (gameWE web)

Run this before every commit, also for small fixes, together with the
`security-check` and `security-privacy-audit` skills. Scope is the diff that goes into the commit
(`git status --short`, `git diff HEAD`). Do the steps, then commit; in the
answer report one line per step (done / nothing to do / suggestion).

## 1. README.md and docs/

- Read the parts of `README.md` and `docs/*.md` (INSTALLATION, CONFIG,
  USAGE, INTERFACE, DEVELOPMENT, ...) that the diff touches: features, configuration tables, commands, defaults, build and
  install steps, version numbers, examples.
- Update them in the same commit when the behaviour, a setting, a default,
  a command, a path or a requirement changed. New settings get a row in the
  configuration table.
- Fix wrong or outdated statements you notice on the way, links that point
  to removed files, and keep the table of contents in sync.

## 2. Commit message (Conventional Commits)

`CHANGELOG.md`, the version files and the tags are written by
semantic-release in CI from the commit messages. Never edit `CHANGELOG.md`,
`VERSION` or other version fields by hand and never create tags.

- Format: `<type>(<optional scope>): <summary>`, summary in English,
  imperative, lower case, no full stop, at most ~72 characters. Body: what
  changed for users and what they have to do.
- Types: `feat` (new feature, minor release), `fix` (bug fix) and `perf`
  (performance; both patch release), `refactor`, `docs`, `test`, `build`,
  `ci`, `chore` (no release). Security fixes are `fix(security): ...`.
- Breaking change: `feat!:` / `fix!:` or a `BREAKING CHANGE: <what to do>`
  footer (major release).
- One logical change per commit, so each changelog line is meaningful.
- Say in the answer which type you chose and whether it will trigger a
  release; a `feat` or `fix` on `main` needs the `release-security-gate`
  skill and Dennis' go before the push.

## 3. Dependencies and toolchain: check, suggest, do not update on your own

- `npm outdated` shows newer versions, `npm audit --omit=dev` known
  vulnerabilities (both after `npm ci`).
- Node.js: compare `engines.node` in `package.json`, the Node version in
  `.github/workflows/build.yml` and the `Dockerfile` base image with the
  current Node LTS.
- Next.js and React: read the release notes of a new major before
  suggesting it.
- GitHub Actions in `.github/workflows/*.yml`: note newer major versions.

- Report available updates as a short list: name, current → newest,
  patch/minor/major, and for security fixes the advisory. Recommend which
  ones to take.
- Do not change versions without Dennis's OK, except when the commit is
  about exactly that update or a security advisory forces it (then say so).
- If the check needs network access that is not available, say that it was
  not possible instead of skipping silently.

## 4. Licenses of third-party code

- The public `/licenses` page lists the licenses of the software, data, map
  tiles, flags and fonts the website uses (find its source with
  `grep -rl "licenses" src/app`). Every runtime dependency in
  `package.json` `dependencies` (and what they bundle into the client, e.g.
  leaflet CSS/images) must be on it with version and license; map tiles,
  flags, fonts and GeoIP data keep their attribution.
- A quick inventory: `npx --yes license-checker --production --summary`
  (or read `node_modules/<pkg>/package.json` `license`).
- `THIRD-PARTY-LICENSES.md` lists every production npm package
  (`npm ls --omit=dev --all`), grouped by license, plus what Next.js bundles
  (`@vercel/og`, Geist font) and the files in `public/`; keep it in step
  with `/licenses` and `package-lock.json`.
- The README section License points to `/licenses` and
  `THIRD-PARTY-LICENSES.md`; keep that true.

- A new third-party component (library, copied code, font, icon, data,
  map tiles, build tool that ships output) needs, in the same commit: name,
  version, SPDX license, URL, what it is used for, and the full license
  text where the license requires it (MIT, BSD, Apache-2.0 NOTICE,
  CC-BY attribution).
- Check that the license is compatible with GPL-3.0-or-later (MIT, BSD,
  ISC, Apache-2.0, MPL-2.0, LGPL, GPL-2.0-or-later, GPL-3.0 are fine;
  GPL-2.0-only, AGPL, SSPL, "non-commercial" or unknown licenses: stop and
  ask Dennis).
- A removed component is removed from the list too; a version change
  updates the version in the list.
- Code taken over from other projects keeps its copyright header and is
  named in README.md (section License or Credits).

## 5. Security and privacy audit

- Run the `security-privacy-audit` skill over the working tree, the
  staged diff (`git diff --cached`), touched docs and the commit message.
- Use `gitleaks protect --staged` if gitleaks is installed; otherwise say
  that it was not available and rely on the targeted searches.
- A `BLOCKED` finding stops the commit. Report only category and
  location, never the value.
- End the answer with the audit summary from that skill.
