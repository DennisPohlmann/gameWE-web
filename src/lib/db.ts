import "server-only";
import { siteDay } from "./day";
import { env } from "./env";
import { DEFAULT_TABLE_PREFIX, normalizeTablePrefix, prefixSql } from "./table-prefix";
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import pg from "pg";

// Access to the collector's HLstatsX/gameME database, on MariaDB/MySQL or
// PostgreSQL (DB_TYPE). Queries are written once, in the subset both
// understand, with ? placeholders; the few differences go through the helpers
// below (sinceDays, likeOp, upsert, adminInsert).
//
// Timestamps in the schema are Unix seconds (integer columns); the few DATE
// and DATETIME columns are read as plain strings so no time zone is applied
// twice.

export type Dialect = "mariadb" | "postgres";

export function dialect(): Dialect {
  const t = (env("DB_TYPE") ?? "mariadb").toLowerCase();
  if (t === "postgres" || t === "postgresql" || t === "pg") return "postgres";
  if (t === "mariadb" || t === "mysql" || t === "") return "mariadb";
  throw new Error(`DB_TYPE must be mariadb or postgres, not "${t}"`);
}

const isPg = () => dialect() === "postgres";

// ---------------------------------------------------------------- SQL helpers

// "column >= <first day of the last n days>", for DATE columns. Today is the
// site's day (TZ, see day.ts), not the database's.
export function sinceDays(column: string): string {
  const today = siteDay();
  return isPg()
    ? `${column} >= DATE '${today}' - CAST(? AS integer)`
    : `${column} >= DATE '${today}' - INTERVAL ? DAY`;
}

// Case-insensitive LIKE. MariaDB's collations already ignore case.
export function likeOp(): string {
  return isPg() ? "ILIKE" : "LIKE";
}

// INSERT that updates `update` when a row with the same `key` exists.
export function upsert(table: string, cols: string[], key: string[], update: string[]): string {
  const head = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  return isPg()
    ? `${head} ON CONFLICT (${key.join(", ")}) DO UPDATE SET ${update.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`
    : `${head} ON DUPLICATE KEY UPDATE ${update.map((c) => `${c} = VALUES(${c})`).join(", ")}`;
}

// ---------------------------------------------------------------- TLS

// DB_TLS: off (default), required (verify the certificate) or skip-verify.
function tls(): { rejectUnauthorized: boolean; ca?: string } | undefined {
  const mode = (env("DB_TLS") ?? "off").toLowerCase();
  if (["", "off", "disable", "disabled", "false", "0"].includes(mode)) return undefined;
  if (!["required", "require", "verify", "verify-full", "skip-verify", "insecure"].includes(mode)) {
    throw new Error(`DB_TLS must be off, required or skip-verify, not "${mode}"`);
  }
  const ca = env("DB_TLS_CA");
  return {
    rejectUnauthorized: mode !== "skip-verify" && mode !== "insecure",
    ...(ca ? { ca: readFileSync(ca, "utf8") } : {}),
  };
}

// ---------------------------------------------------------------- drivers

type Result = { rows: Record<string, unknown>[]; affectedRows: number; insertId: number };

interface Driver {
  run(sql: string, params: Param[]): Promise<Result>;
}

function mariadbDriver(user: string | undefined, password: string | undefined, limit: number): Driver {
  const pool = mysql.createPool({
    host: env("DB_HOST") ?? "127.0.0.1",
    port: Number(env("DB_PORT") ?? 3306),
    user,
    password,
    database: env("DB_NAME") ?? "gamewe",
    ssl: tls(),
    charset: "utf8mb4",
    connectionLimit: limit,
    decimalNumbers: true,
    supportBigNumbers: true,
    dateStrings: true,
  });
  return {
    async run(sql, params) {
      const [res] = await pool.query(sql, params);
      if (Array.isArray(res)) return { rows: res as Record<string, unknown>[], affectedRows: 0, insertId: 0 };
      const h = res as mysql.ResultSetHeader;
      return { rows: [], affectedRows: h.affectedRows, insertId: h.insertId };
    },
  };
}

// Numbers come back as numbers, dates as the plain strings MariaDB gives.
let pgTypesSet = false;
function setPgTypes() {
  if (pgTypesSet) return;
  pgTypesSet = true;
  const { builtins } = pg.types;
  pg.types.setTypeParser(builtins.INT8, (v) => Number(v));
  pg.types.setTypeParser(builtins.NUMERIC, (v) => Number(v));
  for (const t of [builtins.DATE, builtins.TIMESTAMP, builtins.TIMESTAMPTZ]) pg.types.setTypeParser(t, (v) => v);
}

