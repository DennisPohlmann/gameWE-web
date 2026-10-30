import type { L } from "./admin-entities";
import { FLAG_CODES } from "./flag-codes";
import { LINK_SLOTS } from "./header-links";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "./page-size";
import { LANGUAGES } from "../translations/languages";

// Header links: validation and order live in lib/header-links.ts.
export { homeValue, linkValue } from "./header-links";

// Typed form for the hlstats_Options keys the website and the collector read.
// The collector's keys and defaults are documented in collector/docs/CONFIG.md.

export type Setting = {
  key: string;
  label: L;
  // "link": two fields, name and URL, stored as "Name|URL".
  // "template": a folder from templates/ (lib/templates.ts).
  // "secret": never shown again; an empty field keeps the stored value.
  // "home": the Home tab, "Label|URL" with optional parts; "order": the
  // order of the header tabs (lib/header-links.ts). Both, like "link", are
  // edited in the header links list of the group with `id: "header"`.
  type: "text" | "number" | "bool" | "choice" | "link" | "template" | "secret" | "home" | "order";
  // For "choice": value and label of each option.
  choices?: [string, L][];
  def: string;
  min?: number;
  max?: number;
  help?: L;
  // Shown only while the setting `key` has `value` (e.g. TeamSpeak fields
  // only when TeamSpeak is chosen as voice server).
  show?: { key: string; value: string };
  // Admin level needed to change it (default: every admin). The field is
  // read-only below it and saveSettingsAction refuses a value.
  minLevel?: number;
};

// One page of the settings (/admin/settings/<id>) in one area of the menu.
export type SettingArea = "website" | "services" | "collector";
export type SettingGroup = { id: string; area: SettingArea; title: L; help?: L; items: Setting[] };

const TS = { key: "gamewe_voice_type", value: "teamspeak" };

// Event boxes on the public pages (lib/events-mode.ts).
const EVENT_MODES: [string, L][] = [
  ["live", { de: "Sync: neue Ereignisse laufen live ein", en: "Sync: new events flow in live" }],
  ["static", { de: "Async: nur die letzten beim Laden der Seite", en: "Async: only the latest ones when the page loads" }],
  ["off", { de: "Aus: Bereich nicht zeigen", en: "Off: section not shown" }],
];

// Every country with a flag, by its German name, as "Name (DE)".
function countryChoices(): [string, L][] {
  const name = (lang: string, c: string) => {
    try {
      return new Intl.DisplayNames([lang], { type: "region" }).of(c) ?? c;
    } catch {
      return c;
    }
  };
  return [...FLAG_CODES]
    .filter((c) => /^[a-z]{2}$/.test(c))
    .map((c) => c.toUpperCase())
    .map((c): [string, L] => [c, { de: `${name("de", c)} (${c})`, en: `${name("en", c)} (${c})` }])
    .filter(([c, l]) => l.en !== `${c} (${c})`)
    .sort((a, b) => a[1].de.localeCompare(b[1].de, "de"));
}
const DISCORD = { key: "gamewe_voice_type", value: "discord" };

