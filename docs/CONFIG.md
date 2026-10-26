# gameWE - web: configuration

The environment (`/etc/gamewe/web/web.env` for the tar.gz, the container's
`--env-file`) holds only what the website needs before it can reach the
database or what must not be changeable from the browser: database access,
`ADMIN_SECRET`, `BASE_PATH`, `TZ`, `TEMPLATES_DIR`, `ACCESS_LOG`,
`SOURCEBANS_ALLOW_PRIVATE`, `ADMIN_COOKIE_SECURE` and the runtime variables
(`PORT`, `HOSTNAME`, `NODE_ENV`). Every variable is listed with a comment in
[`.env.example`](../.env.example), and
[INSTALLATION.md](INSTALLATION.md#2-the-settings-file) has complete examples.
Everything else is set in the admin area (Admin → Settings) and stored in
`hlstats_Options`.

## Contents

1. [Database, time zone and designs](#database-time-zone-and-designs)
2. [Settings that moved into the database](#settings-that-moved-into-the-database)
3. [Header links](#header-links)
4. [Languages](#languages)
5. [Search engines and sharing](#search-engines-and-sharing)
6. [Voice server](#voice-server)
7. [Access log](#access-log)

## Database, time zone and designs

The environment variables are listed in `.env.example`. `TZ` (e.g.
`Europe/Berlin`) sets the time zone of all times on the site and when a day
starts (awards, daily charts); without it the Docker image uses UTC. Set the
collector to the same zone. `TEMPLATES_DIR` adds a folder of your own design
templates (see [templates/README.md](../templates/README.md)); a template's
optional `chart.json` sets the colours of its charts (section "Charts"
there). `DB_TYPE` selects the database: `mariadb` (default,
also for MySQL) or `postgres`. `DB_PORT`
defaults to 3306 or 5432 accordingly. Both use the same table and column
names; on PostgreSQL they are unquoted, so they are stored in lower case.
`DB_TABLE_PREFIX` is the prefix of the table names (default `hlstats`:
`hlstats_Players`; `gw` or `gw_`: `gw_Players`), for a database created
with another prefix (HLstatsX:CE `DB_PREFIX`) or several installations in
one database. It must be the same as `database.table_prefix` of the
collector (a letter, then letters, digits and `_`, at most 16 characters).
The documentation names the tables `hlstats_*`; read your prefix instead. The
admin area sets the site name, default language, browser title format,
header logo, favicon, site URL, banner, header links, activity days and page
size through `hlstats_Options`. Logo and favicon are given as a path (`/images/logo.png`,
relative to the domain) or an http(s) URL, there is no upload; the logo is
scaled to the header's height, a PNG with a transparent background fits
best. The default design is "dark"; the built-in designs are `dark`,
`light`, `orange`, `modern-dark`, `modern-light` and `modern-orange` (a
setting that names a removed one gets its replacement, see
[templates/README.md](../templates/README.md)).

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

## Settings that moved into the database

These settings were environment variables in older versions. They are now
set in the admin area and stored in `hlstats_Options`; each is read from the
database first, then from its old variable (so an existing `web.env` keeps
working), then the default. An invalid value counts as not set. While a
field's value still comes from the environment, the settings page says so;
saving the page writes it into the database, after which the variable can be
removed from `web.env`.

| Admin → Settings | `hlstats_Options` key | Old variable | Default | Values |
|---|---|---|---|---|
| General → Site title | `sitename` | `SITE_NAME` | `gameWE` | text |
| General → Default language | `gamewe_default_lang` | `DEFAULT_LANG` | `de` | a language code from [Languages](#languages) |
| General → Days until 0 % activity | `MinActivity` | `ACTIVITY_DAYS` | `28` | 1-3650 |
| General → Rows per page | `gamewe_page_size` | `PAGE_SIZE` | `50` | 10-500 |
| Steam → Fetch Steam profiles | `gamewe_steam_profiles` | `STEAM_PROFILES` (`on`/`off`) | on | `1` / `0` |
| Steam → Steam Web API key | `gamewe_steam_api_key` | `STEAM_API_KEY` | - | 32 hex characters |
| Monitoring → Token for /-/metrics | `gamewe_metrics_token` | `GAMEWE_METRICS_TOKEN` | - | at least 16 characters |

The Steam Web API key (https://steamcommunity.com/dev/apikey) and the
metrics token are write-only: the form shows only whether they are set (also
when set in the environment), an empty field keeps them and "clear" removes
the stored value. Only admins with level 100 can change the Steam key. They
are never sent to the browser or listed under the raw options. The public
pages read these rows with the read-only database user, like every other
setting.

`SOURCEBANS_ALLOW_PRIVATE` and `ADMIN_COOKIE_SECURE` stay in the
environment on purpose: the first is the guard against requests to the
local network, and a wrong cookie setting set from the browser could lock
every admin out.

## Header links

Admin → Settings → Header & links shows all tabs at the top of the site as one
numbered list in the order the header uses. Move an entry with its arrows or
drag it by its handle; the order is saved with the settings.

- **Home**: name and address can be changed; both are optional (empty name:
  the translated "Home", empty address: the start page of the statistics).
- **Search, Help, Licenses**: built in, can only be moved.
- **SourceBans**: listed only while an address is set under Settings → Bans,
  can only be moved. It is left out of the header when an own link already
  points to that address or is called "SourceBans".
- **Own links** (up to 6): name and address; `https://…` (or just
  `www.example.org`) opens in a new tab, a path such as `/forum` in the same
  tab. "Add own link" puts a new one at the end, ✕ removes it on saving.

Stored in `hlstats_Options`: `gamewe_header_order` (comma-separated ids
`home`, `search`, `help`, `licenses`, `sourcebans`, `link1` … `link6`),
`gamewe_header_home` (`Name|URL`, both parts optional) and `gamewe_link_1` …
`gamewe_link_6` (`Name|URL`). Without `gamewe_header_order`, as on older
installations, the order is Home, Search, Help, Licenses, SourceBans, then
the own links by number; ids missing from a stored order are added in that
order, unknown ones are ignored. Existing links keep their number and data.

Every section of the settings page has its own Save button. All of them save
the whole page, so changes in other sections are never lost; the page then
returns to the section whose button was pressed.

## Languages

The site comes in 13 languages: en, de, ru, es, fr, pt, pt-br, nl, da, pl,
sr, zh-tw and zh-cn. The texts are in `src/translations/` (see its README);
missing texts fall back to English. Visitors pick a language with the flags
in the footer; without a choice the browser's language is used, then the
default language (Admin → Settings → General, before that `DEFAULT_LANG`).
The admin area is in German or English.

## Search engines and sharing

Admin → Settings → Search engines sets the description, keywords, preview
picture (Open Graph / X), the X account and whether search engines may index
the site. `/robots.txt` and `/sitemap.xml` are served under the base path
(e.g. `/new/robots.txt`); search engines read `robots.txt` only at the root of
the host, so with a base path either point the root's `robots.txt` at the
sitemap (`Sitemap: https://example.org/new/sitemap.xml`) or proxy it. Every
page has a share button with plain share links (no third-party scripts).

## Latest events

Two choices under Admin → Settings → Maps & events decide how the "Latest events" boxes
behave: "Latest events (ranking start page)" (`gamewe_game_events`: every
event on all servers of the ranking: connects, entries, leaves, team, role
and name changes, actions, team bonuses, kills, suicides and teamkills;
never chat or addresses) and "Latest events (player page)"
(`gamewe_player_events`: only the events with that player on either side:
their kills and deaths, actions by and against them, their team bonuses).
There is no setting per event type. Rows with a hidden or banned player as
actor, victim or target are left out in both boxes. Connects, role and name
changes have no server in the database, so their server column shows "-".
Each is "Sync" (`live`, default: new events flow in while the page is
open), "Async" (`static`: only the latest ones as of loading the page) or
"Off" (`off`: the section is not shown). Both boxes show time, event,
server and map the same way; a victim or target no longer in the player
table is shown as "?". In "Sync" the heading says "(Live data)" and a switch
top right pauses the updates (no requests while paused; the choice is kept
per browser and box). The live boxes ask `/<game>/events-feed` and
`/<game>/players/<id>/events-feed` every 4 seconds while the tab is
visible, with `?since=<unix seconds>` of the newest row they show and
`&seen=<n>` rows of that second; the feeds answer `204` without a body
when nothing newer has happened (the usual case), so the browser has nothing to download or draw. Both answer
404 unless their setting is "Sync". Both are kept for 3 seconds per
ranking or player; the player feed allows 60 requests per client IP and
minute. The heading of the player page's box links to the
player's events page ("(Overview)"), the heading of the start page's box
to the ranking's events page (`/<game>/events`, "(Overview)").

"Latest events (ranking start page)" also decides about the ranking's
events page (the "Events" tab): all events of the ranking over the last
hour, 24 hours or 7 days with a chart over time, the share of each type and
a list with type filter and pager. "Sync": a "Live updates" switch (on by
default, kept per browser) lets new events run in on its first page, sorted
newest first; "Async": a plain list; "Off": no tab and the page is 404.

With "Latest events (player page)" on "Sync" the player's events page
(`/<game>/players/<id>/events`) gets a "Live updates" switch next to the
type filter, on its first page and sorted newest first. It is off on every
visit (the list holds still) and not shared with the box on the player
page; switched on, new events of the chosen type (or all types) run in at
the top, from `/<game>/players/<id>/events-feed?list=<type>`. "Async" and
"Off" leave the events page a plain list.

## Voice server

Under Admin → Settings → Voice server choose None, TeamSpeak or Discord;
only the fields of that kind are shown. TeamSpeak 3: address, port, password
to show, ServerQuery port and login, and optionally an address shown
instead of address:port (e.g. a DNS name with an SRV record) and a connect
link that replaces the generated `ts3server://host?port=...` link (only
`ts3server://`, `teamspeak://` and `https://` with a host name are
accepted). The query always uses the real address and ports. A flag
before the name shows the server's country, chosen in "Flag of the
TeamSpeak server": "No flag" (default: neither a flag nor a placeholder),
"Automatic" (the GeoIP country the collector found for a game server on
the same IP, else a neutral flag), or a country from the list. Discord:
invite and server ID. A box at the top of the start page and of every
ranking page (`/<game>` and its subpages) then shows the TeamSpeak address
with a connect link, the type (e.g. `TeamSpeak 3`, from the server version), the password,
the channel count and the players online, or the Discord
link with its online count. Without a choice, a configured TeamSpeak is
used, else Discord. The players are read via
ServerQuery (`serverinfo`, every 60 seconds); without a query login the guest
group needs the permission to see server info. The Discord count comes from
the server widget, which must be enabled in the Discord server settings
(every 5 minutes). The ServerQuery password is never shown.

Clicking the TeamSpeak name in the box opens `/voice` with the channel
tree, the people online, server data, traffic and the welcome message. It
runs `serverinfo`, `channellist -topic -flags` and
`clientlist -away -voice -country` in one query connection, at most once a
minute, so a query login (or a guest group) needs these permissions too.
"Show the names of the people online" (default yes) can hide the nicknames;
they are personal data, so mention them in your privacy policy.

The TeamSpeak banner `/banner/teamspeak.png` (code at the bottom of `/voice`)
uses the same `serverinfo` answer as the box: name, the shown address (the
display address when set), users of the slots, channels, uptime and type.
The server password, the query login and the query port are never in it.

## Access log

The server writes one line per request to stdout in the combined log format
plus the response time, with the client address from the last
`X-Forwarded-For` entry, the one your reverse proxy adds (Docker:
`docker logs gamewe-web`, systemd: `journalctl -u gamewe-web`).
`ACCESS_LOG=off` turns it off, `ACCESS_LOG=all` also logs the health checks
(`/healthz`), which are left out by default.
