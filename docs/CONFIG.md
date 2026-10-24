# gameWE - web: configuration

All settings of the website are environment variables, read from
`/etc/gamewe/web/web.env` (tar.gz) or the container's `--env-file`; every
variable is listed with a comment in [`.env.example`](../.env.example), and
[INSTALLATION.md](INSTALLATION.md#2-the-settings-file) has complete examples.
Everything else is set in the admin area (Admin → Settings) and stored in
`hlstats_Options`.

## Contents

1. [Database, time zone and designs](#database-time-zone-and-designs)
2. [Languages](#languages)
3. [Search engines and sharing](#search-engines-and-sharing)
4. [Voice server](#voice-server)
5. [Access log](#access-log)

## Database, time zone and designs

All settings are environment variables, see `.env.example`. `TZ` (e.g.
`Europe/Berlin`) sets the time zone of all times on the site and when a day
starts (awards, daily charts); without it the Docker image uses UTC. Set the
collector to the same zone. `TEMPLATES_DIR` adds a folder of your own design
templates (see [templates/README.md](../templates/README.md)). `DB_TYPE` selects the database: `mariadb` (default,
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

## Voice server

Under Admin → Settings → Voiceserver choose None, TeamSpeak or Discord;
only the fields of that kind are shown. TeamSpeak 3: address, port, password
to show, ServerQuery port and login, and optionally an address shown
instead of address:port (e.g. a DNS name with an SRV record) and a connect
link that replaces the generated `ts3server://host?port=...` link (only
`ts3server://`, `teamspeak://` and `https://` with a host name are
accepted). The query always uses the real address and ports. Discord:
invite and server ID. A box at the top of the public pages then shows the TeamSpeak address with a connect
link, the type (e.g. `TeamSpeak 3`, from the server version), the password,
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
