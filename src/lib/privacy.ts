import "server-only";
import { query } from "./db";
import { ALL_OPERATOR_KEYS, EMPTY_OPERATOR, readOperator, type Operator } from "./privacy-operator";

// The operator's part of the privacy page and the satellite setting of the
// player map, read with the public (SELECT-only) user: what the page shows
// is public anyway. Not cached: the page is rarely opened and must show a
// saved change at once.
export async function getPrivacyOptions(): Promise<{ operator: Operator; satellite: string }> {
  try {
    const rows = await query<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [
      [...ALL_OPERATOR_KEYS, "gamewe_map_satellite"],
    ]);
    const o = Object.fromEntries(rows.map((r) => [r.keyname, r.value ?? ""]));
    return { operator: readOperator(o), satellite: o.gamewe_map_satellite ?? "" };
  } catch {
    return { operator: EMPTY_OPERATOR, satellite: "" };
  }
}
