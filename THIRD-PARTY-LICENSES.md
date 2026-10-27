# Third-party licenses

gameWE web itself is licensed under GPL-3.0-or-later (see [LICENSE](LICENSE)).
It ships or uses the third-party components below. The license texts are
included in each package (`node_modules/<package>/LICENSE`, in the tar.gz
and the container image under `node_modules/` of the standalone server) or
linked here. The public page `/licenses` shows the same software, data and
graphics for visitors.

All licenses below are compatible with GPL-3.0-or-later.

## npm packages (production)

Every package of a production install (`npm ci --omit=dev`, linux-x64).
The same list with versions is generated from `package-lock.json` by
`scripts/licenses.mjs` before every build (`src/lib/npm-licenses.json`, shown
on `/licenses`); `npm test` fails when a package of it is missing here or its
version differs. Optional platform packages that are not installed on
linux-x64 (other `@img/sharp-*` and `@next/swc-*` builds) are left out; they
carry the same licenses as their linux-x64 counterparts.

### MIT

| Package | Version | Project |
|---------|---------|---------|
| next | 16.4.3 | https://github.com/vercel/next.js |
| @next/env | 16.4.3 | https://github.com/vercel/next.js |
| @next/swc-linux-x64-gnu | 16.4.3 | https://github.com/vercel/next.js |
| @next/swc-linux-x64-musl | 16.4.3 | https://github.com/vercel/next.js |
| react | 19.3.1 | https://github.com/facebook/react |
| react-dom | 19.3.1 | https://github.com/facebook/react |
| scheduler | 0.28.0 | https://github.com/facebook/react |
| server-only | 0.0.1 | https://github.com/facebook/react |
| client-only | 0.0.1 | https://github.com/facebook/react |
| styled-jsx | 5.1.6 | https://github.com/vercel/styled-jsx |
| postcss | 8.5.23 | https://github.com/postcss/postcss |
| nanoid | 3.3.20 | https://github.com/ai/nanoid |
| mysql2 | 3.24.6 | https://github.com/sidorares/node-mysql2 |
| aws-ssl-profiles | 1.1.2 | https://github.com/mysqljs/aws-ssl-profiles |
| named-placeholders | 1.1.6 | https://github.com/mysqljs/named-placeholders |
| sql-escaper | 1.5.2 | https://github.com/mysqljs/sql-escaper |
| generate-function | 2.3.1 | https://github.com/mafintosh/generate-function |
| is-property | 1.0.2 | https://github.com/mikolalysenko/is-property |
| iconv-lite | 0.7.3 | https://github.com/pillarjs/iconv-lite |
| safer-buffer | 2.1.2 | https://github.com/ChALkeR/safer-buffer |
| lru.min | 1.1.5 | https://github.com/wellwelwel/lru.min |
| pg | 8.23.1 | https://github.com/brianc/node-postgres |
| pg-cloudflare | 1.4.1 | https://github.com/brianc/node-postgres |
| pg-connection-string | 2.14.1 | https://github.com/brianc/node-postgres |
| pg-pool | 3.14.0 | https://github.com/brianc/node-postgres |
| pg-protocol | 1.16.1 | https://github.com/brianc/node-postgres |
| pg-types | 2.2.0 | https://github.com/brianc/node-pg-types |
| pgpass | 1.0.5 | https://github.com/hoegaarden/pgpass |
| postgres-array | 2.0.0 | https://github.com/bendrucker/postgres-array |
| postgres-bytea | 1.0.1 | https://github.com/bendrucker/postgres-bytea |
| postgres-date | 1.0.7 | https://github.com/bendrucker/postgres-date |
| postgres-interval | 1.2.0 | https://github.com/bendrucker/postgres-interval |
| xtend | 4.0.2 | https://github.com/Raynos/xtend |
| uqr | 0.1.3 | https://github.com/unjs/uqr |
| @emnapi/runtime | 1.11.3 | https://github.com/toyobayashi/emnapi |
| @img/colour | 1.1.0 | https://github.com/lovell/colour |
| @types/node | 26.6.5 | https://github.com/DefinitelyTyped/DefinitelyTyped (type definitions only, peer dependency) |
| undici-types | 8.9.0 | https://github.com/nodejs/undici (type definitions only) |

