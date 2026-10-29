import type { Entity, Field } from "./admin-entities";
import type { Setting } from "./admin-settings";
import type { Schedule } from "./hall-period";
import { headerOrder, parseHome, parseLink } from "./header-links";

// The admin API's JSON bodies (lib/admin-api.ts): checked strictly (unknown
// or read-only fields are refused, types must match) and turned into the
// same form fields the admin pages send, so lib/admin-ops.ts checks and
// writes them exactly as for the pages. Pure functions, tested in
// tests/admin-api.test.ts.

export type Entries = [string, string][];

export class BodyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly field?: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const bad = (code: string, field: string, message: string): never => {
  throw new BodyError(400, code, field, message);
};

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// The body must be an object with only these keys.
export function onlyKeys(body: unknown, allowed: readonly string[], required: readonly string[] = []): Record<string, unknown> {
  if (!isObject(body)) throw new BodyError(400, "invalid_body", undefined, "the body must be a JSON object");
  for (const k of Object.keys(body)) if (!allowed.includes(k)) bad("unknown_field", k, `unknown field ${k}; allowed: ${allowed.join(", ") || "none"}`);
  for (const k of required) if (body[k] === undefined) bad("missing_field", k, `${k} is required`);
  return body;
}

export function strField(b: Record<string, unknown>, k: string, max = 255): string {
  const v = b[k];
  if (typeof v !== "string" || v.length > max) bad("invalid_field", k, `${k} must be a string of at most ${max} characters`);
  return v as string;
}

export function boolField(b: Record<string, unknown>, k: string): boolean {
  if (typeof b[k] !== "boolean") bad("invalid_field", k, `${k} must be true or false`);
  return b[k] as boolean;
}

export function intField(b: Record<string, unknown>, k: string, min: number, max: number): number {
  const v = b[k];
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) bad("invalid_field", k, `${k} must be an integer from ${min} to ${max}`);
  return v as number;
}

export function enumField<T extends string>(b: Record<string, unknown>, k: string, values: readonly T[]): T {
  const v = b[k];
  if (typeof v !== "string" || !values.includes(v as T)) bad("invalid_field", k, `${k} must be one of ${values.join(", ")}`);
  return v as T;
}

// ---------------------------------------------------------------- entities

// Fields of an entity the API accepts: create takes the createOnly and
// virtual ones (a ranking's template) as well, a change does not.
export function writableFields(e: Entity, create: boolean): Field[] {
  return e.fields.filter((f) => !f.readonly && (create || (!f.createOnly && !f.virtual)));
}

// One field's JSON value as the edit form would send it, or throws.
function fieldValue(f: Field, v: unknown): string {
  const t = (what: string): never => bad("invalid_field", f.name, `${f.name} must be ${what}`);
  switch (f.type) {
    case "number":
      if (typeof v !== "number" || !Number.isSafeInteger(v)) t("an integer");
      return String(v);
    case "decimal":
      if (typeof v !== "number" || !Number.isFinite(v)) t("a number");
      return String(v);
    case "flag":
    case "bool":
      if (typeof v !== "boolean") t("true or false");
      return v ? "1" : "0";
    case "select":
      // The allowed values are checked by saveRow (admin-data.ts).
      if (typeof v === "number" && Number.isSafeInteger(v)) return String(v);
      if (typeof v !== "string") t("one of the allowed values (string)");
      return v as string;
    case "secret":
      // null clears it, as "-" does in the form.
      if (v === null) return "-";
      if (typeof v !== "string" || !v.trim()) t("a non-empty string, or null to clear it");
      return v as string;
    case "password":
      if (typeof v !== "string" || !v.trim()) t("a non-empty string");
      return v as string;
    default:
      if (typeof v !== "string") t("a string");
      return v as string;
  }
}

