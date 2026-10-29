import "server-only";
import type { Entity } from "./admin-entities";
import { deleteRow, getRow, InputError, isDuplicateKey, optionList, otherServerAt, rawOptions, saveRow } from "./admin-data";
import { globalHall, hallSettings, saveGlobalHall, saveHallSettings, setHallRemoved } from "./admin-hall";
import { saveRankingBlockVac, saveRankingBots, type RankingBots } from "./admin-ranking-bots";
import { allServers, assignServers, copyDefinitions, rankingBaseGames, resettableRankings } from "./admin-rankings";
import { RAW_GROUP, READONLY_OPTIONS, homeValue, linkValue, rawKeyAllowed, settingGroups } from "./admin-settings";
import { purgeTokens } from "./api-tokens";
import { LEVEL_ADMIN, type AdminUser } from "./auth";
import { steamKey } from "./config";
import { adminExec, adminQuery, upsert } from "./db";
import { sameBaseGame } from "./games";
import { MAX_EVERY, parseSchedule, scheduleValue } from "./hall-period";
import { invalidateHallOfFame } from "./hall-of-fame";
import { headerOrder } from "./header-links";
import { canonicalIp } from "./ip";
import { operatorValues } from "./privacy-operator";
import { jobsAvailable, queueReset, type ResetMode } from "./reset";
import { imageUrl, invalidateSettings } from "./settings";
import { sourcebansBase } from "./sourcebans";
import { invalidateSteamKey } from "./steam";
import { listTemplates } from "./templates";
import { removeSecret } from "./totp";
import { discordGuild, discordInvite, tsDisplay, tsHost, tsLink } from "./voice";

// What the admin area changes, shared by its server actions (app/admin/
// actions.ts, form in, redirect out) and the admin API (lib/admin-api.ts,
// JSON in and out), so both check and write exactly the same way. Every
// function expects the caller to have checked the admin level already
// (requireAdmin, or the API's token check) and throws OpError for input it
// refuses; the caller turns that into its redirect or its JSON error.

export type OpCode =
  | "notfound" // no such row, ranking or group
  | "cannot" // the entity has no create/delete
  | "self" // would lock the user out of the admin area
  | "password" // the password of an existing user (only its owner, on My account)
  | "mismatch" // server and ranking of different base games
  | "duplicate" // another server has this IP and port
  | "field" // a field is invalid (detail.field)
  | "db" // the database refused the write (detail.msg)
  | "input" // invalid input outside the fields
  | "confirm" // a destructive change was not confirmed
  | "table" // the database lacks the table (old collector)
  | "nojobs" // no job table: the collector cannot run a reset
  | "template"; // the ranking is a template (no servers): never reset

export class OpError extends Error {
  constructor(
    readonly code: OpCode,
    readonly detail: Record<string, string> = {},
  ) {
    super(code);
  }
}

// Who changes something, for the log lines: the admin, and for the API the
// name of the token used.
export type Actor = { user: AdminUser; via?: string };
export const who = (a: Actor) => (a.via ? `${a.user.username} via API token "${a.via}"` : a.user.username);

const dbMsg = (err: unknown) => (err instanceof Error ? err.message.slice(0, 200) : "?");

// A form or the API's converted body: every function reads only what it needs.
type Form = Pick<FormData, "get" | "getAll" | "has" | "entries">;

async function rankingExists(game: string) {
  return (await optionList("games")).some(([code]) => code === game);
}

// A ranking without servers is a template: it only holds the definitions for
// new rankings and is never reset, by hand or by schedule.
async function checkResettable(game: string) {
  if (!(await rankingExists(game))) throw new OpError("notfound");
  if (!(await resettableRankings()).some(([code]) => code === game)) throw new OpError("template");
}

// ---------------------------------------------------------------- rows

