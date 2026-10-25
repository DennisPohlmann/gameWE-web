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

Players online are shown as real players, the bots with the BOT tag (only
when there are any) and the slots, e.g. `1 (31 BOT) / 48` or `1 / 48`: in
the rankings on `/` and their total, in the server lists of a ranking and
on the server page. The collector counts bots in `act_players` and, with
collector schema version 6 (`gamewe db migrate`), the bots among them per server in
`hlstats_Servers.act_bots`; the web shows `act_players` minus `act_bots` as
real players (never below 0). Older databases without the column take the
bots from the live view (`hlstats_Livestats`, uniqueId `BOT:...`), which
misses bots during a map change and when servers of one ranking use the same
bot names (they share one live row per bot); the web looks for the column
again every 5 minutes. The heading on `/` counts the real players.

| URL | Content |
|-----|---------|
| `/` | all rankings with players online (with a total row when there are several), best player (Steam picture, flag) and clan (flag of its members' most common country), load of the last 30 days |
| `/<game>` | a ranking: servers (flag of the server's country; on wide screens also the server version with a Linux or Windows icon and a VAC shield for VAC-secured servers, from the collector's `features.server_info`; `-` while unknown), live players per server by team, daily awards, activity |
| `/<game>/servers/<id>` | one server: live view with the server's country flag, bots and flags, load graph of the last 24 hours (players, maps, uptime), counters, chat |
| `/<game>/players` | ranking (sortable, search), `?view=new` for new players; country, state and city rankings with gameME's links: `?type=countryinfo` (all countries), `?type=countryinfo&valuecountry=de` (players of a country), `?type=stateinfo[&valuecountry=de]` (states: the GeoIP subdivision, e.g. German Bundesland or US state, counted per country; players whose location has no state name, such as the legacy region codes HLstatsX wrote, are left out until the collector looks them up again), `?type=stateinfo&valuecountry=de&valuestate=bavaria` (players of a state), `?type=cityinfo[&valuecountry=de]` (cities), `?type=cityinfo&valuecountry=de&valuecity=berlin` (players of a city; `valuecity` alone also works but joins cities of the same name) |
| `/<game>/players/<id>` | player profile: Steam avatar and data, summary with radar (K/D, kills per minute, assists per kill, survived and won rounds as the percentile among the ranking's players with at least 10 kills, all time and last 14 days; axes the game does not record are left out; hover, tap or focus an axis for its values in a box that never covers the axis label), assists (with the assisted kills only when the collector counted any) and trend pills, player trend (its "Overview" link opens the sessions page), rank and career, ribbons, forum signature, hitbox, weapons, maps, opponents, latest events of the player (live, see the admin setting) |
| `/<game>/clans`, `/<game>/clans/<id>` | clans and members |
| `/<game>/awards` | daily awards with a calendar (`?date=YYYY-MM-DD`, `?month=YYYY-MM`); `?view=history`, `?view=ranks`, `?view=ribbons` (with most decorated players, `&class=N` filters a ribbon class) |
| `/<game>/weapons`, `/<game>/weapons/<code>` | weapons like gameME's ("From a total of X kills with Y headshots"; weapon code, name, modifier, kills, kills %, headshots, headshots % and Hpk as bars; kills % and headshots % are shares of all kills and headshots, Hpk is headshots per kill of the weapon; sortable: `?sort=code\|name\|modifier\|kills\|headshots\|hpk&dir=asc`), best players per weapon |
| `/<game>/actions`, `/<game>/actions/<id>` | actions like gameME's ("From a total of X actions"; action, skill bonus (the player reward, or the team reward of a team action), achieved and achieved % of all actions as a bar; sortable: `?sort=name\|bonus\|count&dir=asc`, paged with `?page=` and `?rows=`), best players per action |
| `/<game>/maps`, `/<game>/maps/<id>` | maps (sortable) with time, kills and headshots and their share of all maps of the ranking, the CT/T win ratio and headshots per kill; per map its details (time, CT/T win ratio, kills, kills per minute, headshots, accuracy), a kill heatmap (where players died, `?pos=killer` where the killers stood; Source games only, GoldSrc logs carry no positions) and every player with a kill on the map (all time, sortable, paged; with GG wins on GunGame rankings) |
| `/<game>/teams` | teams and roles like gameME's: time, kills, deaths and K/D per team and role, each with its share of the table's total as a bar (teamkills not counted; teams without kills or deaths such as spectators show `-`); each table sorts on its own: `?tsort=name\|time\|kills\|deaths\|kpd&tdir=asc` for teams, `rsort`/`rdir` for roles |
| `/<game>/players/<id>/events` | player history: connects, team and name changes, actions, kills and deaths (filter by type; with "Latest events (player page)" on "Sync" a "Live updates" switch, off on every visit, lets new events run in on the first page) |
| `/<game>/players/<id>/sessions` | player history per day, laid out like gameME: a statistics summary (player trend, kills and deaths per day), then one row per day with change, points, time, rounds, wins, kills, deaths, K/D, kill streak, headshots, HS/kill and accuracy; every column sortable (newest day first), paged with "Go to", "Show rows" and the number of entries and pages |
| `/<game>/players/<id>/awards` | awards the player won: summary and list by date |
| `/<game>/players/<id>/chat` | the player's chat messages |
| `/<game>/chat` | chat log with search |
| `/<game>/misc` | player countries, weekdays, connects per day, connect methods, server banners |
| `/<game>/bans` | ban list like gameME's: players the collector marked as banned from the server logs (VAC kick, permanent server ban; `hideranking = 2`), bans from SourceBans (reason, length, date) and, with `STEAM_API_KEY`, VAC/game bans from Steam; points, K/D, HS/kill and accuracy per player. `hlstats_Players_Bans` adds type, date and reason for log bans. |
| `/search` | search players by name or Steam ID and clans by tag or name (`?q=...&st=names\|steam\|clans&game=<code>`) |
| `/help` | help: how points are calculated (with the current settings), actions, weapon modifiers, chat commands |
| `/voice` | detail page of the TeamSpeak server from the voice server box (click its name): channel tree with the people online (names can be hidden in the admin settings), server info (operating system with a small symbol, uptime, users, connections, security level, ping, version, host banner URL), traffic and the welcome message, and at the bottom the code of the TeamSpeak banner; live from the ServerQuery, kept for a minute; 404 unless TeamSpeak is the voice server |
| `/licenses` | licenses of the software, data, map tiles, flags and fonts gameWE uses |
| `/<game>/events-feed` | the latest 10 events of a ranking as JSON (live box on the start page; 404 unless the admin setting "Latest events" is "Sync") |
| `/<game>/players/<id>/events-feed` | the latest 25 events of one player as JSON (kills and deaths, actions by and against the player, team bonuses), the same rows the profile shows (live box on the player page; 404 unless the admin setting "Latest events (player page)" is "Sync", for unknown players, players of another ranking and hidden rankings; 60 requests per IP and minute, then `429`). With `?list=` (empty for all types, or an event type such as `kill`): the latest 25 rows of the player's events page with that filter instead (live table of the events page) |
| `/api` | documentation of the public JSON API: every endpoint with parameters, example answers and code for curl, PHP, Python and JavaScript (Scalar, self-hosted); the OpenAPI description is `/api/openapi.json` |
| `/api/v1/...` | public JSON API, see [INTERFACE.md](INTERFACE.md) |
| `/banner/<game>/player/<playerId>.png` | player banner (forum signature, 400x100) with rank insignia, position and activity; in the banner of the active skin (game design or main template) by default, `/banner/<game>/player/<playerId>-<template>.png` in that of another template (old `-classic` URLs and unknown templates give the default; a template without banner definition the Dark banner, see `templates/README.md`); the profile offers the code as BBCode, HTML, Markdown or image URL; 404 if the player is not in that ranking, for hidden rankings and for bots while "Rank bots" is off; hidden players get it without their position |
| `/banner/<game>/server/<serverId>.png` | server banner (560x95) with address, status, players, map and the last 24 hours; `-<template>` as above; code on the server page and the Misc page; 404 if the server is not in that ranking |
| `/banner/teamspeak.png` | TeamSpeak banner (560x95, the server banner's look) with live data only, no history: name with flag, shown address, status, users online of the slots with a fill bar, channels, uptime and server type; offline banner when the query fails; never the server password, the query login or the query port; `-<template>` as above; code at the bottom of `/voice`; 404 unless TeamSpeak is the voice server |
| `/sig/<playerId>.png`, `/banner/<serverId>.png` | old URLs of the two banners (also with `-<template>`), kept as aliases that answer the same picture, so signatures already posted in forums keep working |
| `/robots.txt`, `/sitemap.xml` | for search engines, see [CONFIG.md](CONFIG.md#search-engines-and-sharing) |
| `/admin` | admin area |

A ranking is a row of `hlstats_Games` that you create in the admin area
(Rankings, e.g. "Assault"), optionally copying weapons, actions, teams, roles,
awards and ranks from an existing ranking. Servers are assigned on the
ranking's page (this sets `hlstats_Servers.game`); the collector picks the
change up within a minute. The start page lists every ranking that has servers;
the servers are listed on the ranking's page. Rankings without servers serve
as templates. The ranking choices on the search and help pages and the
ranking filters of the admin chat and IP pages list only rankings with at
least one server or player; the admin forms that assign a ranking list all.

`<game>` is `hlstats_Games.code`, for example `css`.

### Sorting tables

Column heads are bold in every table and skin; in label/value tables
(overview of a server, map, clan, weapon or action, player summary, search
form) the label column is bold too. A click on the head of a column sorts
the table by it (a second click the other way round); the sorted head is
underlined, carries ▼ or ▲ and `aria-sort`. Numbers start with the highest
value, empty values come last. Columns that only repeat another one (the
rank `#`, share or progress bars next to their number, pictures, buttons)
do not sort; a bar that is a value of its own (HS/kill, accuracy, activity)
sorts by that value.

Paged tables sort on the server with `?sort=<key>&dir=asc` (without `dir`
descending); the pager, the rows choice and the filter forms keep the
order, a new order starts on page 1, and an unknown key gives the table's
default order. Tables with their own params, as a page shows more than one:

| Page | Params | Keys |
|------|--------|------|
| `/` (rankings) | `sort`, `dir` | `name`, `game`, `players`, `top`, `clan` (default: the order of the rankings) |
| `/<game>` server list | `sort`, `dir` | `name`, `map`, `time`, `players` (default: the configured order) |
| `/<game>` and `/<game>/awards` daily awards | `asort`, `adir` | `award`, `winner`, `leader` |
| `/<game>/awards?view=ranks\|ribbons` most decorated | `dsort`, `ddir` | `name`, `wins` |
| `/<game>/awards?view=ranks&rank=N` | `sort`, `dir` | `name`, `kills` (default), `skill`, `time`, `activity` |
| `/<game>/awards?view=ribbons&award=N` | `sort`, `dir` | `name`, `wins` (default), `last` |
| `/<game>/awards?view=history` | `sort`, `dir` | `award`, `winner` |
| `/<game>/clans` | `sort`, `dir` | `tag`, `members`, `skill` (default), `time`, `kills`, `deaths`, `kpd`, `hpk` |
| `/<game>/clans/<id>` members | `sort`, `dir` | the keys of the player ranking (`skill` default, `name`, `activity`, `time`, `kills`, `deaths`, `kpd`, `hs`, `hpk`, `acc`) |
| `/<game>/maps/<id>`, `/<game>/weapons/<code>`, `/<game>/actions/<id>` best players | `sort`, `dir` | `name`, `kills`, `deaths`, `kpd`, `hpk` (map); `name`, `kills`, `hs`, `hpk`, `shots`, `acc` (weapon); `name`, `count`, `points` (action) |
| `/<game>/bans` | `sort`, `dir` | `name`, `type`, `reason`, `date`, `points`, `kpd`, `hpk`, `acc` (default: running bans first, newest first) |
| `/<game>/chat`, `/<game>/players/<id>/chat`, `/<game>/players/<id>/events`, admin chat | `sort`, `dir` | `date` only (newest first; `dir=asc` oldest first): chat and events can hold millions of rows, the time is the column with an index |
| `/<game>/players/<id>/sessions` | `sort`, `dir` | `date` (default), `change`, `points`, `time`, `rounds`, `wins`, `kills`, `deaths`, `kpd`, `streak`, `hs`, `hpk`, `acc`; another order than newest first reads up to 5000 days of the player |
| `/<game>/players/<id>/awards` | `sort`, `dir` | `date` (default), `award` |
| `/<game>/players/<id>/ips`, admin IP addresses | `sort`, `dir` | `ip`, `connects`, `first`, `last` (default), `host`; admin also `name`, `steam`, `game` |
| `/search` | `sort`, `dir` | players: `name`, `game`, `points`, `kills`, `kpd`; clans: `clan`, `game`, `members`, `points` |
| `/admin/<entity>` | `sort`, `dir` | every list column that is a column of the table (also kept when an edit page returns to the list) |

The player ranking and the country, state and city rankings on `/<game>/players`
sorted by their heads already (`sort`/`dir`), as does the weapons list.
Small tables that are shown whole sort in the browser without
reloading the page: on the player profile weapons, teams, actions, maps,
victims and killers, names and kill statistics; on `/help` actions and
weapon modifiers, on `/licenses` all lists, in the admin area the recent
reset jobs. Without JavaScript they keep the server's order. Feeds without
column heads (chat and awards on the profile and the server page, the
latest events), the live players grouped by team and the award calendar
keep their order.

## What the data depends on

The collector does not fill every gameME table (see DB-SEMANTICS.md). The
website therefore computes some things itself:

- **Daily awards** are the awards in `hlstats_Awards`. The collector stores each day's winners in `hlstats_Awards_History`; the
  website computes today's leaders, and yesterday's winners while nothing is
  stored, from the same sources (`hlstats_Events_Frags`,
  `hlstats_Events_PlayerActions`, `hlstats_Players_History`; the latency
  award from `hlstats_Events_Latency`: lowest average ping of players with
  at least 30 ping samples that day, as in the collector).
  The calendar under `?view=history` links the days up to the last day with
  stored winners (yesterday while none are stored); today and later days are
  greyed out, and a `?date=` after that day shows the last day instead.
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
- **Player trend** (profile and sessions page) shows the points at the end of
  each day of `hlstats_Players_History` (line, left axis; days without play
  keep the last value) and the points gained or lost that day (bars, right
  axis). The bars are the difference to the day before (the last history day
  before the range for the first one), so they always match the line; the
  stored `skill_change` can differ from it. The "Change" column of the
  sessions table and `skillChange` of `/api/v1/players/{id}/history` use the
  same difference (the oldest day of all: its recorded `skill_change`).
- **Sessions table**: "Wins" are the rounds won that day (`wins`; gameWE
  records no GunGame wins), "-" when there are none; "Accuracy" is "-" on days
  without weapon statistics (`shots` = 0, e.g. games or servers that do not
  log them). The table reads up to 4000 days of the player and sorts them in
  the app, so every column (also the change) can be sorted.
- **Maps and teams in the player profile** come from `hlstats_Events_Frags`
  and `hlstats_Events_ChangeTeam`.
- **Teams and roles** come from the collector's counters in `hlstats_Teams`
  and `hlstats_Roles` (`time_played`, `kills`, `deaths` per game); they
  cover all players of the game, like the weapon, action and map totals.
- **Players of a map** (map page) come from `hlstats_Events_Frags` over all
  time: kills and headshots as killer, deaths as victim, the position is the
  place in the whole ranking. Hidden players are left out of the list; their
  kills are counted in the line above it. GG wins count the `gg_win` actions
  of the listed players on that map (column only when the ranking logged a
  `gg_win`). Accuracy comes from `hlstats_Players_Maps` (shots and hits),
  which the collector does not fill: "–" without data. The API
  `/maps/<id>/players` still returns the best players of the last days.
- **Map shares** (time %, kills %, headshots %) are the map's part of the
  sum over all maps of the ranking, with one decimal (`<0.1%` for a tiny
  share); the bars are filled relative to the largest share in the list.
- **Win ratio per map** (CT blue / T red) counts the won rounds in
  `hlstats_Events_TeamBonuses` by the side of the trigger's action
  (`hlstats_Actions.team` `CT` / `TERRORIST`): one round per map and time,
  only rounds whose trigger has a team reward, as long as the events are
  kept. Maps without such rounds, and games whose round actions have no
  side (TF2, DoD:S), show "no data" instead of a ratio; the column appears
  for Counter-Strike rankings and wherever wins exist. The collector does
  not write `hlstats_Maps.teama_wins` / `teamb_wins`.
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
  is shown in the map. On a country, state or city ranking the map shows only the
  players of that place. Hovering a player shows name, city and country,
  rank (the same position as on the ranking and the player page: 1 + ranked
  players with more points, hidden players not counted), points, kills, K/D
  and the server or last connect. Both maps also show the ranking's game
  servers as squares at the location the collector stores for their address
  (`hlstats_Servers` `lat`/`lng` from GeoIP: a city, or only the country's
  centre when GeoIP knows no city). The map always opens with all players and
  all servers in view; on the "who is playing now" map a thin line joins each
  player to the server they are playing on, and so does the players map's
  top 10 for those of them who are online right now (`hlstats_Livestats`;
  the map of all players shows no lines). Lines are green while the server
  is online, with a dot running to and fro along them like packets between
  player and server (still, in the middle of the line, when the system asks
  for reduced motion). Servers at the same place (coordinates
  equal after rounding to 0.01°, about 1 km) share one square that shows
  their number; hovering lists them all, each with a green or red status
  dot, and a click opens a box with a link to each server page. Hovering a
  single server shows name (with the VAC shield of the server list when the
  server is VAC-secured, also in the list of several), city and country, address (the public address
  if set, as in the server list), the current map and, while the server is
  online, its uptime (from the latest load sample, as on the server page);
  a click opens the server page. The status lights in the
  square glow slowly like a lighthouse (fade on, stay lit a moment, fade
  off, stay dark; once every 4 s): green while a server there is online
  (load samples of the last 30 minutes, as on the server banner), red and
  every 5 s when not; with reduced motion set in the system they stay lit
  without glowing on and off. Servers without a location
  (LAN address, no GeoIP database, rows imported without one) are left out.
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
  a minute. All other `hlstats_Options` rows (own, old HLstatsX and obsolete
  keys) are at the end of the same page under "Other keys (raw values)", where
  they can be changed, deleted or added; TOTP secrets are never listed. The old
  address `/admin/options` redirects to the settings page.
- **Servers:** the collector only accepts logs from servers registered here
  (IP address, port, game, RCON password). The RCON password is write-only in
  the form and never shown again; public pages never read it, and the
  read-only web user has no right to that column. The optional **log
  secret** (`sv_logsecret`, a number from 1 to 2147483647, empty by default)
  is handled the same way: write-only, `-` clears it, and saving it also
  sets `log_secret_changed` to the current time. When a secret is set, the
  collector accepts only log packets with exactly this secret, so put the
  same value as `sv_logsecret` into the game server's `server.cfg`; without a
  secret it accepts all log packets of the server. The collector never sets
  or changes the secret itself (see the collector's CONFIG.md, "Log
  secret"). The field appears once the collector's database has schema
  version 4 (`gamewe db migrate`).
- Games, players (points, hide from ranking, clan), clans, weapons (name,
  points modifier), actions (rewards), teams, roles, award definitions, ranks
  and users. The lists keep their filters (ranking, search, page, rows) in
  the address; "Back", saving and deleting on an edit page return to the
  list with the same filters.
- **Reset ranking** (level 100, needs collector 0.1.0 or newer): sets one ranking
  back, in one of three kinds (collector 0.2.0 or newer; an older collector
  refuses the job and changes nothing):
  - "Player statistics only" deletes the events, player histories, the
    players' weapon, action, map, role and team statistics, the award winners
    and the ranking totals made from them (weapons, actions, maps, teams,
    roles); the players stay and start again with the start points
    (Settings → Points). The server statistics stay.
  - "All statistics" also resets the server statistics: the counters of the
    servers (kills, players, rounds, headshots, bombs, wins, map values), the
    load history (`hlstats_server_load`) and the trend (`hlstats_Trend`). The
    players stay.
  - "Everything" also deletes the players, their names, Steam IDs and the
    clans of that ranking.

  The collector's `docs/USAGE.md` lists the tables of each kind. Games,
  servers, definitions, options and users stay. The website only places a
  job in `hlstats_gamewe_jobs` (created by the collector's init script); the running
  collector pauses that ranking's servers, does the reset and writes the
  result back, which the page shows. It need not be stopped; if it is not
  running (no `gamewe_heartbeat` in the last two minutes) the job waits for
  its next start. One open job per ranking. The reset button opens a dialog
  that shows the ranking and what is deleted and what stays; the job is only
  placed after ticking "I understand that this data will be deleted
  irreversibly" and confirming there. It cannot be undone, so back up the
  database first. The admin database user needs `SELECT` and `INSERT` on
  `hlstats_gamewe_jobs` (the init script grants it). From the console:
  `gamewe reset CODE -mode player-stats|all-stats|all`.
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
