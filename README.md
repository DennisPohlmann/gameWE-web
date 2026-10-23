# gameWE - web

The website of gameWE: statistics pages in the style of gameME, plus an admin
area. It reads the database that the gameWE collector fills, on MariaDB/MySQL
or PostgreSQL (HLstatsX/gameME schema, see `schema/` and
`docs/DB-SEMANTICS.md` in the collector repository).

Built with Next.js 16 (App Router, server-rendered, almost no client
JavaScript), React 19 and TypeScript 7, with `mysql2` and `pg`. Needs
Node.js 22 or newer; the container image uses Node.js 24 LTS on Debian 13.
Runs as a Docker container or as a systemd service from a tar.gz.

- **Installation:** [INSTALLATION.md](INSTALLATION.md) (container and tar.gz,
  database users, reverse proxy, updates)
- **Changes:** [CHANGELOG.md](CHANGELOG.md)
- **Own designs:** [templates/README.md](templates/README.md)
- **License:** GPL-3.0-or-later, see [LICENSE](LICENSE); third-party
  licenses in [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md)

## Screenshots

Server addresses, server names, the domain and Steam IDs are blurred.

**Start page: all rankings, players online, best player and clan**

![Start page: all rankings, players online, best player and clan](docs/screenshots/home.png)

**Servers: who is playing now on a map, load graph**

![Servers: who is playing now on a map, load graph](docs/screenshots/servers.png)

**One server: live view, load of the last 24 hours, counters**

![One server: live view, load of the last 24 hours, counters](docs/screenshots/server-detail.png)

**Player ranking**

![Player ranking](docs/screenshots/players.png)

**Player profile: summary, trend, rank and career**

![Player profile: summary, trend, rank and career](docs/screenshots/player-profile.png)

**Player profile: hitbox**

![Player profile: hitbox](docs/screenshots/player-hitbox.png)

**Player profile: weapons**

![Player profile: weapons](docs/screenshots/player-weapons.png)

**Player history per day**

![Player history per day](docs/screenshots/player-history.png)

**Daily awards with calendar**

![Daily awards with calendar](docs/screenshots/awards.png)

**Activity**

![Activity](docs/screenshots/activity.png)

**Misc: countries, weekdays, connects**

![Misc: countries, weekdays, connects](docs/screenshots/misc.png)

## Pages

