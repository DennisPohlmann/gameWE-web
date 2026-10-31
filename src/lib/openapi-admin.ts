import { entities, type Entity, type Field } from "./admin-entities.ts";
import { RAW_GROUP, settingGroups, type Setting } from "./admin-settings.ts";
import { MAX_TOKENS_PER_USER, NAME_MAX } from "./api-token-core.ts";
import { RESET_MODES } from "./reset-modes.ts";

// The admin API (/api/v1/admin/...): one entry per operation. The router in
// lib/admin-api.ts serves exactly these (method, path, level, handler) and
// openapi.ts adds them to the document on /api, so routes and documentation
// cannot drift apart. No database access, so `npm test` can load it.

type Schema = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AdminParam = { name: string; in: "path" | "query"; description: string; schema: Schema; required?: boolean; example?: unknown };
export type AdminTag = "Admin: account" | "Admin: rankings" | "Admin: servers" | "Admin: players and clans" | "Admin: definitions" | "Admin: users" | "Admin: settings" | "Admin: jobs and resets" | "Admin: data";
export const ADMIN_TAGS: AdminTag[] = ["Admin: account", "Admin: rankings", "Admin: servers", "Admin: players and clans", "Admin: definitions", "Admin: users", "Admin: settings", "Admin: jobs and resets", "Admin: data"];

export type AdminOp = {
  method: Method;
  path: string; // below /api/v1, e.g. /admin/rankings/{code}
  operationId: string;
  tag: AdminTag;
  summary: string;
  description: string;
  level: 80 | 100; // admin level needed (100 = admin, 80 = restricted)
  handler: string; // name of the handler in lib/admin-api.ts
  entity?: string; // admin-entities key, for the generic row handlers
  params?: AdminParam[];
  body?: Schema;
  bodyExample?: unknown;
  status: 200 | 201 | 202 | 204;
  response?: Schema;
  example?: unknown;
  errors: number[]; // besides 401, 403, 429 and 500
};

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const int = (description: string, extra: Schema = {}): Schema => ({ type: "integer", description, ...extra });
const num = (description: string, extra: Schema = {}): Schema => ({ type: "number", description, ...extra });
const str = (description: string, extra: Schema = {}): Schema => ({ type: "string", description, ...extra });
const bool = (description: string): Schema => ({ type: "boolean", description });
const nullable = (s: Schema): Schema => ({ anyOf: [s, { type: "null" }] });
const arr = (items: Schema, description?: string): Schema => ({ type: "array", items, ...(description ? { description } : {}) });
// All properties required unless listed in `optional`; no other properties.
const obj = (properties: Record<string, Schema>, optional: string[] = [], description?: string): Schema => ({
  type: "object",
  properties,
  required: Object.keys(properties).filter((k) => !optional.includes(k)),
  additionalProperties: false,
  ...(description ? { description } : {}),
});
const unix = (description: string) => int(`${description} (Unix time, seconds)`);

// The ranking code in the examples: openApiDocument replaces it with the
// site's first ranking (the same marker as openapi.ts).
const G = "__example_game__";

const codeParam: AdminParam = { name: "code", in: "path", required: true, description: "Code of the ranking", schema: str("", { pattern: "^[A-Za-z0-9_-]{1,32}$" }), example: G };
const idParam = (what: string, example = 1): AdminParam => ({ name: "id", in: "path", required: true, description: `ID of the ${what}`, schema: int("", { minimum: 1, maximum: 9999999999 }), example });
const usernameParam: AdminParam = { name: "username", in: "path", required: true, description: "User name (URL-encoded)", schema: str("", { minLength: 1, maxLength: 128 }), example: "editor" };
const pageParams: AdminParam[] = [
  { name: "page", in: "query", description: "Page, from 1", schema: int("", { minimum: 1, maximum: 100000, default: 1 }) },
  { name: "limit", in: "query", description: "Entries per page", schema: int("", { minimum: 1, maximum: 100, default: 50 }) },
];
const orderParam: AdminParam = { name: "order", in: "query", description: "Direction", schema: str("", { enum: ["asc", "desc"] }) };

export const ADMIN_PAGE_MAX = 100;

const pageOf = (item: Schema): Schema =>
  obj({ data: arr(item), pagination: obj({ page: int("Current page"), limit: int("Entries per page"), total: int("Entries in the whole list"), totalPages: int("Pages (at least 1)") }) });
const paged = <T>(items: T[], limit = 50) => ({ data: items, pagination: { page: 1, limit, total: items.length, totalPages: 1 } });

const ok = obj({ ok: bool("Always true") });

// ---------------------------------------------------------------- entities

// URL name, singular and the path parameter of each entity of the admin area.
export const ADMIN_ENTITIES: { key: string; path: string; one: string; tag: AdminTag; id: "code" | "id" | "username" }[] = [
  { key: "games", path: "rankings", one: "ranking", tag: "Admin: rankings", id: "code" },
  { key: "servers", path: "servers", one: "server", tag: "Admin: servers", id: "id" },
  { key: "players", path: "players", one: "player", tag: "Admin: players and clans", id: "id" },
  { key: "clans", path: "clans", one: "clan", tag: "Admin: players and clans", id: "id" },
  { key: "weapons", path: "weapons", one: "weapon", tag: "Admin: definitions", id: "id" },
  { key: "actions", path: "actions", one: "action", tag: "Admin: definitions", id: "id" },
  { key: "teams", path: "teams", one: "team", tag: "Admin: definitions", id: "id" },
  { key: "roles", path: "roles", one: "role", tag: "Admin: definitions", id: "id" },
  { key: "awards", path: "awards", one: "award", tag: "Admin: definitions", id: "id" },
  { key: "ranks", path: "ranks", one: "rank", tag: "Admin: definitions", id: "id" },
  { key: "users", path: "users", one: "user", tag: "Admin: users", id: "username" },
];

function fieldSchema(f: Field, input: boolean): Schema {
  // The help of passwords and secrets describes the form's empty field.
  const d = f.label.en + (f.help && f.type !== "password" && f.type !== "secret" ? `. ${f.help.en.replace(/\.$/, "")}` : "");
  switch (f.type) {
    case "number":
      return int(d, { ...(f.min !== undefined ? { minimum: f.min } : {}), ...(f.maxValue !== undefined ? { maximum: f.maxValue } : {}) });
    case "decimal":
      return num(d);
    case "flag":
    case "bool":
      return bool(d);
    case "select":
      if (Array.isArray(f.options)) return str(d, { enum: f.options.map(([v]) => v) });
      return f.options === "clans" ? int(`${d}. Clan ID, 0 for none`) : str(`${d}. Code of a ranking`);
    case "secret":
      return input
        ? nullable(str(`${d}. Write-only: a string sets it, null clears it, left out it stays${f.name === "log_secret" ? "; a number from 1 to 2147483647, the game server's sv_logsecret" : ""}`, f.max ? { maxLength: f.max } : {}))
        : bool(`${f.label.en} is set (the value is never returned)`);
    case "password":
      return str(`${d}. Write-only, at least 10 characters; stored as a hash. Left out, it stays`, { minLength: 10 });
    default:
      return str(d, { ...(f.max ? { maxLength: f.max } : {}), ...(f.pattern ? { pattern: f.pattern.source } : {}) });
  }
}

