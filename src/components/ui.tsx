import Link from "next/link";
import type { ReactNode } from "react";
import { AutoForm } from "@/components/auto-form";
import { noAutofill } from "@/lib/autofill";
import { basePath } from "@/lib/base-path";
import { FLAG_CODES } from "@/lib/flag-codes";
import { gameKind } from "@/lib/games";
import { shareText, winBarSplit } from "@/lib/shares";

// flag: the player's country (getPlayerFlags), shown before the name; without
// one the neutral placeholder keeps the names in line.
// plain (or flag.nolink): a bot without a profile, the name without a link.
export function PlayerLink({
  game,
  id,
  name,
  flag,
  plain = false,
}: {
  game: string;
  id: number;
  name: string | null;
  flag?: { flag: string | null; country: string | null; nolink?: boolean } | null;
  plain?: boolean;
}) {
  return (
    <>
      <Flag code={flag?.flag} title={flag?.country} />{" "}
      {plain || flag?.nolink ? (
        <span className="player">{name || `#${id}`}</span>
      ) : (
        <Link className="player" href={`/${game}/players/${id}`}>
          {name || `#${id}`}
        </Link>
      )}
    </>
  );
}

// Flat country flag (SVG from public/flags) with a light gloss, the same look
// as the language flags. An empty or unknown code (no GeoIP data yet) gets the
// neutral placeholder flags/unknown.svg of the same size, so names stay in line.
export function Flag({ code, title }: { code: string | null | undefined; title?: string | null }) {
  const c = (code ?? "").trim().toLowerCase();
  if (c === "bot") return <span className="bot-tag" title="Bot">BOT</span>;
  const known = FLAG_CODES.has(c);
  const label = title || (known ? c.toUpperCase() : undefined);
  return (
    <span
      className={known ? "flag flag-svg" : "flag flag-svg flag-unknown"}
      role={label ? "img" : undefined}
      title={label}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ backgroundImage: `url(${basePath}/flags/${known ? c : "unknown"}.svg)` }}
    />
  );
}

// Small tag with the ranking's base game, e.g. "CS:GO"; long shows the full name.
export function GameTag({ realgame, long = false }: { realgame: string | null | undefined; long?: boolean }) {
  const k = gameKind(realgame);
  return k ? (
    <span className={`game-tag ${k.engine}`} title={k.name}>
      {long ? k.name : k.short}
    </span>
  ) : null;
}

// Horizontal bar for a share 0..1.
// label: the value as text, in a fixed-width right-aligned slot after the
// bar, so bars line up whatever the number is (98 % vs. 100 %).
export function Bar({
  value,
  green = false,
  wide = false,
  activity = false,
  label,
}: {
  value: number | null;
  green?: boolean;
  wide?: boolean;
  // Red to green by value (player activity).
  activity?: boolean;
  label?: ReactNode;
}) {
  const v = value !== null && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const bar = (
    <span className={`bar${green ? " green" : ""}${wide ? " wide" : ""}`} aria-hidden="true">
      <span style={{ width: `${(v * 100).toFixed(1)}%`, background: activity ? activityColor(v) : undefined }} />
    </span>
  );
  return label === undefined ? (
    bar
  ) : (
    <span className="meter">
      {bar}
      <span className="meter-val">{label}</span>
    </span>
  );
}

// Percentage as gameME shows it in tables: a bar with the rounded value in
// it, the exact value (one decimal) on hover. Green from 30 %, yellow below.
// tone "share": a blue bar for a share of a total (kills %, headshots %),
// with one decimal ("0.5%", "<0.1%"), since a share of many entries is
// mostly below 1 %. fill: the bar width 0..1 when it should differ from the
// value, e.g. relative to the largest share of the table (relativeFill).
// Activity colour: red at 0 %, through yellow, to green at 100 %.
export function activityColor(v: number): string {
  const h = Math.round(120 * Math.max(0, Math.min(1, v)));
  return `linear-gradient(rgba(255, 255, 255, 0.35), rgba(0, 0, 0, 0.15)), hsl(${h} 80% 45%)`;
}

