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
| next | 16.4.6 | https://github.com/vercel/next.js |
| @next/env | 16.4.6 | https://github.com/vercel/next.js |
| @next/swc-linux-x64-gnu | 16.4.6 | https://github.com/vercel/next.js |
| @next/swc-linux-x64-musl | 16.4.6 | https://github.com/vercel/next.js |
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
| @types/node | 26.6.6 | https://github.com/DefinitelyTyped/DefinitelyTyped (type definitions only, peer dependency) |
| undici-types | 8.9.0 | https://github.com/nodejs/undici (type definitions only) |
| @azure-rest/core-client | 2.9.0 | https://github.com/Azure/azure-sdk-for-js |
| @azure/abort-controller | 2.2.0 | https://github.com/Azure/azure-sdk-for-js |
| @azure/core-auth | 1.11.0 | https://github.com/Azure/azure-sdk-for-js |
| @azure/core-client | 1.11.2 | https://github.com/Azure/azure-sdk-for-js |
| @azure/core-lro | 2.7.2 | https://github.com/Azure/azure-sdk-for-js |
| @azure/core-paging | 1.7.0 | https://github.com/Azure/azure-sdk-for-js |
| @azure/core-process | 1.0.0 | https://github.com/Azure/azure-sdk-for-js |
| @azure/core-rest-pipeline | 1.25.1 | https://github.com/Azure/azure-sdk-for-js |
| @azure/core-tracing | 1.4.0 | https://github.com/Azure/azure-sdk-for-js |
| @azure/core-util | 1.14.0 | https://github.com/Azure/azure-sdk-for-js |
| @azure/identity | 4.14.1 | https://github.com/Azure/azure-sdk-for-js |
| @azure/keyvault-common | 2.1.1 | https://github.com/Azure/azure-sdk-for-js |
| @azure/keyvault-keys | 4.10.2 | https://github.com/Azure/azure-sdk-for-js |
| @azure/logger | 1.4.0 | https://github.com/Azure/azure-sdk-for-js |
| @azure/msal-browser | 5.29.1 | https://github.com/AzureAD/microsoft-authentication-library-for-js |
| @azure/msal-common | 16.16.2 | https://github.com/AzureAD/microsoft-authentication-library-for-js |
| @azure/msal-node | 7.2.2 | https://github.com/AzureAD/microsoft-authentication-library-for-js |
| @tediousjs/connection-string | 1.1.0 | https://github.com/tediousjs/connection-string |
| @types/readable-stream | 4.0.25 | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @typespec/ts-http-runtime | 0.3.10 | https://github.com/Azure/azure-sdk-for-js |
| abort-controller | 3.0.0 | https://github.com/mysticatea/abort-controller |
| agent-base | 9.0.0 | https://github.com/TooTallNate/proxy-agents |
| base64-js | 1.5.1 | https://github.com/beatgammit/base64-js |
| bl | 6.1.6 | https://github.com/rvagg/bl |
| buffer | 6.0.3 | https://github.com/feross/buffer |
| bundle-name | 4.1.1 | https://github.com/sindresorhus/bundle-name |
| commander | 11.1.0 | https://github.com/tj/commander.js |
| debug | 4.4.3 | https://github.com/debug-js/debug |
| default-browser | 5.5.1 | https://github.com/sindresorhus/default-browser |
| default-browser-id | 5.0.1 | https://github.com/sindresorhus/default-browser-id |
| define-lazy-prop | 3.0.0 | https://github.com/sindresorhus/define-lazy-prop |
| event-target-shim | 5.0.1 | https://github.com/mysticatea/event-target-shim |
| events | 3.3.0 | https://github.com/Gozala/events |
| http-proxy-agent | 9.1.0 | https://github.com/TooTallNate/proxy-agents |
| https-proxy-agent | 9.1.0 | https://github.com/TooTallNate/proxy-agents |
| is-docker | 3.0.0 | https://github.com/sindresorhus/is-docker |
| is-in-ssh | 1.0.0 | https://github.com/sindresorhus/is-in-ssh |
| is-inside-container | 1.0.0 | https://github.com/sindresorhus/is-inside-container |
| is-wsl | 3.1.1 | https://github.com/sindresorhus/is-wsl |
| js-md4 | 0.3.2 | https://github.com/emn178/js-md4 |
| jsonwebtoken | 9.0.3 | https://github.com/auth0/node-jsonwebtoken |
| jwa | 2.0.1 | https://github.com/brianloveswords/node-jwa |
| jws | 4.0.1 | https://github.com/brianloveswords/node-jws |
| lodash.includes | 4.3.0 | https://github.com/lodash/lodash |
| lodash.isboolean | 3.0.3 | https://github.com/lodash/lodash |
| lodash.isinteger | 4.0.4 | https://github.com/lodash/lodash |
| lodash.isnumber | 3.0.3 | https://github.com/lodash/lodash |
| lodash.isplainobject | 4.0.6 | https://github.com/lodash/lodash |
| lodash.isstring | 4.0.1 | https://github.com/lodash/lodash |
| lodash.once | 4.1.1 | https://github.com/lodash/lodash |
| ms | 2.1.3 | https://github.com/vercel/ms |
| mssql | 12.7.14 | https://github.com/tediousjs/node-mssql |
| native-duplexpair | 1.0.0 | https://github.com/tediousjs/native-duplexpair |
| open | 11.0.4 | https://github.com/sindresorhus/open |
| powershell-utils | 0.2.1 | https://github.com/sindresorhus/powershell-utils |
| process | 0.11.10 | https://github.com/shtylman/node-process |
| proxy-agent-negotiate | 1.1.0 | https://github.com/TooTallNate/proxy-agents |
| readable-stream | 4.8.0 | https://github.com/nodejs/readable-stream |
| run-applescript | 7.1.0 | https://github.com/sindresorhus/run-applescript |
| safe-buffer | 5.2.1 | https://github.com/feross/safe-buffer |
| string_decoder | 1.3.0 | https://github.com/nodejs/string_decoder |
| tarn | 3.1.2 | https://github.com/knex/tarn.js |
| tedious | 20.3.9 | https://github.com/tediousjs/tedious |
| wsl-utils | 1.0.1 | https://github.com/sindresorhus/wsl-utils |

