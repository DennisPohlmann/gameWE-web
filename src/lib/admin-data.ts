import "server-only";
import type { Entity, Field } from "./admin-entities";
import { HIDDEN_OPTION_PREFIXES, allSettings } from "./admin-settings";
import { hashPassword } from "./auth";
import { GAME_HAS_DATA } from "./games";
import { adminExec, adminInsert, adminQuery, likeOp, type Param } from "./db";
import { rankingBaseGames } from "./admin-rankings";
import { isLogSecret, isLogToken } from "./log-secret";
import { secretFormValue } from "./secret-field";
import { ttlCache } from "./ttl-cache";

export type Row = Record<string, string | number | null>;

const PAGE = 50;

// Optional columns that exist, per "table.column", checked once per process.
const columnCache = new Map<string, Promise<boolean>>();

function hasColumn(table: string, column: string) {
  const key = `${table}.${column}`;
  let hit = columnCache.get(key);
  if (!hit) {
    hit = adminQuery(`SELECT ${column} FROM ${table} WHERE 1 = 0`).then(
      () => true,
      () => false,
    );
    columnCache.set(key, hit);
  }
  return hit;
}

// hlstats_Options rows without a field on the settings page; secrets
// (HIDDEN_OPTION_PREFIXES) are left out in SQL, so they are never read.
export async function rawOptions(): Promise<{ keyname: string; value: string }[]> {
  const hidden = HIDDEN_OPTION_PREFIXES.map((p) => `LOWER(LEFT(keyname, ${p.length})) <> ?`).join(" AND ");
  const rows = await adminQuery<{ keyname: string; value: string | null }>(
    `SELECT keyname, value FROM hlstats_Options WHERE keyname NOT IN (?) AND ${hidden} ORDER BY keyname`,
    [allSettings.map((s) => s.key), ...HIDDEN_OPTION_PREFIXES],
  );
  return rows.map((r) => ({ keyname: r.keyname, value: r.value ?? "" }));
}

// The entity without the optional fields whose column the database lacks
// (e.g. hlstats_Games.realgame before the collector added it).
export async function withColumns(e: Entity): Promise<Entity> {
  const optional = e.fields.filter((f) => f.optional && !f.virtual);
  if (!optional.length) return e;
  const missing = new Set<string>();
  for (const f of optional) if (!(await hasColumn(e.table, f.name))) missing.add(f.name);
  return missing.size ? { ...e, fields: e.fields.filter((f) => !missing.has(f.name)) } : e;
}

function fixedWhere(e: Entity, alias: string) {
  const parts: string[] = [];
  const params: Param[] = [];
  for (const [k, v] of Object.entries(e.fixed ?? {})) {
    parts.push(`${alias}.${k} = ?`);
    params.push(v);
  }
  for (const prefix of e.hiddenPrefix ?? []) {
    parts.push(`LOWER(LEFT(${alias}.${e.pk}, ${prefix.length})) <> ?`);
    params.push(prefix.toLowerCase());
  }
  return { parts, params };
}

// What a read of the entity selects from: its table, or with alsoTable a
// union of both (inactive = 1 for the rows only in alsoTable). Table and
// column names are constants of the entity definition.
function source(e: Entity) {
  if (!e.alsoTable || !e.alsoColumns) return e.table;
  const cols = e.alsoColumns.join(", ");
  return `(SELECT ${cols}, 0 AS inactive FROM ${e.table}
    UNION ALL SELECT ${e.alsoColumns.map((c) => `a.${c}`).join(", ")}, 1 AS inactive FROM ${e.alsoTable} a
    WHERE NOT EXISTS (SELECT 1 FROM ${e.table} m WHERE m.${e.pk} = a.${e.pk}))`;
}

function selectCols(e: Entity) {
  const own = e.fields.filter(
    (f) => !f.virtual && f.type !== "password" && f.type !== "secret" && !(e.joinCols && f.readonly && f.name === "lastName"),
  );
  const cols = [`t.${e.pk} AS __pk`, ...own.map((f) => `t.${f.name}`)];
  // Secrets are never read back, only whether one is set.
  for (const f of e.fields) if (f.type === "secret") cols.push(`CHAR_LENGTH(t.${f.name}) > 0 AS ${f.name}__set`);
  if (e.joinCols) cols.push(e.joinCols);
  return cols.join(", ");
}

