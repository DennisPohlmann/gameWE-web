# gameWE - web: development

Running the website locally, building and releasing it. The code layout and
the rules for changes are in [CLAUDE.md](../CLAUDE.md).

## Local development

```bash
cp .env.example .env.local     # set the database
npm install
npm run dev                    # http://localhost:3000
```

Translations: [src/translations/README.md](../src/translations/README.md);
design templates: [templates/README.md](../templates/README.md).
The `modern-*` templates are generated: change
`scripts/modern-templates/layout.css` or `scripts/modern-templates.mjs`,
then run `npm run templates` (see "Modern templates" there); with
`--variants FILE.json --out DIR` it builds other colour variants with the same
layout (gameWE-web-content uses this, `make modern` there).
The flags are shown out of one picture, `public/flags/sprite.png`, with
their order in `src/lib/flag-sprite.ts`: after a change in `public/flags/`
run `npm run flags` (devDependency `sharp`) and commit both.

## Screenshots of the skins

Visual checks use the six built-in skins (`dark`, `light`, `orange`,
`modern-dark`, `modern-light`, `modern-orange`), desktop (1440) and phone
(390), on the same demo data every time.

Demo data, once per test database (collector `gamewe`, config of the test
database; everything is invented, see the head of `scripts/demo-data.mjs`):

```bash
node scripts/demo-data.mjs log > demo.log
node scripts/demo-data.mjs sql > demo.sql
gamewe db init -f
gamewe simulate -file demo.log -f
gamewe simulate -file demo.log -server 127.0.0.1:27016 -f   # a second server
psql ... < demo.sql            # or mariadb ... < demo.sql: places of the players
```

Keep a dump of that database (`pg_dump` / `mariadb-dump`) and load it for the
next check instead of seeding again.

Screenshots: start the site with `SKIN_PREVIEW=on` (`SKIN_PREVIEW=on npm start`
after a build, or `npm run dev`) and run `scripts/skin-shots.mjs` (needs
Playwright with Chromium, not a dependency: `npm i --no-save playwright`).
Every skin and device is its own browser context with the preview cookie,
so all twelve run side by side on one server; nothing in the database
changes. Only the pages change skin: banner pictures and the admin area keep
their own design.

```bash
npm run shots -- -out shots/before                  # the fixed page list, 12 pages x 12
npm run shots -- -pages player,server -out shots/after -baseline shots/before -sheet
```

`-pages` takes names of the list (`home`, `ranking`, `players`, `player`,
`server`, `clans`, `clan`, `maps`, `map`, `weapons`, `awards`, `misc`) or own
paths. `report.txt` lists HTTP errors, pages wider than the screen and browser
errors; with `-baseline` only the shots that changed (and `diff/` shows
where), so a second run needs a look at those only. `-sheet` adds one picture
per page and device with all six skins side by side (`sheet/`). All options
are at the head of the script.

## Build and check

```bash
npm ci
npm run lint    # type check (tsc)
npm test        # unit tests in tests/ (compiled to out/tests, node --test)
npm run build
```

`npm run dev` and `npm run build` first run `scripts/vendor.mjs`: it copies
the Scalar browser bundle (devDependency `@scalar/api-reference`) to
`public/vendor/scalar/` (git-ignored) for the `/api` page and stops when a
route under `src/app/api/v1` is missing in `src/lib/openapi.ts`. Then
`scripts/licenses.mjs` writes `src/lib/npm-licenses.json` (every package of
a production install with version and license, from `package-lock.json`,
for the `/licenses` page). After a dependency change run
`node scripts/licenses.mjs` and commit the file together with the lock
file; `npm test` fails while it is stale, while a license is not
GPL-compatible or while `THIRD-PARTY-LICENSES.md` lacks a package or names
another version.

```bash
make package    # dist/gamewe-web-<version>-linux-amd64.tar.gz + .sha256
make image      # local Docker image gamewe-web:<version>
```

The version comes from a `v*` git tag on HEAD, otherwise from `VERSION`.

GitHub Actions (`.github/workflows/build.yml`) builds and checks every push
to `main` (type check, tests, build, tar.gz as a workflow artifact) and publishes the
container image `ghcr.io/dennispohlmann/gamewe-web` with the tag `edge`.

## Releases

Releases are made by [semantic-release](https://semantic-release.gitbook.io/)
(`.releaserc.json`) in the same workflow; nobody tags by hand. To make a
release, push commits written as [Conventional Commits](https://www.conventionalcommits.org/)
to `main`. semantic-release reads the commits since the last tag and decides
the next version:

| Commit | Release |
|---|---|
| `feat: ...` | minor (0.1.0 → 0.2.0) |
| `fix: ...` (also `fix(security): ...`), `perf: ...` | patch (0.1.0 → 0.1.1) |
| `feat!: ...`, `fix!: ...` or a `BREAKING CHANGE:` footer | major (0.1.0 → 1.0.0) |
| `docs`, `chore`, `ci`, `build`, `test`, `refactor`, `style` | no release |

For a release it writes `VERSION`, `package.json`, `package-lock.json` and
`CHANGELOG.md`, commits them as `chore(release): vX.Y.Z [skip ci]`, tags
`vX.Y.Z` and creates the GitHub release. The workflow then builds that tag,
uploads the tar.gz and its `.sha256` checksum to the release and publishes
the image as `<version>`, `<major>.<minor>` and `latest` (for `v0.1.0`:
`0.1.0`, `0.1` and `latest`). Never edit the version files or
`CHANGELOG.md` by hand.

The image goes to the GitHub Container Registry of the repository owner with the
built-in `GITHUB_TOKEN`; no secrets need to be set. New packages on GHCR are
private; make it public under the package settings if servers should pull it
without logging in.