| URL | Content |
|-----|---------|
| `/` | all rankings with players online, best player (Steam picture, flag) and clan (flag of its members' most common country), load of the last 30 days |
| `/<game>` | a ranking: servers, live players per server by team, daily awards, activity |
| `/<game>/servers/<id>` | one server: live view with bots and flags, load graph of the last 24 hours (players, maps, uptime), counters, chat |
| `/<game>/players` | ranking (sortable, search), `?view=new` for new players; country and city rankings with gameME's links: `?type=countryinfo` (all countries), `?type=countryinfo&valuecountry=de` (players of a country), `?type=cityinfo[&valuecountry=de]` (cities), `?type=cityinfo&valuecountry=de&valuecity=berlin` (players of a city; `valuecity` alone also works but joins cities of the same name) |
| `/<game>/players/<id>` | player profile: Steam avatar and data, summary with radar and trend pills, player trend, rank and career, ribbons, forum signature, hitbox, weapons, maps, opponents |
| `/<game>/clans`, `/<game>/clans/<id>` | clans and members |
| `/<game>/awards` | daily awards with a calendar (`?date=YYYY-MM-DD`, `?month=YYYY-MM`); `?view=history`, `?view=ranks`, `?view=ribbons` (with most decorated players, `&class=N` filters a ribbon class) |
| `/<game>/weapons`, `/<game>/weapons/<code>` | weapons like gameME's (kills %, headshots %, HS/kill as bars, sortable: `?sort=name\|modifier\|kills\|headshots\|hpk&dir=asc`), best players per weapon |
| `/<game>/actions`, `/<game>/actions/<id>` | actions, best players per action |
| `/<game>/maps`, `/<game>/maps/<id>` | maps; per map a kill heatmap (where players died, `?pos=killer` where the killers stood; Source games only, GoldSrc logs carry no positions) and the best players (last 30 days) |
| `/<game>/teams` | team choice, roles |
| `/<game>/players/<id>/events` | player history: connects, team and name changes, actions, kills and deaths (filter by type) |
| `/<game>/players/<id>/sessions` | player history per day: points, time, kills, K/D, HS, accuracy |
| `/<game>/players/<id>/awards` | awards the player won: summary and list by date |
| `/<game>/players/<id>/chat` | the player's chat messages |
| `/<game>/chat` | chat log with search |
| `/<game>/misc` | player countries, weekdays, connects per day, connect methods |
| `/<game>/bans` | ban list like gameME's: players the collector marked as banned from the server logs (VAC kick, permanent server ban; `hideranking = 2`), bans from SourceBans (reason, length, date) and, with `STEAM_API_KEY`, VAC/game bans from Steam; points, K/D, HS/kill and accuracy per player. `hlstats_Players_Bans` adds type, date and reason for log bans. |
| `/search` | search players by name or Steam ID and clans by tag or name (`?q=...&st=names\|steam\|clans&game=<code>`) |
| `/help` | help: how points are calculated (with the current settings), actions, weapon modifiers, chat commands |
| `/licenses` | licenses of the software, data, map tiles, flags and fonts gameWE uses |
| `/<game>/events-feed` | the latest 10 events of a ranking as JSON (live box on the start page; 404 unless the admin setting "Latest events" is live) |
| `/api/v1/...` | public JSON API, see below |
| `/sig/<playerId>.png` | forum signature image (400x100) with rank insignia, position and activity; classic grey by default, `/sig/<playerId>-<template>.png` in a design template's colours; the profile offers the code as BBCode, HTML, Markdown or image URL |
| `/banner/<serverId>.png` | server banner (560x95) with address, status, players, rank, map and the last 24 hours; `-<template>` as above; code on the server page and the Misc page |
| `/robots.txt`, `/sitemap.xml` | for search engines, see below |
| `/admin` | admin area |

A ranking is a row of `hlstats_Games` that you create in the admin area
(Rankings, e.g. "Assault"), optionally copying weapons, actions, teams, roles,
awards and ranks from an existing ranking. Servers are assigned on the
ranking's page (this sets `hlstats_Servers.game`); the collector picks the
change up within a minute. The start page lists every ranking that has servers;
the servers are listed on the ranking's page. Rankings without servers serve
as templates.

`<game>` is `hlstats_Games.code`, for example `css`.

### What the data depends on

The collector does not fill every gameME table (see DB-SEMANTICS.md). The
website therefore computes some things itself:

- **Daily awards** are the awards in `hlstats_Awards`. The collector stores each day's winners in `hlstats_Awards_History`; the
  website computes today's leaders, and yesterday's winners while nothing is
  stored, from the same sources (`hlstats_Events_Frags`,
  `hlstats_Events_PlayerActions`, `hlstats_Players_History`).
- **Ribbons** count a player's wins per award in `hlstats_Awards_History`;
  the classes (bronze, silver, gold) come from
  `hlstats_Definition_Ribbons_Classes`.
- **Ranks** are the kill thresholds in `hlstats_Definition_Ranks_Ribbons`.
- **Steam data** in the profile (avatar, name, VAC status) is read from the
  public profile on steamcommunity.com and kept for a day. No API key is
  needed, but steamcommunity.com blocks many requests in a row, so they are
  throttled; with `STEAM_API_KEY` the Steam Web API is used instead (100
  players per call), which is recommended for the player maps.
  `STEAM_PROFILES=off` turns it off.
- **Activity chart** comes from `hlstats_Players_History`, not `hlstats_Trend`.
- **Maps and teams in the player profile** come from `hlstats_Events_Frags`
  and `hlstats_Events_ChangeTeam`.
- **Best players per map** come from `hlstats_Events_Frags` of the last 30 days.
- **Countries** come from the collector's GeoIP lookup:
  `hlstats_Players_Data.location_id` and `hlstats_Livestats.cli_location_id`
  point to `hlstats_Players_Locations`. The footer shows the credit the
  GeoIP database requires (setting "GeoIP credit": `dbip`, `maxmind` or empty).
- **Bots** appear in the live view with a BOT tag; new bots
  are hidden from rankings unless "Rank bots" is on.
- **Server load graph** reads `hlstats_server_load` (one row per server and
  10 minutes).
- **Player events** never read the IP address of `hlstats_Events_Connects`.
- Clans, countries, ranks and roles appear once they are set up (admin area)
  or imported from the old database. Sections without data are hidden.

- **Player maps** (world map above the ranking, "online now" map on a
  ranking's page) can be turned off one by one under Settings → Player maps,
  which also sets the map style: matching the design (OpenStreetMap, dark
  on dark designs), OpenStreetMap, OSM Humanitarian, OpenTopoMap or CARTO
  (CARTO only for non-commercial sites up to 75,000 map views a month). The
  visitor's browser loads the tiles directly from the provider; the credit
  is shown in the map. On a country or city ranking the map shows only the
  players of that place.
- **SourceBans** (bans page): the public ban list
  (`index.php?p=banlist&page=N`) of the address under Settings → Bans is
  read every 30 minutes, at most 100 pages, one after another. Both the
  classic SourceBans/SB++ 1.x list and the SB++ 2026 one are understood.
  Only public http(s) addresses without redirects are accepted, so the
  setting cannot reach localhost or the LAN; `SOURCEBANS_ALLOW_PRIVATE=1`
  allows that when SourceBans runs on the same network.
- **VAC and game bans** (bans page) need `STEAM_API_KEY`; the 1000 most
  recently active players of the ranking are checked, 100 per call, every
  12 hours.

## Public API

Read-only JSON under `/api/v1`, with `Access-Control-Allow-Origin: *`. Each
IP address may make 120 requests a minute (then `429` with `Retry-After`).
Players hidden from the ranking are left out. The API never returns chat,
IP addresses, RCON passwords or other admin data.

| URL | Content |
|-----|---------|
| `/api/v1` | list of the endpoints |
| `/api/v1/rankings` | all rankings with servers, players online, best player and clan |
| `/api/v1/rankings/<game>?limit=10&offset=0` | one ranking: totals and the players by points (limit 1-100) |
| `/api/v1/rankings/<game>/servers` | servers of a ranking with the players online (name, team, points, kills; bots without an id) |
| `/api/v1/rankings/<game>/servers/<id>` | one server of that ranking |
| `/api/v1/servers` | all servers |
| `/api/v1/players/<id>` | a player's profile values and rank |

Unknown rankings, servers and players give `404` with `{"error":"not found"}`.

## Development

```bash
cp .env.example .env.local     # set the database
npm install
npm run dev                    # http://localhost:3000
```

## Configuration

All settings are environment variables, see `.env.example`. `TZ` (e.g.
`Europe/Berlin`) sets the time zone of all times on the site; without it the
Docker image shows UTC. `TEMPLATES_DIR` adds a folder of your own design
templates (see [templates/README.md](templates/README.md)). `DB_TYPE` selects the database: `mariadb` (default,
also for MySQL) or `postgres`. `DB_PORT`
defaults to 3306 or 5432 accordingly. Both use the same table and column
names; on PostgreSQL they are unquoted, so they are stored in lower case. The
admin area can
override the site name, browser title format, header logo, favicon, site
URL, banner, header links, activity days and page size through
`hlstats_Options`. Logo and favicon are given as a path (`/images/logo.png`,
relative to the domain) or an http(s) URL, there is no upload; the logo is
scaled to the header's height, a PNG with a transparent background fits
best. The default design is "dark".

The website uses two database users: `DB_USER` (read-only, for the public
pages) and `DB_ADMIN_USER` (for the admin area). The collector creates both;
the rights and how to create them by hand are in
[INSTALLATION.md](INSTALLATION.md#13-database-users).

On MariaDB the connection uses `utf8mb4`; a PostgreSQL database should be
created with `ENCODING 'UTF8'`.

TLS to the database is off by default (`DB_TLS=off`, `disable` works too).
With `DB_TLS=required` the server certificate is verified (CA file in
`DB_TLS_CA` for a private CA) and the connection never falls back to
plaintext; `skip-verify` encrypts without checking the certificate.

### Languages

The site comes in 13 languages: en, de, ru, es, fr, pt, pt-br, nl, da, pl,
sr, zh-tw and zh-cn. The texts are in `src/translations/` (see its README);
missing texts fall back to English. Visitors pick a language with the flags
in the footer; without a choice the browser's language is used, then
`DEFAULT_LANG`. The admin area is in German or English.

### Search engines and sharing

Admin → Settings → Search engines sets the description, keywords, preview
picture (Open Graph / X), the X account and whether search engines may index
the site. `/robots.txt` and `/sitemap.xml` are served under the base path
(e.g. `/new/robots.txt`); search engines read `robots.txt` only at the root of
the host, so with a base path either point the root's `robots.txt` at the
sitemap (`Sitemap: https://example.org/new/sitemap.xml`) or proxy it. Every
page has a share button with plain share links (no third-party scripts).

### Voice server

Under Admin → Settings → Voiceserver choose None, TeamSpeak or Discord;
only the fields of that kind are shown. TeamSpeak 3: address, port, password
to show, ServerQuery port and login. Discord: invite and server ID. A box at
the top of the public pages then shows the TeamSpeak address with a connect
link, the password, the channel count and the players online, or the Discord
link with its online count. Without a choice, a configured TeamSpeak is
used, else Discord. The players are read via
ServerQuery (`serverinfo`, every 60 seconds); without a query login the guest
group needs the permission to see server info. The Discord count comes from
the server widget, which must be enabled in the Discord server settings
(every 5 minutes). The ServerQuery password is never shown.

### Access log

The server writes one line per request to stdout in the combined log format
plus the response time, with the client address from the last
`X-Forwarded-For` entry, the one your reverse proxy adds (Docker:
`docker logs gamewe-web`, systemd: `journalctl -u gamewe-web`).
`ACCESS_LOG=off` turns it off, `ACCESS_LOG=all` also logs the health checks
(`/healthz`), which are left out by default.

## Admin area

1. Set `ADMIN_SECRET` to a random string of at least 32 characters
   (`openssl rand -hex 32`). Without it the admin area stays locked.
2. Create the first user; the command prints a generated password
   (container and tar.gz: see [INSTALLATION.md](INSTALLATION.md)):

   ```bash
   npm run create-admin -- admin
   ```

3. Sign in at `/admin/login`.

Two-factor sign-in with TOTP is optional. Each user can set it up under
Administration → My account (next to "Signed in as"), where the password
can be changed too, or `create-admin <name> --totp` prints a key
as text for the authenticator app (in the container:
`docker exec gamewe-web node scripts/create-admin.mjs admin --totp`). After
that the sign-in also needs the six-digit code. `--no-totp` removes it, for
example when the phone is lost. The key is stored encrypted with
`ADMIN_SECRET` in `hlstats_Options`, so changing `ADMIN_SECRET` locks out users
with TOTP until they are reset this way.

Users are the rows of `hlstats_Users`. Level 100 may change everything, level 80
everything except games, servers and users. Passwords are stored as scrypt
hashes; old HLstatsX MD5 hashes still work and are upgraded on the next sign-in.
After 10 failed sign-ins an IP address is blocked for 15 minutes. The session
cookie is `HttpOnly`, `SameSite=Strict` and `Secure` behind HTTPS (set
`ADMIN_COOKIE_SECURE=true` if the proxy does not send `X-Forwarded-Proto`).

The admin area edits:

- **Settings:** the website settings and the collector's `gamewe_*` options
  (points per kill, headshot bonus, penalties, win triggers, rank bots, chat and IP
  storage, in-game commands, RCON timeout). The collector picks them up within
  a minute. All other `hlstats_Options` rows are under "All options".
- **Servers:** the collector only accepts logs from servers registered here
  (IP address, port, game, RCON password). The RCON password is write-only in
  the form and never shown again; public pages never read it, and the
  read-only web user has no right to that column.
- Games, players (points, hide from ranking, clan), clans, weapons (name,
  points modifier), actions (rewards), teams, roles, award definitions, ranks
  and users.
- **Reset ranking** (level 100, needs collector 0.1.0 or newer): sets one ranking
  back. "Statistics only" keeps the players and gives them the start points
  (Settings → Points) with empty statistics; "Everything" also deletes the
  players, their names, Steam IDs and the clans of that ranking. Games,
  servers, definitions, options and users stay. The website only places a
  job in `hlstats_gamewe_jobs` (created by the collector's init script); the running
  collector pauses that ranking's servers, does the reset and writes the
  result back, which the page shows. It need not be stopped; if it is not
  running (no `gamewe_heartbeat` in the last two minutes) the job waits for
  its next start. One open job per ranking. The ranking's code must be typed
  again to confirm. It cannot be undone, so back up the database first. The
  admin database user needs `SELECT` and `INSERT` on `hlstats_gamewe_jobs`
  (the init script grants it). From the console: `gamewe reset CODE -mode stats|all`.
- **Chat** and **IP addresses:** all stored chat messages and connect
  addresses, searchable (IP or its start, Steam ID, name, host name), for
  admins only.
- **Rankings and servers** show their game (Counter-Strike: Source, Day of
  Defeat: Source ...). A server can only be moved into a ranking of the same
  game; rankings without a known game are not checked.

## Installation

See [INSTALLATION.md](INSTALLATION.md): as a container
(`ghcr.io/dennispohlmann/gamewe-web`, with `docker run` or Docker Compose) or
from the tar.gz with systemd, plus database users, the settings file, the
first admin user, the reverse proxy (also under a sub path like `/stats`),
updates and troubleshooting.

Short version for the container:

```bash
# /etc/gamewe/web/web.env: see INSTALLATION.md, section 2
docker run -d --name gamewe-web --restart unless-stopped \
  -p 127.0.0.1:3000:3000 --env-file /etc/gamewe/web/web.env \
  ghcr.io/dennispohlmann/gamewe-web:latest
docker exec gamewe-web node scripts/create-admin.mjs admin
```

### Health and monitoring

`GET /healthz` answers `{"status":"ok"}` when the database is reachable,
otherwise 503. Health endpoints after GitLab's:

| URL | Answer |
|-----|--------|
| `/-/health` | `gameWE OK` (the app answers; no database check) |
| `/-/liveness` | `{"status":"ok"}` (the process is alive) |
| `/-/readiness` | `{"status":"ok","checks":{"database":{"status":"ok"}}}`, 503 when the database does not answer within 3 s |
| `/-/metrics` | Prometheus text: version, process memory and uptime, database up and latency, servers, players online and ranked players per visible ranking |

`/-/metrics` is off (404) until a token of at least 16 characters is set,
in the admin settings ("Token für /-/metrics") or as `GAMEWE_METRICS_TOKEN`.
Prometheus sends it as `Authorization: Bearer <token>`:

```yaml
scrape_configs:
  - job_name: gamewe-web
    metrics_path: /-/metrics
    authorization: { credentials: "<token>" }
    static_configs: [{ targets: ["stats.example.org"] }]
```

## Building and releases

```bash
make package    # dist/gamewe-web-<version>-linux-amd64.tar.gz + .sha256
make image      # local Docker image gamewe-web:<version>
```

The version comes from a `v*` git tag on HEAD, otherwise from `VERSION`.

GitHub Actions (`.github/workflows/build.yml`) builds and checks every push
to `main` (type check, build, tar.gz as a workflow artifact) and publishes the
container image `ghcr.io/dennispohlmann/gamewe-web` with the tag `edge`.

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

## License

gameWE web is free software under the GNU General Public License, version 3
or (at your option) any later version, like the rest of gameWE. The full text
is in [LICENSE](LICENSE). The licenses of the libraries and data the website
uses (Next.js, React, Leaflet, DB-IP/GeoLite2 and others) are listed on the
site under `/licenses`; the full list of third-party npm packages, fonts,
flags and other bundled files with their licenses is in
[THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md).