// The column a list can be sorted by: a list field of the entity that is a
// column of its table (or the joined player name). The name comes from the
// entity definition, never from the URL; anything else gives null.
export function listSortColumn(e: Entity, key: string): string | null {
  const f = e.fields.find((x) => x.name === key && x.inList && !x.virtual && x.type !== "password" && x.type !== "secret");
  if (!f) return null;
  return e.joinCols && f.readonly && f.name === "lastName" ? "d.lastName" : `t.${f.name}`;
}

export async function listRows(e: Entity, opts: { game?: string; q?: string; status?: string; page: number; pageSize?: number; sort?: string; asc?: boolean; noTotal?: boolean }) {
  const size = opts.pageSize ?? PAGE;
  const { parts, params } = fixedWhere(e, "t");
  // Only a condition of the entity's own list, chosen by its value.
  const status = e.statusFilter?.find((f) => f.value === opts.status);
  if (status) parts.push(status.where);
  if (opts.game && e.gameColumn) {
    parts.push(`t.${e.gameColumn} = ?`);
    params.push(opts.game);
  }
  if (opts.q && e.search?.length) {
    parts.push(`(${e.search.map((c) => `${c.includes(".") ? c : `t.${c}`} ${likeOp()} ?`).join(" OR ")})`);
    for (const _ of e.search) params.push(`%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const where = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  const sortCol = opts.sort ? listSortColumn(e, opts.sort) : null;
  // A chosen column first; the entity's order and the key break ties.
  const order = [
    ...(sortCol ? [`${sortCol} ${opts.asc ? "ASC" : "DESC"}`] : []),
    ...e.order.split(",").map((s) => (s.trim().includes(".") ? s.trim() : `t.${s.trim()}`)),
    ...(sortCol ? [`t.${e.pk}`] : []),
  ].join(", ");
  const [rows, [count]] = await Promise.all([
    adminQuery<Row>(`SELECT ${selectCols(e)} FROM ${source(e)} t ${e.join ?? ""} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [
      ...params,
      size + 1,
      (opts.page - 1) * size,
    ]),
    // The page takes the number from statusCounts, one scan less on large lists.
    opts.noTotal ? [] : adminQuery<{ n: number | string }>(`SELECT COUNT(*) AS n FROM ${source(e)} t ${e.join ?? ""} ${where}`, params),
  ]);
  return { rows: rows.slice(0, size), hasNext: rows.length > size, total: Number(count?.n ?? 0) };
}

// The number of rows per status filter (its buttons), with the list's
// ranking and search but no status; all in one pass. The conditions are
// constants of the entity definition.
// Lists over two tables scan hundreds of thousands of rows for it: kept for a minute.
const statusCountsCache = ttlCache<Record<string, number>>(60_000, 600_000, 500);

export function statusCounts(e: Entity, opts: { game?: string; q?: string }): Promise<Record<string, number>> {
  return e.alsoTable ? statusCountsCache(JSON.stringify([e.key, opts.game, opts.q]), () => loadStatusCounts(e, opts)) : loadStatusCounts(e, opts);
}

