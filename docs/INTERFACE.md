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
