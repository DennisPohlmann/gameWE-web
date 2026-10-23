import "server-only";
import type { Entity, Field } from "./admin-entities";
import { hashPassword } from "./auth";
import { adminExec, adminInsert, adminQuery, likeOp, type Param } from "./db";

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

export async function listRows(e: Entity, opts: { game?: string; q?: string; page: number; pageSize?: number }) {
  const size = opts.pageSize ?? PAGE;
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
  const order = e.order
    .split(",")
    .map((s) => (s.trim().includes(".") ? s.trim() : `t.${s.trim()}`))
    .join(", ");
  const [rows, [count]] = await Promise.all([
    adminQuery<Row>(`SELECT ${selectCols(e)} FROM ${e.table} t ${e.join ?? ""} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [
      ...params,
      size + 1,
      (opts.page - 1) * size,
    ]),
    adminQuery<{ n: number | string }>(`SELECT COUNT(*) AS n FROM ${e.table} t ${e.join ?? ""} ${where}`, params),
  ]);
  return { rows: rows.slice(0, size), hasNext: rows.length > size, total: Number(count?.n ?? 0) };
}

export async function getRow(e: Entity, id: string): Promise<Row | undefined> {
  const { parts, params } = fixedWhere(e, "t");
  parts.push(`t.${e.pk} = ?`);
  const rows = await adminQuery<Row>(
    `SELECT ${selectCols(e)} FROM ${e.table} t ${e.join ?? ""} WHERE ${parts.join(" AND ")}`,
    [...params, e.pkIsText ? id : Number(id)],
  );
  return rows[0];
}

export async function optionList(kind: "games" | "clans"): Promise<[string, string][]> {
  if (kind === "games") {
    const g = await adminQuery<{ code: string; name: string }>(`SELECT TRIM(code) AS code, name FROM hlstats_Games ORDER BY display_id, name`);
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
      if (s === "-") return "";
      if (f.max && s.length > f.max) throw new InputError(f.name);
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
      return s;
  }
}

// Writes one row. id = null creates it. Returns the row's primary key.
export async function saveRow(e: Entity, id: string | null, form: FormData): Promise<string> {
  const values: Record<string, Param> = {};
  for (const f of e.fields) {
    if (f.readonly || f.virtual || (f.createOnly && id !== null)) continue;
    if (f.type === "password" && id === null && !String(form.get(f.name) ?? "").trim()) throw new InputError(f.name);
    const v = await parseValue(f, form.get(f.name));
    if (v !== undefined) values[f.name] = v;
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
    await adminExec(`UPDATE ${e.table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE ${e.pk} = ?`, [
      ...cols.map((c) => values[c]),
      e.pkIsText ? id : Number(id),
    ]);
  }
  return id;
}

export async function deleteRow(e: Entity, id: string) {
  await adminExec(`DELETE FROM ${e.table} WHERE ${e.pk} = ?`, [e.pkIsText ? id : Number(id)]);
}