// The body of a create (POST) or change (PATCH) of an entity row: the form
// entries and, for a change, the fields to write.
export function entityInput(e: Entity, body: unknown, create: boolean): { entries: Entries; only?: Set<string> } {
  if (!isObject(body)) throw new BodyError(400, "invalid_body", undefined, "the body must be a JSON object");
  const writable = writableFields(e, create);
  const entries: Entries = [];
  for (const [k, v] of Object.entries(body)) {
    const f = writable.find((x) => x.name === k);
    if (!f) {
      if (e.fields.some((x) => x.name === k)) bad("read_only_field", k, `${k} cannot be ${create ? "set" : "changed"}`);
      bad("unknown_field", k, `unknown field ${k}; allowed: ${writable.map((x) => x.name).join(", ")}`);
    }
    entries.push([k, fieldValue(f!, v)]);
  }
  if (!create && !entries.length) throw new BodyError(400, "invalid_body", undefined, "nothing to change");
  return { entries, only: create ? undefined : new Set(entries.map(([k]) => k)) };
}

// A row as the API returns it: the key as `id`, numbers as numbers, flags
// as booleans, and for secrets only whether one is set (`<name>Set`).
// Passwords and secrets are never read.
export function entityRow(e: Entity, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { id: e.pkIsText ? String(row.__pk ?? "") : Number(row.__pk) };
  for (const f of e.fields) {
    if (f.virtual || f.type === "password") continue;
    if (f.type === "secret") {
      out[`${f.name}Set`] = Number(row[`${f.name}__set`] ?? 0) > 0 || row[`${f.name}__set`] === true;
      continue;
    }
    const v = row[f.name];
    if (v === undefined) continue;
    if (v === null) out[f.name] = null;
    else if (f.type === "number" || f.type === "decimal") out[f.name] = Number(v);
    else if (f.type === "flag" || f.type === "bool") out[f.name] = String(v) === "1" || v === true;
    else if (f.type === "select" && f.options === "clans") out[f.name] = Number(v);
    // Codes are char columns in some databases (padded with spaces).
    else out[f.name] = typeof v !== "string" ? String(v) : ["code", "game", "game_code"].includes(f.name) ? v.trim() : v;
  }
  return out;
}

// ---------------------------------------------------------------- settings

// The JSON value of a setting (stored value, or its default).
export function settingOut(s: Setting, stored: string | undefined): unknown {
  const v = stored ?? s.def;
  switch (s.type) {
    case "secret":
      return { set: !!stored };
    case "bool":
      return v === "1";
    case "number":
      return v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
    case "link":
      return parseLink(v) ?? null;
    case "home":
      return parseHome(v);
    case "order":
      return headerOrder(v);
    default:
      return v;
  }
}

// A change of some settings of one group (PATCH): the form entries the
// settings page would send for them, and the settings changed.
export function settingsInput(items: Setting[], body: unknown): { entries: Entries; only: Set<string> } {
  if (!isObject(body)) throw new BodyError(400, "invalid_body", undefined, "the body must be a JSON object");
  const entries: Entries = [];
  for (const [k, v] of Object.entries(body)) {
    const s = items.find((x) => x.key === k);
    if (!s) bad("unknown_field", k, `unknown setting ${k} in this group; allowed: ${items.map((x) => x.key).join(", ")}`);
    const t = (what: string): never => bad("invalid_field", k, `${k} must be ${what}`);
    switch (s!.type) {
      case "bool":
        if (typeof v !== "boolean") t("true or false");
        entries.push([k, "0"]);
        if (v) entries.push([k, "1"]);
        break;
      case "number":
        if (typeof v !== "number" || !Number.isSafeInteger(v)) t("an integer");
        entries.push([k, String(v)]);
        break;
      case "secret":
        if (v === null) entries.push([`${k}__clear`, "1"]);
        else if (typeof v === "string" && v) entries.push([k, v]);
        else t("a non-empty string, or null to clear it");
        break;
      case "home":
      case "link": {
        if (!isObject(v) || Object.keys(v).some((x) => x !== "label" && x !== "url") || typeof v.label !== "string" || typeof v.url !== "string") {
          t('an object { "label": string, "url": string }');
        }
        const o = v as { label: string; url: string };
        entries.push([`${k}__label`, o.label], [`${k}__url`, o.url]);
        break;
      }
      case "order":
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) t("an array of tab ids");
        entries.push([k, (v as string[]).join(",")]);
        break;
      default:
        if (typeof v !== "string") t("a string");
        entries.push([k, v as string]);
    }
  }
  if (!entries.length) throw new BodyError(400, "invalid_body", undefined, "nothing to change");
  return { entries, only: new Set(Object.keys(body)) };
}