// Every setting, by its old section; settingGroups below puts them on pages.
const definitions: Omit<SettingGroup, "area">[] = [
  {
    id: "website",
    title: { de: "Webseite", en: "Website" },
    items: [
      { key: "sitename", label: { de: "Seitentitel", en: "Site title" }, type: "text", def: "", help: { de: "Name der Seite, z. B. der Clan-Name.", en: "Name of the site, e.g. the clan name." } },
      {
        key: "gamewe_title_format",
        label: { de: "Browser-Titel", en: "Browser title" },
        type: "text",
        def: "{page} | {site}",
        help: {
          de: "Titel im Browser-Tab. {page} = Seite, {site} = Seitentitel. Beispiel: „Suche | GERMANY RELOADED“. Die Startseite zeigt nur den Seitentitel.",
          en: "Title in the browser tab. {page} = page, {site} = site title. Example: \"Search | GERMANY RELOADED\". The home page shows just the site title.",
        },
      },
      {
        key: "gamewe_title_ranking",
        label: { de: "Browser-Titel in Ranglisten", en: "Browser title in rankings" },
        type: "text",
        def: "{ranking} {page} | {site}",
        help: {
          de: "Wie oben, dazu {ranking} = Name der Rangliste. Beispiel: „GunGame Spieler | GERMANY RELOADED“, die Startseite einer Rangliste „GunGame | GERMANY RELOADED“.",
          en: "As above, plus {ranking} = name of the ranking. Example: \"GunGame Players | GERMANY RELOADED\", a ranking's start page \"GunGame | GERMANY RELOADED\".",
        },
      },
      {
        key: "gamewe_default_lang",
        label: { de: "Standardsprache", en: "Default language" },
        type: "choice",
        choices: LANGUAGES.map((l): [string, L] => [l.code, { de: `${l.name} (${l.code})`, en: `${l.name} (${l.code})` }]),
        def: "de",
        help: {
          de: "Für Besucher ohne gewählte Sprache, wenn ihr Browser keine der Sprachen der Seite wünscht. Umschalten können sie unten auf der Seite.",
          en: "For visitors who picked no language and whose browser asks for none of the site's languages. They can switch at the bottom of the page.",
        },
      },
      { key: "MinActivity", label: { de: "Tage bis 0 % Aktivität", en: "Days until 0 % activity" }, type: "number", def: "28", min: 1, max: 3650 },
      {
        key: "gamewe_page_size",
        label: { de: "Zeilen pro Seite", en: "Rows per page" },
        type: "choice",
        choices: PAGE_SIZES.map((n): [string, L] => [String(n), { de: String(n), en: String(n) }]),
        def: String(DEFAULT_PAGE_SIZE),
        help: {
          de: "Wie viele Zeilen jede Tabelle zuerst zeigt. Besucher können unter der Tabelle eine andere Stufe wählen.",
          en: "How many rows every table shows first. Visitors can pick another step below the table.",
        },
      },
      { key: "gamewe_site_url", label: { de: "Link des Seitennamens", en: "Link of the site name" }, type: "text", def: "", help: { de: "z. B. https://example.org (Navigationsleiste)", en: "e.g. https://example.org (navigation bar)" } },
      { key: "gamewe_sig_brand", label: { de: "Text der Forum-Signatur", en: "Forum signature text" }, type: "text", def: "", help: { de: "Steht unten rechts im Signaturbild. Leer: Seitentitel.", en: "Shown bottom right in the signature image. Empty: site title." } },
      { key: "gamewe_geoip_credit", label: { de: "GeoIP-Quellenangabe", en: "GeoIP credit" }, type: "text", def: "dbip", help: { de: "„dbip“ (DB-IP Lite, Pflicht nach CC BY 4.0), „maxmind“ (GeoLite2) oder leer.", en: "\"dbip\" (DB-IP Lite, required by CC BY 4.0), \"maxmind\" (GeoLite2) or empty." } },
      {
        key: "gamewe_skin",
        label: { de: "Design (Template)", en: "Design (template)" },
        type: "template",
        def: "dark",
        help: {
          de: "Ordner aus templates/ oder /var/lib/gamewe/web/templates; eigene Designs: siehe templates/README.md.",
          en: "Folder from templates/ or /var/lib/gamewe/web/templates; your own designs: see templates/README.md.",
        },
      },
      {
        key: "gamewe_game_skins",
        label: { de: "Spiel-Designs", en: "Game designs" },
        type: "bool",
        def: "0",
        help: {
          de: "Ja: die Seiten eines Spiels nutzen das Template game-<Spiel>, wenn es eins gibt (eigenes Design in /var/lib/gamewe/web/templates, z. B. game-tf; keins ist eingebaut).",
          en: "Yes: a game's pages use the template game-<game> when there is one (your own design in /var/lib/gamewe/web/templates, e.g. game-tf; none is built in).",
        },
      },
      {
        key: "gamewe_header_logo",
        label: { de: "Logo oben links", en: "Logo top left" },
        type: "text",
        def: "",
        help: {
          de: "Pfad oder URL eines Bildes, das das gameWE-Logo in der Kopfleiste ersetzt, z. B. /images/logo.png oder https://example.org/logo.png. Am besten ein PNG mit transparentem Hintergrund; größere Bilder werden auf die Leistenhöhe verkleinert. Ein Pfad mit / gilt ab der Domain. Leer: das gameWE-Logo.",
          en: "Path or URL of a picture that replaces the gameWE logo in the header bar, e.g. /images/logo.png or https://example.org/logo.png. Best a PNG with a transparent background; larger pictures are scaled to the bar's height. A path starting with / is relative to the domain. Empty: the gameWE logo.",
        },
      },
      {
        key: "gamewe_favicon",
        label: { de: "Favicon", en: "Favicon" },
        type: "text",
        def: "",
        help: {
          de: "Pfad oder URL des Symbols im Browser-Tab (PNG, ICO oder SVG, z. B. 32 × 32 oder größer). Ein Pfad mit / gilt ab der Domain. Leer: das gameWE-Symbol.",
          en: "Path or URL of the icon in the browser tab (PNG, ICO or SVG, e.g. 32 × 32 or larger). A path starting with / is relative to the domain. Empty: the gameWE icon.",
        },
      },
      {
        key: "gamewe_apple_icon",
        label: { de: "Icon für Smartphones", en: "Icon for phones" },
        type: "text",
        def: "",
        help: {
          de: "Pfad oder URL eines PNG mit 180 × 180 Pixeln, ohne Transparenz. Erscheint beim Teilen auf dem iPhone und auf dem Homescreen. Leer: das gameWE-Symbol.",
          en: "Path or URL of a PNG of 180 × 180 pixels, not transparent. Shown when sharing on an iPhone and on the home screen. Empty: the gameWE icon.",
        },
      },
      { key: "gamewe_logo_url", label: { de: "Bild unter dem Kopf", en: "Picture below the header" }, type: "text", def: "", help: { de: "Pfad oder URL eines Bildes (z. B. Banner), das mittig unter der Kopfleiste steht. Leer: keins.", en: "Path or URL of a picture (e.g. a banner) shown centred below the header bar. Empty: none." } },
      {
        key: "gamewe_game_events",
        label: { de: "Letzte Ereignisse (Startseite einer Rangliste)", en: "Latest events (ranking start page)" },
        type: "choice",
        def: "live",
        choices: EVENT_MODES,
        help: {
          de: "Gilt auch für die Seite „Events“ einer Rangliste (alle Ereignisse mit Diagramm und Liste). Aus: kein Reiter „Events“, die Seite gibt es nicht.",
          en: "Also applies to a ranking's \"Events\" page (all events with a chart and a list). Off: no \"Events\" tab, the page does not exist.",
        },
      },
      {
        key: "gamewe_player_events",
        label: { de: "Letzte Ereignisse (Spielerseite)", en: "Latest events (player page)" },
        type: "choice",
        def: "live",
        choices: EVENT_MODES,
        help: {
          de: "Wie auf der Startseite einer Rangliste, aber nur Ereignisse dieses Spielers: seine Kills und Tode, Aktionen von ihm und gegen ihn, Teamboni.",
          en: "As on a ranking's start page, but only the events of that player: their kills and deaths, actions by and against them, team bonuses.",
        },
      },
      {
        key: "gamewe_metrics_token",
        label: { de: "Token für /-/metrics (Prometheus)", en: "Token for /-/metrics (Prometheus)" },
        type: "secret",
        def: "",
        help: {
          de: "Mindestens 16 Zeichen, z. B. openssl rand -hex 24. Leer: /-/metrics ist aus. Prometheus schickt es als „Authorization: Bearer <Token>“. Wird nie angezeigt; leer lassen behält es.",
          en: "At least 16 characters, e.g. openssl rand -hex 24. Empty: /-/metrics is off. Prometheus sends it as \"Authorization: Bearer <token>\". Never shown; leave empty to keep it.",
        },
      },
      {
        key: "gamewe_update_check",
        label: { de: "Nach Updates suchen", en: "Check for updates" },
        type: "bool",
        def: "1",
        help: {
          de: "Fragt jede Stunde bei GitHub (ohne Konto) nach dem neuesten Release von Web und Collector und zeigt ein Update in der Übersicht des Admin-Bereichs. Installiert nichts. Nein: keine Anfrage an GitHub.",
          en: "Asks GitHub (without an account) every hour for the latest release of the web and the collector and shows an update on the admin overview. Installs nothing. No: no request to GitHub.",
        },
      },
      { key: "gamewe_chat_public", label: { de: "Chat öffentlich zeigen", en: "Show chat publicly" }, type: "bool", def: "0", help: { de: "Nein: den Chat sehen nur Admins unter Administration → Chat.", en: "No: only admins see the chat, under Administration → Chat." } },
    ],
  },
  {
    id: "maps",
    title: { de: "Spielerkarten", en: "Player maps" },
    help: {
      de: "Weltkarten mit dem Steam-Bild jedes Spielers an seinem GeoIP-Ort. Die Kartenkacheln lädt der Browser des Besuchers direkt beim Anbieter.",
      en: "World maps with each player's Steam picture at their GeoIP location. The visitor's browser loads the map tiles directly from the provider.",
    },
    items: [
      { key: "gamewe_map_live", label: { de: "Karte „Gerade online“ (Spielübersicht)", en: "\"Online now\" map (game overview)" }, type: "bool", def: "1" },
      { key: "gamewe_map_players", label: { de: "Karte über der Rangliste und auf den Clan-Seiten", en: "Map above the ranking and on clan pages" }, type: "bool", def: "1" },
      {
        key: "gamewe_map_style",
        label: { de: "Kartenstil", en: "Map style" },
        type: "choice",
        def: "auto",
        choices: [
          ["auto", { de: "Passend zum Design (OpenStreetMap hell/dunkel)", en: "Matching the design (OpenStreetMap light/dark)" }],
          ["osm", { de: "OpenStreetMap", en: "OpenStreetMap" }],
          ["osm-dark", { de: "OpenStreetMap dunkel", en: "OpenStreetMap dark" }],
        ],
        help: {
          de: "Die Quellenangabe steht unten rechts in der Karte.",
          en: "The credit is shown bottom right in the map.",
        },
      },
    ],
  },
  {
    id: "bans",
    title: { de: "Bans", en: "Bans" },
    help: {
      de: "Die Seite „Bans“ eines Spiels zeigt Spieler der Rangliste mit VAC- oder Spiel-Bans (braucht STEAM_API_KEY) und mit Bans aus SourceBans. Sie erscheint, sobald eins von beiden eingerichtet ist.",
      en: "A game's \"Bans\" page lists ranked players with VAC or game bans (needs STEAM_API_KEY) and with bans from SourceBans. It is shown as soon as one of the two is set up.",
    },
    items: [
      {
        key: "gamewe_sourcebans_url",
        label: { de: "SourceBans-Adresse", en: "SourceBans address" },
        type: "text",
        def: "",
        help: {
          de: "z. B. https://bans.example.org/ – der Collector liest die ganze öffentliche Ban-Liste alle features.sourcebans.interval (Standard 30 Minuten) und speichert die laufenden Bans für die Bans-Seite. Nur öffentliche Adressen (außer mit features.sourcebans.allow_private), keine Weiterleitung.",
          en: "e.g. https://bans.example.org/ – the collector reads the whole public ban list every features.sourcebans.interval (default 30 minutes) and stores the running bans for the bans page. Public addresses only (unless features.sourcebans.allow_private), no redirects.",
        },
      },
    ],
  },
  {
    id: "steam",
    title: { de: "Steam", en: "Steam" },
    help: {
      de: "Avatare, Namen und VAC-Status der Spieler von Steam für Spielerprofile, Spielerkarten und Signaturen.",
      en: "Players' avatars, names and VAC status from Steam for player profiles, player maps and signatures.",
    },
    items: [
      {
        key: "gamewe_steam_profiles",
        label: { de: "Steam-Profile abrufen", en: "Fetch Steam profiles" },
        type: "bool",
        def: "1",
        help: {
          de: "Aus: keine Abfragen bei Steam; Profile zeigen dann Buchstaben statt Avataren und keinen VAC-Status.",
          en: "Off: no requests to Steam; profiles then show letters instead of avatars and no VAC status.",
        },
      },
      {
        key: "gamewe_steam_api_key",
        label: { de: "Steam-Web-API-Key", en: "Steam Web API key" },
        type: "secret",
        def: "",
        minLevel: 100,
        help: {
          de: "Optional, 32 Hex-Zeichen von https://steamcommunity.com/dev/apikey. Damit kommen die Avatare zu je 100 über die Steam-API statt einzeln von steamcommunity.com (das viele Abrufe hintereinander sperrt), und die Bans-Seite zeigt VAC- und Spiel-Bans. Wird nie angezeigt; leer lassen behält ihn. Nur Admins mit Level 100.",
          en: "Optional, 32 hex characters from https://steamcommunity.com/dev/apikey. With it avatars come 100 at a time from the Steam API instead of one by one from steamcommunity.com (which blocks many requests in a row), and the bans page shows VAC and game bans. Never shown; leave empty to keep it. Admins with level 100 only.",
        },
      },
    ],
  },
  {
    id: "seo",
    title: { de: "Suchmaschinen (SEO)", en: "Search engines (SEO)" },
    help: {
      de: "Beschreibung und Bild für Google & Co. und für Link-Vorschauen in Facebook, WhatsApp, Discord usw. Jede Seite bekommt ihren eigenen Titel, eine kanonische Adresse und steht in /sitemap.xml.",
      en: "Description and picture for Google & co. and for link previews in Facebook, WhatsApp, Discord etc. Every page gets its own title and a canonical address and is listed in /sitemap.xml.",
    },
    items: [
      { key: "gamewe_seo_description", label: { de: "Beschreibung", en: "Description" }, type: "text", def: "", help: { de: "Etwa 150 Zeichen. Leer: Standardtext in der Sprache des Besuchers.", en: "About 150 characters. Empty: the default text in the visitor's language." } },
      { key: "gamewe_seo_keywords", label: { de: "Stichwörter", en: "Keywords" }, type: "text", def: "game server statistics, player ranking, stats, awards, counter-strike, gameWE", help: { de: "Durch Komma getrennt.", en: "Separated by commas." } },
      { key: "gamewe_seo_image", label: { de: "Vorschaubild", en: "Preview picture" }, type: "text", def: "", help: { de: "URL eines Bildes, am besten 1200 × 630. Leer: das Logo.", en: "URL of a picture, ideally 1200 × 630. Empty: the logo." } },
      { key: "gamewe_seo_index", label: { de: "Von Suchmaschinen erfassen lassen", en: "Let search engines index the site" }, type: "bool", def: "1", help: { de: "Nein: noindex und robots.txt sperrt alles.", en: "No: noindex, and robots.txt blocks everything." } },
      { key: "gamewe_seo_twitter", label: { de: "X/Twitter-Konto", en: "X/Twitter account" }, type: "text", def: "", help: { de: "z. B. @meinclan (für die Link-Vorschau).", en: "e.g. @myclan (for the link preview)." } },
    ],
  },
  {
    id: "voice",
    title: { de: "Voiceserver", en: "Voice server" },
    help: {
      de: "Kasten oben auf jeder Seite mit dem TeamSpeak- oder Discord-Server der Community. Erst die Art wählen, dann erscheinen die passenden Felder. TeamSpeak: Die Personenzahl liest die Webseite jede Minute über die ServerQuery. Discord: Gezählt wird über das Server-Widget (Servereinstellungen → Widget → Server-Widget aktivieren).",
      en: "Box at the top of every page with the community's TeamSpeak or Discord server. Choose the kind first, then the matching fields appear. TeamSpeak: the website reads the number of people every minute over the ServerQuery. Discord: counted through the server widget (Server settings → Widget → Enable server widget).",
    },
    items: [
      {
        key: "gamewe_voice_type",
        label: { de: "Voiceserver", en: "Voice server" },
        type: "choice",
        def: "none",
        choices: [
          ["none", { de: "Keiner", en: "None" }],
          ["teamspeak", { de: "TeamSpeak", en: "TeamSpeak" }],
          ["discord", { de: "Discord", en: "Discord" }],
        ],
        help: { de: "Nach dem Wechsel speichern; die Felder der anderen Art bleiben gespeichert, werden aber nicht genutzt.", en: "Save after switching; the fields of the other kind stay stored but are not used." },
      },
      { key: "gamewe_ts_host", label: { de: "TeamSpeak-Server (Adresse)", en: "TeamSpeak server (address)" }, type: "text", def: "", help: { de: "z. B. ts.example.org", en: "e.g. ts.example.org" }, show: TS },
      { key: "gamewe_ts_port", label: { de: "TeamSpeak-Port", en: "TeamSpeak port" }, type: "number", def: "9987", min: 1, max: 65535, show: TS },
      { key: "gamewe_ts_query_port", label: { de: "ServerQuery-Port", en: "ServerQuery port" }, type: "number", def: "10011", min: 1, max: 65535, help: { de: "Raw-Query (nicht SSH). Muss vom Webserver aus erreichbar sein.", en: "Raw query (not SSH). Must be reachable from the web server." }, show: TS },
      { key: "gamewe_ts_query_user", label: { de: "ServerQuery-Benutzer", en: "ServerQuery user" }, type: "text", def: "", help: { de: "Leer: als Gast abfragen (geht nur, wenn die Gast-Gruppe serverinfo darf).", en: "Empty: query as guest (works only if the guest group may use serverinfo)." }, show: TS },
      { key: "gamewe_ts_query_password", label: { de: "ServerQuery-Passwort", en: "ServerQuery password" }, type: "secret", def: "", help: { de: "Wird nie angezeigt. Leer lassen, um es zu behalten.", en: "Never shown. Leave empty to keep it." }, show: TS },
      { key: "gamewe_ts_password", label: { de: "TeamSpeak-Serverpasswort", en: "TeamSpeak server password" }, type: "text", def: "", help: { de: "Besucher sehen ein Schloss, wenn eins gesetzt ist; das Passwort selbst nur mit der Einstellung darunter. Leer: „-“.", en: "Visitors see a lock when one is set; the password itself only with the setting below. Empty: \"-\"." }, show: TS },
      {
        key: "gamewe_ts_password_reveal",
        label: { de: "TeamSpeak-Passwort anzeigen erlauben", en: "Allow showing the TeamSpeak password" },
        type: "bool",
        def: "0",
        help: {
          de: "Ja: Ein Klick auf das Schloss im Kasten und auf der TeamSpeak-Seite zeigt das Passwort, die API gibt es aus. Nein (Standard): nur das Schloss, das Passwort kommt nie beim Browser oder in der API an. Die Banner zeigen es nie.",
          en: "Yes: clicking the lock in the box and on the TeamSpeak page shows the password, and the API returns it. No (default): only the lock; the password never reaches the browser or the API. The banners never show it.",
        },
        show: TS,
      },
      { key: "gamewe_ts_name", label: { de: "TeamSpeak-Anzeigename", en: "TeamSpeak display name" }, type: "text", def: "", help: { de: "Leer: Name aus der ServerQuery.", en: "Empty: the name from the ServerQuery." }, show: TS },
      {
        key: "gamewe_ts_display",
        label: { de: "Angezeigte Adresse", en: "Address shown" },
        type: "text",
        def: "",
        help: {
          de: "Statt Adresse:Port, z. B. ein DNS-Name mit SRV-Eintrag (ts.example.org). Höchstens 100 Zeichen. Abgefragt wird weiter die echte Adresse mit den Ports oben. Leer: Adresse:Port.",
          en: "Instead of address:port, e.g. a DNS name with an SRV record (ts.example.org). At most 100 characters. The query still uses the real address and the ports above. Empty: address:port.",
        },
        show: TS,
      },
      {
        key: "gamewe_ts_link",
        label: { de: "Connect-Link", en: "Connect link" },
        type: "text",
        def: "",
        help: {
          de: "Ersetzt den erzeugten Link, z. B. ts3server://ts.example.org?port=9987. Erlaubt: ts3server://, teamspeak:// und https:// mit Hostname. Leer: ts3server:// mit Adresse und Port oben.",
          en: "Replaces the generated link, e.g. ts3server://ts.example.org?port=9987. Allowed: ts3server://, teamspeak:// and https:// with a host name. Empty: ts3server:// with the address and port above.",
        },
        show: TS,
      },
      {
        key: "gamewe_ts_country",
        label: { de: "Flagge des TeamSpeak-Servers", en: "Flag of the TeamSpeak server" },
        type: "choice",
        def: "",
        choices: [
          ["", { de: "Keine Flagge", en: "No flag" }],
          ["auto", { de: "Automatisch", en: "Automatic" }],
          ...countryChoices(),
        ],
        help: {
          de: "Vor dem Namen im Kasten und auf der Detailseite. Keine Flagge (Standard): weder Flagge noch Platzhalter. Automatisch: das Land eines Spielservers mit derselben IP, sonst eine neutrale Flagge.",
          en: "Before the name in the box and on the detail page. No flag (default): neither a flag nor a placeholder. Automatic: the country of a game server on the same IP, else a neutral flag.",
        },
        show: TS,
      },
      {
        key: "gamewe_ts_show_clients",
        label: { de: "Namen der Personen online zeigen", en: "Show the names of the people online" },
        type: "bool",
        def: "1",
        help: {
          de: "Auf der Detailseite des TeamSpeak-Servers (Klick auf den Namen im Kasten). Nein: nur die Zahl je Channel. Die Namen sind personenbezogene Daten, gehört in die Datenschutzerklärung.",
          en: "On the TeamSpeak server's detail page (click its name in the box). No: just the number per channel. The names are personal data; mention them in your privacy policy.",
        },
        show: TS,
      },
      { key: "gamewe_discord_invite", label: { de: "Discord-Einladung", en: "Discord invite" }, type: "text", def: "", help: { de: "z. B. https://discord.gg/abc123", en: "e.g. https://discord.gg/abc123" }, show: DISCORD },
      { key: "gamewe_discord_guild", label: { de: "Discord-Server-ID (für die Online-Zahl)", en: "Discord server ID (for the online count)" }, type: "text", def: "", help: { de: "Rechtsklick auf den Server → Server-ID kopieren (Entwicklermodus). Leer: nur der Link.", en: "Right-click the server → Copy Server ID (developer mode). Empty: link only." }, show: DISCORD },
    ],
  },
  {
    id: "header",
    title: { de: "Links im Kopf", en: "Header links" },
    items: [
      { key: "gamewe_header_order", label: { de: "Reihenfolge der Links", en: "Order of the links" }, type: "order", def: "" },
      { key: "gamewe_header_home", label: { de: "Startseite", en: "Home" }, type: "home", def: "" },
      ...Array.from({ length: LINK_SLOTS }, (_, i) => ({
        key: `gamewe_link_${i + 1}`,
        label: { de: `Eigener Link ${i + 1}`, en: `Own link ${i + 1}` },
        type: "link" as const,
        def: "",
      })),
    ],
  },
  {
    id: "points",
    title: { de: "Punkte (Collector)", en: "Points (collector)" },
    help: {
      de: "Der Collector übernimmt Änderungen innerhalb einer Minute. Bereits vergebene Punkte bleiben unverändert.",
      en: "The collector picks up changes within a minute. Points already awarded stay as they are.",
    },
    items: [
      { key: "gamewe_start_skill", label: { de: "Startpunkte neuer Spieler", en: "Points of a new player" }, type: "number", def: "1000", min: 0, max: 100000 },
      { key: "gamewe_kill_points", label: { de: "Punkte pro Kill (Basis)", en: "Points per kill (base)" }, type: "number", def: "5", min: 1, max: 1000, help: { de: "Skaliert mit Opfer-/Killer-Punkten und dem Waffenfaktor.", en: "Scaled by victim/killer points and the weapon modifier." } },
      { key: "gamewe_headshot_bonus", label: { de: "Headshot-Bonus", en: "Headshot bonus" }, type: "number", def: "0", min: 0, max: 1000 },
      { key: "gamewe_suicide_penalty", label: { de: "Abzug pro Selbstmord", en: "Penalty per suicide" }, type: "number", def: "5", min: 0, max: 1000 },
      { key: "gamewe_teamkill_penalty", label: { de: "Abzug pro Teamkill", en: "Penalty per team kill" }, type: "number", def: "10", min: 0, max: 1000 },
      { key: "gamewe_win_triggers", label: { de: "Trigger für Rundensieg", en: "Round win triggers" }, type: "text", def: "CTs_Win,Terrorists_Win,Target_Bombed,Target_Saved,Bomb_Defused,All_Hostages_Rescued,Hostages_Not_Rescued,VIP_Escaped,VIP_Assassinated,VIP_Not_Escaped,Round_Win", help: { de: "Kommagetrennt. Der Bonus pro Trigger steht unter Aktionen (Bonus Team).", en: "Comma separated. The bonus per trigger is set under Actions (team reward)." } },
    ],
  },
  {
    id: "collector",
    title: { de: "Collector", en: "Collector" },
    items: [
      { key: "gamewe_server_load", label: { de: "Server-Auslastung aufzeichnen", en: "Record server load" }, type: "bool", def: "1", help: { de: "Alle 10 Minuten ein Eintrag je Server, für die Grafik auf der Serverseite.", en: "One row per server every 10 minutes, for the graph on the server page." } },
      { key: "gamewe_store_chat", label: { de: "Chat speichern", en: "Store chat" }, type: "bool", def: "1", help: { de: "Personenbezogene Daten, gehört in die Datenschutzerklärung. Ob Besucher den Chat sehen, steht unter Webseite.", en: "Personal data; mention it in your privacy policy. Whether visitors see the chat is set under Website." } },
      { key: "gamewe_store_player_ip", label: { de: "Spieler-IPs speichern", en: "Store player IPs" }, type: "bool", def: "1", help: { de: "Personenbezogene Daten, gehört in die Datenschutzerklärung. Nur Admins sehen sie.", en: "Personal data; mention it in your privacy policy. Only admins see them." } },
      { key: "gamewe_commands", label: { de: "Befehle im Spiel beantworten (!rank, !top10 …)", en: "Answer in-game commands (!rank, !top10 …)" }, type: "bool", def: "1" },
      { key: "gamewe_menu_time", label: { de: "Anzeigedauer !top10-Menü (s)", en: "!top10 menu time (s)" }, type: "number", def: "15", min: 1, max: 300 },
      { key: "gamewe_rcon_timeout", label: { de: "RCON-Timeout (s)", en: "RCON timeout (s)" }, type: "number", def: "5", min: 1, max: 60 },
      {
        key: "gamewe_command_display",
        label: { de: "Antwort auf !rank und Co.", en: "Reply to !rank etc." },
        type: "choice",
        def: "panel",
        choices: [
          ["panel", { de: "Panel links", en: "Panel on the left" }],
          ["chat", { de: "Chat", en: "Chat" }],
          ["both", { de: "Beides", en: "Both" }],
        ],
      },
      {
        key: "gamewe_command_prefix",
        label: { de: "Präfix der Plugin-Serverbefehle", en: "Prefix of the plugin server commands" },
        type: "choice",
        def: "gamewe",
        choices: [
          ["gamewe", { de: "gamewe", en: "gamewe" }],
          ["gameme", { de: "gameme (Plugins für gameME)", en: "gameme (plugins made for gameME)" }],
        ],
      },
      { key: "gamewe_raw_messages", label: { de: "Antworten als Raw-Messages", en: "Replies as raw messages" }, type: "bool", def: "0", help: { de: "An ein Nachrichten-Plugin statt als Chattext.", en: "To a message plugin instead of chat text." } },
      { key: "gamewe_store_locations", label: { de: "Kill- und Todespositionen speichern (Heatmap)", en: "Store kill and death positions (heatmap)" }, type: "bool", def: "1", help: { de: "Die Plugin-Cvar gamewe_log_locations muss dafür 1 sein.", en: "The plugin cvar gamewe_log_locations must be 1 for this." } },
      { key: "gamewe_idle_timeout", label: { de: "Besuch endet nach (s ohne Logzeile)", en: "A visit ends after (s without a log line)" }, type: "number", def: "300", min: 0, max: 86400, help: { de: "Für Bots höchstens 3 Minuten; 0 = nie.", en: "At most 3 minutes for bots; 0 = never." } },
      { key: "gamewe_log_lines", label: { de: "Jede Logzeile ins Journal schreiben", en: "Write every log line to the journal" }, type: "bool", def: "1" },
      {
        key: "gamewe_player_reset",
        label: { de: "Spieler dürfen ihre Stats zurücksetzen (!gamewe_reset)", en: "Players may reset their stats (!gamewe_reset)" },
        type: "bool",
        def: "0",
        help: {
          de: "Bestätigt mit !gamewe_reset 1 innerhalb von 30 Sekunden; nie für gebannte oder vom Admin versteckte Spieler. Nur einschalten, wenn die Server ihre Logs mit sv_logsecret schicken: ein gefälschtes Logpaket könnte sonst die Stats jedes Spielers löschen.",
          en: "Confirmed with !gamewe_reset 1 within 30 seconds; never for banned players or players hidden by an admin. Turn it on only when the servers send their logs with sv_logsecret: otherwise a faked log packet could reset any player's stats.",
        },
      },
      { key: "gamewe_player_reset_cooldown", label: { de: "Wartezeit bis zum nächsten Zurücksetzen (h)", en: "Wait before the next reset (h)" }, type: "number", def: "24", min: 0, max: 87600, help: { de: "0 = keine Wartezeit.", en: "0 = no wait." } },
      {
        key: "gamewe_console_events",
        label: { de: "Punkte jedes Kills in der Konsole zeigen", en: "Show the points of every kill in the console" },
        type: "bool",
        def: "0",
        help: {
          de: "Killer und Opfer, bei Aktionen der Spieler, bekommen die Punkte in die Konsole; Spieler schalten es mit !gamewe_display 0 ab. Ein RCON-Befehl pro Spieler und Ereignis.",
          en: "Killer and victim, for actions the player, get the points in the console; players turn it off with !gamewe_display 0. One RCON command per player and event.",
        },
      },
      {
        key: "gamewe_global_chat",
        label: { de: "Aktionen mit Punkten im Chat ansagen", en: "Announce actions with points in the chat" },
        type: "bool",
        def: "0",
        help: {
          de: "Spieler- und Spieler-gegen-Spieler-Aktionen mit Punkten und Teamsiege; Spieler schalten es mit !gamewe_chat 0 ab. Ein RCON-Befehl pro Ereignis und Sprache.",
          en: "Player and player-vs-player actions with points and team wins; players turn it off with !gamewe_chat 0. One RCON command per event and language.",
        },
      },
    ],
  },
];

