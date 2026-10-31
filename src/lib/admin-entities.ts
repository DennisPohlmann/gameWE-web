import { GAME_KINDS, RETIRED_GAMES } from "./games";
import { canonicalIp } from "./ip";
import { isLogSecret } from "./log-secret";

// What the admin area can edit. Each entity is one table; the generic list,
// edit and save code in app/admin works from these definitions only, so
// table and column names never come from the request.

export type L = { de: string; en: string };

export type Field = {
  name: string;
  label: L;
  type: "text" | "number" | "decimal" | "flag" | "bool" | "select" | "password" | "secret" | "textarea";
  // The column may be missing in older databases; then the field is left out
  // (see withColumns in admin-data.ts).
  optional?: boolean;
  // flag = enum('0','1') column, bool = tinyint 0/1 column.
  // password = stored as a hash; secret = stored as is but never read back into a page.
  options?: [string, L | string][] | "games" | "clans";
  // select only: choices that stay only while they are the row's value (a
  // retired game): not offered otherwise, and refused when newly chosen.
  keepOnly?: string[];
  inList?: boolean;
  required?: boolean;
  readonly?: boolean; // shown, never written
  virtual?: boolean; // form only, not a column (handled by the entity's own code)
  createOnly?: boolean; // written on create, read-only afterwards
  help?: L;
  max?: number;
  min?: number;
  maxValue?: number;
  pattern?: RegExp;
  // secret only: the value must pass this check (besides max).
  valid?: (s: string) => boolean;
  // text only: the stored form of the value, or null if it is invalid.
  normalize?: (s: string) => string | null;
  // A column set to the current Unix time whenever this field is written
  // (a constant of the entity definition).
  changedAt?: string;
};

export type Entity = {
  key: string;
  table: string;
  pk: string;
  pkIsText?: boolean;
  label: L;
  help?: L;
  fields: Field[];
  order: string;
  search?: string[];
  gameColumn?: string; // filter the list by game
  fixed?: Record<string, string>; // column values always set and filtered on
  join?: string; // extra read-only columns for the list, see players
  joinCols?: string;
  canCreate: boolean;
  canDelete: boolean;
  minLevel?: number;
  // Rows whose key starts with one of these (any case) are never listed,
  // read, created, changed or deleted here, e.g. the TOTP secrets and the
  // TeamSpeak query password in Options.
  hiddenPrefix?: string[];
  // One row of buttons above the list (?status=<value>); `where` is a
  // constant SQL condition on the table alias t, never input.
  statusFilter?: { value: string; label: L; where: string; tone?: "ok" | "warn" | "bad" }[];
  // The list column shown as a coloured state (value -> filter value).
  statusColumn?: string;
};

const yesNo: [string, L][] = [
  ["0", { de: "Nein", en: "No" }],
  ["1", { de: "Ja", en: "Yes" }],
];

const gameField: Field = { name: "game", label: { de: "Rangliste", en: "Ranking" }, type: "select", options: "games", inList: true, required: true };

