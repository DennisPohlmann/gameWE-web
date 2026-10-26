// Parsing of the public SourceBans ban list (index.php?p=banlist&page=N),
// kept apart from sourcebans.ts (server-only: fetching, cache) so the tests
// can run it. Three templates:
// - classic (SourceBans 1.4 to SB++ 1.7): <tr class="opener ..."> with a
//   sliding panel of "Steam ID", "Invoked on", "Banlength", "Reason" rows;
// - SB++ 1.8 default theme: <tr class="collapse"> with the summary, followed
//   by <tr class="table_hide"> with a <ul class="ban_list_detal"> list of
//   label / value pairs;
// - SB++ 2026: one <tr class="ban-row ..." data-state="..."> per ban.

export type SbState = "permanent" | "active" | "expired" | "unbanned";

// One ban as the page shows it; steam is the matched Steam ID
// ("STEAM_0:1:123" as "1:123", or a SteamID64), converted by the caller.
export type SbRawBan = {
  steam: string;
  name: string;
  reason: string;
  length: string;
  date: string;
  state: SbState;
};

export function parseBans(html: string): SbRawBan[] {
  if (html.includes('class="ban-row')) return parseNew(html);
  if (html.includes('class="ban_list_detal"')) return parseDetail(html);
  return parseClassic(html);
}

// Whether the page shows Steam IDs at all: with none parsed, the template is
// one this code does not know (or the IDs are hidden from guests).
export function hasSteamIds(html: string): boolean {
  return /STEAM_[0-5]:[01]:\d{1,10}/.test(html);
}

// SB++ 2026: one <tr class="ban-row ..." data-state="..."> per ban.
function parseNew(html: string): SbRawBan[] {
  const out: SbRawBan[] = [];
  for (const chunk of html.split('<tr class="ban-row').slice(1)) {
    const row = chunk.split(/<tr class="ban-row|<\/tbody>/)[0];
    const steam = steamOf(row);
    if (!steam) continue;
    const state = /data-state="([a-z]+)"/.exec(row)?.[1] ?? "";
    const reasonTd = /<td class="text-muted truncate"[^>]*?(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/td>/.exec(row);
    out.push({
      steam,
      name: text(/ban-player-cell__name"[^>]*>([\s\S]*?)<\/a>/.exec(row)?.[1]),
      reason: reasonTd ? text(reasonTd[1] ?? reasonTd[2].split("<div")[0]) : "",
      length: text(/<td class="col-length[^"]*"[^>]*>([\s\S]*?)<\/td>/.exec(row)?.[1]),
      date: /<time datetime="([^"]+)"/.exec(row)?.[1] ?? "",
      state: state === "permanent" || state === "active" || state === "expired" || state === "unbanned" ? state : "active",
    });
  }
  return out;
}

// SB++ 1.8 default theme: <tr class="collapse" ...> (game, country, date,
// name, length with the listtable_1_* state class), then
// <tr class="table_hide"> whose <ul class="ban_list_detal"> holds
// <li><span><i ...></i> Label</span> <span>value</span></li> pairs.
function parseDetail(html: string): SbRawBan[] {
  const out: SbRawBan[] = [];
  for (const chunk of html.split('<tr class="collapse"').slice(1)) {
    // The list holds an empty <ul> of its own, so it ends at the comments
    // list or the end of the cell, not at the first </ul>.
    const detail = chunk.split('class="ban_list_detal"')[1]?.split(/class="ban_list_comments|<\/td>/)[0];
    if (!detail) continue;
    const field = (label: string) =>
      text(new RegExp(`<span>(?:\\s*<i[^>]*></i>)?\\s*${label}\\s*</span>\\s*<span[^>]*>([\\s\\S]*?)</span>`).exec(detail)?.[1]);
    const steam = steamOf(field("Steam ID")) ?? steamOf(field("Steam Community"));
    if (!steam) continue;
    const cls = /class="listtable_1_(permanent|banned|unbanned)"[^>]*>([\s\S]*?)<\/td>/.exec(chunk);
    const length = field("Ban length") || text(cls?.[2]);
    out.push({
      steam,
      name: field("Player"),
      reason: field("Reason"),
      length: length.replace(/\s*\((?:Unbanned|Expired|Deleted)\)\s*$/i, ""),
      date: field("Invoked on"),
      state: classState(cls?.[1], length),
    });
  }
  return out;
}

// Classic template: <tr class="opener ..."> with the summary, followed by a
// sliding panel with "Steam ID", "Invoked on", "Banlength", "Reason" rows.
function parseClassic(html: string): SbRawBan[] {
  const out: SbRawBan[] = [];
  for (const chunk of html.split(/<tr class="opener/).slice(1)) {
    const steam = steamOf(chunk);
    if (!steam) continue;
    const field = (label: string) =>
      text(new RegExp(`>\\s*${label}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`).exec(chunk)?.[1]);
    const cls = /class="listtable_1_(permanent|banned|unbanned)"[^>]*>([\s\S]*?)<\/td>/.exec(chunk);
    const length = field("Banlength") || text(cls?.[2]);
    out.push({
      steam,
      name: field("Player").replace(/\s+/g, " "),
      reason: field("Reason"),
      length: length.replace(/\s*\((?:Unbanned|Expired|Deleted)\)\s*$/i, ""),
      date: field("Invoked on"),
      state: classState(cls?.[1], length),
    });
  }
  return out;
}

// The listtable_1_* class of the length cell: permanent, banned (running)
// or unbanned (lifted, or expired when the length says so).
function classState(cls: string | undefined, length: string): SbState {
  if (cls === "permanent") return "permanent";
  if (cls === "unbanned") return /expired/i.test(length) ? "expired" : "unbanned";
  return "active";
}

function steamOf(s: string): string | null {
  const m = /STEAM_[0-5]:([01]):(\d{1,10})/.exec(s) ?? /steamcommunity\.com\/profiles\/(7656119\d{10})/.exec(s) ?? /^(7656119\d{10})$/.exec(s);
  if (!m) return null;
  return m[0].startsWith("STEAM") ? `${m[1]}:${m[2]}` : m[1];
}

function text(s: string | undefined): string {
  return (s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) < 0x110000 ? Number(n) : 32))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