const byKey = new Map(definitions.flatMap((g) => g.items).map((s) => [s.key, s]));
const helpOf = (id: string) => definitions.find((g) => g.id === id)?.help;
const pick = (...keys: string[]) =>
  keys.map((k) => {
    const s = byKey.get(k);
    if (!s) throw new Error(`setting ${k} is not defined`);
    return s;
  });

// The settings pages of the admin menu, in menu order. Every setting is on
// exactly one page (tests/admin-settings.test.ts).
export const settingGroups: SettingGroup[] = [
  {
    id: "general",
    area: "website",
    title: { de: "Allgemein", en: "General" },
    help: { de: "Name, Titel und Grundwerte der Webseite.", en: "Name, titles and basic values of the website." },
    items: pick("sitename", "gamewe_default_lang", "gamewe_title_format", "gamewe_title_ranking", "gamewe_site_url", "gamewe_page_size", "MinActivity", "gamewe_chat_public", "gamewe_geoip_credit"),
  },
  {
    id: "design",
    area: "website",
    title: { de: "Design & Logo", en: "Design & logo" },
    help: {
      de: "Aussehen der öffentlichen Seiten. Der Admin-Bereich hat sein eigenes Design und ändert sich hier nicht mit.",
      en: "Look of the public pages. The admin area has its own design and does not change with it.",
    },
    items: pick("gamewe_skin", "gamewe_game_skins", "gamewe_header_logo", "gamewe_favicon", "gamewe_apple_icon", "gamewe_logo_url", "gamewe_sig_brand"),
  },
  {
    id: "header",
    area: "website",
    title: { de: "Kopfzeile & Links", en: "Header & links" },
    items: definitions.find((g) => g.id === "header")!.items,
  },
  {
    id: "maps",
    area: "website",
    title: { de: "Karten & Ereignisse", en: "Maps & events" },
    help: helpOf("maps"),
    items: pick("gamewe_map_live", "gamewe_map_players", "gamewe_map_style", "gamewe_game_events", "gamewe_player_events"),
  },
  { id: "seo", area: "website", title: { de: "Suchmaschinen", en: "Search engines" }, help: helpOf("seo"), items: definitions.find((g) => g.id === "seo")!.items },
  { id: "voice", area: "services", title: { de: "Voiceserver", en: "Voice server" }, help: helpOf("voice"), items: definitions.find((g) => g.id === "voice")!.items },
  { id: "bans", area: "services", title: { de: "SourceBans", en: "SourceBans" }, help: helpOf("bans"), items: pick("gamewe_sourcebans_url") },
  { id: "steam", area: "services", title: { de: "Steam", en: "Steam" }, help: helpOf("steam"), items: definitions.find((g) => g.id === "steam")!.items },
  {
    id: "monitoring",
    area: "services",
    title: { de: "Monitoring", en: "Monitoring" },
    help: {
      de: "Kennzahlen der Webseite für Prometheus unter /-/metrics und die Suche nach Updates.",
      en: "Metrics of the website for Prometheus under /-/metrics and the check for updates.",
    },
    items: pick("gamewe_metrics_token", "gamewe_update_check"),
  },
  { id: "points", area: "collector", title: { de: "Punkte", en: "Points" }, help: helpOf("points"), items: definitions.find((g) => g.id === "points")!.items },
  {
    id: "capture",
    area: "collector",
    title: { de: "Erfassung & Datenschutz", en: "Recording & privacy" },
    help: {
      de: "Was der Collector speichert. Der Collector übernimmt Änderungen innerhalb einer Minute.",
      en: "What the collector stores. The collector picks up changes within a minute.",
    },
    items: pick("gamewe_server_load", "gamewe_store_chat", "gamewe_store_player_ip", "gamewe_store_locations", "gamewe_idle_timeout", "gamewe_log_lines"),
  },
  {
    id: "commands",
    area: "collector",
    title: { de: "Befehle im Spiel", en: "In-game commands" },
    help: {
      de: "Antworten des Collectors auf !rank, !top10 und Co. über RCON.",
      en: "The collector's replies to !rank, !top10 etc. over RCON.",
    },
    items: pick(
      "gamewe_commands",
      "gamewe_menu_time",
      "gamewe_rcon_timeout",
      "gamewe_command_display",
      "gamewe_command_prefix",
      "gamewe_raw_messages",
      "gamewe_console_events",
      "gamewe_global_chat",
      "gamewe_player_reset",
      "gamewe_player_reset_cooldown",
    ),
  },
];