// The raw options page: change or delete existing rows and add one new row,
// as the form's numbered fields.
export function rawInput(body: unknown): { entries: Entries; keys: string[]; created: string | null } {
  const b = onlyKeys(body, ["set", "delete", "create"]);
  const entries: Entries = [];
  const keys: string[] = [];
  let i = 0;
  if (b.set !== undefined) {
    if (!isObject(b.set)) bad("invalid_field", "set", 'set must be an object { "key": "value" }');
    for (const [k, v] of Object.entries(b.set as Record<string, unknown>)) {
      if (typeof v !== "string") bad("invalid_field", `set.${k}`, `set.${k} must be a string`);
      entries.push([`raw_key_${i}`, k], [`raw_val_${i}`, v as string]);
      keys.push(k);
      i++;
    }
  }
  if (b.delete !== undefined) {
    if (!Array.isArray(b.delete) || b.delete.some((x) => typeof x !== "string")) bad("invalid_field", "delete", "delete must be an array of keys");
    for (const k of b.delete as string[]) {
      if (keys.includes(k)) bad("invalid_field", "delete", `${k} is both set and deleted`);
      entries.push([`raw_key_${i}`, k], [`raw_del_${i}`, "1"]);
      keys.push(k);
      i++;
    }
  }
  if (i > 9999) bad("invalid_body", "set", "too many keys");
  let created: string | null = null;
  if (b.create !== undefined) {
    const c = onlyKeys(b.create, ["key", "value"], ["key", "value"]);
    created = strField(c, "key", 128);
    entries.push(["raw_new_key", created], ["raw_new_val", strField(c, "value")]);
  }
  if (!entries.length) throw new BodyError(400, "invalid_body", undefined, "nothing to change");
  return { entries, keys, created };
}

// The schedule object of the hall of fame endpoints as the form's fields
// (unit, every and the start day of the period).
export const SCHEDULE_UNITS = ["day", "week", "month", "quarter", "year"] as const;
export function scheduleInput(v: unknown, field = "schedule"): Entries {
  const s = onlyKeys(v, ["unit", "every", "monthDay", "weekday", "month", "day"], ["unit"]);
  const entries: Entries = [["unit", enumField(s, "unit", SCHEDULE_UNITS)]];
  if (s.every !== undefined) entries.push(["every", String(intField(s, "every", 1, 120))]);
  const num = (k: string, max: number) => (s[k] === undefined ? null : String(intField(s, k, 1, max)));
  const unit = entries[0][1];
  const mday = num("monthDay", 28);
  const wday = num("weekday", 7);
  const month = num("month", 12);
  const day = num("day", 28);
  const wrong = (k: string) => bad("invalid_field", `${field}.${k}`, `${field}.${k} does not fit the unit ${unit}`);
  if ((mday && unit !== "month" && unit !== "quarter") || (wday && unit !== "week") || ((month || day) && unit !== "year")) {
    wrong(mday ? "monthDay" : wday ? "weekday" : "month");
  }
  if (mday) entries.push(["mday", mday]);
  if (wday) entries.push(["wday", wday]);
  if (month) entries.push(["ymonth", month]);
  if (day) entries.push(["yday", day]);
  return entries;
}

// A stored schedule as the API shows it (the same object the endpoints
// accept); quarters are stored as 3 months.
export function scheduleOut(s: Schedule | null): Record<string, unknown> | null {
  if (!s) return null;
  if (s.unit === "week") return { unit: "week", every: s.every, weekday: s.day };
  if (s.unit === "month") return { unit: "month", every: s.every, monthDay: s.day };
  if (s.unit === "year") return { unit: "year", every: s.every, month: s.month, day: s.day };
  return { unit: s.unit, every: s.every };
}
