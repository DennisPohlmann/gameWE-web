# gameWE - web

gameWE is a statistics system for Source 2 (Counter-Strike 2), Source and
GoldSrc game servers, in the style of gameME / HLstatsX. **gameWE web** is
its website: statistics pages in the style of gameME plus an admin area. It
reads the database that the
[gameWE collector](https://github.com/DennisPohlmann/gameWE-collector) fills,
on MariaDB/MySQL or PostgreSQL. It

- shows rankings, servers with live view and load graphs, player profiles
  (hitbox, weapons, maps, history), clans, daily awards, ribbons and ranks,
  weapons, actions, maps with kill heatmaps, chat and bans,
- has an admin area with its own light and dark design for desktop and
  phone: an overview of what needs attention, ranking management (rankings,
  servers, players, definitions, ranking resets) and settings (website,
  services, collector, users with optional TOTP),
- offers a read-only public JSON API with paged lists of players, countries,
  states, cities, clans, weapons, maps, awards, ranks and servers (documented on
  `/api` with Scalar), forum signatures, server banners and a TeamSpeak banner,
- comes in 13 languages and with design templates, including your own.

Built with Next.js 16 (App Router, server-rendered, almost no client
JavaScript), React 19 and TypeScript 7, with `mysql2` and `pg`. Runs as a
Docker container or as a systemd service from a tar.gz.

Current version: see `VERSION` and [CHANGELOG.md](CHANGELOG.md).

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

## Requirements

- The [gameWE collector](https://github.com/DennisPohlmann/gameWE-collector)
  with its database: MariaDB 11.4 or 12.3, or PostgreSQL 17 or 18
- Docker (the image brings Node.js 24 LTS on Debian 13), or Node.js 22 or
  newer for the tar.gz (Node.js 24 LTS recommended)
- A reverse proxy with TLS (nginx, Caddy, Apache) in front of port 3000

## Quick start

```bash
# /etc/gamewe/web/web.env: see docs/INSTALLATION.md, section 2
docker run -d --name gamewe-web --restart unless-stopped \
  -p 127.0.0.1:3000:3000 --env-file /etc/gamewe/web/web.env \
  ghcr.io/dennispohlmann/gamewe-web:latest
docker exec gamewe-web node scripts/create-admin.mjs admin
```

Then sign in at `/admin/login`. Every step, also for the tar.gz with systemd
and the reverse proxy: [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Documentation

| File | Content |
|------|---------|
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | installation step by step: database users, settings file, container, tar.gz, reverse proxy, update, troubleshooting, removal |
| [docs/CONFIG.md](docs/CONFIG.md) | environment variables, languages, search engines, voice server, access log |
| [docs/USAGE.md](docs/USAGE.md) | pages, where the data comes from, admin area, health and monitoring |
| [docs/INTERFACE.md](docs/INTERFACE.md) | database access and the public JSON API |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | local development, building, CI and releases |
| [templates/README.md](templates/README.md) | own design templates |
| [CHANGELOG.md](CHANGELOG.md) | changes per version |
| [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md) | third-party components and their licenses |

## gameWE components

| Repository | Part |
|------------|------|
| [gameWE-collector](https://github.com/DennisPohlmann/gameWE-collector) | receives the game server logs and fills the database |
| [gameWE-web](https://github.com/DennisPohlmann/gameWE-web) | statistics website and admin area (this repository) |
| [gameWE-plugin-sourcemod](https://github.com/DennisPohlmann/gameWE-plugin-sourcemod) | game server plugin for Source games |
| [gameWE-plugin-amxmodx](https://github.com/DennisPohlmann/gameWE-plugin-amxmodx) | game server plugin for GoldSrc games |

## Building

```bash
make package    # dist/gamewe-web-<version>-linux-amd64.tar.gz + .sha256
make image      # local Docker image gamewe-web:<version>
```

Local development, checks and the release process:
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Counter-Strike 2

Rankings of Counter-Strike 2 (Source 2) servers carry their own game tag
(CS2, in the Source 2 colour). CS2 logs no shots, so its pages leave out
shots, hits, accuracy, damage per hit and shots per kill; damage and the hit
zones (with the neck, which only CS2 logs) come from its attacked lines. The
heatmap of de_nuke and de_vertigo shows the upper or the lower level alone on
request.
CS2 has no plugin, so in-game commands get no answer. Setting up the server
(HTTP log) is described in the collector's documentation.

## Credits

The Counter-Strike 2 support follows HLstatsX:CE by lovasatt
(https://github.com/lovasatt/hlstatsx-community-edition, GPL-2.0-or-later),
whose CS2 game definitions and HTTP log handling were the reference for the
gameWE collector's Source 2 engine. The database schema comes from
HLstatsX: Community Edition. Thanks to both projects.

## License

gameWE web is free software under the GNU General Public License, version 3
or (at your option) any later version, like the rest of gameWE. The full text
is in [LICENSE](LICENSE). The licenses of the libraries and data the website
uses (Next.js, React, Leaflet, Scalar, DB-IP/GeoLite2 and others) are listed on the
site under `/licenses`; the full list of third-party npm packages, fonts,
flags and other bundled files with their licenses is in
[THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md).