const ROW_EXAMPLES: Record<string, Record<string, unknown>> = {
  games: { id: 3, code: G, realgame: "css", name: "Example Assault", hidden: false, display_id: 1 },
  servers: { id: 1, name: "Example Server #1", address: "203.0.113.10", port: 27015, game: G, rcon_passwordSet: true, log_secretSet: false, publicaddress: "play.example.org:27015", max_players: 24, display_id: 1 },
  players: { id: 42, lastName: "ExamplePlayer", game: G, skill: 1450, hideranking: "0", clan: 3 },
  clans: { id: 3, tag: "[EX]", name: "Example Clan", homepage: "https://clan.example.org/", game: G },
  weapons: { id: 12, code: "ak47", name: "AK-47", modifier: 1, game: G },
  actions: { id: 7, code: "Planted_The_Bomb", description: "Planted the bomb", reward_player: 3, reward_team: 0, team: "TERRORIST", for_PlayerActions: true, for_PlayerPlayerActions: false, for_TeamActions: false, for_WorldActions: false, game: G },
  teams: { id: 2, code: "CT", name: "Counter-Terrorists", hidden: false, game: G },
  roles: { id: 1, code: "sniper", name: "Sniper", hidden: false, game: G },
  awards: { id: 9, awardType: "W", code: "awp", name: "AWP Master", verb: "kills with the AWP", game: G },
  ranks: { id: 5, name: "{LANG_RANG_PVT}", minimum: 50, game_code: G },
  users: { id: "editor", username: "editor", acclevel: "80" },
};

function entityOps(): AdminOp[] {
  const ops: AdminOp[] = [];
  for (const m of ADMIN_ENTITIES) {
    const e = entities.find((x) => x.key === m.key) as Entity;
    const level = (e.minLevel ?? 80) as 80 | 100;
    const Name = m.one[0].toUpperCase() + m.one.slice(1);
    const Names = m.path[0].toUpperCase() + m.path.slice(1);
    const base = `/admin/${m.path}`;
    const one = `${base}/{${m.id}}`;
    const idP = m.id === "code" ? codeParam : m.id === "username" ? usernameParam : idParam(m.one, Number(ROW_EXAMPLES[m.key].id));
    const row = ref(`Admin${Name}`);
    const ex = ROW_EXAMPLES[m.key];
    const create = e.fields.filter((f) => !f.readonly);
    const update = e.fields.filter((f) => !f.readonly && !f.createOnly && !f.virtual);
    const bodyEx = (fields: Field[]) => Object.fromEntries(fields.filter((f) => f.type !== "secret" && f.type !== "password" && ex[f.name] !== undefined).map((f) => [f.name, ex[f.name]]));
    const selfNote = m.key === "users" ? " Your own account cannot be changed or deleted with a token (`403 self_security_forbidden`): change your password and TOTP on your account page." : "";
    const pwNote = m.key === "users" ? " The password of an existing admin cannot be set (`403 password_own_only`): it is given only when the admin is created; afterwards each admin changes only their own, on their account page." : "";
    if (m.key !== "games") {
      const sorts = e.fields.filter((f) => f.inList && !f.virtual && f.type !== "password" && f.type !== "secret").map((f) => f.name);
      ops.push({
        method: "GET",
        path: base,
        operationId: `adminList${Names}`,
        tag: m.tag,
        summary: `List ${m.path}`,
        description: `${e.help?.en ?? e.label.en} Same list as Admin → ${e.label.en}.`,
        level,
        handler: "entityList",
        entity: m.key,
        params: [
          ...(e.gameColumn ? [{ name: "game", in: "query" as const, description: "Only this ranking (code)", schema: str("", { pattern: "^[A-Za-z0-9_-]{1,32}$" }), example: G }] : []),
          ...(e.search?.length ? [{ name: "q", in: "query" as const, description: `Search in ${e.search.map((c) => c.replace(/^d\./, "")).join(", ")}`, schema: str("", { maxLength: 100 }) }] : []),
          ...(e.statusFilter ? [{ name: "status", in: "query" as const, description: "Only rows in this state", schema: str("", { enum: e.statusFilter.map((s) => s.value) }) }] : []),
          { name: "sort", in: "query", description: "Sort field (then the default order)", schema: str("", { enum: sorts }) },
          orderParam,
          ...pageParams,
        ],
        status: 200,
        response: pageOf(row),
        example: paged([ex]),
        errors: [400],
      });
    }
    ops.push({
      method: "GET",
      path: one,
      operationId: `adminGet${Name}`,
      tag: m.tag,
      summary: `Get a ${m.one}`,
      description: `One ${m.one} with every field of its edit page. Passwords and secrets are never returned, only whether a secret is set.`,
      level,
      handler: "entityGet",
      entity: m.key,
      params: [idP],
      status: 200,
      response: row,
      example: ex,
      errors: [404],
    });
    if (e.canCreate) {
      ops.push({
        method: "POST",
        path: base,
        operationId: `adminCreate${Name}`,
        tag: m.tag,
        summary: `Create a ${m.one}`,
        description:
          `Creates a ${m.one} with the checks of the admin page.` +
          (m.key === "games" ? " `realgame` is the ranking's game; `template` (optional) copies weapons, actions, teams, roles, awards, ranks and ribbons from that ranking, must be of the same game and defaults to the game's standard ranking (e.g. `css`); `name` empty takes the game's name; `realgame` empty takes the template's game, one of the two is required." : "") +
          (m.key === "servers" ? " IP and port must be unique (`409 duplicate`, with the other server's ID)." : "") +
          (m.key === "users" ? " `password` is required." : "") +
          " Fields left out get the value an empty form field gives.",
        level,
        handler: "entityCreate",
        entity: m.key,
        body: ref(`Admin${Name}Create`),
        bodyExample: m.key === "users" ? { username: "editor", password: "REPLACE_WITH_A_PASSWORD", acclevel: "80" } : m.key === "games" ? { code: G, template: "css", name: "Example Assault", hidden: false, display_id: 1 } : { ...bodyEx(create), ...(m.key === "servers" ? { rcon_password: "REPLACE_WITH_RCON_PASSWORD" } : {}) },
        status: 201,
        response: row,
        example: ex,
        errors: [400, 409],
      });
    }
    ops.push({
      method: "PATCH",
      path: one,
      operationId: `adminUpdate${Name}`,
      tag: m.tag,
      summary: `Change a ${m.one}`,
      description:
        `Changes only the fields sent, with the checks of the admin page.` +
        (m.key === "servers" ? " A new `game` must be a ranking of the same game (`409 mismatch`); IP and port stay unique (`409 duplicate`). A secret set to null is cleared." : "") +
        (m.key === "players" ? " `hideranking`: 0 visible, 1 hidden (admin or bot), 2 banned, 3 hidden by the player." : "") +
        selfNote +
        pwNote,
      level,
      handler: "entityUpdate",
      entity: m.key,
      params: [idP],
      body: ref(`Admin${Name}Update`),
      bodyExample: m.key === "users" ? { acclevel: "100" } : Object.fromEntries(Object.entries(bodyEx(update)).slice(0, 2)),
      status: 200,
      response: row,
      example: ex,
      errors: [400, 404, 409],
    });
    if (e.canDelete) {
      ops.push({
        method: "DELETE",
        path: one,
        operationId: `adminDelete${Name}`,
        tag: m.tag,
        summary: `Delete a ${m.one}`,
        description: `Deletes the ${m.one} for good.` + (m.key === "users" ? " Also removes the user's TOTP key and API tokens." : "") + selfNote,
        level,
        handler: "entityDelete",
        entity: m.key,
        params: [idP],
        status: 204,
        errors: [404],
      });
    }
  }
  return ops;
}