### Apache-2.0

| Package | Version | Project |
|---------|---------|---------|
| sharp | 0.35.5 | https://github.com/lovell/sharp (optional, image optimisation of Next.js; also draws `public/flags/sprite.png` at development time) |
| @img/sharp-linux-x64 | 0.35.5 | https://github.com/lovell/sharp |
| @img/sharp-linuxmusl-x64 | 0.35.5 | https://github.com/lovell/sharp |
| @swc/helpers | 0.5.23 | https://github.com/swc-project/swc |
| detect-libc | 2.1.2 | https://github.com/lovell/detect-libc |
| baseline-browser-mapping | 2.11.35 | https://github.com/web-platform-dx/baseline-browser-mapping |
| long | 5.3.2 | https://github.com/dcodeIO/long.js |
| ecdsa-sig-formatter | 1.0.11 | https://github.com/Brightspace/node-ecdsa-sig-formatter |

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
| @js-joda/core | 6.3.2 | https://github.com/js-joda/js-joda |
| buffer-equal-constant-time | 1.0.1 | git@github.com:goinstant/buffer-equal-constant-time |
| ieee754 | 1.2.1 | https://github.com/feross/ieee754 |

### ISC

| Package | Version | Project |
|---------|---------|---------|
| pg-int8 | 1.0.1 | https://github.com/charmander/pg-int8 |
| split2 | 4.2.0 | https://github.com/mcollina/split2 |
| semver | 7.8.6 | https://github.com/npm/node-semver |
| picocolors | 1.1.1 | https://github.com/alexeyraspopov/picocolors |
| inherits | 2.0.4 | https://github.com/isaacs/inherits |

### 0BSD

| Package | Version | Project |
|---------|---------|---------|
| tslib | 2.9.1 | https://github.com/microsoft/tslib |

### CC-BY-4.0

| Package | Version | Project |
|---------|---------|---------|
| caniuse-lite | 1.0.30001826 | https://github.com/browserslist/caniuse-lite (browser support data, used at build time) |

### OFL-1.1

Fonts, served by this site itself (no font CDN). They are separate files
next to the program, not linked with its code, so the OFL fits a
GPL-3.0-or-later program. The license text with the copyright line ships
as `public/vendor/fonts/<name>-LICENSE.txt` (copied by `scripts/vendor.mjs`).