// The page with the raw hlstats_Options rows (no group of its own).
export const RAW_GROUP = "raw";

export const allSettings = settingGroups.flatMap((g) => g.items);
// Every defined setting, for the tests.
export const definedSettings = definitions.flatMap((g) => g.items);

// hlstats_Options rows that are never listed or written as raw values:
// TOTP secrets and API tokens of the admin users, the secrets of the form
// above and the privacy page's keys (their own page, /admin/privacy; the address and the
// text hold line breaks a raw value may not have).
export const HIDDEN_OPTION_PREFIXES = ["gamewe_totp", "gamewe_apitoken", "gamewe_ts_query_password", "gamewe_metrics_token", "gamewe_steam_api_key", "gamewe_privacy_"];
// Written by the collector, shown read-only.
export const READONLY_OPTIONS = ["gamewe_heartbeat", "gamewe_collector_version", "gamewe_collector_runtime"];

// Meaning of known keys that have no field above (raw list of the settings page).
export const RAW_OPTION_HELP: Record<string, L> = {
  gamewe_heartbeat: {
    de: "Schreibt der Collector jede Minute (Unix-Zeit seiner letzten Runde); keine Einstellung.",
    en: "Written by the collector every minute (Unix time of its last poll); not a setting.",
  },
  gamewe_collector_version: {
    de: "Schreibt der Collector beim Start (seine Version); die Übersicht vergleicht sie mit dem neuesten Release. Keine Einstellung.",
    en: "Written by the collector at start (its version); the overview compares it with the latest release. Not a setting.",
  },
  gamewe_collector_runtime: {
    de: "Schreibt der Collector beim Start: docker oder container, wenn er in einem läuft, sonst leer. Das Admin-Menü zeigt es hinter seiner Version. Keine Einstellung.",
    en: "Written by the collector at start: docker or container when it runs in one, else empty. The admin menu shows it after its version. Not a setting.",
  },
  gamewe_ignore_bots: {
    de: "Veraltet: Die Bot-Einstellungen stehen jetzt pro Ranking (Rankings → Ranking → Bots). Ein Collector-Update (Migration 15) übernimmt den Wert und löscht den Schlüssel.",
    en: "Obsolete: the bot settings are per ranking now (Rankings → ranking → Bots). A collector update (migration 15) takes over the value and deletes the key.",
  },
  gamewe_rank_bots: {
    de: "Veraltet: Die Bot-Einstellungen stehen jetzt pro Ranking (Rankings → Ranking → Bots). Ein Collector-Update (Migration 15) übernimmt den Wert in jedes Ranking und löscht den Schlüssel.",
    en: "Obsolete: the bot settings are per ranking now (Rankings → ranking → Bots). A collector update (migration 15) copies the value to every ranking and deletes the key.",
  },
  gamewe_daily_awards: {
    de: "Veraltet, ersetzt durch features.daily_awards in der config.yaml. Wirkt nicht mehr; ein Collector-Update löscht den Schlüssel.",
    en: "Obsolete, replaced by features.daily_awards in config.yaml. Has no effect; a collector update deletes the key.",
  },
  gamewe_default_game: {
    de: "Veraltet, die Webseite wertet ihn nicht aus. Ein Collector-Update löscht den Schlüssel.",
    en: "Obsolete, the website does not use it. A collector update deletes the key.",
  },
  gamewe_geoip_db: {
    de: "Veraltet: Pfad einer .mmdb auf dem Collector-Rechner. Gilt nur, wenn die config.yaml kein geoip.path hat; besser dort eintragen und die Zeile löschen.",
    en: "Obsolete: path of an .mmdb on the collector's machine. Used only when config.yaml has no geoip.path; better set it there and delete the row.",
  },
  contact: {
    de: "Aus HLstatsX:CE, die Webseite wertet ihn nicht aus. Leer löscht ein Collector-Update den Schlüssel.",
    en: "From HLstatsX:CE, the website does not use it. When empty, a collector update deletes the key.",
  },
  siteurl: {
    de: "Aus HLstatsX:CE, die Webseite wertet ihn nicht aus (Link des Seitennamens: unter Allgemein). Leer löscht ein Collector-Update den Schlüssel.",
    en: "From HLstatsX:CE, the website does not use it (site name link: under General). When empty, a collector update deletes the key.",
  },
};