// Creates (id null) or changes one row of an entity; returns its key.
// only: write just these fields (the API's PATCH); without it every field
// of the entity is written, as the edit form sends them all. ranking: a new
// server goes into this ranking (the "Add server" button of a ranking).
export async function saveEntity(a: Actor, e: Entity, id: string | null, form: Form, opts: { only?: Set<string>; ranking?: string | null } = {}): Promise<string> {
  if (id === null && !e.canCreate) throw new OpError("cannot");
  const row = id === null ? undefined : await getRow(e, id);
  if (id !== null && !row) throw new OpError("notfound");
  const writes = (f: string) => !opts.only || opts.only.has(f);
  // Each admin changes only their own password, on My account with the
  // current one; nobody sets the password of an existing user here.
  if (e.key === "users" && id !== null && String(form.get("password") ?? "").trim()) throw new OpError("password");
  if (e.key === "users" && id === a.user.username && writes("acclevel") && Number(form.get("acclevel")) < LEVEL_ADMIN && a.user.acclevel >= LEVEL_ADMIN) {
    throw new OpError("self");
  }
  // A server only moves into a ranking of the same base game.
  if (e.key === "servers" && row && writes("game")) {
    const from = String(row.game ?? "").trim();
    const to = String(form.get("game") ?? "").trim();
    const bases = await rankingBaseGames();
    if (from !== to && !sameBaseGame(bases.get(from) ?? null, bases.get(to) ?? null)) throw new OpError("mismatch");
  }
  if (opts.ranking) form = withValue(form, "game", opts.ranking);
  // One server per IP and port: point to the existing one instead of the
  // database's duplicate key error.
  if (e.key === "servers") {
    const address = canonicalIp(String((writes("address") ? form.get("address") : row?.address) ?? "").trim());
    const port = Number(String((writes("port") ? form.get("port") : row?.port) ?? "").trim());
    if (address && Number.isInteger(port)) {
      const other = await otherServerAt(address, port, id);
      if (other !== null) throw new OpError("duplicate", { dup: String(other) });
    }
  }
  let saved: string;
  try {
    saved = await saveRow(e, id, form as FormData, opts.only);
  } catch (err) {
    if (err instanceof InputError) throw new OpError("field", { field: err.message });
    // Another admin saved the same IP and port in the meantime.
    if (e.key === "servers" && isDuplicateKey(err)) throw new OpError("duplicate");
    console.error("admin save:", err);
    throw new OpError("db", { msg: dbMsg(err), ...(isDuplicateKey(err) ? { dupkey: "1" } : {}) });
  }
  // A new user never inherits the API tokens of an earlier user of that name.
  if (e.key === "users" && id === null) await purgeTokens(saved);
  // A new ranking takes the definitions of its template.
  if (e.key === "games" && id === null) {
    const template = String(form.get("template") ?? "");
    const code = String(form.get("code") ?? "").trim();
    if (template && (await rankingExists(template))) {
      try {
        await copyDefinitions(code, template);
        // Only where the database has the column.
        const base = e.fields.some((f) => f.name === "realgame") ? (await rankingBaseGames()).get(template) : null;
        if (base) await adminExec(`UPDATE hlstats_Games SET realgame = ? WHERE code = ? AND (realgame IS NULL OR realgame = '')`, [base, code]);
      } catch (err) {
        console.error("admin copy definitions:", err);
        throw new OpError("db", { msg: dbMsg(err), saved });
      }
    }
  }
  if (a.via) console.info(`gameWE: ${e.key} ${saved} ${id === null ? "created" : "changed"} by ${who(a)}`);
  return saved;
}

function withValue(form: Form, name: string, value: string): Form {
  const f = new FormData();
  for (const [k, v] of form.entries()) if (k !== name) f.append(k, v);
  f.set(name, value);
  return f;
}

export async function deleteEntity(a: Actor, e: Entity, id: string): Promise<void> {
  if (!e.canDelete) throw new OpError("cannot");
  if (!(await getRow(e, id))) throw new OpError("notfound");
  if (e.key === "users" && id === a.user.username) throw new OpError("self");
  try {
    await deleteRow(e, id);
    if (e.key === "users") await Promise.all([removeSecret(id, false), removeSecret(id, true), purgeTokens(id)]);
  } catch (err) {
    throw new OpError("db", { msg: dbMsg(err) });
  }
  if (a.via) console.info(`gameWE: ${e.key} ${id} deleted by ${who(a)}`);
}

// ---------------------------------------------------------------- servers of a ranking

// Moves servers into ranking `code` (only known servers; unknown ids are
// returned in `unknown` and not moved).
export async function assignServersTo(a: Actor, code: string, ids: number[]): Promise<{ moved: number; unknown: number[] }> {
  const [servers, bases] = await Promise.all([allServers(), rankingBaseGames()]);
  const base = bases.get(code) ?? null;
  const known = new Map(servers.map((s) => [s.serverId, s]));
  const ok = ids.filter((n) => known.has(n));
  // A server only moves into a ranking of the same base game.
  if (ok.some((n) => !sameBaseGame(bases.get(known.get(n)!.game) ?? null, base))) throw new OpError("mismatch");
  let moved: number;
  try {
    moved = await assignServers(code, ok);
  } catch (err) {
    throw new OpError("db", { msg: dbMsg(err) });
  }
  if (a.via) console.info(`gameWE: servers ${ok.join(", ") || "-"} moved into ranking ${code} by ${who(a)}`);
  return { moved, unknown: ids.filter((n) => !known.has(n)) };
}