### Apache-2.0

| Package | Version | Project |
|---------|---------|---------|
| sharp | 0.35.5 | https://github.com/lovell/sharp (optional, image optimisation of Next.js; also draws `public/flags/sprite.png` at development time) |
| @img/sharp-linux-x64 | 0.35.5 | https://github.com/lovell/sharp |
| @img/sharp-linuxmusl-x64 | 0.35.5 | https://github.com/lovell/sharp |
| @swc/helpers | 0.5.23 | https://github.com/swc-project/swc |
| detect-libc | 2.1.2 | https://github.com/lovell/detect-libc |
| baseline-browser-mapping | 2.11.30 | https://github.com/web-platform-dx/baseline-browser-mapping |
| long | 5.3.2 | https://github.com/dcodeIO/long.js |
| @opentelemetry/api | 1.9.0 | https://github.com/open-telemetry/opentelemetry-js (optional peer dependency of Next.js, tracing interface only) |

### LGPL-3.0-or-later

| Package | Version | Project |
|---------|---------|---------|
| @img/sharp-libvips-linux-x64 | 1.3.4 | https://github.com/lovell/sharp-libvips (prebuilt libvips and its libraries; the package lists them in its README and `versions.json`) |
| @img/sharp-libvips-linuxmusl-x64 | 1.3.4 | https://github.com/lovell/sharp-libvips |

### Apache-2.0 AND LGPL-3.0-or-later AND MIT

| Package | Version | Project |
|---------|---------|---------|
| @img/sharp-wasm32 | 0.35.5 | https://github.com/lovell/sharp (WebAssembly build of sharp and libvips, the fallback without a native build) |

### BSD-2-Clause

| Package | Version | Project |
|---------|---------|---------|
| leaflet | 1.9.4 | https://leafletjs.com (player maps; its CSS and marker images are sent to the browser) |

### BSD-3-Clause

| Package | Version | Project |
|---------|---------|---------|
| source-map-js | 1.2.2 | https://github.com/7rulnik/source-map-js |

### ISC

| Package | Version | Project |
|---------|---------|---------|
| pg-int8 | 1.0.1 | https://github.com/charmander/pg-int8 |
| split2 | 4.2.0 | https://github.com/mcollina/split2 |
| semver | 7.8.5 | https://github.com/npm/node-semver |
| picocolors | 1.1.1 | https://github.com/alexeyraspopov/picocolors |

### 0BSD

| Package | Version | Project |
|---------|---------|---------|
| tslib | 2.8.1 | https://github.com/microsoft/tslib |

### CC-BY-4.0

| Package | Version | Project |
|---------|---------|---------|
| caniuse-lite | 1.0.30001819 | https://github.com/browserslist/caniuse-lite (browser support data, used at build time) |

## Bundled inside Next.js

`next/dist/compiled/@vercel/og` (used by `next/og` for the forum signatures
`/sig/...` and the server banners `/banner/...`):

| Component | License | Project |
|-----------|---------|---------|
| @vercel/og 1.0.1 | MPL-2.0 | https://github.com/vercel/og |
| Satori | MPL-2.0 | https://github.com/vercel/satori |
| resvg (resvg.wasm) | MPL-2.0 | https://github.com/RazrFalcon/resvg |
| Yoga (yoga.wasm) | MIT | https://github.com/facebook/yoga |
| Geist font (Geist-Regular.ttf) | SIL OFL 1.1 | https://github.com/vercel/geist-font |

The MPL-2.0 components are used unmodified; their source is available at
the links above.

## Browser bundle of the API documentation