function entitySchemas(): Record<string, Schema> {
  const out: Record<string, Schema> = {};
  for (const m of ADMIN_ENTITIES) {
    const e = entities.find((x) => x.key === m.key) as Entity;
    const Name = m.one[0].toUpperCase() + m.one.slice(1);
    const props: Record<string, Schema> = { id: e.pkIsText ? str("Key of the row") : int("Key of the row") };
    for (const f of e.fields) {
      if (f.virtual || f.type === "password") continue;
      props[f.type === "secret" ? `${f.name}Set` : f.name] = fieldSchema(f, false);
    }
    // Optional columns may be missing in older databases.
    out[`Admin${Name}`] = obj(props, e.fields.filter((f) => f.optional).flatMap((f) => [f.name, `${f.name}Set`]), `${e.label.en} (Admin → ${e.label.en})`);
    const create = e.fields.filter((f) => !f.readonly);
    if (e.canCreate) {
      out[`Admin${Name}Create`] = {
        ...obj(Object.fromEntries(create.map((f) => [f.name, fieldSchema(f, true)])), create.filter((f) => !f.required && !(m.key === "users" && f.type === "password")).map((f) => f.name)),
        description: `New ${m.one}`,
      };
    }
    const update = e.fields.filter((f) => !f.readonly && !f.createOnly && !f.virtual);
    out[`Admin${Name}Update`] = { ...obj(Object.fromEntries(update.map((f) => [f.name, fieldSchema(f, true)])), update.map((f) => f.name)), minProperties: 1, description: "Only the fields to change" };
  }
  return out;
}

// ---------------------------------------------------------------- settings

function settingSchema(s: Setting, input: boolean): Schema {
  const d = s.label.en + (s.help ? `. ${s.help.en}` : "") + (s.minLevel ? ` (level ${s.minLevel} only)` : "");
  switch (s.type) {
    case "bool":
      return bool(d);
    case "number":
      return int(d, { ...(s.min !== undefined ? { minimum: s.min } : {}), ...(s.max !== undefined ? { maximum: s.max } : {}) });
    case "choice":
      return str(d, { enum: s.choices?.map(([v]) => v) ?? [] });
    case "secret":
      return input ? nullable(str(`${d}. Write-only; null clears it`, { maxLength: 255 })) : obj({ set: bool("A value is stored (it is never returned)") }, [], d);
    case "home":
    case "link":
      return input ? obj({ label: str("Text"), url: str("Address") }, [], d) : nullable(obj({ label: str("Text"), url: str("Address") }, [], d));
    case "order":
      return arr(str("Tab id"), d);
    default:
      return str(d, { maxLength: 255 });
  }
}

const groupIds = settingGroups.map((g) => g.id);

// ---------------------------------------------------------------- shared schemas

const scheduleSchema = obj(
  {
    unit: str("Length of a period", { enum: ["day", "week", "month", "quarter", "year"] }),
    every: int("Number of units per period", { minimum: 1, maximum: 120, default: 1 }),
    monthDay: int("month/quarter: day of the month the periods start (1-28)", { minimum: 1, maximum: 28 }),
    weekday: int("week: weekday the periods start (1 Monday - 7 Sunday)", { minimum: 1, maximum: 7 }),
    month: int("year: month of the start date", { minimum: 1, maximum: 12 }),
    day: int("year: day of the start date (1-28)", { minimum: 1, maximum: 28 }),
  },
  ["every", "monthDay", "weekday", "month", "day"],
  "Reset schedule: every N units; without a start day periods start on the 1st, on Monday and on 1 January. Quarters are stored as 3 months.",
);
const modeSchema = str("What a reset deletes: player-stats (player statistics), all-stats (also server statistics), all (also the players)", { enum: [...RESET_MODES] });
const job = obj({
  id: int("Job ID"),
  type: str("reset, scheduled-reset, inactive or awards"),
  game: str("Ranking code (empty for jobs of all rankings)"),
  mode: str("Reset mode"),
  status: str("pending, running, done or failed"),
  requestedBy: str("Admin who queued it (only for level 100 or your own jobs), else empty"),
  requestedAt: unix("Queued"),
  startedAt: unix("Started, 0 before"),
  finishedAt: unix("Finished, 0 before"),
  result: str("Result text of the collector"),
  origin: obj(
    {
      feature: str(
        "The feature that queued the job: scheduled_resets, daily_awards, inactive_players (the collector itself), cli (a gamewe command), admin (the web admin), api (this API); empty for jobs queued before collector schema version 22",
      ),
      startup: bool("Queued by the collector's first look at its schedule after its start (a period or day that ended while it was stopped)"),
      from: unix("Start of the period of a scheduled reset that ended, 0 if none"),
      to: unix("End of that period (excluded), 0 if none"),
      schedule: str("Reset schedule of that period (as gamewe_reset_schedule), else empty"),
      inherited: bool("The ranking follows the schedule for all rankings"),
      zone: str("Time zone of the period, else empty"),
      day: str("Day of the daily awards (YYYY-MM-DD), else empty"),
      command: str("The gamewe command that queued it, else empty"),
      token: str("Name of the API token it came through (only for level 100 or your own jobs), else empty"),
      version: str("Collector version that queued it, else empty"),
    },
    [],
    "Which feature queued the job and why",
  ),
});