// Meaning of keys per ranking (<prefix><game>) without a field here.
export const RAW_PREFIX_HELP: [string, L][] = [
  [
    "gamewe_rank_bots_",
    {
      de: "Bots dieses Rankings ranken (1) oder ausblenden (0). Einstellbar auf der Ranking-Seite unter „Bots“.",
      en: "Rank (1) or hide (0) the bots of this ranking. Set on the ranking's page under \"Bots\".",
    },
  ],
  [
    "gamewe_bot_points_",
    {
      de: "Punkte für Kills mit Bots in diesem Ranking (1) oder keine (0). Einstellbar auf der Ranking-Seite unter „Bots“.",
      en: "Points for kills with bots in this ranking (1) or none (0). Set on the ranking's page under \"Bots\".",
    },
  ],
  [
    "gamewe_bot_kills_",
    {
      de: "Kills an Bots zählen in diesem Ranking für den Karriere-Rang (1) oder nicht (0). Einstellbar auf der Ranking-Seite unter „Bots“.",
      en: "Kills of bots count for the career rank in this ranking (1) or not (0). Set on the ranking's page under \"Bots\".",
    },
  ],
  [
    "gamewe_bot_stats_",
    {
      de: "Kills mit Bots zählen in diesem Ranking in der Statistik (1) oder nicht (0, Standard): Kills, Tode, Headshots, K/D. Einstellbar auf der Ranking-Seite unter „Bots“.",
      en: "Kills with bots count in the stats of this ranking (1) or not (0, default): kills, deaths, headshots, K/D. Set on the ranking's page under \"Bots\".",
    },
  ],
];

export function rawOptionHelp(key: string, lang: "de" | "en"): string | undefined {
  return (RAW_OPTION_HELP[key] ?? RAW_PREFIX_HELP.find(([p]) => key.startsWith(p))?.[1])?.[lang];
}

const settingKeys = new Set(allSettings.map((s) => s.key.toLowerCase()));

export function hiddenOption(key: string): boolean {
  const k = key.toLowerCase();
  return HIDDEN_OPTION_PREFIXES.some((p) => k.startsWith(p));
}

// A key that may be created as a raw value: well-formed, not secret, no
// field of its own and not written by the collector.
export function rawKeyAllowed(key: string): boolean {
  return /^[A-Za-z0-9_.-]{1,128}$/.test(key) && !hiddenOption(key) && !settingKeys.has(key.toLowerCase()) && !READONLY_OPTIONS.includes(key);
}

