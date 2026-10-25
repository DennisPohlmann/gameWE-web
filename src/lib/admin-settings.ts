import type { L } from "./admin-entities";
import { FLAG_CODES } from "./flag-codes";
import { LINK_SLOTS } from "./header-links";

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
  type: "text" | "number" | "bool" | "game" | "choice" | "link" | "template" | "secret" | "home" | "order";
  // For "choice": value and label of each option.
  choices?: [string, L][];
  def: string;
  min?: number;
  max?: number;
  help?: L;
  // Shown only while the setting `key` has `value` (e.g. TeamSpeak fields
  // only when TeamSpeak is chosen as voice server).
  show?: { key: string; value: string };
  // Old keys the website does not need: written only when filled in or
  // already stored, so saving the page creates no empty rows.
  optional?: boolean;
};

// `id` is the anchor of the group's section (the save buttons under each
// section come back to it).
export type SettingGroup = { id: string; title: L; help?: L; items: Setting[] };

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

export const settingGroups: SettingGroup[] = [
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
      { key: "MinActivity", label: { de: "Tage bis 0 % Aktivität", en: "Days until 0 % activity" }, type: "number", def: "28", min: 1, max: 3650 },
      { key: "gamewe_page_size", label: { de: "Zeilen pro Seite", en: "Rows per page" }, type: "number", def: "50", min: 10, max: 500 },
      { key: "gamewe_site_url", label: { de: "Link des Seitennamens", en: "Link of the site name" }, type: "text", def: "", help: { de: "z. B. https://example.org (Navigationsleiste)", en: "e.g. https://example.org (navigation bar)" } },
      { key: "gamewe_sig_brand", label: { de: "Text der Forum-Signatur", en: "Forum signature text" }, type: "text", def: "", help: { de: "Steht unten rechts im Signaturbild. Leer: Seitentitel.", en: "Shown bottom right in the signature image. Empty: site title." } },
      { key: "gamewe_geoip_credit", label: { de: "GeoIP-Quellenangabe", en: "GeoIP credit" }, type: "text", def: "dbip", help: { de: "„dbip“ (DB-IP Lite, Pflicht nach CC BY 4.0), „maxmind“ (GeoLite2) oder leer.", en: "\"dbip\" (DB-IP Lite, required by CC BY 4.0), \"maxmind\" (GeoLite2) or empty." } },
      {
        key: "gamewe_skin",
        label: { de: "Design (Template)", en: "Design (template)" },
        type: "template",
        def: "dark",
        help: {
          de: "Ordner aus templates/ oder TEMPLATES_DIR; eigene Designs: siehe templates/README.md.",
          en: "Folder from templates/ or TEMPLATES_DIR; your own designs: see templates/README.md.",
        },
      },
      {
        key: "gamewe_game_skins",
        label: { de: "Spiel-Designs", en: "Game designs" },
        type: "bool",
        def: "0",
        help: {
          de: "Ja: die Seiten eines Spiels nutzen das Template game-<Spiel>, wenn es eins gibt (z. B. game-tf).",
          en: "Yes: a game's pages use the template game-<game> when there is one (e.g. game-tf).",
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
      { key: "gamewe_map_players", label: { de: "Karte über der Rangliste", en: "Map above the ranking" }, type: "bool", def: "1" },
      {
        key: "gamewe_map_style",
        label: { de: "Kartenstil", en: "Map style" },
        type: "choice",
        def: "auto",
        choices: [
          ["auto", { de: "Passend zum Design (OpenStreetMap hell/dunkel)", en: "Matching the design (OpenStreetMap light/dark)" }],
          ["osm", { de: "OpenStreetMap", en: "OpenStreetMap" }],
          ["osm-dark", { de: "OpenStreetMap dunkel", en: "OpenStreetMap dark" }],
          ["hot", { de: "OpenStreetMap Humanitarian", en: "OpenStreetMap Humanitarian" }],
          ["topo", { de: "OpenTopoMap (Gelände)", en: "OpenTopoMap (terrain)" }],
          ["carto-light", { de: "CARTO Positron (hell)", en: "CARTO Positron (light)" }],
          ["carto-voyager", { de: "CARTO Voyager", en: "CARTO Voyager" }],
          ["carto-dark", { de: "CARTO Dark Matter (dunkel)", en: "CARTO Dark Matter (dark)" }],
        ],
        help: {
          de: "Die Quellenangabe steht unten rechts in der Karte. CARTO ist nur für nicht-kommerzielle Seiten bis 75.000 Kartenaufrufe im Monat frei.",
          en: "The credit is shown bottom right in the map. CARTO is free only for non-commercial sites up to 75,000 map views a month.",
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
          de: "z. B. https://bans.example.org/ – die öffentliche Ban-Liste wird alle 30 Minuten gelesen (bis 100 Seiten). Nur öffentliche Adressen, keine Weiterleitung.",
          en: "e.g. https://bans.example.org/ – the public ban list is read every 30 minutes (up to 100 pages). Public addresses only, no redirects.",
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
      { key: "gamewe_ts_password", label: { de: "TeamSpeak-Serverpasswort (öffentlich)", en: "TeamSpeak server password (public)" }, type: "text", def: "", help: { de: "Wird im Kasten für Besucher angezeigt. Leer: „-“.", en: "Shown to visitors in the box. Empty: \"-\"." }, show: TS },
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
      { key: "gamewe_rank_bots", label: { de: "Bots ranken (in Ranglisten und Awards)", en: "Rank bots (in rankings and awards)" }, type: "bool", def: "0", help: { de: "Bots werden immer erfasst und auf den Serverseiten mit ihren Stats gezeigt. Nein: sie erscheinen nicht in Ranglisten und Awards, ihre Namen sind nicht verlinkt und ihre Profilseiten antworten 404. Gilt für neu erfasste Bots; bestehende sind einzeln unter Spieler änderbar.", en: "Bots are always recorded and shown with their stats on the server pages. No: they stay out of rankings and awards, their names are not linked and their profile pages answer 404. Applies to newly recorded bots; existing ones can be changed under Players." } },
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
    ],
  },
  {
    id: "older",
    title: { de: "Ältere Optionen", en: "Older options" },
    help: {
      de: "Schlüssel aus HLstatsX:CE und älteren gameWE-Versionen. Die Webseite braucht sie nicht; sie bleiben für eigene Erweiterungen und ältere Collector-Installationen einstellbar. Leere Felder legen keinen Eintrag an.",
      en: "Keys from HLstatsX:CE and older gameWE versions. The website does not need them; they stay settable for own extensions and older collector installations. Empty fields create no row.",
    },
    items: [
      { key: "contact", label: { de: "Kontaktangabe (E-Mail oder URL)", en: "Contact (e-mail or URL)" }, type: "text", def: "", optional: true, help: { de: "Aus HLstatsX:CE. Text oder leer.", en: "From HLstatsX:CE. Text or empty." } },
      {
        key: "siteurl",
        label: { de: "Basis-URL der Seite (HLstatsX)", en: "Base URL of the site (HLstatsX)" },
        type: "text",
        def: "",
        optional: true,
        help: { de: "URL oder leer. Für den Link des Seitennamens gilt „Link des Seitennamens“ unter Webseite.", en: "URL or empty. The site name link is \"Link of the site name\" under Website." },
      },
      {
        key: "gamewe_default_game",
        label: { de: "Spiel, das zuerst gezeigt wird (alt)", en: "Game shown first (old)" },
        type: "game",
        def: "",
        optional: true,
        help: { de: "Aus älteren Versionen; die aktuelle Webseite wertet ihn nicht aus.", en: "From older versions; the current website does not use it." },
      },
      {
        key: "gamewe_geoip_db",
        label: { de: "GeoIP-Datenbank (veraltet)", en: "GeoIP database (obsolete)" },
        type: "text",
        def: "",
        optional: true,
        help: {
          de: "Pfad einer .mmdb auf dem Collector-Rechner. Gilt nur, wenn die config.yaml des Collectors kein geoip.path hat und der Wert nicht der alte Standard /var/lib/gamewe/GeoLite2-City.mmdb ist.",
          en: "Path of an .mmdb on the collector's machine. Used only when the collector's config.yaml has no geoip.path and the value is not the old default /var/lib/gamewe/GeoLite2-City.mmdb.",
        },
      },
    ],
  },
];

export const allSettings = settingGroups.flatMap((g) => g.items);

// hlstats_Options rows that are never listed or written as raw values:
// TOTP secrets of the admin users and the secrets of the form above.
export const HIDDEN_OPTION_PREFIXES = ["gamewe_totp", "gamewe_ts_query_password", "gamewe_metrics_token"];
// Written by the collector, shown read-only.
export const READONLY_OPTIONS = ["gamewe_heartbeat"];

// Meaning of known keys that have no field above (raw list of the settings page).
export const RAW_OPTION_HELP: Record<string, L> = {
  gamewe_heartbeat: {
    de: "Schreibt der Collector jede Minute (Unix-Zeit seiner letzten Runde); keine Einstellung.",
    en: "Written by the collector every minute (Unix time of its last poll); not a setting.",
  },
  gamewe_ignore_bots: {
    de: "Veraltet, ersetzt durch „Bots ranken“ unter Collector. Ein Collector-Update löscht den Schlüssel.",
    en: "Obsolete, replaced by \"Rank bots\" under Collector. A collector update deletes the key.",
  },
  gamewe_daily_awards: {
    de: "Veraltet, ersetzt durch features.daily_awards in der config.yaml. Ein Collector-Update löscht den Schlüssel.",
    en: "Obsolete, replaced by features.daily_awards in config.yaml. A collector update deletes the key.",
  },
};

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

