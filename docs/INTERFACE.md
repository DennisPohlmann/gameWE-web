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
`404`. The API never returns chat, IP addresses, Steam IDs, RCON passwords
or other admin data.

**Lists** are paged the same way everywhere: `limit` (1-100, default 25) and
`page` (from 1) or `offset` (not both). The answer is
`{"data": [...], "pagination": {...}, "links": {...}}`; `pagination` has
`page`, `limit`, `offset`, `total` and `totalPages`, `links` has `self`,
`first`, `prev`, `next` and `last` (`null` at the ends). Lists with `sort`
take one of their documented fields and `order=asc|desc`. An invalid
parameter (`limit=0`, `limit=101`, `limit=abc`, an unknown `sort`, a bad
country code, ...) gives `400` with a message that names it; unknown
parameters are ignored.

| URL | Content |
|-----|---------|
| `/api` | documentation page (Scalar) with code examples in curl, PHP, Python and JavaScript |
| `/api/openapi.json` | OpenAPI 3.1 description of `/api/v1` |
| `/api/v1` | list of the endpoints and the link to the documentation |
| `/api/v1/rankings` | all rankings with servers, players online, best player and clan |
| `/api/v1/rankings/<game>?limit=10&offset=0` | one ranking: totals and the best players by points (limit 1-100) |
| `/api/v1/rankings/<game>/players` | the ranking as a paged list; filters `country`, `city`, `clan`, `q` (name); `sort` by points, name, activity, time, kills, deaths, K:D, headshots, HS/kill, accuracy or first seen |
| `/api/v1/rankings/<game>/stats?days=30` | totals and activity per day (players, kills, headshots) |
| `/api/v1/rankings/<game>/countries` | country ranking (players, points, kills summed per country) |
| `/api/v1/rankings/<game>/countries/<code>` | one country with its place |
| `/api/v1/rankings/<game>/cities?country=de` | city ranking, optionally of one country |
| `/api/v1/rankings/<game>/clans` | clan ranking (clans with at least two ranked members) |
| `/api/v1/rankings/<game>/clans/<id>` | one clan |
| `/api/v1/rankings/<game>/clans/<id>/members` | its ranked members |
| `/api/v1/rankings/<game>/weapons` | weapons with kills and headshots |
| `/api/v1/rankings/<game>/weapons/<code>` | one weapon |
| `/api/v1/rankings/<game>/weapons/<code>/players` | best players with that weapon |
| `/api/v1/rankings/<game>/maps` | maps with kills, rounds and time played |
| `/api/v1/rankings/<game>/maps/<id>` | one map |
| `/api/v1/rankings/<game>/maps/<id>/players?days=30` | best players on that map in the last days (1-90) |
| `/api/v1/rankings/<game>/awards` | daily awards: yesterday's winners and today's leaders, or `?day=YYYY-MM-DD` (last 365 days) |
| `/api/v1/rankings/<game>/ribbons` | ribbons: holders per award and class, most decorated players |
| `/api/v1/rankings/<game>/ranks` | ranks (kill thresholds) with the number of players in each |
| `/api/v1/rankings/<game>/ranks/<index>/players` | the players of one rank |
| `/api/v1/rankings/<game>/actions` | actions (bomb planted, ...) by count |
| `/api/v1/rankings/<game>/teams` | teams and roles |
| `/api/v1/rankings/<game>/servers` | servers of a ranking with the players online (name, team, points, kills; bots without an id) |
| `/api/v1/rankings/<game>/servers/<id>` | one server of that ranking |
| `/api/v1/rankings/<game>/servers/<id>/load?hours=24` | players on that server per 10 minutes (1-168 hours) |
| `/api/v1/servers` | all servers |
| `/api/v1/stats?days=30` | totals over all rankings and activity per day |
| `/api/v1/players/<id>` | a player's profile values and rank |
| `/api/v1/players/<id>/weapons` | the player's weapons with accuracy and hits per body zone |
| `/api/v1/players/<id>/hitboxes` | hits per body zone over all weapons |
| `/api/v1/players/<id>/maps` | kills and deaths per map |
| `/api/v1/players/<id>/history` | points, kills and time per day, newest first |
| `/api/v1/players/<id>/awards` | daily awards won |
| `/api/v1/players/<id>/ribbons` | rank by kills and ribbons per award |

Unknown rankings, servers, players and other ids give `404` with
`{"error":"not found"}`; for `/api/v1/players/<id>/...` also hidden and
banned players, players of hidden rankings and bots while "Rank bots" is off.

The OpenAPI description is written in `src/lib/openapi.ts` (one entry per
route, with schema and a made-up example answer); `/api/v1` lists the same
entries. `npm run build` fails when a route under `src/app/api/v1` has no
entry there, so new endpoints have to be documented.

## Banner pictures

PNG pictures for forums and other sites, under the base path like every
page (with `BASE_PATH=/stats`: `/stats/banner/...`). `<game>` is the ranking
code (e.g. `css1`); `-<template>` before `.png` picks a design template's
colours. The codes on the profile, server and Misc pages use these URLs.

| URL | Content |
|-----|---------|
| `/banner/<game>/player/<playerId>.png` | player banner (forum signature), 400x100, cached 15 minutes |
| `/banner/<game>/server/<serverId>.png` | server banner, 560x95, cached 5 minutes |
| `/sig/<playerId>.png`, `/banner/<serverId>.png` | old URLs, aliases of the two above (same picture, no redirect) |

A player or server that does not belong to `<game>`, a hidden ranking and a
bot while "Rank bots" is off give `404`. Players hidden from the ranking keep
their banner (as their profile), without their position.