export const adminSchemas: Record<string, Schema> = {
  AdminError: {
    type: "object",
    properties: {
      error: str("Error code", { examples: ["unauthorized", "forbidden", "self_security_forbidden", "password_own_only", "not_found", "invalid_field", "unknown_field", "read_only_field", "missing_field", "confirmation_required", "mismatch", "duplicate", "template_ranking", "rate_limited"] }),
      message: str("What went wrong, in English"),
      field: str("The field it is about, if any"),
      id: int("For duplicate: the ID of the other server"),
      created: bool("A new ranking was created although copying its template's definitions failed"),
    },
    required: ["error", "message"],
  },
  ...entitySchemas(),
  AdminRankingSummary: obj({
    id: int("ID"),
    code: str("Code"),
    name: str("Name"),
    hidden: bool("Hidden on the website"),
    baseGame: nullable(str("The game behind the ranking (css, csgo, cstrike, ...)")),
    servers: int("Number of servers"),
  }),
  AdminSchedule: scheduleSchema,
  AdminSettings: obj({
    id: str("Settings page"),
    area: str("website, services or collector"),
    title: str("Title of the page"),
    settings: { type: "object", additionalProperties: true, description: "Key → stored value or default. Secrets: { set }; links: { label, url }; order: tab ids. The types are those of AdminSettingsChange." },
    readOnly: arr(str("Key"), "Settings above your admin level"),
  }),
  AdminJob: job,
  AdminSettingGroup: obj({
    id: str("Group id, as in /admin/settings/{group}"),
    area: str("website, services or collector"),
    title: str("Title of the settings page"),
    settings: arr(obj({ key: str("hlstats_Options key"), type: str("text, number, bool, choice, link, template, secret, home or order"), label: str("Label of the field"), readOnly: bool("You cannot change it (admin level)") })),
  }),
};

// ---------------------------------------------------------------- operations

const hallBody = obj(
  {
    source: str("global: follow the schedule for all rankings; own: own schedule; off: never reset by schedule", { enum: ["global", "own", "off"] }),
    schedule: ref("AdminSchedule"),
    mode: modeSchema,
    page: str("Hall of fame page: auto (shown when there are entries), on or off", { enum: ["auto", "on", "off"] }),
    confirm: bool("Must be true when a schedule is switched on or changed (the ranking is then reset at the end of every period)"),
  },
  ["schedule", "confirm"],
);
const hallOut = obj({
  source: str("global, own or off"),
  schedule: nullable(ref("AdminSchedule")),
  mode: modeSchema,
  page: str("auto, on or off"),
  global: obj({ schedule: nullable(ref("AdminSchedule")), mode: modeSchema }),
  effective: nullable(ref("AdminSchedule")),
  effectiveMode: modeSchema,
  lastStart: unix("Start of the running period, 0 if none"),
  periods: int("Periods in the hall of fame"),
  available: bool("The database has the hall of fame table (collector 0.19 or newer)"),
});
const hallEx = { source: "own", schedule: { unit: "month", every: 1, monthDay: 1 }, mode: "player-stats", page: "auto", global: { schedule: null, mode: "player-stats" }, effective: { unit: "month", every: 1, monthDay: 1 }, effectiveMode: "player-stats", lastStart: 1767225600, periods: 4, available: true };
const entryParts = obj({ start: str("First day of the period, YYYY-MM-DD", { pattern: "^\\d{4}-\\d{2}-\\d{2}$" }), place: int("Place 1-99; left out: the whole period", { minimum: 1, maximum: 99 }) }, ["place"]);

const settingsEx = { id: "general", area: "website", title: "General", settings: { sitename: "Example Stats", gamewe_default_lang: "en", MinActivity: 28, gamewe_chat_public: false }, readOnly: [] };

