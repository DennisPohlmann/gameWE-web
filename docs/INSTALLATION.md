# Installing gameWE - web

The website shows the statistics that the gameWE collector writes to the
database, and has an admin area for settings, rankings, servers and users.
There are two ways to run it, and both read the same settings:

- **A: container** (Docker or Docker Compose), the image
  `ghcr.io/dennispohlmann/gamewe-web`
- **B: tar.gz with systemd**, the archive
  `gamewe-web-<version>-linux-amd64.tar.gz` from the GitHub release

Both run the same server. Pick the container if Docker already runs on the
machine, and the tar.gz if you prefer a plain service next to the collector.

## 1. Before you start

| What | Notes |
|------|-------|
| The gameWE collector | Installed, with its database set up (section 1.2). Its full guide: [collector INSTALLATION.md](https://github.com/DennisPohlmann/gameWE-collector/blob/main/docs/INSTALLATION.md). |
| Database | **MariaDB 11.4 or 12.3**, or **PostgreSQL 17 or 18** (tested on every release). MySQL 8 is not supported by the collector's schema scripts. |
| Node.js 22 or newer | Only for the tar.gz (Node.js 24 LTS recommended). The container brings its own Node.js 24. |
| Reverse proxy with TLS | nginx, Caddy, Apache or similar in front of port 3000 (see [section 5](#5-reverse-proxy)). |
| A secret | At least 32 characters for the admin session: `openssl rand -hex 32`. |

### 1.1 Linux user and folders

The website uses the same system user as the collector. The collector's
installation creates it; on a machine without the collector, create it yourself:

```bash
useradd --system --no-create-home --shell /usr/sbin/nologin gamewe
```

Layout of a complete installation (collector and website on one machine):

| Path | Owner, mode | What |
|------|-------------|------|
| `/etc/gamewe/collector/` | root:gamewe 0750 | collector settings |
| `/etc/gamewe/collector/config.yaml` | root:gamewe 0640 | collector config (database, listen port, GeoIP) |
| `/opt/gamewe/collector/bin/gamewe` | root 0755 | collector program |
| `/var/lib/gamewe/collector/` | gamewe:gamewe 0755 | collector data (GeoIP database) |
| `/etc/gamewe/web/` | root:gamewe 0750 | website settings |
| `/etc/gamewe/web/web.env` | root:gamewe 0640 | website settings file (section 2) |
| `/etc/gamewe/web/templates/` | root:gamewe 0750 | optional own designs (`TEMPLATES_DIR`) |
| `/opt/gamewe/web/` | root | website program (tar.gz) |
| `/etc/systemd/system/gamewe-collector.service`, `gamewe-web.service` | root 0644 | systemd units |

```bash
install -d -o root -g gamewe -m 0750 /etc/gamewe/web
# tar.gz: the archive brings web.env; container: create it (section 2)
```

The website keeps no data of its own; everything is in the database.

### 1.2 Create the database

The collector's repository has the scripts; the website only needs the
database they create. Short version (details and the alternatives by hand in
the [collector INSTALLATION.md](https://github.com/DennisPohlmann/gameWE-collector/blob/main/docs/INSTALLATION.md)):

**MariaDB** (`schema/init/`):

| File | What |
|------|------|
| `00_create_database.sql` | database `gamewe` with `utf8mb4` / `utf8mb4_unicode_ci`, and the users |
| `01_schema.sql` | the tables |
| `02_seed.sql` | reference data: games, weapons, actions, awards, ranks, ribbons |
| `03_grants.sql` | the rights |

```bash
cd schema/init
COLLECTOR_PASSWORD='...' WEB_PASSWORD='...' WEB_ADMIN_PASSWORD='...' ./init-db.sh -u root -p
```

**PostgreSQL** (`schema/postgres/init/`, same four files; the database gets
`ENCODING 'UTF8'`):

```bash
cd schema/postgres/init
COLLECTOR_PASSWORD='...' WEB_PASSWORD='...' WEB_ADMIN_PASSWORD='...' ./init-db.sh -U postgres
```

The script stops if the database already has tables, so it never overwrites
data. There are no migration scripts: the init script is the only way to
create the database, and an older database (also an old HLstatsX one) is
not upgraded. Create a new database with the current init script instead,
and copy old statistics into it with the migration guides of the collector:
[from HLstatsX:CE](https://github.com/DennisPohlmann/gameWE-collector/blob/main/docs/MIGRATION-HLSTATSX.md),
[from gameME](https://github.com/DennisPohlmann/gameWE-collector/blob/main/docs/MIGRATION-GAMEME.md).
Afterwards `gamewe check` shows `schema: ok` or lists what is missing.

### 1.3 Database users

The init scripts create three users. The website uses the two `gamewe_web*`
users:

| User | Used by | Rights |
|------|---------|--------|
| `gamewe` | collector | `SELECT, INSERT, UPDATE, DELETE` on all tables (PostgreSQL also the sequences) |
| `gamewe_web` | website `DB_USER` | `SELECT` on all tables except `hlstats_Users`, `hlstats_Events_Rcon` and `hlstats_Events_Chat`; on `hlstats_Servers` without `rcon_password`, `log_secret` and `log_secret_changed` and on `hlstats_Events_Connects` without `ipAddress` (column rights, so `SELECT *` fails there); `SELECT` on `hlstats_gamewe_jobs` |
| `gamewe_web_admin` | website `DB_ADMIN_USER` | `SELECT` on all tables; `INSERT, UPDATE, DELETE` on Options, Games, Servers, Clans, Weapons, Actions, Teams, Roles, Awards, Definition_Ranks_Ribbons and Users; on Players only `UPDATE` of `skill`, `hideranking` and `clan`; `INSERT` on `hlstats_gamewe_jobs` |

So the public pages can never read passwords, chat or IP addresses; chat and
IPs in the admin area are read with `gamewe_web_admin`. The exact statements
are in `03_grants.sql` (MariaDB) and `schema/postgres/init/03_grants.sql`.

## 2. The settings file

Both ways read `/etc/gamewe/web/web.env`, a plain `NAME=value` file. Write
comments on their own lines: `docker --env-file` takes everything after the
`=` as the value, including a `# comment` behind it. Quotes around values are
removed by the website, so both `X=a` and `X="a"` work.

The tar.gz brings a commented copy of all settings (`.env.example` in this
repository). The two examples below are complete and ready to adapt; only the
database address differs.

### Example: tar.gz (systemd), database on the same machine

```ini
# /etc/gamewe/web/web.env - gameWE web, tar.gz / systemd

# ---- Database: the one the gameWE collector writes ----
# mariadb (also for MySQL) or postgres
DB_TYPE=mariadb
DB_HOST=127.0.0.1
# 3306 for mariadb, 5432 for postgres
DB_PORT=3306
DB_NAME=gamewe
# Read-only user for the public pages
DB_USER=gamewe_web
DB_PASSWORD=change-me
# User for the admin area (settings, rankings, servers, users)
DB_ADMIN_USER=gamewe_web_admin
DB_ADMIN_PASSWORD=change-me
# TLS to the database: off, required (verify) or skip-verify
DB_TLS=off
#DB_TLS_CA=/etc/gamewe/web/ca.pem

# ---- Admin area ----
# Signs the admin cookie, at least 32 characters: openssl rand -hex 32
# Without it the admin area stays locked.
ADMIN_SECRET=

# ---- Address ----
# The unit listens on 127.0.0.1:3000; change it here if needed.
#HOSTNAME=127.0.0.1
#PORT=3000
# Sub path behind the reverse proxy, e.g. /stats for https://example.org/stats.
# Empty: the site runs at the root of its domain.
BASE_PATH=

# ---- Display ----
TZ=Europe/Berlin
SITE_NAME=gameWE
# en, de, ru, es, fr, pt, pt-br, nl, da, pl, sr, zh-tw or zh-cn
DEFAULT_LANG=de
ACTIVITY_DAYS=28
PAGE_SIZE=50

# ---- Optional ----
# Own design templates, one subfolder each (see templates/README.md)
#TEMPLATES_DIR=/etc/gamewe/web/templates
# Steam avatars and VAC status (on/off), optional Steam Web API key
#STEAM_PROFILES=on
#STEAM_API_KEY=
# 1 when SourceBans runs on the same machine or LAN
#SOURCEBANS_ALLOW_PRIVATE=0
# Access log on stdout: on, off or all
#ACCESS_LOG=on
# Token for /-/metrics (Prometheus), at least 16 characters; empty: off
#GAMEWE_METRICS_TOKEN=
```

### Example: container, database on the Docker host

```ini
# /etc/gamewe/web/web.env - gameWE web, Docker / Docker Compose

# ---- Database ----
DB_TYPE=mariadb
# With --network host (or network_mode: host) the host's database is 127.0.0.1.
# Without it, use the host's address in the Docker network, e.g. 172.17.0.1,
# and let the database listen there.
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=gamewe
DB_USER=gamewe_web
DB_PASSWORD=change-me
DB_ADMIN_USER=gamewe_web_admin
DB_ADMIN_PASSWORD=change-me
DB_TLS=off

# ---- Admin area ----
ADMIN_SECRET=

# ---- Address ----
# The container listens on 0.0.0.0:3000. With the host network, pick a free
# port here and bind it to 127.0.0.1 so only the reverse proxy reaches it.
#HOSTNAME=127.0.0.1
#PORT=3000
BASE_PATH=

# ---- Display ----
# The container is UTC without TZ.
TZ=Europe/Berlin
SITE_NAME=gameWE
DEFAULT_LANG=de
ACTIVITY_DAYS=28
PAGE_SIZE=50

# ---- Optional ----
# Own templates: mount a folder and point here, e.g.
# -v /etc/gamewe/web/templates:/app/custom-templates:ro
#TEMPLATES_DIR=/app/custom-templates
#STEAM_PROFILES=on
#STEAM_API_KEY=
#SOURCEBANS_ALLOW_PRIVATE=0
#ACCESS_LOG=on
#GAMEWE_METRICS_TOKEN=
```

Most site settings (title, logo, favicon, voice server, SourceBans, design,
header links) are set later in the admin area and stored in the database.



Protect the file, it holds passwords:

```bash
mkdir -p /etc/gamewe/web
chown -R root:gamewe /etc/gamewe/web    # tar.gz: the service runs as gamewe
chmod 750 /etc/gamewe/web && chmod 640 /etc/gamewe/web/web.env
```

For the container, `root:root` and `600` are enough, since Docker reads the
file as root.

## 3. A: Container (Docker / Docker Compose)

The image tags are `latest` (the newest release), `<version>` (e.g.
`0.1.0`), `<major>.<minor>` (e.g. `0.1`) and `edge`. Every commit on `main`
is built and checked and published as `edge`; only a release (made by
semantic-release from `feat`/`fix` commits on `main`) publishes `<version>`,
`<major>.<minor>` and `latest` and creates the GitHub release with the tar.gz
and its `.sha256`. Use `latest` or a version for
production. If the package on GHCR is private, log in first:
`echo <token> | docker login ghcr.io -u <github-user> --password-stdin`
(a token with `read:packages`).

### With docker run

```bash
docker run -d --name gamewe-web --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --env-file /etc/gamewe/web/web.env \
  ghcr.io/dennispohlmann/gamewe-web:latest
```

If the database runs on the same host and only listens on 127.0.0.1, use the
host network instead of `-p` (set `PORT` in `web.env` if 3000 is taken):

```bash
docker run -d --name gamewe-web --restart unless-stopped \
  --network host \
  --env-file /etc/gamewe/web/web.env \
  ghcr.io/dennispohlmann/gamewe-web:latest
```

### With Docker Compose

`/opt/gamewe/web/compose.yaml`:

```yaml
services:
  web:
    image: ghcr.io/dennispohlmann/gamewe-web:latest
    container_name: gamewe-web
    restart: unless-stopped
    env_file: /etc/gamewe/web/web.env
    ports:
      - "127.0.0.1:3000:3000"
    # Database on this host, listening on 127.0.0.1 only: use the host
    # network instead of ports.
    # network_mode: host
    # Own design templates (TEMPLATES_DIR=/app/custom-templates):
    # volumes:
    #   - /etc/gamewe/web/templates:/app/custom-templates:ro
```

```bash
cd /opt/gamewe/web && docker compose up -d
```

### First admin user

```bash
docker exec gamewe-web node scripts/create-admin.mjs admin
# with a TOTP key for the authenticator app:
docker exec gamewe-web node scripts/create-admin.mjs admin --totp
```

It creates the user with full rights and prints a generated password once
(with `--totp` also the TOTP key). The same command sets a new password for an
existing user; `--no-totp` also removes the TOTP key.

### Update

```bash
docker pull ghcr.io/dennispohlmann/gamewe-web:latest
docker rm -f gamewe-web && docker run ...           # same command as above
# or with Compose:
docker compose pull && docker compose up -d
```

The container keeps no data, so it can be replaced at any time. It runs as
user `node` (uid 1000) and has a health check on `/healthz`
(`docker ps` shows `healthy`).

## 4. B: tar.gz with systemd

### Install

Download `gamewe-web-<version>-linux-amd64.tar.gz` and its `.sha256` from the
GitHub release, then:

```bash
sha256sum -c gamewe-web-<version>-linux-amd64.tar.gz.sha256
node --version                      # 22 or newer
tar -xzf gamewe-web-<version>-linux-amd64.tar.gz -C /
chown -R root:gamewe /etc/gamewe/web && chmod 750 /etc/gamewe/web && chmod 640 /etc/gamewe/web/web.env
# edit /etc/gamewe/web/web.env (section 2)
systemctl daemon-reload
systemctl enable --now gamewe-web
systemctl status gamewe-web
```

The archive contains:

```
/opt/gamewe/web/                        the server (server.js), scripts, templates
/etc/gamewe/web/web.env                 commented settings
/etc/systemd/system/gamewe-web.service  systemd unit
```

The `gamewe` system user comes from the collector (section 1.1).

The service runs as `gamewe`, listens on `127.0.0.1:3000` (`HOSTNAME` and
`PORT` in `web.env` change that) and is hardened (`ProtectSystem=strict`,
`NoNewPrivileges`, only `/opt/gamewe/web/.next/cache` writable). The unit
puts `BASE_PATH` into the prebuilt files at every start.

### First admin user

```bash
cd /opt/gamewe/web && set -a && . /etc/gamewe/web/web.env && set +a && node scripts/create-admin.mjs admin
# add --totp for a TOTP key, --no-totp to remove it
```

It prints a generated password once.

### Update

Keep your settings by leaving `web.env` out:

```bash
tar -xzf gamewe-web-<version>-linux-amd64.tar.gz -C / --exclude=./etc/gamewe/web/web.env
systemctl daemon-reload && systemctl restart gamewe-web
```

The admin overview shows when a newer release is out
([USAGE.md](USAGE.md), update check). Read the [CHANGELOG](../CHANGELOG.md) for new settings; new entries in
`.env.example` are optional unless the changelog says otherwise.

### Logs

```bash
journalctl -u gamewe-web -f
```

## 5. Reverse proxy

Put nginx (or another proxy with TLS) in front of port 3000 and pass
`X-Forwarded-Proto`, so the admin cookie is marked `Secure`. The website takes
the client address (access log, brake against password guessing) from the
last `X-Forwarded-For` entry, which is the one nginx adds. With a second
proxy in front (e.g. a CDN), restore the real address with `real_ip_header`
first.

At the root of a domain:

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name stats.example.org;
    # ssl_certificate / ssl_certificate_key ...

    # Compress the pages and JSON feeds (the website only gzips itself).
    gzip on;
    gzip_types text/html text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Everything, static files included, comes from the website; it sets
    # the cache headers itself.
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        # The pages are streamed: the frame comes first, the slower parts
        # follow. Pass them on as they arrive instead of collecting the
        # whole page first.
        proxy_buffering off;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With the Brotli module (`ngx_brotli`, in many distributions a package of
its own) add `brotli on; brotli_types text/html text/css application/javascript application/json image/svg+xml;`
next to the gzip lines; the pages get 15 to 20 per cent smaller than with gzip.

Under a sub path, e.g. `https://example.org/stats`: set `BASE_PATH=/stats` in
`web.env`, restart, and proxy the path as it is, without rewriting it and
without a trailing slash in the location (with `location /stats/` nginx and
the website redirect each other in a loop):

```nginx
location /stats {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

All links, the admin cookie and the health endpoints then live under
`/stats`.

## 6. Check it

```bash
curl -s http://127.0.0.1:3000/healthz          # {"status":"ok"}, 503 without database
curl -s http://127.0.0.1:3000/-/readiness      # database check with details
```

(add the `BASE_PATH` in front, e.g. `/stats/healthz`). Then open the site,
sign in at `/admin` with the user from above and go through
**Admin → Settings**: site title, logo, favicon, voice server, SourceBans
address and design. Under **Admin → Rankings** each ranking gets its game
(e.g. Counter-Strike: Source) and its servers.

For monitoring, `/-/metrics` gives Prometheus metrics once a token is set
(see [USAGE.md](USAGE.md#health-and-monitoring)).

## 7. Troubleshooting

| Symptom | Cause |
|---------|-------|
| `/healthz` answers 503 | The database is not reachable: check `DB_HOST`, `DB_PORT`, user and password; in the container, 127.0.0.1 is the container itself (use `--network host` or the host's address). |
| Admin area says it is locked | `ADMIN_SECRET` is missing or shorter than 32 characters. |
| Admin cookie is not kept, login loops | The proxy does not pass `X-Forwarded-Proto https`, or the site is opened over plain http. |
| Redirect loop under a sub path | `location /stats/` with a trailing slash; use `location /stats`. |
| Times are off by hours, or the date (awards, "yesterday") changes only at 01:00/02:00 | `TZ` is not set (the container is UTC otherwise). Web and collector need the same `TZ`. |
| A ranking shows no game, or the game cannot be chosen | The database was not created with the current collector init script (column `hlstats_Games.realgame` missing). Create it again with the init script, then set the game under Admin → Rankings. Servers take the game of their ranking. |
| "Reset ranking" shows a hint | It needs collector 0.1.0 or newer and a database created with its init script (table `hlstats_gamewe_jobs`). |

## 8. Uninstall

Container: `docker rm -f gamewe-web` and `docker image rm ghcr.io/dennispohlmann/gamewe-web`.

tar.gz:

```bash
systemctl disable --now gamewe-web
rm -rf /opt/gamewe/web /etc/systemd/system/gamewe-web.service
systemctl daemon-reload
# settings: /etc/gamewe/web (remove only if no longer needed)
```

The database and its data stay untouched in both cases.
