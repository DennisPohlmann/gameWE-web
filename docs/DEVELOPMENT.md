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

## Build and check

```bash
npm ci
npm run lint    # type check (tsc)
npm run build
```

`npm run dev` and `npm run build` first run `scripts/vendor.mjs`: it copies
the Scalar browser bundle (devDependency `@scalar/api-reference`) to
`public/vendor/scalar/` (git-ignored) for the `/api` page and stops when a
route under `src/app/api/v1` is missing in `src/lib/openapi.ts`.

```bash
make package    # dist/gamewe-web-<version>-linux-amd64.tar.gz + .sha256
make image      # local Docker image gamewe-web:<version>
```

The version comes from a `v*` git tag on HEAD, otherwise from `VERSION`.

GitHub Actions (`.github/workflows/build.yml`) builds and checks every push
to `main` (type check, build, tar.gz as a workflow artifact) and publishes the
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