export const adminOps: AdminOp[] = [
  {
    method: "GET",
    path: "/admin/me",
    operationId: "adminMe",
    tag: "Admin: account",
    summary: "Token owner",
    description: "The admin the token belongs to, their level and the token used. Tokens are created and revoked only on the account page (Admin → My account → API tokens); there is no API for that.",
    level: 80,
    handler: "me",
    status: 200,
    response: obj({ username: str("User name"), level: int("Admin level: 100 admin, 80 restricted"), token: obj({ name: str("Name of the token"), prefix: str("First characters of the token") }) }),
    example: { username: "admin", level: 100, token: { name: "deploy script", prefix: "gwe_Ab12Cd34" } },
    errors: [],
  },
  {
    method: "GET",
    path: "/admin/rankings",
    operationId: "adminListRankings",
    tag: "Admin: rankings",
    summary: "List rankings",
    description: "Every ranking (also hidden ones and templates without servers) with its game and number of servers, in display order.",
    level: 80,
    handler: "rankingsList",
    status: 200,
    response: arr(ref("AdminRankingSummary")),
    example: [{ id: 3, code: G, name: "Example Assault", hidden: false, baseGame: "css", servers: 2 }],
    errors: [],
  },
  ...entityOps(),
  {
    method: "GET",
    path: "/admin/rankings/{code}/servers",
    operationId: "adminListRankingServers",
    tag: "Admin: rankings",
    summary: "Servers of a ranking",
    description: "The servers whose logs count for this ranking.",
    level: 100,
    handler: "rankingServers",
    params: [codeParam],
    status: 200,
    response: arr(obj({ id: int("Server ID"), name: str("Name"), address: str("IP address"), port: int("Port") })),
    example: [{ id: 1, name: "Example Server #1", address: "203.0.113.10", port: 27015 }],
    errors: [404],
  },
  {
    method: "POST",
    path: "/admin/rankings/{code}/servers",
    operationId: "adminAssignRankingServers",
    tag: "Admin: rankings",
    summary: "Assign servers to a ranking",
    description: "Moves the servers into this ranking (they leave their current one). Only servers of the same game (`409 mismatch`). The collector picks the change up within a minute.",
    level: 100,
    handler: "rankingAssign",
    params: [codeParam],
    body: obj({ servers: arr(int("Server ID", { minimum: 1 }), "Server IDs (1-500)") }),
    bodyExample: { servers: [1, 2] },
    status: 200,
    response: obj({ moved: int("Servers moved") }),
    example: { moved: 2 },
    errors: [400, 404, 409],
  },
  {
    method: "POST",
    path: "/admin/servers/{id}/move",
    operationId: "adminMoveServer",
    tag: "Admin: servers",
    summary: "Move a server to another ranking",
    description: "Moves one server into another ranking of the same game (`409 mismatch` otherwise).",
    level: 100,
    handler: "serverMove",
    params: [idParam("server")],
    body: obj({ ranking: str("Code of the target ranking") }),
    bodyExample: { ranking: G },
    status: 200,
    response: ok,
    example: { ok: true },
    errors: [400, 404, 409],
  },
  {
    method: "GET",
    path: "/admin/rankings/{code}/bots",
    operationId: "adminGetRankingBots",
    tag: "Admin: rankings",
    summary: "Bot settings of a ranking",
    description: "Whether bots are ranked, kills with bots give points, kills of bots count for the career rank and kills with bots count in the players' stats.",
    level: 80,
    handler: "botsGet",
    params: [codeParam],
    status: 200,
    response: obj({ ranked: bool("Bots appear in the ranking"), points: bool("Kills with bots give points"), kills: bool("Kills of bots count for the career rank"), stats: bool("Kills with bots count in the players' stats (kills, deaths, headshots, K/D)") }),
    example: { ranked: false, points: false, kills: true, stats: false },
    errors: [404],
  },
  {
    method: "PUT",
    path: "/admin/rankings/{code}/bots",
    operationId: "adminSetRankingBots",
    tag: "Admin: rankings",
    summary: "Change the bot settings",
    description: "Switching `ranked` also shows or hides the ranking's existing bots; `changedBots` is their number.",
    level: 100,
    handler: "botsSet",
    params: [codeParam],
    body: obj({ ranked: bool("Bots appear in the ranking"), points: bool("Kills with bots give points"), kills: bool("Kills of bots count for the career rank"), stats: bool("Kills with bots count in the players' stats (kills, deaths, headshots, K/D)") }),
    bodyExample: { ranked: true, points: false, kills: true, stats: false },
    status: 200,
    response: obj({ ranked: bool("As sent"), points: bool("As sent"), kills: bool("As sent"), stats: bool("As sent"), changedBots: int("Bots shown or hidden") }),
    example: { ranked: true, points: false, kills: true, stats: false, changedBots: 12 },
    errors: [400, 404],
  },
  {
    method: "GET",
    path: "/admin/rankings/{code}/vac",
    operationId: "adminGetRankingVac",
    tag: "Admin: rankings",
    summary: "VAC block of a ranking",
    description: "Whether players with a VAC or game ban are left out of the ranking.",
    level: 80,
    handler: "vacGet",
    params: [codeParam],
    status: 200,
    response: obj({ block: bool("VAC block on") }),
    example: { block: false },
    errors: [404],
  },
  {
    method: "PUT",
    path: "/admin/rankings/{code}/vac",
    operationId: "adminSetRankingVac",
    tag: "Admin: rankings",
    summary: "Switch the VAC block",
    description: "The collector applies it within a minute (it needs a Steam API key).",
    level: 100,
    handler: "vacSet",
    params: [codeParam],
    body: obj({ block: bool("VAC block on") }),
    bodyExample: { block: true },
    status: 200,
    response: obj({ block: bool("As sent") }),
    example: { block: true },
    errors: [400, 404],
  },
  {
    method: "GET",
    path: "/admin/rankings/{code}/hall-of-fame",
    operationId: "adminGetRankingHall",
    tag: "Admin: rankings",
    summary: "Reset schedule and hall of fame of a ranking",
    description: "The ranking's own schedule, the one for all rankings, and the one in effect.",
    level: 80,
    handler: "hallGet",
    params: [codeParam],
    status: 200,
    response: hallOut,
    example: hallEx,
    errors: [404],
  },
  {
    method: "PUT",
    path: "/admin/rankings/{code}/hall-of-fame",
    operationId: "adminSetRankingHall",
    tag: "Admin: rankings",
    summary: "Change the reset schedule of a ranking",
    description: "`schedule` is needed for `source: own`. Switching a schedule on or changing it needs `confirm: true` (`400 confirmation_required`): the ranking is then reset at the end of every period. A template (a ranking without servers) has no schedule (`409 template_ranking`).",
    level: 100,
    handler: "hallSet",
    params: [codeParam],
    body: hallBody,
    bodyExample: { source: "own", schedule: { unit: "month", every: 1, monthDay: 1 }, mode: "player-stats", page: "auto", confirm: true },
    status: 200,
    response: hallOut,
    example: hallEx,
    errors: [400, 404, 409, 503],
  },
  {
    method: "GET",
    path: "/admin/rankings/{code}/hall-of-fame/entries",
    operationId: "adminListHallEntries",
    tag: "Admin: rankings",
    summary: "Hall of fame entries",
    description: "Every stored period with all places, removed entries too, newest first.",
    level: 100,
    handler: "hallEntries",
    params: [codeParam],
    status: 200,
    response: arr(
      obj({
        unit: str("Unit of the period"),
        every: int("Units per period"),
        start: str("First day"),
        end: str("Last day"),
        entries: arr(obj({ place: int("Place"), playerId: int("Player ID"), name: str("Name at the time"), currentName: nullable(str("Current name")), points: int("Points"), kills: int("Kills"), removed: bool("Removed by an admin"), hidden: bool("The player is hidden now") })),
      }),
    ),
    example: [{ unit: "month", every: 1, start: "2026-09-01", end: "2026-09-30", entries: [{ place: 1, playerId: 42, name: "ExamplePlayer", currentName: "ExamplePlayer", points: 2210, kills: 5321, removed: false, hidden: false }] }],
    errors: [404],
  },
  {
    method: "POST",
    path: "/admin/rankings/{code}/hall-of-fame/entries/remove",
    operationId: "adminRemoveHallEntries",
    tag: "Admin: rankings",
    summary: "Remove hall of fame entries",
    description: "Removes one place or, without `place`, the whole period from the hall of fame (they can be restored). Needs `confirm: true`.",
    level: 100,
    handler: "hallRemove",
    params: [codeParam],
    body: obj({ start: str("First day of the period, YYYY-MM-DD"), place: int("Place 1-99; left out: the whole period", { minimum: 1, maximum: 99 }), confirm: bool("Must be true") }, ["place"]),
    bodyExample: { start: "2026-09-01", place: 1, confirm: true },
    status: 200,
    response: obj({ changed: int("Entries changed") }),
    example: { changed: 1 },
    errors: [400, 404],
  },
  {
    method: "POST",
    path: "/admin/rankings/{code}/hall-of-fame/entries/restore",
    operationId: "adminRestoreHallEntries",
    tag: "Admin: rankings",
    summary: "Restore hall of fame entries",
    description: "Brings back one place or, without `place`, the whole period.",
    level: 100,
    handler: "hallRestore",
    params: [codeParam],
    body: entryParts,
    bodyExample: { start: "2026-09-01", place: 1 },
    status: 200,
    response: obj({ changed: int("Entries changed") }),
    example: { changed: 1 },
    errors: [400, 404],
  },
  {
    method: "POST",
    path: "/admin/rankings/{code}/reset",
    operationId: "adminResetRanking",
    tag: "Admin: jobs and resets",
    summary: "Reset a ranking",
    description:
      "Queues a reset job; the collector runs it (it pauses the ranking's servers). `confirm: true` is required because the data is **deleted for good**. A reset already queued for the ranking is returned instead (`existing: true`). Poll `/admin/jobs/{id}` for the result. A template (a ranking without servers) is never reset (`409 template_ranking`).",
    level: 100,
    handler: "reset",
    params: [codeParam],
    body: obj({ mode: modeSchema, confirm: bool("Must be true: the data is deleted for good") }),
    bodyExample: { mode: "player-stats", confirm: true },
    status: 202,
    response: obj({ job: int("Job ID"), existing: bool("A reset was already queued") }),
    example: { job: 17, existing: false },
    errors: [400, 404, 409, 503],
  },
  {
    method: "GET",
    path: "/admin/hall-of-fame",
    operationId: "adminGetGlobalHall",
    tag: "Admin: rankings",
    summary: "Reset schedule for all rankings",
    description: "The schedule every ranking without its own one follows.",
    level: 80,
    handler: "globalHallGet",
    status: 200,
    response: obj({ enabled: bool("Switched on"), schedule: nullable(ref("AdminSchedule")), mode: modeSchema }),
    example: { enabled: true, schedule: { unit: "month", every: 1, monthDay: 1 }, mode: "player-stats" },
    errors: [],
  },
  {
    method: "PUT",
    path: "/admin/hall-of-fame",
    operationId: "adminSetGlobalHall",
    tag: "Admin: rankings",
    summary: "Change the reset schedule for all rankings",
    description: "Switching it on or changing it while on needs `confirm: true`: every ranking that follows it is reset at the end of every period.",
    level: 100,
    handler: "globalHallSet",
    body: obj({ enabled: bool("Switched on"), schedule: ref("AdminSchedule"), mode: modeSchema, confirm: bool("Must be true when it is switched on or changed") }, ["confirm"]),
    bodyExample: { enabled: true, schedule: { unit: "month", every: 1, monthDay: 1 }, mode: "player-stats", confirm: true },
    status: 200,
    response: obj({ enabled: bool("Switched on"), schedule: nullable(ref("AdminSchedule")), mode: modeSchema }),
    example: { enabled: true, schedule: { unit: "month", every: 1, monthDay: 1 }, mode: "player-stats" },
    errors: [400],
  },
  {
    method: "GET",
    path: "/admin/jobs",
    operationId: "adminJobs",
    tag: "Admin: jobs and resets",
    summary: "Jobs of the collector",
    description: "What the collector does next, what waits or runs and what it did last (Admin → Jobs).",
    level: 80,
    handler: "jobs",
    status: 200,
    response: obj({
      collectorSeen: unix("Last heartbeat of the collector, 0 if never"),
      queue: arr(ref("AdminJob"), "Waiting and running jobs"),
      history: arr(ref("AdminJob"), "Finished jobs, newest first (last 30)"),
      scheduled: arr(obj({ game: str("Ranking"), schedule: ref("AdminSchedule"), mode: modeSchema, next: unix("Next reset") })),
      available: bool("The job table exists (collector 0.1.0 or newer)"),
    }),
    example: {
      collectorSeen: 1767225600,
      queue: [],
      history: [
        {
          id: 17, type: "scheduled-reset", game: G, mode: "player-stats", status: "done", requestedBy: "schedule", requestedAt: 1767225000, startedAt: 1767225030, finishedAt: 1767225041, result: "ok",
          origin: { feature: "scheduled_resets", startup: true, from: 1759269600, to: 1767222000, schedule: "3 month", inherited: true, zone: "Europe/Berlin", day: "", command: "", token: "", version: "1.4.0" },
        },
      ],
      scheduled: [{ game: G, schedule: { unit: "month", every: 1, monthDay: 1 }, mode: "player-stats", next: 1769904000 }],
      available: true,
    },
    errors: [],
  },
  {
    method: "GET",
    path: "/admin/jobs/{id}",
    operationId: "adminGetResetJob",
    tag: "Admin: jobs and resets",
    summary: "State of a reset job",
    description: "The reset job returned by `POST /admin/rankings/{code}/reset`.",
    level: 80,
    handler: "job",
    params: [idParam("job", 17)],
    status: 200,
    response: ref("AdminJob"),
    example: {
      id: 17, type: "reset", game: G, mode: "player-stats", status: "running", requestedBy: "admin", requestedAt: 1767225000, startedAt: 1767225030, finishedAt: 0, result: "",
      origin: { feature: "api", startup: false, from: 0, to: 0, schedule: "", inherited: false, zone: "", day: "", command: "", token: "deploy", version: "" },
    },
    errors: [404],
  },
  {
    method: "GET",
    path: "/admin/settings",
    operationId: "adminSettingGroups",
    tag: "Admin: settings",
    summary: "Settings pages",
    description: "The settings pages and their settings (without values).",
    level: 80,
    handler: "settingGroups",
    status: 200,
    response: arr(ref("AdminSettingGroup")),
    example: [{ id: "general", area: "website", title: "General", settings: [{ key: "sitename", type: "text", label: "Site title", readOnly: false }] }],
    errors: [],
  },
  {
    method: "GET",
    path: "/admin/settings/raw",
    operationId: "adminGetRawOptions",
    tag: "Admin: settings",
    summary: "Other options (raw)",
    description: "hlstats_Options rows without a field on a settings page. Secrets, TOTP keys, API tokens and the privacy texts are never listed.",
    level: 80,
    handler: "rawGet",
    status: 200,
    response: arr(obj({ key: str("Key"), value: str("Value"), readOnly: bool("Written by the collector") })),
    example: [{ key: "gamewe_heartbeat", value: "1767225600", readOnly: true }],
    errors: [],
  },
  {
    method: "PATCH",
    path: "/admin/settings/raw",
    operationId: "adminUpdateRawOptions",
    tag: "Admin: settings",
    summary: "Change other options (raw)",
    description: "Changes or deletes listed rows and adds one new key (letters, digits, `_ . -`; not a key of a settings page or a hidden one). Values: at most 255 characters, no line breaks.",
    level: 80,
    handler: "rawSet",
    body: obj({ set: { type: "object", additionalProperties: { type: "string", maxLength: 255 }, description: "Existing keys and their new values" }, delete: arr(str("Key"), "Existing keys to delete"), create: obj({ key: str("New key", { maxLength: 128 }), value: str("Value", { maxLength: 255 }) }) }, ["set", "delete", "create"]),
    bodyExample: { set: { contact: "admin@example.org" }, create: { key: "example_key", value: "1" } },
    status: 200,
    response: obj({ written: arr(str("Key")), removed: arr(str("Key")) }),
    example: { written: ["contact", "example_key"], removed: [] },
    errors: [400],
  },
  {
    method: "GET",
    path: "/admin/settings/{group}",
    operationId: "adminGetSettings",
    tag: "Admin: settings",
    summary: "Settings of one page",
    description: "The stored values (or defaults) of one settings page. Secrets show only whether they are set.",
    level: 80,
    handler: "settingsGet",
    params: [{ name: "group", in: "path", required: true, description: "Settings page", schema: str("", { enum: groupIds }), example: "general" }],
    status: 200,
    response: ref("AdminSettings"),
    example: settingsEx,
    errors: [404],
  },
  {
    method: "PATCH",
    path: "/admin/settings/{group}",
    operationId: "adminUpdateSettings",
    tag: "Admin: settings",
    summary: "Change settings of one page",
    description: "Changes only the settings sent, with the checks of the settings page. Settings above your level are refused. Types per setting: see `AdminSettingsChange`.",
    level: 80,
    handler: "settingsSet",
    params: [{ name: "group", in: "path", required: true, description: "Settings page", schema: str("", { enum: groupIds }), example: "general" }],
    body: ref("AdminSettingsChange"),
    bodyExample: { sitename: "Example Stats", MinActivity: 28, gamewe_chat_public: false },
    status: 200,
    response: ref("AdminSettings"),
    example: settingsEx,
    errors: [400, 404],
  },
  {
    method: "GET",
    path: "/admin/privacy",
    operationId: "adminGetPrivacy",
    tag: "Admin: settings",
    summary: "Operator data of the privacy page",
    description: "Name, postal address, contact e-mail and the free text of the privacy page.",
    level: 80,
    handler: "privacyGet",
    status: 200,
    response: obj({ name: str("Controller"), address: str("Postal address (lines with \\n)"), email: str("Contact e-mail"), text: str("Free text") }),
    example: { name: "Example Clan e.V.", address: "Example Street 1\n12345 Example City", email: "privacy@example.org", text: "" },
    errors: [],
  },
  {
    method: "PUT",
    path: "/admin/privacy",
    operationId: "adminSetPrivacy",
    tag: "Admin: settings",
    summary: "Change the operator data of the privacy page",
    description: "All four fields, with the checks of the page (lengths, e-mail format, no hidden characters).",
    level: 80,
    handler: "privacySet",
    body: obj({ name: str("Controller", { maxLength: 120 }), address: str("Postal address", { maxLength: 120 }), email: str("Contact e-mail", { maxLength: 120 }), text: str("Free text", { maxLength: 3000 }) }),
    bodyExample: { name: "Example Clan e.V.", address: "Example Street 1\n12345 Example City", email: "privacy@example.org", text: "" },
    status: 200,
    response: obj({ name: str("Controller"), address: str("Postal address"), email: str("Contact e-mail"), text: str("Free text") }),
    example: { name: "Example Clan e.V.", address: "Example Street 1\n12345 Example City", email: "privacy@example.org", text: "" },
    errors: [400],
  },
  {
    method: "GET",
    path: "/admin/chat",
    operationId: "adminChat",
    tag: "Admin: data",
    summary: "Stored chat",
    description: "All stored chat lines, also of hidden players (Admin → Chat). Personal data.",
    level: 80,
    handler: "chat",
    params: [
      { name: "game", in: "query", description: "Only this ranking", schema: str("", { pattern: "^[A-Za-z0-9_-]{1,32}$" }), example: G },
      { name: "player", in: "query", description: "Only this player ID", schema: int("", { minimum: 1 }) },
      { name: "q", in: "query", description: "Search in message and name", schema: str("", { maxLength: 100 }) },
      orderParam,
      ...pageParams,
    ],
    status: 200,
    response: pageOf(obj({ time: unix("Time"), playerId: int("Player ID"), name: nullable(str("Player name")), team: bool("Team chat"), message: str("Message"), server: nullable(str("Server name")) })),
    example: paged([{ time: 1767225600, playerId: 42, name: "ExamplePlayer", team: false, message: "gg", server: "Example Server #1" }]),
    errors: [400],
  },
  {
    method: "GET",
    path: "/admin/ips",
    operationId: "adminIps",
    tag: "Admin: data",
    summary: "Stored player addresses",
    description: "Address, player and connects (Admin → IP addresses). `q`: an IPv4 address or prefix, a Steam ID or part of a name or host name. Personal data.",
    level: 80,
    handler: "ips",
    params: [
      { name: "game", in: "query", description: "Only this ranking", schema: str("", { pattern: "^[A-Za-z0-9_-]{1,32}$" }), example: G },
      { name: "q", in: "query", description: "Address, prefix, Steam ID or name", schema: str("", { maxLength: 100 }) },
      { name: "days", in: "query", description: "Only connects of the last N days", schema: int("", { minimum: 1, maximum: 3650 }) },
      { name: "sort", in: "query", description: "Sort field", schema: str("", { enum: ["last", "first", "connects", "ip", "name", "steam", "game", "host"], default: "last" }) },
      orderParam,
      ...pageParams,
    ],
    status: 200,
    response: pageOf(obj({ ip: str("IPv4 address"), playerId: int("Player ID"), name: nullable(str("Name")), game: str("Ranking"), uniqueId: nullable(str("Steam ID")), connects: int("Connects"), first: unix("First connect"), last: unix("Last connect"), hostname: str("Host name") })),
    example: paged([{ ip: "203.0.113.10", playerId: 42, name: "ExamplePlayer", game: G, uniqueId: "STEAM_ID_PLACEHOLDER", connects: 12, first: 1735689600, last: 1767225600, hostname: "" }]),
    errors: [400],
  },
];