export function PctBar({ value, lang, tone, fill }: { value: number | null; lang: string; tone?: "share" | "activity"; fill?: number }) {
  // No basis (e.g. no kills, no shots): an empty bar at 0 %, not a blank cell.
  const n = value !== null && Number.isFinite(value) ? value : 0;
  const v = Math.max(0, Math.min(1, n));
  const w = fill !== undefined && Number.isFinite(fill) ? Math.max(0, Math.min(1, fill)) : v;
  const pct = n * 100;
  const exact = tone === "share" ? shareText(n, lang) : `${pct.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  return (
    <span className={`pbar${tone ? ` ${tone}` : v >= 0.3 ? " good" : v > 0 ? " low" : ""}`} title={exact}>
      <span className="pbar-fill" style={{ width: `${(w * 100).toFixed(1)}%`, background: tone === "activity" ? activityColor(v) : undefined }} />
      <span className="pbar-text">{tone === "share" ? exact : `${Math.round(pct)}%`}</span>
    </span>
  );
}

// Round wins of the two sides as one bar, CT (blue) left, T (red) right,
// with both percentages (winBarSplit: whole numbers, together 100). Without
// any win both sides get half, the tooltip says there is no data.
export function WinRatioBar({ ct, t, labels }: { ct: number; t: number; labels: { ct: string; t: string; noData: string } }) {
  const split = winBarSplit(ct, t);
  const title = split.data
    ? `${labels.ct} ${split.ct}% (${ct}) | ${labels.t} ${split.t}% (${t})`
    : `${labels.ct} ${split.ct}% | ${labels.t} ${split.t}% (${labels.noData})`;
  return (
    <span className="winbar" title={title} role="img" aria-label={title}>
      <span className="winbar-ct" style={{ width: `${split.ct}%` }}>
        {split.ct >= 20 ? `${split.ct}%` : ""}
      </span>
      <span className="winbar-t" style={{ width: `${split.t}%` }}>
        {split.t >= 20 ? `${split.t}%` : ""}
      </span>
    </span>
  );
}

export function Section({ id, title, aside, children }: { id?: string; title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section" id={id}>
      <header className="section-head">
        <h2>{title}</h2>
        {aside ? <div className="section-aside">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

// Placeholder of a part of the page that is still loading (Suspense
// fallback): a box with a few grey lines, a chart's height (chart) or the
// given class (e.g. the map's). Decorative only; aria-busy marks the wait.
export function Skeleton({ rows = 4, chart = false, className }: { rows?: number; chart?: boolean; className?: string }) {
  return (
    <div className={`skeleton${className ? ` ${className}` : chart ? " skeleton-chart" : " box"}`} aria-busy="true" aria-hidden="true">
      {className || chart ? null : Array.from({ length: rows }, (_, i) => <span key={i} className="skel-line" />)}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

// Label/value table as on gameME's info pages, with an optional title row.
export function Stats({ items, title }: { items: [ReactNode, ReactNode][]; title?: ReactNode }) {
  return (
    <table className="stats">
      {title ? (
        <thead>
          <tr>
            <th colSpan={2}>{title}</th>
          </tr>
        </thead>
      ) : null}
      <tbody>
        {items.map(([k, v], i) => (
          <tr key={i}>
            <td className="stats-key">{k}{k ? ":" : ""}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Builds a URL to the current page with some query params replaced.
export function withParams(base: string, params: Record<string, string | number | undefined>, change: Record<string, string | number | undefined>) {
  const merged = { ...params, ...change };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export function SortTh({
  label,
  sortKey,
  current,
  asc,
  base,
  params,
  className,
  sortParam = "sort",
  dirParam = "dir",
}: {
  label: ReactNode;
  sortKey: string;
  current: string;
  asc: boolean;
  base: string;
  params: Record<string, string | number | undefined>;
  className?: string;
  // Query param names; two sortable tables on one page use their own, so
  // sorting one keeps the order of the other.
  sortParam?: string;
  dirParam?: string;
}) {
  const active = current === sortKey;
  const href = withParams(base, params, { [sortParam]: sortKey, [dirParam]: active && !asc ? "asc" : undefined, page: undefined });
  return (
    <th className={className} aria-sort={active ? (asc ? "ascending" : "descending") : undefined}>
      <Link href={href} className={active ? "sort active" : "sort"}>
        {label}
        {active ? (asc ? " ▲" : " ▼") : ""}
      </Link>
    </th>
  );
}

// |◀ and ▶| drawn as SVG: the text glyphs for them (⏮ ⏭) differ too much
// between fonts and become emoji on phones.
function PagerEdge({ last }: { last: boolean }) {
  return (
    <svg className="pager-edge" viewBox="0 0 12 12" aria-hidden="true">
      <path fill="currentColor" d={last ? "M9 1.5h2v9H9zM1 1.5v9L8.5 6z" : "M1 1.5h2v9H1zM11 1.5v9L3.5 6z"} />
    </svg>
  );
}

// Paging below a table. With `total` it is the full bar: a page field, the
// rows per page (when `rows` is given), the number of entries and pages,
// and first/back/forward/last.
export function Pager({
  base,
  params,
  page,
  pages,
  hasNext,
  total,
  rows,
  locale,
  labels,
}: {
  base: string;
  params: Record<string, string | number | undefined>;
  page: number;
  pages?: number;
  hasNext?: boolean;
  total?: number;
  rows?: { value: number; options: number[] };
  locale?: string;
  labels: { prev: string; next: string; firstPage: string; lastPage: string; page: string; goTo?: string; showRows?: string; entriesOnPages?: string };
}) {
  const next = pages !== undefined ? page < pages : !!hasNext;
  if (total !== undefined && pages !== undefined && labels.goTo && labels.entriesOnPages) {
    const hidden = Object.entries(params).filter(([k, v]) => v !== undefined && v !== "" && k !== "page" && k !== "rows");
    return (
      <nav className="pager pager-full" aria-label={labels.page}>
        <AutoForm action={base} className="pager-form">
          {hidden.map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={String(v)} />
          ))}
          <label>
            {labels.goTo} <input {...noAutofill} type="number" name="page" min={1} max={pages} defaultValue={page} className="pager-page" />
          </label>
          {rows ? (
            <label>
              {labels.showRows}{" "}
              <select {...noAutofill} name="rows" defaultValue={String(rows.value)}>
                {rows.options.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <noscript>
            <button type="submit">OK</button>
          </noscript>
        </AutoForm>
        <span className="pager-count">{labels.entriesOnPages.replace("{n}", total.toLocaleString(locale)).replace("{p}", pages.toLocaleString(locale))}</span>
        <span className="pager-arrows">
          {page > 1 ? (
            <Link href={withParams(base, params, { page: undefined })} aria-label={labels.firstPage} title={labels.firstPage}>
              <PagerEdge last={false} />
            </Link>
          ) : (
            <span className="disabled" aria-hidden="true">
              <PagerEdge last={false} />
            </span>
          )}
          {page > 1 ? (
            <Link href={withParams(base, params, { page: page - 1 > 1 ? page - 1 : undefined })} aria-label={labels.prev} title={labels.prev}>
              ◀
            </Link>
          ) : (
            <span className="disabled" aria-hidden="true">◀</span>
          )}
          {next ? (
            <Link href={withParams(base, params, { page: page + 1 })} aria-label={labels.next} title={labels.next}>
              ▶
            </Link>
          ) : (
            <span className="disabled" aria-hidden="true">▶</span>
          )}
          {next ? (
            <Link href={withParams(base, params, { page: pages })} aria-label={labels.lastPage} title={labels.lastPage}>
              <PagerEdge last />
            </Link>
          ) : (
            <span className="disabled" aria-hidden="true">
              <PagerEdge last />
            </span>
          )}
        </span>
      </nav>
    );
  }
  if (page <= 1 && !next) return null;
  return (
    <nav className="pager" aria-label={labels.page}>
      {page > 1 ? (
        <Link href={withParams(base, params, { page: undefined })}>« {labels.firstPage}</Link>
      ) : (
        <span className="disabled">« {labels.firstPage}</span>
      )}
      {page > 1 ? (
        <Link href={withParams(base, params, { page: page - 1 > 1 ? page - 1 : undefined })}>← {labels.prev}</Link>
      ) : (
        <span className="disabled">← {labels.prev}</span>
      )}
      <span>
        {labels.page} {page}
        {pages !== undefined ? ` / ${pages}` : ""}
      </span>
      {next ? (
        <Link href={withParams(base, params, { page: page + 1 })}>{labels.next} →</Link>
      ) : (
        <span className="disabled">{labels.next} →</span>
      )}
      {pages !== undefined ? (
        next ? (
          <Link href={withParams(base, params, { page: pages })}>{labels.lastPage} »</Link>
        ) : (
          <span className="disabled">{labels.lastPage} »</span>
        )
      ) : null}
    </nav>
  );
}

// Rows per page a visitor can pick, besides the configured page size.
export const ROW_OPTIONS = [25, 50, 100, 250];

export function rowsParam(v: string | string[] | undefined, fallback: number): number {
  const n = Number.parseInt(Array.isArray(v) ? v[0] : (v ?? ""), 10);
  return ROW_OPTIONS.includes(n) ? n : fallback;
}

export function pageParam(v: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(v) ? v[0] : (v ?? ""), 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export function strParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v ?? "").trim().slice(0, 64);
}