async function loadStatusCounts(e: Entity, opts: { game?: string; q?: string }): Promise<Record<string, number>> {
  if (!e.statusFilter?.length) return {};
  const { parts, params } = fixedWhere(e, "t");
  if (opts.game && e.gameColumn) {
    parts.push(`t.${e.gameColumn} = ?`);
    params.push(opts.game);
  }
  if (opts.q && e.search?.length) {
    parts.push(`(${e.search.map((c) => `${c.includes(".") ? c : `t.${c}`} ${likeOp()} ?`).join(" OR ")})`);
    for (const _ of e.search) params.push(`%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const where = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  // The player name is only needed for a search.
  const join = opts.q ? (e.join ?? "") : "";
  const sums = e.statusFilter.map((f, i) => `SUM(CASE WHEN ${f.where} THEN 1 ELSE 0 END) AS s${i}`).join(", ");
  const [r] = await adminQuery<Record<string, number | string | null>>(`SELECT COUNT(*) AS n, ${sums} FROM ${source(e)} t ${join} ${where}`, params);
  const out: Record<string, number> = { "": Number(r?.n ?? 0) };
  e.statusFilter.forEach((f, i) => (out[f.value] = Number(r?.[`s${i}`] ?? 0)));
  return out;
}

export async function getRow(e: Entity, id: string): Promise<Row | undefined> {
  const { parts, params } = fixedWhere(e, "t");
  parts.push(`t.${e.pk} = ?`);
  const rows = await adminQuery<Row>(
    `SELECT ${selectCols(e)} FROM ${source(e)} t ${e.join ?? ""} WHERE ${parts.join(" AND ")}`,
    [...params, e.pkIsText ? id : Number(id)],
  );
  return rows[0];
}

// withData: only rankings with a server or a player (filters); forms that
// assign a ranking keep all of them.
export async function optionList(kind: "games" | "clans", withData = false): Promise<[string, string][]> {
  if (kind === "games") {
    const g = await adminQuery<{ code: string; name: string }>(
      `SELECT TRIM(code) AS code, name FROM hlstats_Games${withData ? ` WHERE ${GAME_HAS_DATA}` : ""} ORDER BY display_id, name`,
    );
    return g.map((x) => [x.code, `${x.name} (${x.code})`]);
  }
  const c = await adminQuery<{ clanId: number; tag: string; game: string }>(`SELECT clanId, tag, game FROM hlstats_Clans ORDER BY tag LIMIT 2000`);
  return [["0", "-"], ...c.map((x): [string, string] => [String(x.clanId), `${x.tag} (${x.game})`])];
}

export class InputError extends Error {}

async function parseValue(f: Field, raw: FormDataEntryValue | null): Promise<Param | undefined> {
  const s = typeof raw === "string" ? raw.trim() : "";
  switch (f.type) {
    case "password":
      if (!s) return undefined;
      if (s.length < 10) throw new InputError(f.name);
      return hashPassword(s);
    case "secret":
      if (!s) return undefined;
      if (f.max && s.length > f.max) throw new InputError(f.name);
      if (f.valid && !f.valid(s)) throw new InputError(f.name);
      return s;
    case "number": {
      if (!s) {
        if (f.required) throw new InputError(f.name);
        return 0;
      }
      const n = Number(s);
      if (!Number.isInteger(n)) throw new InputError(f.name);
      if (f.min !== undefined && n < f.min) throw new InputError(f.name);
      if (f.maxValue !== undefined && n > f.maxValue) throw new InputError(f.name);
      return n;
    }
    case "decimal": {
      const n = Number(s.replace(",", "."));
      if (!s || !Number.isFinite(n)) throw new InputError(f.name);
      return n;
    }
    case "flag":
      return s === "1" ? "1" : "0";
    case "bool":
      return s === "1" ? 1 : 0;
    case "select": {
      const allowed = Array.isArray(f.options) ? f.options.map(([v]) => v) : (await optionList(f.options!)).map(([v]) => v);
      if (!allowed.includes(s)) throw new InputError(f.name);
      return /^\d+$/.test(s) && f.options === "clans" ? Number(s) : s;
    }
    default:
      if (f.required && !s) throw new InputError(f.name);
      if (f.max && s.length > f.max) throw new InputError(f.name);
      if (f.pattern && s && !f.pattern.test(s)) throw new InputError(f.name);
      if (f.normalize && s) {
        const n = f.normalize(s);
        if (n === null) throw new InputError(f.name);
        return n;
      }
      return s;
  }
}

// Writes one row. id = null creates it. Returns the row's primary key.
// only: write just these fields (the admin API's PATCH); without it every
// writable field, as the edit form sends them all.
export async function saveRow(e: Entity, id: string | null, form: Pick<FormData, "get">, only?: Set<string>): Promise<string> {
  const values: Record<string, Param> = {};
  for (const f of e.fields) {
    if (f.readonly || f.virtual || (f.createOnly && id !== null) || (only && !only.has(f.name))) continue;
    if (f.type === "password" && id === null && !String(form.get(f.name) ?? "").trim()) throw new InputError(f.name);
    let v: Param | undefined;
    if (f.type === "secret") {
      // Empty keeps it, "" (the Remove switch) clears it.
      const s = secretFormValue(form.get(f.name), form.get(`${f.name}__clear`));
      v = s === undefined || s === "" ? s : await parseValue(f, s);
    } else v = await parseValue(f, form.get(f.name));
    // A keepOnly choice (a retired game) may stay, but not be newly chosen.
    if (v !== undefined && f.keepOnly?.includes(String(v)) && (id === null || String((await getRow(e, id))?.[f.name] ?? "") !== String(v))) throw new InputError(f.name);
    if (v !== undefined) {
      values[f.name] = v;
      if (f.changedAt) values[f.changedAt] = Math.floor(Date.now() / 1000);
    }
  }
  // A server's log secret: a number for sv_logsecret, a token on Counter-Strike 2.
  if (e.key === "servers" && values.log_secret) {
    const game = String(values.game ?? (id === null ? "" : (await getRow(e, id))?.game ?? "")).trim();
    const cs2 = (await rankingBaseGames()).get(game) === "cs2";
    if (!(cs2 ? isLogToken : isLogSecret)(String(values.log_secret))) throw new InputError("log_secret");
  }
  if (id === null) {
    const key = String(values[e.pk] ?? "").toLowerCase();
    if (e.hiddenPrefix?.some((p) => key.startsWith(p.toLowerCase()))) throw new InputError(e.pk);
    Object.assign(values, e.fixed ?? {});
    const newId = await adminInsert(e.table, values, e.pk);
    return e.pkIsText ? String(values[e.pk]) : String(newId);
  }
  const cols = Object.keys(values);
  if (cols.length) {
    const key = e.pkIsText ? id : Number(id);
    const set = cols.map((c) => `${c} = ?`).join(", ");
    await adminExec(`UPDATE ${e.table} SET ${set} WHERE ${e.pk} = ?`, [...cols.map((c) => values[c]), key]);
    // An inactive player's row is in alsoTable (after a crash in both). The
    // admin database user may lack the right to change it (collector grants
    // before UPDATE on hlstats_PlayersInactive): then the field "inactive"
    // is at fault, the page says why.
    if (e.alsoTable && (await adminQuery(`SELECT 1 AS x FROM ${e.alsoTable} WHERE ${e.pk} = ?`, [key])).length) {
      try {
        await adminExec(`UPDATE ${e.alsoTable} SET ${set} WHERE ${e.pk} = ?`, [...cols.map((c) => values[c]), key]);
      } catch (err) {
        if (isDenied(err)) throw new InputError("inactive");
        throw err;
      }
    }
  }
  return id;
}

// The id of a server other than exceptId with this address and port, if any
// (hlstats_Servers has a unique key on both).
export async function otherServerAt(address: string, port: number, exceptId: string | null): Promise<number | null> {
  const rows = await adminQuery<{ serverId: number | string }>(
    `SELECT serverId FROM hlstats_Servers WHERE address = ? AND port = ? AND serverId <> ?`,
    [address, port, exceptId === null ? 0 : Number(exceptId)],
  );
  return rows.length ? Number(rows[0].serverId) : null;
}

// A write the database user has no right to (MySQL/MariaDB table or column
// access denied, PostgreSQL 42501).
function isDenied(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "ER_TABLEACCESS_DENIED_ERROR" || code === "ER_COLUMNACCESS_DENIED_ERROR" || code === "42501";
}

// A write that broke a unique key (MySQL/MariaDB ER_DUP_ENTRY, PostgreSQL 23505).
export function isDuplicateKey(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "ER_DUP_ENTRY" || code === "23505";
}

// The form's plain fields of a new row, to fill the form again after an
// error; passwords and secrets are never put into a URL.
export function keptValues(e: Entity, form: Pick<FormData, "get">): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const f of e.fields) {
    if (f.readonly || f.virtual || f.type === "password" || f.type === "secret") continue;
    const v = form.get(f.name);
    if (typeof v === "string" && v.trim()) kept[`v_${f.name}`] = v.trim().slice(0, f.max ?? 255);
  }
  return kept;
}

export async function deleteRow(e: Entity, id: string) {
  await adminExec(`DELETE FROM ${e.table} WHERE ${e.pk} = ?`, [e.pkIsText ? id : Number(id)]);
}