adminSchemas.AdminSettingsChange = {
  type: "object",
  description: "Settings to change (only those of the page in the path). Secrets: a string sets, null clears. Links: { label, url }. Order: the tab ids.",
  properties: Object.fromEntries(settingGroups.flatMap((g) => g.items).map((s) => [s.key, settingSchema(s, true)])),
  additionalProperties: false,
  minProperties: 1,
};

// What a token can never do, for the documentation and the tests.
export const FORBIDDEN_WITH_TOKEN = [
  "change, set or reset the password of its own account",
  "set up, remove or reset TOTP (two-factor) of its own account",
  "change, demote or delete its own account (the user name is the login)",
  "create, list or revoke API tokens (also its own): only on the account page, signed in",
  "sign in, sign out or manage sessions",
];

export const ADMIN_API_INFO = [
  "",
  "## Admin API",
  "",
  "Everything the admin area can do, under `/api/v1/admin/...`, with an **API token** of an admin (tags *Admin: ...*).",
  "",
  `- **Token:** sign in to the admin area, open *My account → API tokens*, give the token a name (at most ${NAME_MAX} characters) and optionally an expiry, and confirm with your password (and your TOTP code if it is set up). The token (\`gwe_...\`) is shown **once**; only a hash is stored. Up to ${MAX_TOKENS_PER_USER} tokens per admin; revoking one takes effect at once.`,
  "- **Authentication:** `Authorization: Bearer gwe_...` on every request. Nothing else (no cookie, no query parameter). A missing, wrong, expired or revoked token, or one of an admin that was deleted or lost admin rights, gets `401` without details.",
  "- **Rights:** the token acts as its admin, with their level: level 80 cannot reach rankings, servers or users, as in the admin area (`403 forbidden`). Every change is logged with the admin and the token name.",
  "- **Never with a token** (`403 self_security_forbidden`):",
  ...FORBIDDEN_WITH_TOKEN.map((f) => `  - ${f}`),
  "  Other admins can be created (with a first password), changed (level) and deleted as in the admin area. The password of an existing admin is never set (`403 password_own_only`): each admin changes only their own, on the account page.",
  "- **Bodies** are JSON (`Content-Type: application/json`, at most 64 KB). Unknown, read-only or wrongly typed fields are refused (`400`); `PATCH` changes only the fields sent. The checks are those of the admin pages.",
  "- **Errors:** `{ \"error\": code, \"message\": text, \"field\"?: name }` with `400`, `401`, `403`, `404`, `405`, `409` (`mismatch`, `duplicate`), `413`, `415`, `429`, `503`.",
  "- **Rate limit:** 300 requests per minute and address; 20 failed authentications per 15 minutes block the address for 15 minutes.",
  "- **Caching:** never (`Cache-Control: no-store`); no CORS.",
].join("\n");