// Moves one server into ranking `target`.
export async function moveServer(a: Actor, serverId: number, target: string): Promise<void> {
  const [servers, bases] = await Promise.all([allServers(), rankingBaseGames()]);
  const server = servers.find((s) => s.serverId === serverId);
  if (!server) throw new OpError("notfound");
  if (!(await rankingExists(target))) throw new OpError("input");
  if (!sameBaseGame(bases.get(server.game) ?? null, bases.get(target) ?? null)) throw new OpError("mismatch");
  try {
    await assignServers(target, [serverId]);
  } catch (err) {
    throw new OpError("db", { msg: dbMsg(err) });
  }
  if (a.via) console.info(`gameWE: server ${serverId} moved into ranking ${target} by ${who(a)}`);
}

// ---------------------------------------------------------------- settings

// One settings page (/admin/settings/<group>) or the raw rows: checks the
// form and writes it. A bad field throws OpError("field", { field }).
// only (API): change just these settings of the group.
export async function saveSettings(a: Actor, groupId: string, form: Form, only?: Set<string>): Promise<{ written: string[]; removed: string[] }> {
  const group = settingGroups.find((g) => g.id === groupId);
  const isRaw = groupId === RAW_GROUP;
  if (!group && !isRaw) throw new OpError("notfound");
  const bad = (field: string): never => {
    throw new OpError("field", { field });
  };
  const values: [string, string][] = [];
  for (const s of group?.items ?? []) {
    if (only && !only.has(s.key)) continue;
    if (s.minLevel !== undefined && a.user.acclevel < s.minLevel) {
      // Read-only for this admin: a sent value is refused, nothing is written.
      if (form.get(s.key) || form.get(`${s.key}__clear`)) bad(s.key);
      continue;
    }
    if (s.type === "order") {
      // Sent by the header links list; without it the stored order stays.
      const v = form.get(s.key);
      if (v !== null) values.push([s.key, headerOrder(String(v)).join(",")]);
      continue;
    }
    if (s.type === "home") {
      const v = homeValue(String(form.get(`${s.key}__label`) ?? ""), String(form.get(`${s.key}__url`) ?? ""));
      if (v === null) bad(s.key);
      values.push([s.key, v!]);
      continue;
    }
    if (s.type === "link") {
      const v = linkValue(String(form.get(`${s.key}__label`) ?? ""), String(form.get(`${s.key}__url`) ?? ""));
      if (v === null) bad(s.key);
      values.push([s.key, v!]);
      continue;
    }
    if (s.type === "secret") {
      // Empty keeps the stored value; the checkbox clears it.
      const v = String(form.get(s.key) ?? "");
      if (form.get(`${s.key}__clear`) === "1") values.push([s.key, ""]);
      else if (v) {
        if (v.length > 255 || /[\r\n]/.test(v)) bad(s.key);
        if (s.key === "gamewe_steam_api_key" && !steamKey(v)) bad(s.key);
        values.push([s.key, s.key === "gamewe_steam_api_key" ? v.trim() : v]);
      }
      continue;
    }
    if (s.type === "bool") {
      // A switch: the hidden "0" always, "1" as well when it is on.
      const sent = form.getAll(s.key).map(String);
      if (!sent.length || sent.some((x) => x !== "0" && x !== "1")) bad(s.key);
      values.push([s.key, sent.includes("1") ? "1" : "0"]);
      continue;
    }
    const v = String(form.get(s.key) ?? "").trim();
    if (s.type === "number") {
      const n = Number(v);
      if (!v || !Number.isInteger(n) || (s.min !== undefined && n < s.min) || (s.max !== undefined && n > s.max)) {
        bad(s.key);
      }
    } else if (
      (s.type === "choice" && !s.choices?.some(([c]) => c === v)) ||
      (s.type === "template" && !(await listTemplates()).some((t) => t.id === v))
    ) {
      bad(s.key);
    } else if (v.length > 255) {
      bad(s.key);
    } else if (s.key === "gamewe_ts_host" && v) {
      const host = tsHost(v);
      if (!host) bad(s.key);
      values.push([s.key, host!]);
      continue;
    } else if ((s.key === "gamewe_ts_display" && v && !tsDisplay(v)) || (s.key === "gamewe_ts_link" && v && !tsLink(v))) {
      bad(s.key);
    } else if (s.key === "gamewe_discord_invite" && v) {
      const invite = discordInvite(v);
      if (!invite) bad(s.key);
      values.push([s.key, invite!]);
      continue;
    } else if (s.key === "gamewe_discord_guild" && v && !discordGuild(v)) {
      bad(s.key);
    } else if ((s.key === "gamewe_header_logo" || s.key === "gamewe_favicon" || s.key === "gamewe_apple_icon") && v && !imageUrl(v)) {
      bad(s.key);
    } else if ((s.key === "gamewe_title_format" || s.key === "gamewe_title_ranking") && !v.includes("{page}")) {
      bad(s.key);
    } else if (s.key === "gamewe_sourcebans_url" && v) {
      const base = sourcebansBase(v);
      if (!base) bad(s.key);
      values.push([s.key, base!]);
      continue;
    }
    values.push([s.key, v]);
  }
  const removed: string[] = [];
  if (isRaw) {
    // Other keys (raw values): the form sends each key with its index; only
    // keys that exist as raw rows are written or deleted.
    const rawKeys = new Set((await rawOptions()).map((r) => r.keyname));
    for (const [name, entry] of form.entries()) {
      const m = /^raw_key_(\d{1,4})$/.exec(name);
      if (!m) continue;
      const key = String(entry);
      if (!rawKeys.has(key) || READONLY_OPTIONS.includes(key)) continue;
      if (form.get(`raw_del_${m[1]}`) === "1") {
        removed.push(key);
        continue;
      }
      const v = String(form.get(`raw_val_${m[1]}`) ?? "");
      if (v.length > 255 || /[\r\n]/.test(v)) bad(`raw:${key}`);
      values.push([key, v]);
    }
    const newKey = String(form.get("raw_new_key") ?? "").trim();
    if (newKey) {
      const v = String(form.get("raw_new_val") ?? "");
      if (!rawKeyAllowed(newKey) || rawKeys.has(newKey) || v.length > 255 || /[\r\n]/.test(v)) bad("raw_new");
      const exists = await adminQuery(`SELECT keyname FROM hlstats_Options WHERE keyname = ?`, [newKey]);
      if (exists.length) bad("raw_new");
      values.push([newKey, v]);
    }
  }
  for (const [k, v] of values) {
    await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [k, v]);
  }
  for (const k of removed) await adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [k]);
  invalidateSettings();
  invalidateSteamKey();
  if (a.via) console.info(`gameWE: settings ${groupId} changed (${values.map(([k]) => k).join(", ") || "-"}${removed.length ? `; removed ${removed.join(", ")}` : ""}) by ${who(a)}`);
  return { written: values.map(([k]) => k), removed };
}

