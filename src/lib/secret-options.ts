// API keys and passwords of the settings. They live in hlstats_gamewe_secrets,
// which the public database user cannot read, so a SQL injection on a public
// page does not reach them; values the public never sees, read with the admin
// user and kept for 30 seconds. Until the collector has migrated the database
// they are still in hlstats_Options.
import "server-only";
import { adminExec, adminQuery, query, upsert } from "./db";

export const SECRET_OPTIONS: readonly string[] = ["gamewe_steam_api_key", "gamewe_ts_query_password", "gamewe_ts_password", "gamewe_metrics_token", "gamewe_fastdl_password", "gamewe_fastdl_token", "gamewe_fastdl_header"];

const noTable = (err: unknown) => {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "ER_NO_SUCH_TABLE" || code === "42P01";
};

let cache: { at: number; value: Record<string, string> } | null = null;

async function read(): Promise<Record<string, string>> {
  let rows: { keyname: string; value: string | null }[];
  try {
    rows = await adminQuery(`SELECT keyname, value FROM hlstats_gamewe_secrets WHERE keyname IN (?)`, [[...SECRET_OPTIONS]]);
  } catch (err) {
    if (!noTable(err)) throw err;
    rows = await query(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [[...SECRET_OPTIONS]]);
  }
  return Object.fromEntries(rows.map((r) => [r.keyname, r.value ?? ""]));
}

/** The stored secrets by key; empty when the database cannot be read or this
 *  site has no admin database user. Never log or send these to a browser. */
export async function secretOptions(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  let value: Record<string, string> = {};
  try {
    value = await read();
  } catch {
    // Database down or no rights: the environment alone.
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Secrets by key that are not in SECRET_OPTIONS (e.g. per ranking), read
 *  each time; empty when they cannot be read. */
export async function secretsOf(keys: string[]): Promise<Record<string, string>> {
  if (!keys.length) return {};
  try {
    let rows: { keyname: string; value: string | null }[];
    try {
      rows = await adminQuery(`SELECT keyname, value FROM hlstats_gamewe_secrets WHERE keyname IN (?)`, [keys]);
    } catch (err) {
      if (!noTable(err)) throw err;
      rows = await query(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [keys]);
    }
    return Object.fromEntries(rows.map((r) => [r.keyname, r.value ?? ""]));
  } catch {
    return {};
  }
}

/** Removes stored secrets (no error when there are none). */
export async function deleteSecrets(keys: string[]): Promise<void> {
  if (!keys.length) return;
  invalidateSecrets();
  try {
    await adminExec(`DELETE FROM hlstats_gamewe_secrets WHERE keyname IN (?)`, [keys]);
  } catch (err) {
    if (!noTable(err)) throw err;
  }
  await adminExec(`DELETE FROM hlstats_Options WHERE keyname IN (?)`, [keys]);
}

export function invalidateSecrets() {
  cache = null;
}

export async function saveSecret(key: string, value: string): Promise<void> {
  invalidateSecrets();
  try {
    await adminExec(upsert("hlstats_gamewe_secrets", ["keyname", "value"], ["keyname"], ["value"]), [key, value]);
  } catch (err) {
    if (!noTable(err)) throw err;
    await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [key, value]);
  }
}