// ? placeholders become $1, $2, ...; an array parameter becomes a list, as
// with mysql2 ("IN (?)"). Question marks inside '...' literals are left alone.
function toPg(sql: string, params: Param[]): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  let text = "";
  let i = 0;
  let quoted = false;
  for (const ch of sql) {
    if (ch === "'") quoted = !quoted;
    if (ch !== "?" || quoted) {
      text += ch;
      continue;
    }
    const p = params[i++];
    if (Array.isArray(p)) {
      text += p.length ? p.map((v) => `$${values.push(v)}`).join(", ") : "NULL";
    } else {
      text += `$${values.push(p)}`;
    }
  }
  if (i !== params.length) throw new Error(`query has ${i} placeholders but ${params.length} parameters`);
  return { text, values };
}

// Postgres folds unquoted names to lower case, so "SELECT playerId" returns
// "playerid". Result keys are mapped back to the spelling used in the query.
const keyMaps = new Map<string, Map<string, string>>();
function keyMap(sql: string): Map<string, string> {
  let m = keyMaps.get(sql);
  if (m) return m;
  m = new Map();
  for (const w of sql.replace(/'[^']*'/g, "''").match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
    if (w !== w.toLowerCase()) m.set(w.toLowerCase(), w);
  }
  if (keyMaps.size > 1000) keyMaps.clear();
  keyMaps.set(sql, m);
  return m;
}

function postgresDriver(user: string | undefined, password: string | undefined, limit: number): Driver {
  setPgTypes();
  const pool = new pg.Pool({
    host: env("DB_HOST") ?? "127.0.0.1",
    port: Number(env("DB_PORT") ?? 5432),
    user,
    password,
    database: env("DB_NAME") ?? "gamewe",
    ssl: tls() ?? false,
    max: limit,
  });
  // An idle client losing its connection must not take the process down.
  pool.on("error", (err) => console.error("postgres:", err.message));
  return {
    async run(sql, params) {
      const { text, values } = toPg(sql, params);
      const res = await pool.query(text, values);
      const map = keyMap(sql);
      const rows = res.rows.map((r: Record<string, unknown>) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) out[map.get(k) ?? k] = v;
        return out;
      });
      const id = rows[0] ? Number(Object.values(rows[0])[0]) : 0;
      return { rows, affectedRows: res.rowCount ?? 0, insertId: Number.isFinite(id) ? id : 0 };
    },
  };
}

// The queries name the tables hlstats_*; with DB_TABLE_PREFIX (the
// collector's database.table_prefix) the driver rewrites them (table-prefix.ts).
function createDriver(user: string | undefined, password: string | undefined, limit: number): Driver {
  const d = isPg() ? postgresDriver(user, password, limit) : mariadbDriver(user, password, limit);
  const prefix = normalizeTablePrefix(env("DB_TABLE_PREFIX"));
  if (prefix === DEFAULT_TABLE_PREFIX) return d;
  return { run: (sql, params) => d.run(prefixSql(prefix, sql), params) };
}

declare global {
  var __gameweDb: Driver | undefined;
  var __gameweAdminDb: Driver | undefined;
}

function db(): Driver {
  globalThis.__gameweDb ??= createDriver(env("DB_USER"), env("DB_PASSWORD"), 10);
  return globalThis.__gameweDb;
}

// The admin area writes. It may use its own database user (DB_ADMIN_USER),
// so the public pages can run with SELECT rights only.
function adminDb(): Driver {
  globalThis.__gameweAdminDb ??= env("DB_ADMIN_USER")
    ? createDriver(env("DB_ADMIN_USER"), env("DB_ADMIN_PASSWORD"), 3)
    : db();
  return globalThis.__gameweAdminDb;
}

// ---------------------------------------------------------------- queries

export type Param = string | number | null | (string | number)[];

export async function query<T>(sql: string, params: Param[] = []): Promise<T[]> {
  return (await db().run(sql, params)).rows as T[];
}

export async function queryOne<T>(sql: string, params: Param[] = []): Promise<T | undefined> {
  return (await query<T>(sql, params))[0];
}

export async function adminExec(sql: string, params: Param[] = []): Promise<{ affectedRows: number }> {
  return adminDb().run(sql, params);
}

// INSERT that returns the new row's generated key (`pk`).
export async function adminInsert(table: string, values: Record<string, Param>, pk: string): Promise<number> {
  const cols = Object.keys(values);
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  const res = await adminDb().run(isPg() ? `${sql} RETURNING ${pk}` : sql, cols.map((c) => values[c]));
  return res.insertId;
}

export async function adminQuery<T>(sql: string, params: Param[] = []): Promise<T[]> {
  return (await adminDb().run(sql, params)).rows as T[];
}
