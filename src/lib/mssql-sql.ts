// T-SQL for Microsoft SQL Server from the queries written for MariaDB and
// PostgreSQL (? placeholders, the subset both understand), as the collector
// does it (internal/database/mssql.go):
//
//   - ? becomes @p1, @p2, ...; an array parameter becomes a list (IN (?)),
//     an empty one NULL
//   - LIMIT n [OFFSET m] and LIMIT m, n become OFFSET m ROWS FETCH NEXT n
//     ROWS ONLY, with ORDER BY (SELECT NULL) when that query has no ORDER BY
//   - `name` becomes [name]; TRUE and FALSE become 1 and 0
//   - IFNULL( becomes COALESCE(, LENGTH( and CHAR_LENGTH( become LEN(
//   - ROUND(x) gets its second argument, AVG(x) averages as float (SQL
//     Server's AVG of an integer column is an integer)
//   - a key repeated in an ORDER BY list (a sort column that is also a
//     tie-breaker) is left out the second time: SQL Server refuses it, and
//     it changes nothing in the order
//
// Strings, quoted identifiers and comments are left alone.

export type MssqlParam = string | number | null | (string | number)[];

export function toMssql(sql: string, params: MssqlParam[]): { text: string; values: (string | number | null)[] } {
  sql = dedupeOrderBy(fixCalls(sql));
  const values: (string | number | null)[] = [];
  const next = (): string => {
    if (used >= params.length) throw new Error(`query has more placeholders than the ${params.length} parameters`);
    const p = params[used++];
    if (Array.isArray(p)) return p.length ? p.map((v) => `@p${values.push(v)}`).join(", ") : "NULL";
    return `@p${values.push(p)}`;
  };
  let used = 0;
  let out = "";
  const ordered = [false]; // per paren depth: the query there has an ORDER BY
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" || c === '"') {
      const end = skipQuoted(sql, i);
      out += sql.slice(i, end);
      i = end - 1;
    } else if (c === "`") {
      const end = skipQuoted(sql, i);
      out += `[${sql.slice(i + 1, end - 1)}]`;
      i = end - 1;
    } else if ((c === "-" && sql[i + 1] === "-") || (c === "/" && sql[i + 1] === "*")) {
      const end = skipComment(sql, i);
      out += sql.slice(i, end);
      i = end - 1;
    } else if (c === "?") {
      out += next();
    } else if (c === "(") {
      ordered.push(false);
      out += c;
    } else if (c === ")") {
      if (ordered.length > 1) ordered.pop();
      out += c;
    } else if (isWordStart(c) && (i === 0 || !isWord(sql[i - 1]))) {
      let j = i;
      while (j < sql.length && isWord(sql[j])) j++;
      const word = sql.slice(i, j).toUpperCase();
      if (word === "ORDER") {
        ordered[ordered.length - 1] = true;
        out += sql.slice(i, j);
      } else if (word === "LIMIT") {
        const lim = parseLimit(sql, j, next, () => params[used]);
        if (!lim) {
          out += sql.slice(i, j);
        } else {
          out = out.trimEnd();
          if (!ordered[ordered.length - 1]) out += " ORDER BY (SELECT NULL)";
          // FETCH NEXT 0 is an error on SQL Server: LIMIT 0 skips past any table instead.
          out += lim.zero ? " OFFSET 9223372036854775806 ROWS FETCH NEXT 1 ROWS ONLY" : ` OFFSET ${lim.off} ROWS FETCH NEXT ${lim.n} ROWS ONLY`;
          j = lim.end;
        }
      } else if (word === "TRUE") {
        out += "1";
      } else if (word === "FALSE") {
        out += "0";
      } else {
        out += sql.slice(i, j);
      }
      i = j - 1;
    } else {
      out += c;
    }
  }
  if (used !== params.length) throw new Error(`query has ${used} placeholders but ${params.length} parameters`);
  return { text: out, values };
}

// What follows LIMIT at sql[i]: "n", "n OFFSET m" or "m, n", each a number or
// a ? (taken with next() in the order of the text; peek() is the value the
// next ? takes). zero: the limit is 0.
function parseLimit(sql: string, i: number, next: () => string, peek: () => MssqlParam | undefined): { n: string; off: string; end: number; zero: boolean } | undefined {
  const tok = (k: number): [string, number] => {
    while (k < sql.length && /\s/.test(sql[k])) k++;
    if (sql[k] === "?" || sql[k] === ",") return [sql[k], k + 1];
    let j = k;
    while (j < sql.length && isWord(sql[j])) j++;
    return [sql.slice(k, j), j];
  };
  const val = (t: string) => (t === "?" ? next() : /^\d+$/.test(t) ? t : undefined);
  const isZero = (t: string) => (t === "?" ? Number(peek()) === 0 : t === "0");
  const [t1, j1] = tok(i);
  const zero1 = isZero(t1);
  const first = val(t1);
  if (first === undefined) return undefined;
  const [t2, j2] = tok(j1);
  if (t2 === ",") {
    const [t3, j3] = tok(j2);
    const zero = isZero(t3);
    const n = val(t3);
    return n === undefined ? undefined : { n, off: first, end: j3, zero };
  }
  if (t2.toUpperCase() === "OFFSET") {
    const [t3, j3] = tok(j2);
    const off = val(t3);
    return off === undefined ? undefined : { n: first, off, end: j3, zero: zero1 };
  }
  return { n: first, off: "0", end: j1, zero: zero1 };
}