export const entities: Entity[] = [
  {
    key: "games",
    table: "hlstats_Games",
    pk: "id",
    label: { de: "Ranglisten", en: "Rankings" },
    help: {
      de: "Eine Rangliste ist eine Sammlung von Servern mit einem gemeinsamen Ranking, z. B. „Assault“ mit fünf Assault-Servern oder „GunGame“ mit zwei GunGame-Servern. Lege sie hier an und ordne ihr danach die Server zu. Ranglisten ohne Server erscheinen nicht auf der Startseite und dienen als Vorlagen.",
      en: "A ranking is a set of servers sharing one player ranking, e.g. \"Assault\" with five assault servers or \"GunGame\" with two gungame servers. Create it here, then assign the servers. Rankings without servers are not shown on the start page and serve as templates.",
    },
    fields: [
      {
        name: "realgame",
        label: { de: "Spiel", en: "Game" },
        type: "select",
        optional: true,
        options: [
          ["", { de: "– nicht gesetzt –", en: "– not set –" }],
          ...Object.entries(GAME_KINDS).map(([k, g]): [string, string] => [
            k,
            `${g.name} (${k})${g.retired ? " – nicht mehr unterstützt / no longer supported" : g.limited ? " – eingeschränkt / limited" : ""}`,
          ]),
        ],
        keepOnly: RETIRED_GAMES,
        inList: true,
        help: {
          de: "Das Spiel der Rangliste, z. B. Counter-Strike: Source. Der Collector liest daraus das Logformat, die Webseite zeigt es als Kennzeichen an. Der Rangliste lassen sich nur Server dieses Spiels zuordnen.",
          en: "The ranking's game, e.g. Counter-Strike: Source. The collector reads the log format from it, the website shows it as a tag. Only servers of this game can be assigned to the ranking.",
        },
      },
      {
        name: "template",
        label: { de: "Vorlage (optional)", en: "Template (optional)" },
        type: "select",
        options: "games",
        virtual: true,
        createOnly: true,
        help: {
          de: "Woher Waffen, Aktionen, Teams, Rollen, Awards, Ränge und Ribbons kommen. Leer lassen nimmt die Standardvorlage des Spiels (z. B. css für Counter-Strike: Source). Eine eigene Rangliste desselben Spiels übernimmt deren angepasste Werte; nur Vorlagen des gewählten Spiels sind erlaubt.",
          en: "Where weapons, actions, teams, roles, awards, ranks and ribbons come from. Left empty, the game's standard template is used (e.g. css for Counter-Strike: Source). One of your own rankings of the same game passes on its adjusted values; only templates of the chosen game are allowed.",
        },
      },
      { name: "name", label: { de: "Name", en: "Name" }, type: "text", inList: true, required: true, max: 255 },
      { name: "code", label: { de: "Kürzel", en: "Code" }, type: "text", inList: true, required: true, createOnly: true, max: 10, pattern: /^[a-z0-9_]+$/, help: { de: "Kurz, nur a–z, 0–9 und _, z. B. assault oder gungame. Steht in der URL und lässt sich später nicht ändern.", en: "Short, only a–z, 0–9 and _, e.g. assault or gungame. Used in the URL and cannot be changed later." } },
      { name: "hidden", label: { de: "Ausgeblendet", en: "Hidden" }, type: "flag", options: yesNo, inList: true, help: { de: "Ja: Die Webseite zeigt das Ranking nicht, weder auf der Startseite noch mit eigenen Seiten. Die Daten bleiben erhalten.", en: "Yes: the website does not show the ranking, neither on the start page nor with its own pages. The data is kept." } },
      { name: "display_id", label: { de: "Reihenfolge", en: "Order" }, type: "number", inList: true, help: { de: "Position in Menüs und Listen, kleinere Zahlen stehen weiter vorn.", en: "Position in menus and lists, lower numbers come first." } },
    ],
    order: "display_id, name",
    canCreate: true,
    canDelete: false,
    minLevel: 100,
  },
  {
    key: "servers",
    table: "hlstats_Servers",
    pk: "serverId",
    label: { de: "Server", en: "Servers" },
    help: {
      de: "Der Collector nimmt nur Logs von Servern an, die hier eingetragen sind, und liest die Liste jede Minute neu. Auf dem Gameserver: logaddress_add <Collector-IP>:41337; Counter-Strike 2 (mit -usercon): logaddress_delall_http und logaddress_add_http \"http://<Collector-IP>:41338/<Token>/<Spielport>\" (Token: listen.http.token des Collectors, Spielport wie hier eingetragen).",
      en: "The collector only accepts logs from servers listed here and re-reads the list every minute. On the game server: logaddress_add <collector IP>:41337; Counter-Strike 2 (with -usercon): logaddress_delall_http and logaddress_add_http \"http://<collector IP>:41338/<token>/<game port>\" (token: the collector's listen.http.token, the game port as entered here).",
    },
    fields: [
      {
        name: "name",
        label: { de: "Name", en: "Name" },
        type: "text",
        inList: true,
        required: true,
        max: 255,
        help: {
          de: "Sobald der Server antwortet, übernimmt der Collector seinen Hostnamen (RCON status, sonst A2S_INFO) und überschreibt diesen Wert.",
          en: "Once the server answers, the collector takes its hostname (RCON status, else A2S_INFO) and overwrites this value.",
        },
      },
      { name: "address", label: { de: "IP-Adresse", en: "IP address" }, type: "text", inList: true, required: true, max: 32, normalize: canonicalIp, help: { de: "Eine IP-Adresse, kein Hostname. Jede Kombination aus IP und Port gibt es nur einmal.", en: "An IP address, not a host name. Each IP and port combination exists only once." } },
      { name: "port", label: { de: "Port", en: "Port" }, type: "number", inList: true, required: true, min: 1, maxValue: 65535, help: { de: "Spiel- und RCON-Port des Servers.", en: "Game and RCON port of the server." } },
      { ...gameField, help: { de: "Die Rangliste bestimmt das Spiel: erst unter Ranglisten das Spiel der Rangliste wählen, dann den Server ihr zuordnen. Nur Ranglisten desselben Spiels sind erlaubt. Vorlagen (Ranglisten ohne Server) stehen nicht zur Wahl; den ersten Server bekommt eine neue Rangliste auf ihrer Seite unter Ranglisten („Server hinzufügen“).", en: "The ranking decides the game: first choose the ranking's game under Rankings, then assign the server to it. Only rankings of the same game are allowed. Templates (rankings without servers) are not offered; a new ranking gets its first server on its page under Rankings (“Add server”)." } },
      { name: "rcon_password", label: { de: "RCON-Passwort", en: "RCON password" }, type: "secret", max: 128, help: { de: "Für die Antworten auf !rank, !top10 usw. Leer lassen, um es nicht zu ändern; „Entfernen“ löscht es.", en: "For replies to !rank, !top10 etc. Leave empty to keep it; “Remove” clears it." } },
      {
        name: "log_secret",
        label: { de: "Log-Secret", en: "Log secret" },
        type: "secret",
        optional: true,
        max: 10,
        valid: isLogSecret,
        changedAt: "log_secret_changed",
        help: {
          de: "Optional: sv_logsecret des Gameservers, eine Zahl von 1 bis 2147483647. Ist es gesetzt, nimmt der Collector nur Logpakete mit genau diesem Secret an; trage denselben Wert als sv_logsecret in die server.cfg des Gameservers ein. Ohne Secret werden alle Logpakete des Servers angenommen. Der Collector setzt oder ändert es nie selbst. Leer lassen, um es nicht zu ändern; „Entfernen“ löscht es.",
          en: "Optional: the game server's sv_logsecret, a number from 1 to 2147483647. When it is set, the collector accepts only log packets with exactly this secret; put the same value as sv_logsecret into the game server's server.cfg. Without a secret all log packets of the server are accepted. The collector never sets or changes it itself. Leave empty to keep it; “Remove” clears it.",
        },
      },
      { name: "publicaddress", label: { de: "Öffentliche Adresse", en: "Public address" }, type: "text", max: 255, help: { de: "Wird statt IP:Port angezeigt, z. B. ein Hostname.", en: "Shown instead of IP:port, e.g. a host name." } },
      {
        name: "max_players",
        label: { de: "Slots (max. Spieler)", en: "Slots (max players)" },
        type: "number",
        min: 0,
        maxValue: 255,
        help: {
          de: "Wird angezeigt, solange der Server noch nie online war. Sobald er antwortet, überschreibt der Collector den Wert mit den echten Slots (RCON status, sonst A2S_INFO) und hält ihn aktuell. 0 oder leer: unbekannt.",
          en: "Shown as long as the server has never been online. Once it answers, the collector overwrites the value with the real slots (RCON status, else A2S_INFO) and keeps it current. 0 or empty: unknown.",
        },
      },
      { name: "display_id", label: { de: "Reihenfolge", en: "Order" }, type: "number", inList: true },
    ],
    order: "display_id, serverId",
    search: ["name", "address"],
    canCreate: true,
    canDelete: true,
    minLevel: 100,
  },
  {
    key: "players",
    table: "hlstats_Players",
    pk: "playerId",
    label: { de: "Spieler", en: "Players" },
    help: {
      de: "Der Name kommt aus dem Spiel und wird vom Collector bei jeder Verbindung aktualisiert.",
      en: "The name comes from the game and is updated by the collector on every connect.",
    },
    join: "LEFT JOIN hlstats_Players_Data d ON d.playerId = t.playerId",
    joinCols: "d.lastName AS lastName",
    fields: [
      { name: "lastName", label: { de: "Name", en: "Name" }, type: "text", inList: true, readonly: true },
      { name: "game", label: { de: "Rangliste", en: "Ranking" }, type: "text", inList: true, readonly: true },
      { name: "skill", label: { de: "Punkte", en: "Points" }, type: "number", inList: true },
      {
        name: "hideranking",
        label: { de: "Aus Rangliste ausblenden", en: "Hide from ranking" },
        type: "select",
        options: [
          ["0", { de: "Nein, sichtbar", en: "No, visible" }],
          ["1", { de: "Ja (Admin oder Bot)", en: "Yes (admin or bot)" }],
          ["2", { de: "Ja, gebannt", en: "Yes, banned" }],
          ["3", { de: "Ja, vom Spieler selbst", en: "Yes, by the player" }],
        ],
        inList: true,
      },
      { name: "clan", label: { de: "Clan", en: "Clan" }, type: "select", options: "clans" },
    ],
    order: "t.skill DESC",
    search: ["d.lastName"],
    // Hidden and banned players stay out of every public page (lib/hidden.ts);
    // the admin list shows them, marked, to let them back in.
    statusFilter: [
      { value: "visible", label: { de: "Sichtbar", en: "Visible" }, where: "t.hideranking = 0", tone: "ok" },
      { value: "hidden", label: { de: "Versteckt", en: "Hidden" }, where: "t.hideranking IN (1, 3)", tone: "warn" },
      { value: "banned", label: { de: "Gebannt", en: "Banned" }, where: "t.hideranking = 2", tone: "bad" },
    ],
    statusColumn: "hideranking",
    gameColumn: "game",
    canCreate: false,
    canDelete: false,
  },
  {
    key: "clans",
    table: "hlstats_Clans",
    pk: "clanId",
    label: { de: "Clans", en: "Clans" },
    help: {
      de: "Mitglieder ordnest du unter Spieler zu. Der Collector erkennt Clan-Tags nicht automatisch.",
      en: "Assign members under Players. The collector does not detect clan tags.",
    },
    fields: [
      { name: "tag", label: { de: "Tag", en: "Tag" }, type: "text", inList: true, required: true, max: 128 },
      { name: "name", label: { de: "Name", en: "Name" }, type: "text", inList: true, max: 255 },
      { name: "homepage", label: { de: "Homepage", en: "Homepage" }, type: "text", max: 255 },
      gameField,
    ],
    order: "tag",
    search: ["tag", "name"],
    gameColumn: "game",
    canCreate: true,
    canDelete: true,
  },
  {
    key: "weapons",
    table: "hlstats_Weapons",
    pk: "weaponId",
    label: { de: "Waffen", en: "Weapons" },
    help: {
      de: "Der Faktor multipliziert die Punkte für einen Kill mit dieser Waffe. Neue Waffen legt der Collector beim ersten Kill an.",
      en: "The modifier multiplies the points for a kill with this weapon. The collector creates new weapons on their first kill.",
    },
    fields: [
      { name: "code", label: { de: "Code", en: "Code" }, type: "text", inList: true, required: true, createOnly: true, max: 128 },
      { name: "name", label: { de: "Name", en: "Name" }, type: "text", inList: true, required: true, max: 255 },
      { name: "modifier", label: { de: "Faktor", en: "Modifier" }, type: "decimal", inList: true },
      gameField,
    ],
    order: "code",
    search: ["code", "name"],
    gameColumn: "game",
    canCreate: true,
    canDelete: false,
  },
  {
    key: "actions",
    table: "hlstats_Actions",
    pk: "id",
    label: { de: "Aktionen", en: "Actions" },
    help: {
      de: "Bonuspunkte für Ereignisse wie Bombe gelegt oder Runde gewonnen. Der Code muss dem Trigger im Server-Log entsprechen.",
      en: "Bonus points for events such as bomb planted or round won. The code must match the trigger in the server log.",
    },
    fields: [
      { name: "code", label: { de: "Code", en: "Code" }, type: "text", inList: true, required: true, max: 128 },
      { name: "description", label: { de: "Beschreibung", en: "Description" }, type: "text", inList: true, max: 255 },
      { name: "reward_player", label: { de: "Bonus Spieler", en: "Player reward" }, type: "number", inList: true },
      { name: "reward_team", label: { de: "Bonus Team", en: "Team reward" }, type: "number", inList: true },
      { name: "team", label: { de: "Team", en: "Team" }, type: "text", max: 128 },
      { name: "for_PlayerActions", label: { de: "Spieler-Aktion", en: "Player action" }, type: "flag", options: yesNo },
      { name: "for_PlayerPlayerActions", label: { de: "Spieler-gegen-Spieler-Aktion", en: "Player-vs-player action" }, type: "flag", options: yesNo },
      { name: "for_TeamActions", label: { de: "Team-Aktion", en: "Team action" }, type: "flag", options: yesNo },
      { name: "for_WorldActions", label: { de: "Welt-Aktion", en: "World action" }, type: "flag", options: yesNo },
      gameField,
    ],
    order: "code",
    search: ["code", "description"],
    gameColumn: "game",
    canCreate: true,
    canDelete: true,
  },
  {
    key: "teams",
    table: "hlstats_Teams",
    pk: "teamId",
    label: { de: "Teams", en: "Teams" },
    fields: [
      { name: "code", label: { de: "Code", en: "Code" }, type: "text", inList: true, required: true, createOnly: true, max: 128 },
      { name: "name", label: { de: "Name", en: "Name" }, type: "text", inList: true, required: true, max: 255 },
      { name: "hidden", label: { de: "Ausgeblendet", en: "Hidden" }, type: "flag", options: yesNo, inList: true },
      gameField,
    ],
    order: "code",
    gameColumn: "game",
    canCreate: true,
    canDelete: false,
  },
  {
    key: "roles",
    table: "hlstats_Roles",
    pk: "roleId",
    label: { de: "Rollen", en: "Roles" },
    fields: [
      { name: "code", label: { de: "Code", en: "Code" }, type: "text", inList: true, required: true, createOnly: true, max: 128 },
      { name: "name", label: { de: "Name", en: "Name" }, type: "text", inList: true, required: true, max: 255 },
      { name: "hidden", label: { de: "Ausgeblendet", en: "Hidden" }, type: "flag", options: yesNo, inList: true },
      gameField,
    ],
    order: "code",
    gameColumn: "game",
    canCreate: true,
    canDelete: true,
  },
  {
    key: "awards",
    table: "hlstats_Awards",
    pk: "awardId",
    label: { de: "Awards", en: "Awards" },
    help: {
      de: "Award-Definitionen wie bei gameME. Die Tagesgewinner auf der Webseite werden aus den Tageswerten berechnet; diese Liste ergänzt sie.",
      en: "Award definitions as in gameME. The daily winners on the website are computed from daily totals; this list adds to them.",
    },
    fields: [
      { name: "awardType", label: { de: "Art", en: "Type" }, type: "select", options: [["W", { de: "Waffe", en: "Weapon" }], ["O", { de: "Aktion/Sonstiges", en: "Action/other" }]], inList: true, required: true },
      { name: "code", label: { de: "Code (Waffe/Aktion)", en: "Code (weapon/action)" }, type: "text", inList: true, required: true, max: 128 },
      { name: "name", label: { de: "Name", en: "Name" }, type: "text", inList: true, required: true, max: 255 },
      { name: "verb", label: { de: "Einheit", en: "Verb" }, type: "text", max: 255, help: { de: "z. B. \"Kills mit AK47\"", en: "e.g. \"kills with ak47\"" } },
      gameField,
    ],
    order: "awardType, name",
    search: ["code", "name"],
    gameColumn: "game",
    canCreate: true,
    canDelete: true,
  },
  {
    key: "ranks",
    table: "hlstats_Definition_Ranks_Ribbons",
    pk: "id",
    label: { de: "Ränge", en: "Ranks" },
    help: {
      de: "Ränge nach Anzahl Kills, angezeigt im Spielerprofil.",
      en: "Ranks by number of kills, shown in the player profile.",
    },
    // As HLstatsX:CE stores them (lib/awards.ts reads the same rows).
    fixed: { definition_type: "ranks", restriction_type: "kills" },
    fields: [
      {
        name: "name",
        label: { de: "Name", en: "Name" },
        type: "text",
        inList: true,
        required: true,
        max: 128,
        help: {
          de: "Platzhalter wie {LANG_RANG_PVT} (Private) oder {LANG_RANG_GEN} (General) zeigen den Rang mit passendem Abzeichen; jeder andere Text wird so angezeigt, mit einem Abzeichen aus den Anfangsbuchstaben.",
          en: "Placeholders such as {LANG_RANG_PVT} (Private) or {LANG_RANG_GEN} (General) show the rank with its insignia; any other text is shown as it is, with a badge of its initials.",
        },
      },
      { name: "minimum", label: { de: "Ab Kills", en: "From kills" }, type: "number", inList: true, required: true },
      { name: "game_code", label: { de: "Rangliste", en: "Ranking" }, type: "select", options: "games", inList: true, required: true },
    ],
    order: "game_code, minimum",
    gameColumn: "game_code",
    canCreate: true,
    canDelete: true,
  },
  {
    key: "users",
    table: "hlstats_Users",
    pk: "username",
    pkIsText: true,
    label: { de: "Benutzer", en: "Users" },
    help: {
      de: "Stufe 100 = Admin (alles), 80 = eingeschränkt (keine Spiele, Server und Benutzer). Passwort und TOTP ändert jeder Benutzer nur selbst, unter Mein Konto.",
      en: "Level 100 = admin (everything), 80 = restricted (no games, servers or users). Each user changes their password and TOTP only themselves, under My account.",
    },
    fields: [
      { name: "username", label: { de: "Benutzername", en: "User name" }, type: "text", inList: true, required: true, createOnly: true, max: 128 },
      // Only when the user is created: afterwards each admin changes only
      // their own password, on My account with the current one.
      { name: "password", label: { de: "Passwort", en: "Password" }, type: "password", createOnly: true, help: { de: "Erstes Passwort, mindestens 10 Zeichen. Danach ändert es nur der Benutzer selbst unter Mein Konto.", en: "First password, at least 10 characters. Afterwards only the user changes it, under My account." } },
      { name: "acclevel", label: { de: "Stufe", en: "Level" }, type: "select", options: [["100", "100 Admin"], ["80", "80"]], inList: true, required: true },
    ],
    order: "username",
    canCreate: true,
    canDelete: true,
    minLevel: 100,
  },
];

export function getEntity(key: string): Entity | undefined {
  return entities.find((e) => e.key === key);
}