| Package | Version | Project |
|---------|---------|---------|
| @fontsource/inter | 5.3.0 | https://github.com/rsms/inter (Inter, modern designs) |
| @fontsource/noto-sans | 5.3.0 | https://github.com/notofonts/latin-greek-cyrillic (Noto Sans, classic designs) |

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
(`@scalar/api-reference` 1.78.1, devDependency, https://github.com/scalar/scalar,
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
| `public/games/<code>/icon.png` without an `icon.svg` beside it | the games' own icons before the server names, supplied by the maintainer; the artwork of Valve Corporation, the Zombie Panic Team and the rights holders of the other mod games, whose names are their trademarks | Valve's: Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement; Zombie Panic! Source: All Rights Reserved (https://zombiepanicsource.com/); the other mod games': all rights with the rights holder of the game; see each folder's `LICENSE.txt` |
| `public/games/<code>/icon.svg` and the `icon.png` made from it | gameWE's own drawing of a game icon (not the game's official logo) | GPL-3.0-or-later |
| `templates/` | gameWE's own design templates | GPL-3.0-or-later |
| `overviews/cs2/*.png` and their `.json` (de_ancient, de_anubis, de_cache, de_dust2, de_inferno, de_mirage, de_nuke, de_overpass, de_train, de_vertigo) | redrawn by gameWE (`scripts/overviews/restyle.py`) from the radar pictures of Boltobserv (commit 0320883), https://github.com/boltgolt/boltobserv, made with simpleradar; Boltobserv's calibration | GPL-3.0, text in `overviews/cs2/LICENSE-boltobserv.txt` |
| `overviews/cs2/cs_italy.json`, `cs_office.json`, `de_dust.json` | position and scale taken from Counter-Strike 2's overview files (`resource/overviews/<map>.txt`, Valve); numbers only | facts from Valve's game files |
| `overviews/csgo/*` | redrawn by gameWE (`scripts/overviews/restyle.py`) from CS:GO's radar pictures (Valve), as collected in https://github.com/micvbang/csgo-overviews; calibration from the game's overview files | gameWE's drawing GPL-3.0-or-later; the map layouts are Valve's |
| `overviews/css/*` | drawn by gameWE (`scripts/overviews/radar.ts`) from the stock map and navigation files of Counter-Strike: Source (Valve) | gameWE's drawing GPL-3.0-or-later; the map layouts are Valve's |
| `overviews/{tf,dods,hl2mp}/*` | drawn by gameWE (`scripts/overviews/radar.ts`) from the stock map files of Team Fortress 2, Day of Defeat: Source and Half-Life 2 Deathmatch (Valve) | gameWE's drawing GPL-3.0-or-later; the map layouts are Valve's |
| `overviews/{nmrih,fof,zps}/*` | drawn by gameWE (`scripts/overviews/radar.ts`) from the stock map files of No More Room in Hell (No More Room in Hell Team), Fistful of Frags (Fistful of Frags Team) and Zombie Panic! Source (Zombie Panic Team) | gameWE's drawing GPL-3.0-or-later; the map layouts are their developers' |
| `map-images/css/*.png` (the 18 stock maps of Counter-Strike: Source) | the game's own menu pictures (`materials/vgui/maps/menu_thumb_<map>.vtf`), converted to PNG with `scripts/overviews/thumbs.ts`; property of Valve Corporation | not covered by gameWE's license and not licensed by Valve to gameWE; included only to show which map is running, removed on request of the rights holder; see `map-images/css/LICENSE.txt` |
| `map-images/dods/*.png` (the 9 stock maps of Day of Defeat: Source) | the game's own menu pictures (`materials/vgui/maps/menu_thumb_<map>.vtf`), converted to PNG with `scripts/overviews/thumbs.ts`; property of Valve Corporation | not covered by gameWE's license and not licensed by Valve to gameWE; included only to show which map is running, removed on request of the rights holder; see `map-images/dods/LICENSE.txt` |
| `map-images/hl2mp/*.png` (the 7 stock maps of Half-Life 2 Deathmatch) | the game's own menu pictures (`materials/vgui/maps/menu_thumb_<map>.vtf`), converted to PNG with `scripts/overviews/thumbs.ts`; property of Valve Corporation | not covered by gameWE's license and not licensed by Valve to gameWE; included only to show which map is running, removed on request of the rights holder; see `map-images/hl2mp/LICENSE.txt` |
| `scripts/overviews/` | gameWE's own scripts | GPL-3.0-or-later |
| `scripts/overviews/draw.ts` (`fillPolygon`) | scan line polygon filling translated from Pillow 12.1.1 (`src/libImaging/Draw.c`), https://github.com/python-pillow/Pillow, so that the pictures stay the same | MIT-CMU, https://github.com/python-pillow/Pillow/blob/12.1.1/LICENSE |
| `scripts/overviews/draw.ts` (`nearestValid`, `voronoiLine`) | feature transform translated from SciPy 1.16.3 (`scipy/ndimage/src/ni_morphology.c`), https://github.com/scipy/scipy | BSD-3-Clause, https://github.com/scipy/scipy/blob/v1.16.3/LICENSE.txt |
| `scripts/overviews/draw.ts` (`npSum`, `percentile`) | summing and percentile rules translated from NumPy 2.3.5, https://github.com/numpy/numpy | BSD-3-Clause, https://github.com/numpy/numpy/blob/v2.3.5/LICENSE.txt |
| `src/components/admin/icons.tsx` | admin menu icons, several paths after Feather Icons 4.29 by Cole Bemis, https://github.com/feathericons/feather | MIT, text in `src/components/admin/FEATHER-LICENSE.txt` |
| Database schema and table names (`hlstats_*`) | HLstatsX: Community Edition, https://github.com/NomisCZ/hlstatsx-community-edition | GPL-2.0-or-later (the schema is created by the collector; gameWE web reads it) |
| Counter-Strike 2 support (game `cs2`, hit zone neck) | reference: HLstatsX:CE with CS2 support by lovasatt, https://github.com/lovasatt/hlstatsx-community-edition (no code or files copied; its CS2 definitions are used by the collector) | GPL-2.0-or-later, usable under GPL-3.0-or-later ("or any later version") |

## Game icons

The icon before every server name (`public/games/<code>/icon.png`). Each
folder holds the icon's `LICENSE.txt` with the source, the original file's
SHA-256 and the full license note; the website lists the same on
`/licenses` under "Spiel-Icons / game icons". The names of the games are
trademarks of their makers; gameWE is not affiliated with or endorsed by
them. The Valve icons are listed under the Steam Subscriber Agreement,
section 2.D "License to Use Valve Game Content in Fan Art"
(https://store.steampowered.com/agreement). The Zombie Panic! Source
icon: "Copyright © Zombie Panic Team 2004-2026. All Rights Reserved. Zombie
Panic is a trademark of Monochrome, Inc." (https://zombiepanicsource.com/).
The icons of Fistful of Frags and No More Room in Hell belong to the rights
holder of each game. For these mod games no license that allows passing them on is
known: they are shipped on the maintainer's own decision, and
gameWE's own drawing (git history: `public/games/<code>/icon.svg`) can take
its place.

| Game | Folder | Source | Rights holder | Changed by gameWE | License |
|------|--------|--------|---------------|-------------------|---------|
| Counter-Strike 2 | `public/games/cs2/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | none | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Counter-Strike: Global Offensive | `public/games/csgo/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | none | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Counter-Strike: Source | `public/games/css/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | scaled down to 32 x 32 | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Counter-Strike 1.6 | `public/games/cstrike/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | none | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Counter-Strike: Condition Zero | `public/games/czero/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | none | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Day of Defeat | `public/games/dod/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | none | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Day of Defeat: Source | `public/games/dods/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | none | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Fistful of Frags | `public/games/fof/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | the rights holder of the game | none | all rights with the rights holder of the game |
| Half-Life 2 Deathmatch | `public/games/hl2mp/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-30 | Valve Corporation | scaled down to 32 x 32 | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Left 4 Dead | `public/games/l4d/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | none | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Left 4 Dead 2 | `public/games/l4d2/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | none | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| No More Room in Hell | `public/games/nmrih/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | the rights holder of the game | none | all rights with the rights holder of the game |
| Team Fortress 2 | `public/games/tf/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | none | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Half-Life Deathmatch | `public/games/valve/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Valve Corporation | none | Steam Subscriber Agreement, section 2.D, https://store.steampowered.com/agreement |
| Zombie Panic! Source | `public/games/zps/` | supplied by the maintainer (Dennis Pohlmann), 2026-10-31 | Zombie Panic Team ("Zombie Panic" is a trademark of Monochrome, Inc.) | none | All Rights Reserved, https://zombiepanicsource.com/ |

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