export const ADMIN_SECURITY_SCHEMES = {
  bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "gwe_ token", description: "Admin API token from Admin → My account → API tokens" },
};

// The path items of the admin operations for the OpenAPI document.
export function adminPathItems(): Record<string, Record<string, unknown>> {
  const err = (description: string) => ({ description, content: { "application/json": { schema: ref("AdminError") } } });
  const texts: Record<number, string> = {
    400: "Invalid body or parameter: the field and what it accepts are named; also confirmation_required",
    404: "Unknown ranking, row, job or settings page",
    409: "mismatch (server and ranking of different games) or duplicate (IP and port taken, or another row with the same unique key, e.g. an award code twice in a ranking)",
    503: "The database lacks what this needs (update the collector)",
  };
  const items: Record<string, Record<string, unknown>> = {};
  for (const op of adminOps) {
    const params = op.params?.map(({ example, ...p }) => (example === undefined ? p : { ...p, example }));
    const success =
      op.status === 204
        ? { description: "Done, no content" }
        : { description: op.status === 201 ? "Created" : op.status === 202 ? "Queued" : "OK", content: { "application/json": { schema: op.response, example: op.example } } };
    (items[op.path] ??= {})[op.method.toLowerCase()] = {
      operationId: op.operationId,
      tags: [op.tag],
      summary: op.summary,
      description: `${op.description}\n\nAdmin level: ${op.level === 100 ? "100 (admin)" : "80 or higher"}.`,
      security: [{ bearerAuth: [] }],
      ...(params?.length ? { parameters: params } : {}),
      ...(op.body ? { requestBody: { required: true, content: { "application/json": { schema: op.body, example: op.bodyExample } } } } : {}),
      responses: {
        [String(op.status)]: success,
        ...Object.fromEntries(op.errors.map((s) => [String(s), err(texts[s] ?? "Error")])),
        "401": err("No, a wrong, expired or revoked token, or its admin no longer exists"),
        "403": err(op.path.startsWith("/admin/users") ? "Admin level too low, self_security_forbidden (your own account) or password_own_only (another admin's password)" : "Admin level too low"),
        "429": err("Too many requests or failed authentications; see Retry-After"),
        "500": err("Internal or database error"),
      },
    };
  }
  return items;
}