// The operator's part of the privacy page.
export async function savePrivacy(a: Actor, form: Form): Promise<void> {
  const res = operatorValues(form);
  if ("field" in res) throw new OpError("field", { field: res.field });
  for (const [k, v] of res.values) {
    await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [k, v]);
  }
  if (a.via) console.info(`gameWE: privacy page operator data changed by ${who(a)}`);
}

// ---------------------------------------------------------------- rankings

// Queues a reset of ranking `game` (the caller has checked the confirmation).
export async function resetRanking(a: Actor, game: string, mode: ResetMode): Promise<{ id: number; existing: boolean }> {
  await checkResettable(game);
  if (!(await jobsAvailable())) throw new OpError("nojobs");
  let job: { id: number; existing: boolean };
  try {
    job = await queueReset(game, mode, a.user.username);
  } catch (e) {
    console.error(`gameWE: reset job for ${game} not queued: ${e instanceof Error ? e.message : e}`);
    throw new OpError("db", { msg: dbMsg(e) });
  }
  console.info(`gameWE: reset of ranking ${game} (${mode}) queued as job ${job.id} by ${who(a)}${job.existing ? " (already queued)" : ""}`);
  return job;
}

export async function setRankingBots(a: Actor, game: string, next: RankingBots): Promise<number> {
  if (!(await rankingExists(game))) throw new OpError("notfound");
  const n = await saveRankingBots(game, next);
  console.info(`gameWE: bots of ranking ${game} ${next.ranked ? "ranked" : "hidden"}, ${next.points ? "with" : "without"} points, kills of bots ${next.kills ? "counted" : "not counted"} for the career rank, bots ${next.stats ? "in" : "not in"} the stats${n ? ` (${n} bots changed)` : ""}, by ${who(a)}`);
  return n;
}

