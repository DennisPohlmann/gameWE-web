# gameWE - web: usage

What the website shows, where its data comes from, the admin area and the
health and monitoring endpoints. Installation: [INSTALLATION.md](INSTALLATION.md);
settings: [CONFIG.md](CONFIG.md).

## Contents

1. [Pages](#pages)
2. [What the data depends on](#what-the-data-depends-on)
3. [Admin area](#admin-area)
4. [Health and monitoring](#health-and-monitoring)

## Pages

| URL | Content |
|-----|---------|
| `/` | all rankings with players online, best player (Steam picture, flag) and clan (flag of its members' most common country), load of the last 30 days |
| `/<game>` | a ranking: servers (flag of the server's country), live players per server by team, daily awards, activity |
| `/<game>/servers/<id>` | one server: live view with the server's country flag, bots and flags, load graph of the last 24 hours (players, maps, uptime), counters, chat |
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
| `/<game>/misc` | player countries, weekdays, connects per day, connect methods, server banners |
| `/<game>/bans` | ban list like gameME's: players the collector marked as banned from the server logs (VAC kick, permanent server ban; `hideranking = 2`), bans from SourceBans (reason, length, date) and, with `STEAM_API_KEY`, VAC/game bans from Steam; points, K/D, HS/kill and accuracy per player. `hlstats_Players_Bans` adds type, date and reason for log bans. |
| `/search` | search players by name or Steam ID and clans by tag or name (`?q=...&st=names\|steam\|clans&game=<code>`) |
| `/help` | help: how points are calculated (with the current settings), actions, weapon modifiers, chat commands |
| `/voice` | detail page of the TeamSpeak server from the voice server box (click its name): channel tree with the people online (names can be hidden in the admin settings), server info (operating system with a small symbol, uptime, users, connections, security level, ping, version, host banner URL), traffic and the welcome message; live from the ServerQuery, kept for a minute; 404 unless TeamSpeak is the voice server |
| `/licenses` | licenses of the software, data, map tiles, flags and fonts gameWE uses |
| `/<game>/events-feed` | the latest 10 events of a ranking as JSON (live box on the start page; 404 unless the admin setting "Latest events" is live) |
| `/api/v1/...` | public JSON API, see [INTERFACE.md](INTERFACE.md) |
| `/banner/<game>/player/<playerId>.png` | player banner (forum signature, 400x100) with rank insignia, position and activity; classic grey by default, `/banner/<game>/player/<playerId>-<template>.png` in a design template's colours; the profile offers the code as BBCode, HTML, Markdown or image URL; 404 if the player is not in that ranking, for hidden rankings and for bots while "Rank bots" is off; hidden players get it without their position |
| `/banner/<game>/server/<serverId>.png` | server banner (560x95) with address, status, players, map and the last 24 hours; `-<template>` as above; code on the server page and the Misc page; 404 if the server is not in that ranking |
| `/sig/<playerId>.png`, `/banner/<serverId>.png` | old URLs of the two banners (also with `-<template>`), kept as aliases that answer the same picture, so signatures already posted in forums keep working |
| `/robots.txt`, `/sitemap.xml` | for search engines, see [CONFIG.md](CONFIG.md#search-engines-and-sharing) |
| `/admin` | admin area |

A ranking is a row of `hlstats_Games` that you create in the admin area
(Rankings, e.g. "Assault"), optionally copying weapons, actions, teams, roles,
awards and ranks from an existing ranking. Servers are assigned on the
ranking's page (this sets `hlstats_Servers.game`); the collector picks the
change up within a minute. The start page lists every ranking that has servers;
the servers are listed on the ranking's page. Rankings without servers serve
as templates.

`<game>` is `hlstats_Games.code`, for example `css`.

## What the data depends on

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
  are hidden from rankings unless "Rank bots" is on. While it is off, bot
  names are plain text everywhere (no link to a profile) and a bot's
  profile pages and `/api/v1/players/<id>` answer 404.
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

## Health and monitoring

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