The page `/api` renders the OpenAPI description of the public API with the
self-hosted browser bundle of **Scalar API Reference**
(`@scalar/api-reference` 1.75.1, devDependency, https://github.com/scalar/scalar,
MIT). `npm run build` copies `dist/browser/standalone.js` to
`public/vendor/scalar/standalone.js` together with Scalar's MIT license text
(`public/vendor/scalar/LICENSE.txt`); nothing is loaded from Scalar's
servers. The bundle includes code from Scalar's dependencies (`npm query
'#@scalar/api-reference *'`): mostly MIT (Vue, Tailwind CSS and others),
some Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause (highlight.js) and 0BSD;
all compatible with GPL-3.0-or-later.

## Files in this repository

| Path | Component | License |
|------|-----------|---------|
| `public/flags/*.svg` (except `unknown.svg`, gameWE's own placeholder) and `public/flags/sprite.png` (all of them in one picture, made by `scripts/flags-sprite.mjs`) | flag-icons 7.2.3 by Panayiotis Lipiridis, https://github.com/lipis/flag-icons | MIT, text in `public/flags/LICENSE.txt` |
| `public/icon*.png`, `public/icon.svg`, `public/apple-touch-icon.png`, `public/avatar-unknown.svg` | gameWE's own graphics | GPL-3.0-or-later |
| `templates/` | gameWE's own design templates | GPL-3.0-or-later |
| `overviews/cs2/*.png` and their `.json` (de_ancient, de_anubis, de_cache, de_dust2, de_inferno, de_mirage, de_nuke, de_overpass, de_train, de_vertigo) | redrawn by gameWE (`scripts/overviews/restyle.py`) from the radar pictures of Boltobserv (commit 0320883), https://github.com/boltgolt/boltobserv, made with simpleradar; Boltobserv's calibration | GPL-3.0, text in `overviews/cs2/LICENSE-boltobserv.txt` |
| `overviews/cs2/cs_italy.json`, `cs_office.json`, `de_dust.json` | position and scale taken from Counter-Strike 2's overview files (`resource/overviews/<map>.txt`, Valve); numbers only | facts from Valve's game files |
| `overviews/csgo/*` | redrawn by gameWE (`scripts/overviews/restyle.py`) from CS:GO's radar pictures (Valve), as collected in https://github.com/micvbang/csgo-overviews; calibration from the game's overview files | gameWE's drawing GPL-3.0-or-later; the map layouts are Valve's |
| `overviews/css/*` | drawn by gameWE (`scripts/overviews/radar.py`) from the stock map and navigation files of Counter-Strike: Source (Valve) | gameWE's drawing GPL-3.0-or-later; the map layouts are Valve's |
| `scripts/overviews/` | gameWE's own scripts | GPL-3.0-or-later |
| `src/components/admin/icons.tsx` | admin menu icons, several paths after Feather Icons 4.29 by Cole Bemis, https://github.com/feathericons/feather | MIT, text in `src/components/admin/FEATHER-LICENSE.txt` |
| Database schema and table names (`hlstats_*`) | HLstatsX: Community Edition, https://github.com/NomisCZ/hlstatsx-community-edition | GPL-2.0-or-later (the schema is created by the collector; gameWE web reads it) |
| Counter-Strike 2 support (game `cs2`, hit zone neck) | reference: HLstatsX:CE with CS2 support by lovasatt, https://github.com/lovasatt/hlstatsx-community-edition (no code or files copied; its CS2 definitions are used by the collector) | GPL-2.0-or-later, usable under GPL-3.0-or-later ("or any later version") |

Rank insignia and award ribbons are drawn with SVG and CSS in
`src/components/badges.tsx` (no third-party images).

## External data and services

Not shipped with gameWE web, but shown on its pages; their credit appears on
the site where required:

| Data or service | License | Notes |
|-----------------|---------|-------|
| IP to City Lite (DB-IP.com) | CC BY 4.0 | GeoIP data of the collector, credit "IP Geolocation by DB-IP" |
| GeoLite2 (MaxMind) | GeoLite2 EULA | alternative GeoIP data of the collector |
| OpenStreetMap data and tiles | ODbL 1.0 | "© OpenStreetMap contributors" |
| Steam Web API, steamcommunity.com | Steam Web API Terms of Use | avatars, profile data, VAC/game bans |