// The shape each path parameter must have before anything is looked up.
const PARAM_OK: Record<string, (s: string) => boolean> = {
  code: (s) => /^[A-Za-z0-9_-]{1,32}$/.test(s),
  id: (s) => /^[1-9]\d{0,9}$/.test(s),
  username: (s) => s.length >= 1 && s.length <= 128 && !/[\u0000-\u001f\u007f]/.test(s),
  group: (s) => /^[a-z0-9_-]{1,32}$/.test(s),
};

// The operation for a path (segments below /api/v1/admin) and method. A
// path segment matches a parameter only when it has the parameter's shape;
// the operation with the most fixed segments wins (settings/raw before
// settings/{group}).
export function matchOp(segments: string[], method: string): { op: AdminOp; params: Record<string, string> } | { allow: string[] } | null {
  const hits: { op: AdminOp; params: Record<string, string>; fixed: number }[] = [];
  for (const op of adminOps) {
    const parts = op.path.split("/").slice(2);
    if (parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let fixed = 0;
    let ok = true;
    for (let i = 0; i < parts.length && ok; i++) {
      const m = /^\{(\w+)\}$/.exec(parts[i]);
      if (m) {
        ok = PARAM_OK[m[1]]?.(segments[i]) ?? false;
        params[m[1]] = segments[i];
      } else {
        ok = parts[i] === segments[i];
        fixed++;
      }
    }
    if (ok) hits.push({ op, params, fixed });
  }
  if (!hits.length) return null;
  const best = Math.max(...hits.map((h) => h.fixed));
  const top = hits.filter((h) => h.fixed === best);
  const hit = top.find((h) => h.op.method === method);
  return hit ? { op: hit.op, params: hit.params } : { allow: [...new Set(top.map((h) => h.op.method))] };
}