export async function setRankingVac(a: Actor, game: string, on: boolean): Promise<void> {
  if (!(await rankingExists(game))) throw new OpError("notfound");
  await saveRankingBlockVac(game, on);
  console.info(`gameWE: VAC block of ranking ${game} ${on ? "on" : "off"}, by ${who(a)}`);
}

// The schedule of the hall of fame forms: every N units with the start day
// of the period (day of the month, weekday or date). null: invalid input.
export function scheduleFromForm(form: Form): string | null {
  const unit = String(form.get("unit") ?? "");
  const every = Number(form.get("every") ?? 1);
  if (!Number.isInteger(every) || every < 1 || every > MAX_EVERY || !["day", "week", "month", "quarter", "year"].includes(unit)) return null;
  let anchor = "";
  if (unit === "month" || unit === "quarter") anchor = String(form.get("mday") ?? "1");
  else if (unit === "week") anchor = String(form.get("wday") ?? "1");
  else if (unit === "year") anchor = `${String(form.get("ymonth") ?? "1").padStart(2, "0")}-${String(form.get("yday") ?? "1").padStart(2, "0")}`;
  const s = parseSchedule(anchor ? `${every} ${unit}@${anchor}` : `${every} ${unit}`);
  return s ? scheduleValue(s) : null;
}

// Scheduled reset and hall of fame page of one ranking. Turning a schedule
// on or changing it must be confirmed (understood=yes): the ranking is then
// reset at the end of every period.
export async function setRankingHall(a: Actor, game: string, src: string, mode: ResetMode | null, page: string, form: Form): Promise<void> {
  await checkResettable(game);
  if ((src !== "global" && src !== "own" && src !== "off") || !mode || (page !== "auto" && page !== "on" && page !== "off")) throw new OpError("input");
  const schedule = src === "own" ? scheduleFromForm(form) : "";
  if (schedule === null) throw new OpError("input");
  const now = await hallSettings(game);
  if (!now.table) throw new OpError("table");
  const after = src === "global" ? scheduleValue(now.global.schedule) : schedule;
  const afterMode = src === "global" ? now.global.mode : mode;
  const changed = after !== scheduleValue(now.effective) || (after && afterMode !== now.effectiveMode);
  if (after && changed && form.get("understood") !== "yes") throw new OpError("confirm");
  await saveHallSettings(game, src, schedule, mode, page);
  invalidateHallOfFame();
  const what = src === "global" ? "as for all rankings" : schedule ? `${schedule} (${mode})` : "off";
  console.info(`gameWE: reset schedule of ranking ${game} set to ${what}, hall of fame page ${page}, by ${who(a)}`);
}

// The reset schedule for all rankings.
export async function setGlobalHall(a: Actor, enabled: boolean, mode: ResetMode | null, form: Form): Promise<void> {
  const schedule = scheduleFromForm(form);
  if (schedule === null || !mode) throw new OpError("input");
  const now = await globalHall();
  const changed = !now.enabled || schedule !== scheduleValue(now.schedule) || mode !== now.mode;
  if (enabled && changed && form.get("understood") !== "yes") throw new OpError("confirm");
  await saveGlobalHall(enabled, schedule, mode);
  invalidateHallOfFame();
  console.info(`gameWE: reset schedule for all rankings ${schedule} (${mode}) switched ${enabled ? "on" : "off"}, by ${who(a)}`);
}

// Removes or brings back hall of fame entries: one place, or a whole period
// (place null). Removing must be confirmed.
export async function setHallEntry(a: Actor, game: string, start: string, place: number | null, op: string, confirmed: boolean): Promise<number> {
  if (!(await rankingExists(game))) throw new OpError("notfound");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || (place !== null && (!Number.isInteger(place) || place < 1 || place > 99)) || (op !== "remove" && op !== "restore")) {
    throw new OpError("input");
  }
  if (op === "remove" && !confirmed) throw new OpError("confirm");
  const n = await setHallRemoved(game, start, place, op === "remove");
  invalidateHallOfFame();
  console.info(`gameWE: hall of fame of ranking ${game}, period ${start}${place === null ? "" : ` place ${place}`}: ${op === "remove" ? "removed" : "restored"} ${n} entries, by ${who(a)}`);
  return n;
}
