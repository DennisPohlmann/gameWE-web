# gameWE - web: configuration

All settings of the website are environment variables, read from
`/etc/gamewe/web/web.env` (tar.gz) or the container's `--env-file`; every
variable is listed with a comment in [`.env.example`](../.env.example), and
[INSTALLATION.md](INSTALLATION.md#2-the-settings-file) has complete examples.
Everything else is set in the admin area (Admin → Settings) and stored in
`hlstats_Options`.

## Contents

1. [Database, time zone and designs](#database-time-zone-and-designs)
2. [Header links](#header-links)
3. [Languages](#languages)
4. [Search engines and sharing](#search-engines-and-sharing)
5. [Voice server](#voice-server)
6. [Access log](#access-log)

## Database, time zone and designs

All settings are environment variables, see `.env.example`. `TZ` (e.g.
`Europe/Berlin`) sets the time zone of all times on the site and when a day
starts (awards, daily charts); without it the Docker image uses UTC. Set the
collector to the same zone. `TEMPLATES_DIR` adds a folder of your own design
templates (see [templates/README.md](../templates/README.md)); a template's
optional `chart.json` sets the colours of its charts (section "Charts"
there). `DB_TYPE` selects the database: `mariadb` (default,
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

## Header links

Admin → Settings → Header links shows all tabs at the top of the site as one
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
in the footer; without a choice the browser's language is used, then
`DEFAULT_LANG`. The admin area is in German or English.

## Search engines and sharing

Admin → Settings → Search engines sets the description, keywords, preview
picture (Open Graph / X), the X account and whether search engines may index
the site. `/robots.txt` and `/sitemap.xml` are served under the base path
(e.g. `/new/robots.txt`); search engines read `robots.txt` only at the root of
the host, so with a base path either point the root's `robots.txt` at the
sitemap (`Sitemap: https://example.org/new/sitemap.xml`) or proxy it. Every
page has a share button with plain share links (no third-party scripts).

## Latest events

Two choices under Admin → Settings decide how the "Latest events" boxes
behave: "Latest events (ranking start page)" (`gamewe_game_events`: kills,
actions and team bonuses on all servers of the ranking) and "Latest events
(player page)" (`gamewe_player_events`: the same kinds, but only with that
player on either side: their kills and deaths, actions by and against them,
their team bonuses). Each is "Sync" (`live`, default: new events flow in
while the page is open), "Async" (`static`: only the latest ones as of
loading the page) or "Off" (`off`: the section is not shown). Both boxes
show time, event, server and map the same way; a hidden player in another
row is shown as "?". In "Sync" the heading says "(Live data)" and a switch
top right pauses the updates (no requests while paused; the choice is kept
per browser and box). The live boxes ask `/<game>/events-feed` and
`/<game>/players/<id>/events-feed` every 4 seconds while the tab is
visible; both answer 404 unless their setting is "Sync". Both are kept for
3 seconds per ranking or player; the player feed allows 60 requests per
client IP and minute.

## Voice server

Under Admin → Settings → Voiceserver choose None, TeamSpeak or Discord;
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

## Access log

The server writes one line per request to stdout in the combined log format
plus the response time, with the client address from the last
`X-Forwarded-For` entry, the one your reverse proxy adds (Docker:
`docker logs gamewe-web`, systemd: `journalctl -u gamewe-web`).
`ACCESS_LOG=off` turns it off, `ACCESS_LOG=all` also logs the health checks
(`/healthz`), which are left out by default.