function fixCalls(sql: string): string {
  const edits: { at: number; cut: number; s: string }[] = [];
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" || c === '"' || c === "`") {
      i = skipQuoted(sql, i) - 1;
      continue;
    }
    if ((c === "-" && sql[i + 1] === "-") || (c === "/" && sql[i + 1] === "*")) {
      i = skipComment(sql, i) - 1;
      continue;
    }
    if (!isWordStart(c) || (i > 0 && isWord(sql[i - 1]))) continue;
    let j = i;
    while (j < sql.length && isWord(sql[j])) j++;
    let k = j;
    while (sql[k] === " ") k++;
    if (sql[k] !== "(") {
      i = j - 1;
      continue;
    }
    const close = matchParen(sql, k);
    const name = sql.slice(i, j).toUpperCase();
    if (name === "IFNULL") edits.push({ at: i, cut: j - i, s: "COALESCE" });
    else if (name === "LENGTH" || name === "CHAR_LENGTH") edits.push({ at: i, cut: j - i, s: "LEN" });
    else if (name === "ROUND" && close > 0 && !topLevelComma(sql.slice(k + 1, close))) edits.push({ at: close, cut: 0, s: ", 0" });
    else if (name === "AVG" && close > 0) edits.push({ at: k + 1, cut: 0, s: "CAST(" }, { at: close, cut: 0, s: " AS float)" });
    i = j - 1;
  }
  // From the end, so the positions stay valid; at one position the edit
  // found later (IFNULL inside AVG) first.
  edits.sort((a, b) => a.at - b.at);
  for (let e = edits.length - 1; e >= 0; e--) {
    const x = edits[e];
    sql = sql.slice(0, x.at) + x.s + sql.slice(x.at + x.cut);
  }
  return sql;
}

function dedupeOrderBy(sql: string): string {
  const re = /\bORDER\s+BY\s/gi;
  let out = "";
  let from = 0;
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    if (inQuoteOrComment(sql, m.index)) continue;
    const start = m.index + m[0].length;
    // The list ends at the paren closing its query, a clause keyword or the end.
    let depth = 0;
    let end = sql.length;
    const cuts: number[] = [];
    for (let i = start; i < sql.length; i++) {
      const c = sql[i];
      if (c === "'" || c === '"' || c === "`") {
        i = skipQuoted(sql, i) - 1;
      } else if (c === "(") {
        depth++;
      } else if (c === ")") {
        if (depth-- === 0) {
          end = i;
          break;
        }
      } else if (depth === 0 && c === ",") {
        cuts.push(i);
      } else if (depth === 0 && c === ";") {
        end = i;
        break;
      } else if (depth === 0 && /\s/.test(c) && /^\s+(LIMIT|OFFSET|FETCH|UNION|FOR)\b/i.test(sql.slice(i, i + 12))) {
        end = i;
        break;
      }
    }
    const items: string[] = [];
    let at = start;
    for (const cut of [...cuts, end]) {
      items.push(sql.slice(at, cut));
      at = cut + 1;
    }
    const seen = new Set<string>();
    const kept = items.filter((it) => {
      const key = it.trim().replace(/\s+(ASC|DESC)$/i, "").replace(/\s+/g, " ").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (kept.length === items.length) continue;
    out += sql.slice(from, start) + kept.map((s) => s.trim()).join(", ") + (end < sql.length && /\S/.test(sql[end]) && sql[end] !== ")" && sql[end] !== ";" ? " " : "");
    from = end;
    re.lastIndex = end;
  }
  return out + sql.slice(from);
}

// Whether position at lies inside a string, quoted name or comment.
function inQuoteOrComment(s: string, at: number): boolean {
  for (let i = 0; i < at; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === "`") {
      const end = skipQuoted(s, i);
      if (end > at) return true;
      i = end - 1;
    } else if ((c === "-" && s[i + 1] === "-") || (c === "/" && s[i + 1] === "*")) {
      const end = skipComment(s, i);
      if (end > at) return true;
      i = end - 1;
    }
  }
  return false;
}

function matchParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === "`") i = skipQuoted(s, i) - 1;
    else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return -1;
}

function topLevelComma(s: string): boolean {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === "`") i = skipQuoted(s, i) - 1;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) return true;
  }
  return false;
}

// The end (exclusive) of the quoted text at s[i]; a doubled quote is escaped.
function skipQuoted(s: string, i: number): number {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] !== q) continue;
    if (s[j + 1] === q) {
      j++;
      continue;
    }
    return j + 1;
  }
  return s.length;
}

function skipComment(s: string, i: number): number {
  if (s[i] === "-") {
    const end = s.indexOf("\n", i);
    return end < 0 ? s.length : end;
  }
  const end = s.indexOf("*/", i + 2);
  return end < 0 ? s.length : end + 2;
}

const isWordStart = (c: string) => /[A-Za-z_]/.test(c);
const isWord = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_@$]/.test(c);
