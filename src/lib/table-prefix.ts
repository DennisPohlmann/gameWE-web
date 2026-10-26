// Table prefix (DB_TABLE_PREFIX), the same value as database.table_prefix
// of the collector. The queries name the tables hlstats_<Name>; with another
// prefix every statement is rewritten before it is sent (prefixSql), so the
// database has <prefix>_<Name>. String literals and comments stay as they
// are. With the default prefix (hlstats) nothing changes.

export const DEFAULT_TABLE_PREFIX = "hlstats";
const CODE = "hlstats_";
const MAX = 16;

// The prefix without one trailing "_" (hlstats_ and hlstats are the same);
// throws on an invalid value, as the collector refuses it.
export function normalizeTablePrefix(raw: string | undefined): string {
  let p = (raw ?? "").trim();
  if (p.endsWith("_")) p = p.slice(0, -1);
  if (p === "") return DEFAULT_TABLE_PREFIX;
  if (p.length > MAX || !/^[A-Za-z][A-Za-z0-9_]*$/.test(p) || p.endsWith("_")) {
    throw new Error(`DB_TABLE_PREFIX "${raw}": a letter, then letters, digits and _, at most ${MAX} characters`);
  }
  const l = p.toLowerCase();
  if (l.startsWith(CODE) || l === "gamewe") {
    throw new Error(`DB_TABLE_PREFIX "${raw}": may not start with ${CODE} or be gamewe`);
  }
  return p;
}

const isIdent = (c: string) => /[A-Za-z0-9_$\u0080-￿]/.test(c);

// The name a table of the queries (hlstats_Players) has in the database.
export function prefixTable(prefix: string, name: string): string {
  if (prefix === DEFAULT_TABLE_PREFIX || name.length <= CODE.length || name.slice(0, CODE.length).toLowerCase() !== CODE) {
    return name;
  }
  return `${prefix}_${name.slice(CODE.length)}`;
}

// Rewrites every identifier that starts with hlstats_ (also inside `...`
// or "..."), outside '...' literals and -- or /* */ comments.
export function prefixSql(prefix: string, sql: string): string {
  if (prefix === DEFAULT_TABLE_PREFIX || !sql.toLowerCase().includes(CODE)) return sql;
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    let end = i + 1;
    if (c === "'") {
      end = i + 1;
      while (end < sql.length) {
        if (sql[end] === "'") {
          if (sql[end + 1] === "'") {
            end += 2;
            continue;
          }
          end++;
          break;
        }
        end++;
      }
      out += sql.slice(i, end);
    } else if (c === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      end = nl < 0 ? sql.length : nl;
      out += sql.slice(i, end);
    } else if (c === "/" && sql[i + 1] === "*") {
      const close = sql.indexOf("*/", i + 2);
      end = close < 0 ? sql.length : close + 2;
      out += sql.slice(i, end);
    } else if (isIdent(c) && (i === 0 || !isIdent(sql[i - 1]))) {
      while (end < sql.length && isIdent(sql[end])) end++;
      out += prefixTable(prefix, sql.slice(i, end));
    } else {
      out += c;
    }
    i = end;
  }
  return out;
}
