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
| `/` | all rankings with players online (with a total row when there are several), best player (Steam picture, flag) and clan (flag of its members' most common country), "General statistics" (all players of `hlstats_Players` and `hlstats_PlayersInactive`, also hidden and inactive ones, bots left out, and how many play now; all clans of `hlstats_Clans`, also those without active members, and in how many rankings; servers and how many have real players now, kills and the time of the latest kill without a hidden player, headshots and their share of the kills; each card with a faint line of the last 30 days behind it: players online and servers with players from `hlstats_server_load`, else active players per day, clans with an active member per day, kills and headshots per day from `hlstats_Players_History`, whole days only), load of the last 30 days (while fewer days are recorded, the graph starts at the first one and its caption says since when) |
| `/<game>` | a ranking: servers (flag of the server's country; on wide screens also the server version with a Linux or Windows icon and a VAC shield for VAC-secured servers, from the collector's `features.server_info`; `-` while unknown), live players per server by team, daily awards, activity |
| `/<game>/servers/<id>` | one server: live view with the server's country flag, bots and flags, load graph of the last 24 hours (players, maps, uptime), counters, chat |
| `/<game>/players` | ranking (sortable, search; when the ranking has career ranks, a "Rank" column shows the player's rank badge, sorted by kills like the ranks themselves; hover, tap or focus the badge for a box with the rank, the kills, the next rank and the kills still to go with a progress bar, a dash for players below the first rank; the clan members table has the same column), `?view=new` for new players, `?view=inactive` for inactive players (`hlstats_PlayersInactive`: players the collector moved out of the ranking after a long time without playing; sorted by last seen, without rank numbers and place filters); country, state and city rankings with gameME's links: `?type=countryinfo` (all countries), `?type=countryinfo&valuecountry=de` (players of a country), `?type=stateinfo[&valuecountry=de]` (states: the GeoIP subdivision, e.g. German Bundesland or US state, counted per country; players whose location has no state name, such as the legacy region codes HLstatsX wrote, are left out until the collector looks them up again), `?type=stateinfo&valuecountry=de&valuestate=bavaria` (players of a state), `?type=cityinfo[&valuecountry=de]` (cities), `?type=cityinfo&valuecountry=de&valuecity=berlin` (players of a city; `valuecity` alone also works but joins cities of the same name) |
| `/<game>/players/<id>` | player profile: Steam avatar and data (laid out like gameME's and as compact as HLstatsX's: rows of about 21px, the labels in a column of 30 %, the name across the full width, the avatar centred beside the rows from Clan to Steam name with the same gap on all four sides (the table cell is its frame) and the rows below across the full width; in every skin), summary laid out like gameME's (left half: position and points, below them the radar; right half: labels and values; the rows below with the label in the left and the value in the right half; the "last 14 days" note on the line of the history links) with radar (K/D, kills per minute, assists per kill, survived and won rounds of the player over the last 14 days against the average of all ranked players of the game active in those 14 days, i.e. their pooled ratio; the average sits on the middle ring and the player relative to it, the outer ring is twice the average; the four core axes K/D (top), kills per minute (right), survived (bottom) and won rounds (left) are always drawn, assists only as a fifth axis when the game records them; axes without data for the player or the game (no rounds, no win triggers) stay greyed at the centre with "no data", and without activity in the last 14 days only the average is drawn with a note; the average is a dashed outline with hollow points and the player a solid filled shape with filled points (the legend shows the same line styles), the average drawn over the player's shape, so both stay visible when they are equal; hover, tap or focus an axis for its values in a box that never covers the axis label), assists (with the assisted kills only when the collector counted any) and trend pills, player trend (its "Overview" link opens the sessions page), rank and career (hover, tap or focus a career badge for a box with the rank's kill range, whether the player reached it, and for the current rank and the ranks not reached yet the player's kills and the kills still to go with a progress bar; Escape or a tap elsewhere closes it), ribbons, forum signature, hitbox (one card centred across the section; values and lines in the skin's text colour; the neck zone only when the player has neck hits, which only Counter-Strike 2 logs), weapons, maps, opponents, latest events of the player (live, see the admin setting) |
| `/<game>/hall-of-fame` | hall of fame ("Ruhmeshalle" in German) of a ranking with a scheduled reset: the star table (how often a player was on the podium of a period, after moving up: gold, silver and bronze stars, most gold first; the top 10, `?stars=all` all), the points of places 1 to 3 per period as a graph, and every period newest first (6 per page, `?page=`) with its podium: place, name, points, the rank reached (badge), kills, deaths, K/D, headshots %, accuracy, best kill streak, time played and favourite weapon, as the collector stored them at the end of the period. Each card shows the player's current Steam name and avatar (Steam profiles on, Admin → Settings → Steam; without them the current name in the ranking) and, if it differed, the name then ("then: X"); deleted players keep the stored name. Hidden players and entries an admin removed are left out, the next ones move up (the collector stores five per period, three before 0.20); with fewer the place stays empty. The tab after "Clans" and the page exist only while the page is on for the ranking (see Admin → Rankings; by default only once the ranking has entries, i.e. from its first reset, and no longer when they are deleted); the player profile then shows the player's stars next to the name |
| `/<game>/clans`, `/<game>/clans/<id>` | clans and members |
| `/<game>/awards` | daily awards with a calendar (`?date=YYYY-MM-DD`, `?month=YYYY-MM`); `?view=history`, `?view=ranks`, `?view=ribbons` (with most decorated players, `&class=N` filters a ribbon class) |
| `/<game>/weapons`, `/<game>/weapons/<code>` | weapons like gameME's ("From a total of X kills with Y headshots"; weapon code, name, modifier, kills, kills %, headshots, headshots % and Hpk as bars; kills % and headshots % are shares of all kills and headshots, Hpk is headshots per kill of the weapon; sortable: `?sort=code\|name\|modifier\|kills\|headshots\|hpk&dir=asc`), best players per weapon |
| `/<game>/actions`, `/<game>/actions/<id>` | actions like gameME's ("From a total of X actions"; action, skill bonus (the player reward, or the team reward of a team action), achieved and achieved % of all actions as a bar; sortable: `?sort=name\|bonus\|count&dir=asc`, paged with `?page=` and `?rows=`), best players per action |
| `/<game>/maps`, `/<game>/maps/<id>` | maps (sortable) with time, kills and headshots and their share of all maps of the ranking, the CT/T win ratio and headshots per kill; per map its details (time, CT/T win ratio, kills, kills per minute, headshots, accuracy), a kill heatmap with one dot per position as on gameME's map tracking (kills blue, headshots blue with a white centre, deaths red; the newest 3000 of each, `?pos=killer` only the kills, `?pos=victim` only the deaths; Source games only, GoldSrc logs carry no positions; on Counter-Strike 2's de_nuke and de_vertigo `?lv=upper` or `?lv=lower` shows one level alone, split at the height of the map's radar overview, `src/lib/map-levels.ts`) and every player with a kill on the map (all time, sortable, paged; with GG wins on GunGame rankings) |
| `/<game>/teams` | teams and roles like gameME's: time, kills, deaths and K/D per team and role, each with its share of the table's total as a bar (teamkills not counted; teams without kills or deaths such as spectators show `-`); each table sorts on its own: `?tsort=name\|time\|kills\|deaths\|kpd&tdir=asc` for teams, `rsort`/`rdir` for roles |
| `/<game>/players/<id>/events` | player history: connects, team and name changes, actions, kills and deaths (filter by type; with "Latest events (player page)" on "Sync" a "Live updates" switch, off on every visit, lets new events run in on the first page) |
| `/<game>/players/<id>/sessions` | player history per day, laid out like gameME: a statistics summary (player trend, kills and deaths per day), then one row per day with change, points, time, rounds, wins, kills, deaths, K/D, kill streak, headshots, HS/kill and accuracy; every column sortable (newest day first), paged with "Go to", "Show rows" and the number of entries and pages |
| `/<game>/players/<id>/awards` | awards the player won: summary and list by date |
| `/<game>/players/<id>/chat` | the player's chat messages |
| `/<game>/chat` | chat log with search |
| `/<game>/events` | all events of the ranking (the kinds of the "Latest events" box on the start page: connects, entries, leaves, team, role and name changes, actions, team bonuses, kills, suicides, teamkills; never chat or addresses) over the last hour, 24 hours (default) or 7 days (`?period=1h\|24h\|7d`): a chart of the events over time in five groups (kills, actions, joins and leaves, team/role/name changes, suicides and teamkills; per 5 minutes or per hour), the share of each type (count and percent; a click filters the list by it), and the list newest first with time, type, event, server and map, a type filter (`?type=`, "Action" includes actions on another player) and a pager (at most the newest 5,000 rows; a note says so when the period holds more). Rows with a hidden or banned player on either side are left out of the list and the counts alike. Follows the admin setting "Latest events (ranking start page)": "Sync" adds a "Live updates" switch (on by default, kept per browser) that lets new events run in on the first page, "Async" shows a plain list, "Off" removes the tab and the page (404). The "Events" tab sits between "Teams" and "Chat"; the "Overview" link in the heading of the start page's box opens the page |
| `/<game>/misc` | player countries, weekdays, connects per day, connect methods, server banners |
| `/<game>/bans` | ban list like gameME's: the running bans of the ranking's players from the collector's ban records (`hlstats_Players_Bans`: type, date, reason; `features.sourcebans` of the collector, which takes SourceBans-banned players out of the ranking while the ban runs), from SourceBans (reason, length, date) and, with a Steam Web API key (Admin → Settings → Steam), VAC/game bans from Steam; K/D, HS/kill and accuracy per player (no points: a banned player has none). 50 players per page (pager below, `?page=`, `?rows=`); sorting covers the whole list. Behind each name, at the height of the flag, a "!" in the colour of the ban (yellow VAC, red SourceBans and server bans, split diagonally red/yellow when both run) shows every running ban with reason, date and length on hover or tap. The ban type column (centred) always shows VAC and SourceBans side by side (each only when the site checks it: Steam Web API key, SourceBans address), the one that does not apply in grey; a server ban gets its own badge only when one runs; the details of each ban show on hover or tap. Players banned in the ranking (`hideranking = 2`) are listed, players hidden by an admin or by themselves are not. Expired and lifted bans are not shown; a SourceBans ban the collector recorded is listed once. |
| `/search` | search players by name or Steam ID and clans by tag or name (`?q=...&st=names\|steam\|clans&game=<code>`) |
| `/help` | help: how points are calculated (with the current settings), actions, weapon modifiers, chat commands |
| `/voice` | detail page of the TeamSpeak server from the voice server box (click its name): channel tree with the people online (country flag before the name; names can be hidden in the admin settings), server info (operating system with a small symbol, uptime, users, connections, security level, ping, version, host banner URL), traffic and the welcome message, and at the bottom the code of the TeamSpeak banner; live from the ServerQuery, kept for a minute; 404 unless TeamSpeak is the voice server |
| `/licenses` | licenses of the software, data, map tiles, flags and fonts gameWE uses |
| `/privacy` | privacy policy: the operator's details (Admin → Settings → Website → Privacy), the visitor's consent settings (`#consent`, works without JavaScript), and lists the site builds itself from the settings: cookies and browser storage, the other hosts the browser loads from (with the consent category that gates them), the services only the server asks, the access log, the game statistics and the visitor's rights; see [CONFIG.md](CONFIG.md#privacy-and-cookie-consent) |
| `/consent` | `POST` only (the cookie banner's and the privacy page's forms): stores the choice in the cookie `gamewe_consent` and goes back to the page; `GET` leads to `/privacy#consent` |
| `/<game>/events-feed` | the latest 10 events of a ranking as JSON, all event types except chat, without hidden or banned players (live box on the start page; 404 unless the admin setting "Latest events" is "Sync"). With `?list=` (empty for all types, or a type of the events page's filter such as `kill`) and `&period=1h\|24h\|7d`: the latest 25 rows of the events page with that filter instead (live table of the events page; 60 requests per IP and minute, then `429`). With `?since=<unix seconds>&seen=<n>`: `204` without a body when no event is newer than `since` and no more than `n` events have that second |
| `/<game>/players/<id>/events-feed` | the latest 25 events of one player as JSON (kills and deaths, actions by and against the player, team bonuses), the same rows the profile shows (live box on the player page; 404 unless the admin setting "Latest events (player page)" is "Sync", for unknown players, players of another ranking and hidden rankings; 60 requests per IP and minute, then `429`). With `?list=` (empty for all types, or an event type such as `kill`): the latest 25 rows of the player's events page with that filter instead (live table of the events page). `?since=` as above |
| `/api` | documentation of the public JSON API: every endpoint with parameters, example answers and code for curl, PHP, Python and JavaScript (Scalar, self-hosted); the OpenAPI description is `/api/openapi.json` |
| `/api/v1/...` | public JSON API, see [INTERFACE.md](INTERFACE.md) |
| `/banner/<game>/player/<playerId>.png` | player banner (forum signature, 400x100) with rank insignia, position and activity; in the banner of the active skin (game design or main template) by default, `/banner/<game>/player/<playerId>-<template>.png` in that of another template (old `-classic` URLs and unknown templates give the default, removed built-in templates such as `-blue` their replacement; a template without banner definition the Dark banner, see `templates/README.md`); the profile offers the code as BBCode, HTML, Markdown or image URL; 404 if the player is not in that ranking, for hidden rankings and for bots of rankings whose "Bots in the ranking" is off; hidden players get it without their position |
| `/banner/<game>/server/<serverId>.png` | server banner (560x95) with address, status, players, map and the last 24 hours; `-<template>` as above; code on the server page and the Misc page; 404 if the server is not in that ranking |
| `/banner/teamspeak.png` | TeamSpeak banner (560x95, the server banner's look) with live data only, no history: name with flag, shown address, status, users online of the slots with a fill bar, channels, uptime and server type; offline banner when the query fails; never the server password, the query login or the query port; `-<template>` as above; code at the bottom of `/voice`; 404 unless TeamSpeak is the voice server |
| `/sig/<playerId>.png`, `/banner/<serverId>.png` | old URLs of the two banners (also with `-<template>`), kept as aliases that answer the same picture, so signatures already posted in forums keep working |
| `/robots.txt`, `/sitemap.xml` | for search engines, see [CONFIG.md](CONFIG.md#search-engines-and-sharing) |
| `/admin` | admin area |

A ranking is a row of `hlstats_Games` that you create in the admin area
(Rankings, e.g. "Assault"), optionally copying weapons, actions, teams, roles,
awards and ranks from an existing ranking. Servers are assigned on the
ranking's page (this sets `hlstats_Servers.game`), or created there right
away with "Add server"; the collector picks the change up within a minute. The start page lists every ranking that has servers;
the servers are listed on the ranking's page. Rankings without servers serve
as templates. The ranking choices on the search and help pages and the
ranking filters of the admin chat and IP pages list only rankings with at
least one server or player; the admin forms that assign a ranking list all.

`<game>` is `hlstats_Games.code`, for example `css1`; the API documentation on
`/api` fills its examples with the first ranking of the site.

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

Paged tables end in a pager: "Go to" (page field), "Show rows" (10, 25,
50, 100 or 250; the first view uses Admin → Settings → General → Rows per
page, the same steps), the number of entries and pages, and the buttons
|◀ (first page), ◀ (previous), ▶ (next) and ▶| (last page); a button that does not apply on the current
page is greyed out. The admin lists use the same pager.

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
| `/<game>/clans/<id>` members | `sort`, `dir` | the keys of the player ranking (`skill` default, `name`, `activity`, `time`, `kills`, `career` (career rank, by kills), `deaths`, `kpd`, `hs`, `hpk`, `acc`) |
| `/<game>/maps/<id>`, `/<game>/weapons/<code>`, `/<game>/actions/<id>` best players | `sort`, `dir` | `name`, `kills`, `deaths`, `kpd`, `hpk` (map); `name`, `kills`, `hs`, `hpk`, `shots`, `acc` (weapon); `name`, `count`, `points` (action) |
| `/<game>/bans` | `sort`, `dir` | `name`, `type`, `reason`, `date`, `kpd`, `hpk`, `acc` (default: running bans first, newest first) |
| `/<game>/chat`, `/<game>/events`, `/<game>/players/<id>/chat`, `/<game>/players/<id>/events`, admin chat | `sort`, `dir` | `date` only (newest first; `dir=asc` oldest first): chat and events can hold millions of rows, the time is the column with an index |
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
  throttled; with a Steam Web API key (Admin → Settings → Steam) the Steam
  Web API is used instead (100 players per call), which is recommended for
  the player maps. "Fetch Steam profiles" on the same page turns it off.
- **Activity chart** comes from `hlstats_Players_History`, not `hlstats_Trend`.
- **Counter-Strike 2** logs no shots (there is no weaponstats plugin), so
  the ranking, profile, sessions, weapon, map, live and ban pages of a CS2
  ranking leave out shots, accuracy and shots per kill, the profile's
  weapon table also hits and damage per hit, which the collector does not
  count for CS2 (the API returns `accuracy: null`). Damage and the hit zones
  come from the attacked lines; the neck zone (`hlstats_Players_Weapons.neck`, collector migration
  7) only exists there and reads as 0 in older databases.
- **Player trend** (profile and sessions page) shows the points at the end of
  each day of `hlstats_Players_History` (line, left axis; days without play
  keep the last value) and the points gained or lost that day (bars, right
  axis). The bars are the difference to the day before (the last history day
  before the range for the first one), so they always match the line; the
  stored `skill_change` can differ from it. The "Change" column of the
  sessions table and `pointsChange` (formerly `skillChange`) of
  `/api/v1/players/{id}/history` use the same difference (the oldest day of
  all: its recorded `skill_change`).
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
- **Hidden players** (`hlstats_Players.hideranking` other than 0: hidden by
  an admin, hidden by the player with `!hide`, or marked as banned by the
  collector) appear nowhere on the public pages or in the public API: their
  profile, sessions, events, awards and chat pages, events feed, banner,
  forum signature and avatar answer 404, and every ranking, list and table
  leaves them out (opponents, events with them on the other side, award
  winners, clans, maps, weapons, actions, search, chat, the player
  maps and their lines). Exception for banned players (`hideranking = 2`):
  they are on the bans page, and their profile page (with its charts and
  avatar, without the links to the history pages, which stay 404; not
  indexed by search engines, no forum signature; position "not listed" and
  no points) shows the ban: a "!" behind the name as on the bans page, and
  the "Bans" row with the VAC and SourceBans badges side by side (grey when
  that ban does not apply; VAC once Steam answered) for the running bans
  (the collector's record, else the SourceBans list, else "Server" for a
  player hidden as banned without details), their reason, date and length
  or end on hover or tap. Without a ban the row shows the VAC status from
  Steam when Steam answered; it is left out when there is neither. Only the live list of a server still shows them,
  with their in-game name and live values but without a link or player id;
  the server's player count is unchanged. Bots are not hidden players. The
  admin area shows them as before.
- **Players of a map** (map page) come from `hlstats_Events_Frags` over all
  time: kills and headshots as killer, deaths as victim, the position is the
  place in the whole ranking. Hidden players are left out of the list; their
  kills are counted in the line above it. GG wins count the `gg_win` actions
  of the listed players on that map (column only when the ranking logged a
  `gg_win`). Accuracy comes from `hlstats_Players_Maps` (shots and hits),
  which the collector does not fill: "–" without data. The map's time is
  the larger of `hlstats_Maps.play_time` (only filled by imported gameME
  data) and the time `hlstats_server_load` saw the map running with
  players (each row counts the time since the server's previous row, at
  most 10 minutes); kills per minute divide the kills by that time. The API
  `/maps/<id>/players` still returns the best players of the last days.
- **Map shares** (time %, kills %, headshots %) are the map's part of the
  sum over all maps of the ranking, with one decimal (`<0.1%` for a tiny
  share); the bars are filled relative to the largest share in the list.
- **Win ratio per map** (CT blue / T red) counts the won rounds in
  `hlstats_Events_TeamBonuses` by the side of the trigger's action
  (`hlstats_Actions.team` `CT` / `TERRORIST`): one round per map and time,
  only rounds whose trigger has a team reward, as long as the events are
  kept. Maps without such rounds, and games whose round actions have no
  side (TF2, DoD:S), show an even 50 % / 50 % bar whose tooltip says
  "no data"; the column appears
  for Counter-Strike rankings (CS:S, CS:GO, CS2, CS 1.6, Condition Zero) and
  wherever wins exist. The collector does
  not write `hlstats_Maps.teama_wins` / `teamb_wins`.
- **Countries** come from the collector's GeoIP lookup:
  `hlstats_Players_Data.location_id` and `hlstats_Livestats.cli_location_id`
  point to `hlstats_Players_Locations`. The footer shows the credit the
  GeoIP database requires (setting "GeoIP credit": `dbip`, `maxmind` or empty).
- **Bots** appear in the live view with a BOT tag. Per ranking (Admin →
  Rankings → ranking → Bots) they are ranked like players (the default) or
  hidden; while a ranking hides them, their names are plain text everywhere
  (no link to a profile) and a bot's profile pages and
  `/api/v1/players/<id>` answer 404.
- **Server load graph** reads `hlstats_server_load` (one row per server and
  10 minutes).
- **Player events** never read the IP address of `hlstats_Events_Connects`.
- Clans, countries, ranks and roles appear once they are set up (admin area)
  or imported from the old database. Sections without data are hidden.

- **Player maps** (world map above the ranking, "online now" map on a
  ranking's page) can be turned off one by one under Settings → Player maps,
  which also sets the map style: matching the design (OpenStreetMap, dark
  on dark designs), OpenStreetMap or OpenStreetMap dark. The visitor's
  browser loads the tiles directly from OpenStreetMap; the credit is shown
  in the map. On a country, state or city ranking the map shows only the
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
  is online, with a dot running slowly to and fro along them like packets
  between player and server, at the same speed on every line (about 40
  pixels per second, so a longer line takes longer; still, in the middle of the line, when the system asks
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
  read every 30 minutes, at most 100 pages, one after another. The classic
  SourceBans/SB++ 1.x list, the SB++ 1.8 default theme (rows with a
  "Steam ID / Invoked on / Ban length / Reason" detail list) and the SB++
  2026 one are understood. When the list shows Steam IDs but no ban can be
  read from it (another template), the bans page says so and the server
  log gets a warning, instead of an empty list.
  Only public http(s) addresses without redirects are accepted, so the
  setting cannot reach localhost or the LAN; `SOURCEBANS_ALLOW_PRIVATE=1`
  allows that when SourceBans runs on the same network.
- **VAC and game bans** (bans page) need the Steam Web API key; the 1000 most
  recently active players of the ranking are checked, 100 per call, every
  12 hours.
- **Block VAC-banned players** (Admin → Rankings → a ranking, card "VAC
  block", off by default; `hlstats_Options` `gamewe_block_vac_<game>`, also
  `gamewe game set CODE -block-vac=true` of the collector): the
  collector checks every connecting player with the Steam Web API; a
  player with a VAC ban on record is kicked ("VAC ban on record"), taken
  out of the ranking and listed only on the bans page (yellow VAC badge,
  type `vac` of the collector's ban records). The collector reads only the
  key stored under Settings → Steam, not `STEAM_API_KEY` of the website's
  environment: the card and the ranking's header say so when no key is
  stored. The servers need an RCON password for the kick. Without a key or
  when Steam does not answer nobody is blocked. Switched off again, the
  ranking's VAC blocks end and the players are back in the ranking.

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
Settings → My account & 2FA (also in the user menu top right), where the password
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

The admin area has its own design, independent of the templates of the
public pages: light or dark (it follows the device; the user menu top right
switches it and the language). "To the website" in the top bar and in the
user menu opens the public pages in a new tab. The top bar has three areas, on phones a bar
at the bottom; each area has its own side menu (on phones a drawer behind the
menu button), and lists turn into cards on narrow screens:

- **Overview** (`/admin`): active rankings, servers (and how many have
  players right now), players (and how many are hidden or banned), players
  active today, whether the collector reports in (`gamewe_heartbeat`), the
  rankings with their state, what needs attention (own TOTP off, collector
  silent, active ranking without a game, no server yet, an update of the web
  or the collector) and quick links. The side menu ends with the running
  versions of the web and the collector and, when there is one, a link to
  the newer release.
- **Update check**: the admin area asks GitHub (`api.github.com`, without a
  token, from the web server) for the latest release of gameWE-web and
  gameWE-collector and compares it with the running web (`APP_VERSION`) and
  the version the collector writes at its start (`gamewe_collector_version`,
  collector 0.17 and later; an older collector is just not compared). The
  answer is kept for 6 hours, after a failure the next request waits an
  hour; offline or after 4 seconds nothing is shown. Only the overview page
  asks GitHub, the other pages use the kept answer. Nothing is downloaded or
  installed: the notice links to the release, the steps are under "Update" in
  [INSTALLATION.md](INSTALLATION.md). Admin → Settings → Monitoring, "Check
  for updates" (`gamewe_update_check`, default on) turns it off; then no
  request goes to GitHub.
- **Rankings** (`/admin/rankings`): all rankings, the ones with servers
  first. The ranking chosen at the top of the side menu applies to everything
  below it: its overview (`/admin/rankings/<code>`: servers with address, map
  and players now, number of players, clans and definitions; "Add server"
  in its servers card opens the new-server form, `/admin/servers/new?game=<code>`,
  with the ranking preset and locked, and saving returns to the ranking's
  page; a `game` that is not an existing ranking is ignored), servers,
  players, clans, weapons, actions, teams, roles, awards, ranks and the reset.
  "All rankings" in the same menu shows the lists without a filter.
- **Settings** (`/admin/settings/<page>`): one page per topic, each with its
  own save bar: Website (general, design & logo, header & links, maps &
  events, search engines, privacy), Services (voice server, SourceBans, Steam, monitoring),
  Collector (points, recording & privacy, in-game commands), Moderation (chat,
  IP addresses), Access (users, my account & 2FA) and Advanced (all options
  (raw)).

What the admin area edits:

- **Settings:** the website settings and the collector's `gamewe_*` options
  (points per kill, headshot bonus, penalties, win triggers, chat and IP
  storage, in-game commands, RCON timeout, the players' own stats reset, points
  in the console and actions in the chat). The collector picks them up within
  a minute. A page saves only its own settings. All other `hlstats_Options`
  rows (own, old HLstatsX and obsolete keys) are on Advanced → All options
  (raw), where they can be changed, deleted or added; TOTP secrets are never
  listed. The old address `/admin/options` redirects there.
- **Privacy** (`/admin/privacy`): the controller's name, postal address,
  contact e-mail and an optional free text (plain text; blank lines make
  paragraphs, `https://` addresses and e-mail addresses become links) for
  `/privacy`, stored in `hlstats_Options` (`gamewe_privacy_name`,
  `gamewe_privacy_address`, `gamewe_privacy_email`, the text split over
  `gamewe_privacy_text_1` … `_25`; not on the raw options page). The page
  also names pictures from the settings that are on other servers. The
  generated privacy policy is an aid, not legal advice.
- **Servers:** the collector only accepts logs from servers registered here
  (IP address, port, game, RCON password). Each IP address and port exists
  only once: saving a server with the IP and port of another one is refused
  with a link to the existing server, and the form keeps its input and the
  ranking preset by "Add server" (never the RCON password or log secret). The address is stored in the form the
  collector matches log packets by (IPv4 without leading zeros, IPv6
  compressed in lower case, IPv4-mapped IPv6 as IPv4), so `192.000.002.010` and
  `192.0.2.10` are the same server. The RCON password is write-only in
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
  and users. The lists keep their filters (ranking, search, state, page,
  rows) in the address; "Back", saving and deleting on an edit page return
  to the list with the same filters. The player list shows hidden and banned
  players marked and filters them (All, Visible, Hidden, Banned), so they can
  be let back in; the public pages keep leaving them out.
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
  `gamewe reset CODE -mode player-stats|all-stats|all`. The job list also
  shows the scheduled resets (by `schedule`).
- **Hall of fame & scheduled reset** (level 100, on the ranking's overview
  `/admin/rankings/<code>`, needs a collector with the table
  `hlstats_gamewe_hall_of_fame`): resets the ranking every N days, weeks,
  months, quarters or years, in one of the three kinds above. Schedule: "As
  for all rankings" (the default, see below), an own schedule, or "Off" (no
  scheduled reset for this ranking even with one for all). At the end of
  every period the collector stores the best five players in the hall of
  fame and then resets; the podium shows the first three. The periods follow
  the calendar in the collector's time zone: weeks from Monday, months from
  the 1st, quarters from January, April, July and October 1st, years from
  January 1st, unless a start day is set (day of the month 1-28, e.g. every
  15th, also for quarters; weekday; day and month of the year). Every 2
  months is always Jan–Feb, Mar–Apr, ... The time of day is set in the
  collector's config.yaml (`features.scheduled_resets.time`, default 00:00).
  A new or changed schedule starts with the period now running (the collector
  sets its start within a minute), so saving never resets at once; turning
  one on or changing it needs the tick "I understand that the statistics ...
  will be reset". The card shows since when the current period runs and the
  date of the next reset. "Hall of Fame" page: Automatic (shown once the
  ranking has entries, i.e. from the first reset, and hidden again when they
  are deleted or all removed), Always show, or Hide (the entries
  stay). Stored in `hlstats_Options` (`gamewe_reset_schedule_<code>`: the
  schedule, `off`, or missing for the one for all; `gamewe_reset_mode_<code>`,
  `gamewe_hof_<code>`; the collector writes `gamewe_reset_last_<code>`). From
  the console: `gamewe halloffame schedule CODE [EVERY|off|inherit] -mode
  MODE`.
- **Scheduled reset for all rankings** (level 100, at the end of
  `/admin/rankings`): one schedule (with start day and kind of reset) for
  every ranking set to "As for all rankings", e.g. every quarter; the card
  lists those rankings. Changing it starts every following ranking with the
  period now running, none is reset at once. Stored as
  `gamewe_reset_schedule` and `gamewe_reset_mode`; from the console `gamewe
  halloffame schedule -all [EVERY|off] -mode MODE`.
- **Edit the hall of fame** (level 100, `/admin/rankings/<code>/hall-of-fame`,
  "Edit entries" on the card; needs collector migration 16): every stored
  entry per period (place stored, place on the podium, name then and now,
  points, kills, removed / hidden / reserve). "Remove" (asks once more) takes
  one entry out, "Remove whole period" all of a period; both can be brought
  back. The players below move up: with five stored, removing the second puts
  the third on place 2, the fourth on place 3; with fewer entries (or periods
  stored by collector 0.19 with three) the places stay empty. A player hidden
  in the admin is left out the same way. Stars are counted from the podiums.
  Only the column `removed` is written; the admin database user may update
  nothing else in `hlstats_gamewe_hall_of_fame`.
- **Bots** (level 100, on the ranking's overview `/admin/rankings/<code>`):
  three switches per ranking, all on by default. "Bots in the ranking": bots
  are ranked like players (they can be number 1, win awards, have profile
  pages); off, they stay out of the ranking and the awards, their names are
  not linked and their profiles answer 404 (the live view and the server
  pages still show them). Switching also hides or shows the ranking's
  existing bots at once (`hideranking` 0 ↔ 1; banned bots stay hidden).
  "Points for bot kills": off, kills with bots (either side) still count as
  kills, deaths and for the kill-based ranks, but change nobody's points;
  the help page then says so for that ranking. "Bot kills count as kills":
  off, a kill of a bot is stored (events, weapons, maps) but not added to
  the player's kills and headshots, so it raises neither the kill ranking,
  K/D nor the career rank. Stored in `hlstats_Options`
  (`gamewe_rank_bots_<code>`, `gamewe_bot_points_<code>`,
  `gamewe_bot_kills_<code>`, read by the
  collector within a minute; the global "Rank bots" setting of web 0.25 and
  older is gone, collector migration 15 copies its value to every ranking).
  From the console: `gamewe game set CODE -rank-bots=true|false
  -bot-points=true|false -bot-kills=true|false`.
- **Chat** and **IP addresses:** all stored chat messages and connect
  addresses, searchable (IP or its start, Steam ID, name, host name), for
  admins only.
- **Rankings and servers** show their game (Counter-Strike: Source, Counter-
  Strike: Condition Zero, Day of Defeat: Source ...). A server can only be moved into a ranking of the same
  game; rankings without a known game are not checked. The game tag has
  the colour of its engine (GoldSrc, Source, Source 2). The form of a
  Counter-Strike 2 server shows the `logaddress_add_http` line for its game
  port and explains that CS2 has no log secret.

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
in the admin settings (Monitoring → "Token for /-/metrics"; before that
`GAMEWE_METRICS_TOKEN`, which is still read while no token is stored).
Prometheus sends it as `Authorization: Bearer <token>`:

```yaml
scrape_configs:
  - job_name: gamewe-web
    metrics_path: /-/metrics
    authorization: { credentials: "<token>" }
    static_configs: [{ targets: ["stats.example.org"] }]
```
