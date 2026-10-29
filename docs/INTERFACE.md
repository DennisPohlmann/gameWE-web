# gameWE - web: interfaces

The website has two interfaces: it reads the database that the
[gameWE collector](https://github.com/DennisPohlmann/gameWE-collector) fills,
and it offers a read-only public JSON API.

## Database

The website reads the HLstatsX/gameME schema on MariaDB/MySQL or PostgreSQL
that the collector creates (`schema/` in the collector repository). What the
collector writes into which table is in the collector's
[DB-SEMANTICS.md](https://github.com/DennisPohlmann/gameWE-collector/blob/main/docs/DB-SEMANTICS.md).
The website uses two database users: `gamewe_web` (`DB_USER`, SELECT only, for
the public pages) and `gamewe_web_admin` (`DB_ADMIN_USER`, for the admin
area); their rights are in [INSTALLATION.md](INSTALLATION.md#13-database-users).
Some values the collector does not store are computed by the website, see
[USAGE.md](USAGE.md#what-the-data-depends-on).

## Public API

Read-only JSON under `/api/v1`, with `Access-Control-Allow-Origin: *`. Each
IP address may make 120 requests a minute (then `429` with `Retry-After`);
answers may be cached for 30 seconds. It shows only what the website shows
to everyone: players hidden from the ranking or banned, bots without a
profile and hidden rankings (with their servers) are left out or answer
`404`. The API never returns chat, IP addresses, Steam IDs, RCON passwords, log
secrets or other admin data; the TeamSpeak password only when the admin allows
showing it.
Parts of the site an admin turned off (live map, player map, events, hall of
fame, TeamSpeak) answer `404` there too. The three banners
(`/players/<id>/banner`, `/rankings/<game>/servers/<id>/banner`,
`/voice/teamspeak/banner`) answer `image/png` (errors as JSON) and are the
same pictures as the `/banner/...png` addresses below.

**Lists** are paged the same way everywhere: `limit` (1-100, default 25) and
`page` (from 1) or `offset` (not both). The answer is
`{"data": [...], "pagination": {...}, "links": {...}}`; `pagination` has
`page`, `limit`, `offset`, `total` and `totalPages`, `links` has `self`,
`first`, `prev`, `next` and `last` (`null` at the ends). Lists with `sort`
take one of their documented fields and `order=asc|desc`. An invalid
parameter (`limit=0`, `limit=101`, `limit=abc`, an unknown `sort`, a bad
country code, ...) gives `400` with a message that names it; unknown
parameters are ignored. Equal values keep the order of their IDs, so pages
do not overlap.

The values match the website's tables one to one and are computed by the
same code: points are `points` (and `avgPoints`, `totalPoints`,
`pointsChange`; the older names `skill`, `avgSkill` and `skillChange` carry
the same values and stay as deprecated aliases), `kpd` is kills per death
(the kills without deaths), `hpk`, `accuracy` and the shares (`killShare`,
`timeShare`, ...) are fractions with four decimals, `activity` uses the
site's activity setting. Player lists give `position` (the row number, the
website's # column) and `rank` (the place in the whole ranking by points);
`sort=points` works wherever `sort=skill` does.

| URL | Content |
|-----|---------|
| `/api` | documentation page (Scalar) with code examples in curl, PHP, Python and JavaScript |
| `/api/openapi.json` | OpenAPI 3.1 description of `/api/v1` |
| `/api/v1` | list of the endpoints and the link to the documentation |
| `/api/v1/rankings` | all rankings with servers, players online (`players`, bots included, and `bots`), best player and clan |
| `/api/v1/rankings/<game>?limit=10&offset=0` | one ranking: totals and the best players by points (limit 1-100, offset 0-1000000; anything else `400`) |
| `/api/v1/rankings/<game>/players` | the ranking as a paged list; filters `country`, `state`, `city`, `clan`, `q` (name); `sort` by points, name, activity, time, kills, career rank (`career`, by kills), deaths, K:D, headshots, HS/kill, accuracy or first seen; `view=inactive`: the inactive players (no place, `rank` null) |
| `/api/v1/rankings/<game>/stats?days=30` | totals and activity per day (players, kills, headshots) |
| `/api/v1/rankings/<game>/countries` | country ranking (players, points, kills summed per country), by total points by default (`?sort=players` for the number of players) |
| `/api/v1/rankings/<game>/countries/<code>` | one country with its place in the country ranking by total points |
| `/api/v1/rankings/<game>/states?country=de` | state ranking (GeoIP subdivision: German Bundesland, US state, ...), optionally of one country, by total points by default; states are counted per country |
| `/api/v1/rankings/<game>/cities?country=de` | city ranking, optionally of one country, by total points by default |
| `/api/v1/rankings/<game>/clans` | clan ranking (clans with at least two ranked members); `view=inactive`: the inactive clans |
| `/api/v1/rankings/<game>/clans/<id>` | one clan, where its members come from, whether it is inactive |
| `/api/v1/rankings/<game>/clans/<id>/members` | its ranked members (`view=inactive`: the inactive ones) |
| `/api/v1/rankings/<game>/clans/<id>/history?days=30` | the members' days added up (1-90 days) |
| `/api/v1/rankings/<game>/clans/<id>/radar` | the clan page's radar: the members' last 14 days against the average |
| `/api/v1/rankings/<game>/clans/<id>/weapons` | the members' weapons with hitboxes |
| `/api/v1/rankings/<game>/clans/<id>/maps` | the members' 15 maps with the most kills |
| `/api/v1/rankings/<game>/clans/<id>/map` | the clan map: members at their GeoIP city point (404 while the player map is off) |
| `/api/v1/rankings/<game>/clans/<id>/events` | latest events of the members (404 while the player event boxes are off) |
| `/api/v1/rankings/<game>/weapons` | weapons with modifier, kills and headshots and their share of all, HS/kill |
| `/api/v1/rankings/<game>/weapons/<code>` | one weapon |
| `/api/v1/rankings/<game>/weapons/<code>/players` | best players with that weapon |
| `/api/v1/rankings/<game>/maps` | maps with times played, time, rounds, kills and headshots (each with its share of all maps) and CT/T round wins |
| `/api/v1/rankings/<game>/maps/<id>` | one map as on its page: play time, CT/T win ratio, kills per minute, accuracy, kills of hidden players |
| `/api/v1/rankings/<game>/maps/<id>/heatmap` | kill and death positions of the map page (game units; `level=upper\|lower` on Counter-Strike 2 maps with two levels) |
| `/api/v1/rankings/<game>/maps/<id>/players` | the players with a kill on that map, all time, with place in the ranking and GunGame wins (`?days=1..90`: only the last days) |
| `/api/v1/rankings/<game>/awards` | daily awards: yesterday's winners and today's leaders, or `?day=YYYY-MM-DD` (last 365 days) |
| `/api/v1/rankings/<game>/ribbons` | ribbons: holders per award and class, most decorated players |
| `/api/v1/rankings/<game>/ranks` | ranks (kill thresholds) with the number of players in each |
| `/api/v1/rankings/<game>/ranks/<index>/players` | the players of one rank with progress to the next rank, points, time and activity |
| `/api/v1/rankings/<game>/actions` | actions (bomb planted, ...) by count, with points bonus and share |
| `/api/v1/rankings/<game>/actions/<id>` | one action with its best players (count, points) |
| `/api/v1/rankings/<game>/teams` | teams and roles with time, kills and deaths and their share of the table |
| `/api/v1/rankings/<game>/servers` | servers of a ranking (`players` online with bots, `bots` among them; `version`, `os` (`linux`, `windows`, `mac`) and `vac` (true / false), each null while unknown) with the players online (name, team, points, kills; bots without an id) |
| `/api/v1/rankings/<game>/servers/<id>` | one server of that ranking (also suicides, CT/T wins, bombs planted and defused), with the players online (a hidden player with `id: null`, like a bot; HS/kill, accuracy, ping, points and their change, place) |
| `/api/v1/rankings/<game>/servers/<id>/load?hours=24` | players on that server per 10 minutes (1-168 hours), with the uptime in seconds |
| `/api/v1/rankings/<game>/servers/<id>/banner` | the server banner as PNG (`?style=<template>`) |
| `/api/v1/rankings/<game>/load?hours=24` | the load of all servers of the ranking in one answer |
| `/api/v1/rankings/<game>/activity?days=14` | players online, servers with players, kills and headshots per 15 minutes (`days` 1, 7, 14 or 30) |
| `/api/v1/rankings/<game>/map/live` | the live map: players online and the servers at their GeoIP city point (404 while the live map is off) |
| `/api/v1/rankings/<game>/map/players` | the player map of the players page (`show=top\|all`, `country`, `state`, `city`; 404 while the player map is off) |
| `/api/v1/rankings/<game>/events` | the events page: `period=1h\|24h\|7d`, `type`, `order`, paged, at most 5000 (404 while the events page is off) |
| `/api/v1/rankings/<game>/events/stats` | the events page's chart and share table |
| `/api/v1/rankings/<game>/hall-of-fame` | the hall of fame periods with their podium (404 while the ranking shows none) |
| `/api/v1/rankings/<game>/hall-of-fame/stars` | the hall of fame's star table |
| `/api/v1/rankings/<game>/misc` | the misc page: player countries, weekdays, connect methods, connects per day |
| `/api/v1/servers` | all servers |
| `/api/v1/stats?days=30` | totals over all rankings, the start page's general statistics and the activity per day (with the clans active that day) |
| `/api/v1/activity?days=30` | the start page's load chart and card lines: players online, servers with players, kills and headshots per 15 minutes |
| `/api/v1/search/players?q=<text>` | the search over all rankings (`in=names\|steamid`, `game`); at most 100 hits, hidden and banned players are not found |
| `/api/v1/search/clans?q=<text>` | clan search by tag or name |
| `/api/v1/points` | the help page's point rules and the bot settings per ranking |
| `/api/v1/voice` | the voice server box (TeamSpeak or Discord) |
| `/api/v1/voice/teamspeak` | the TeamSpeak page: server info, channel tree, people online (names only while shown); `passwordProtected`, and `password` only while "Allow showing the TeamSpeak password" is on (404 unless TeamSpeak is the voice server) |
| `/api/v1/voice/teamspeak/banner` | the TeamSpeak banner as PNG (`?style=<template>`) |
| `/api/v1/banners/styles` | the styles (design templates) the banners take |
| `/api/v1/players/<id>` | the values of a player's profile: place, points and last change, kills, K:D, HS/kill, kills per minute, assists, accuracy, shots per kill, rounds, win ratio, survived, connections, ping, location, career rank, favourite weapon, hall of fame stars |
| `/api/v1/players/<id>/weapons` | the player's weapons with K:D, accuracy, damage per hit, shots per kill and hits per body zone |
| `/api/v1/players/<id>/hitboxes` | hits per body zone over all weapons (`neck` only from Counter-Strike 2, else 0) |
| `/api/v1/players/<id>/maps` | kills and deaths per map |
| `/api/v1/players/<id>/teams` | how often the player joined each team |
| `/api/v1/players/<id>/actions` | the player's actions with count and points |
| `/api/v1/players/<id>/opponents` | the ten favourite victims and the ten worst killers |
| `/api/v1/players/<id>/kills` | kill statistics: opponents killed at least five times with kills, deaths and their place |
| `/api/v1/players/<id>/names` | the names the player used |
| `/api/v1/players/<id>/history` | points and their change, kills, accuracy and time per day, newest first (`sort` as the sessions table) |
| `/api/v1/players/<id>/awards` | daily awards won (`sort=date\|award`) |
| `/api/v1/players/<id>/events` | the player's events page (`type`, `order`), at most 10000 deep |
| `/api/v1/players/<id>/radar` | the profile's radar: last 14 days against the average |
| `/api/v1/players/<id>/banner` | the player banner as PNG (`?style=<template>`) |
| `/api/v1/players/<id>/ribbons` | rank by kills and ribbons per award |

Unknown rankings, servers, players and other ids, and unknown paths under
`/api/v1`, give `404` with `{"error":"not found"}`; for `/api/v1/players/<id>/...` also hidden and
banned players, players of hidden rankings and bots of rankings whose "Bots in the ranking" is off.

The OpenAPI description is written in `src/lib/openapi.ts` (one entry per
route, with schema and a made-up example answer); `/api/v1` lists the same
entries. Its examples and the "try it" requests on `/api` use the site's
first ranking (the first public ranking with servers or players in the
order of the ranking list, else the first public one, else `css`), read
when the description is requested. `npm run build` fails when a route under `src/app/api/v1` has no
entry there, so new endpoints have to be documented.

## Banner pictures

PNG pictures for forums and other sites, under the base path like every
page (with `BASE_PATH=/stats`: `/stats/banner/...`). `<game>` is the ranking
code (e.g. `css1`); `-<template>` before `.png` picks a design template's
colours. The codes on the profile, server, Misc and `/voice` pages use these
URLs.

| URL | Content |
|-----|---------|
| `/banner/<game>/player/<playerId>.png` | player banner (forum signature), 400x100, cached 15 minutes |
| `/banner/<game>/server/<serverId>.png` | server banner, 560x95, cached 5 minutes |
| `/banner/teamspeak.png` | TeamSpeak banner, 560x95, live ServerQuery data (no history), cached 1 minute; offline banner when the query fails |
| `/sig/<playerId>.png`, `/banner/<serverId>.png` | old URLs, aliases of the two above (same picture, no redirect) |

A player or server that does not belong to `<game>`, a hidden ranking and a
bot of a ranking whose "Bots in the ranking" is off give `404`, and so do players hidden from the
ranking or banned (as their profile). The TeamSpeak
banner gives `404` unless TeamSpeak is the voice server (Admin → Settings →
Voice server).
