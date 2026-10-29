import "server-only";
import { ApiError, kpd, share } from "./api-params";
import { apiDisabledResponse, apiEnabled } from "./api-switch";
import { basePath } from "./base-path";
import { clientIp } from "./client-ip";
import { activity } from "./format";
import { getGame, getGames, getPlayer, getPlayerFlags, noProfile, type ClanRow, type HistoryDay, type LivePlayer, type MapPlayer, type MapRow, type MapServer, type PlayerWeapon, type RankingRow, type Server } from "./data";
import type { GameEvent } from "./history";
import { eventDetail } from "./api-events";

export { eventDetail };
import { radarPoints, type PlayerRatios, type RadarAverage } from "./radar";
import { siteDay } from "./day";
import { ZONES } from "./zones";
import type { BanEntry } from "./ban-merge";
import { playerCount } from "./player-count";
import { winSplit } from "./shares";

export { RANKING_SORT_ALIASES } from "./sorts";

// Public read-only JSON API (/api/v1/...). Only data the website shows to
// everyone: no IPs, no chat, no hidden players, no RCON or admin data.

const LIMIT = 120; // requests per IP and minute
const buckets = new Map<string, Map<string, { n: number; until: number }>>();

// Counts a request of the client in `bucket` (one per kind of endpoint);
// over `limit` a minute: the seconds to wait, otherwise 0.
export async function overLimit(bucket: string, limit: number): Promise<number> {
  const ip = await clientIp();
  const now = Date.now();
  let hits = buckets.get(bucket);
  if (!hits) buckets.set(bucket, (hits = new Map()));
  const h = hits.get(ip);
  if (h && h.until > now && h.n >= limit) return Math.ceil((h.until - now) / 1000);
  if (!h || h.until <= now) {
    if (hits.size > 10000) hits.clear();
    hits.set(ip, { n: 1, until: now + 60_000 });
  } else h.n++;
  return 0;
}

// Fallback of the documentation's examples when no ranking can be read.
export const EXAMPLE_GAME_FALLBACK = "css";

// Ranking used in the examples and "try it" requests of /api: the first
// public ranking in the site's order (display_id, name) that has servers
// or players, else the first public one, else EXAMPLE_GAME_FALLBACK.
export async function defaultGame(): Promise<string> {
  try {
    const withData = await getGames(true);
    if (withData[0]) return withData[0].code;
    const all = await getGames();
    if (all[0]) return all[0].code;
  } catch (err) {
    console.error("api: default ranking:", err instanceof Error ? err.message : err);
  }
  return EXAMPLE_GAME_FALLBACK;
}

export async function api(handler: () => Promise<unknown | null>): Promise<Response> {
  if (!apiEnabled()) return apiDisabledResponse();
  const wait = await overLimit("api", LIMIT);
  if (wait) return json({ error: "rate limit" }, 429, { "retry-after": String(wait) });
  try {
    const data = await handler();
    return data === null ? json({ error: "not found" }, 404) : json(data, 200);
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.message }, err.status);
    console.error("api:", err instanceof Error ? err.message : err);
    return json({ error: "internal error" }, 500);
  }
}

// Picture endpoints (banners): rate limited, with CORS, like the JSON ones.
// handler answers the PNG of the website's banner route, or null (404).
export async function apiImage(handler: () => Promise<Response | null>): Promise<Response> {
  if (!apiEnabled()) return apiDisabledResponse();
  const wait = await overLimit("api", LIMIT);
  if (wait) return json({ error: "rate limit" }, 429, { "retry-after": String(wait) });
  try {
    const res = await handler();
    if (!res || !res.ok) return json({ error: "not found" }, 404);
    const headers = new Headers(res.headers);
    headers.set("access-control-allow-origin", "*");
    headers.set("x-content-type-options", "nosniff");
    return new Response(res.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.message }, err.status);
    console.error("api:", err instanceof Error ? err.message : err);
    return json({ error: "internal error" }, 500);
  }
}

function json(data: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, max-age=30" : "no-store",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });
}

export function intParam(v: string | null, def: number, min: number, max: number) {
  if (v === null || !/^\d{1,6}$/.test(v)) return def;
  return Math.min(max, Math.max(min, Number(v)));
}

export const codeOk = (s: string) => /^[A-Za-z0-9_-]{1,32}$/.test(s);

// Weapon codes of hlstats_Weapons (weapon_awp, tec9, ...).
export const weaponCodeOk = (s: string) => /^[A-Za-z0-9_.-]{1,64}$/.test(s);

// Path of an endpoint as clients call it (for the links of a list).
export const apiPath = (path: string) => `${basePath}/api/v1${path}`;

// A visible ranking (hidden ones are for admins only), or undefined.
export async function visibleGame(code: string) {
  return codeOk(code) ? getGame(code) : undefined;
}

// A player the API may show, exactly when the website shows the profile:
// not hidden by an admin or by the player (a player banned in the ranking,
// hideranking 2, keeps the profile with the ban notice, as on the site),
// not a bot while bots have no profile (noProfile), in a visible ranking.
// Anything else is answered like an unknown player (404).
export async function publicPlayer(id: number | null) {
  if (!id) return undefined;
  const p = await getPlayer(id);
  if (!p || (await noProfile(p, true)) || !(await getGame(p.game))) return undefined;
  return p;
}

// A ban as the bans page and the profile show it: source, reason, date
// (dateText when the source gives no usable date), length as shown and the
// end when known. Never an IP address.
export function apiBan(b: BanEntry) {
  return { source: b.kind, reason: b.reason || null, bannedAt: b.at, dateText: b.at ? null : b.dateText || null, length: b.length || null, endsAt: b.until };
}

export const apiCountry = (flag: string | null | undefined, name: string | null | undefined) =>
  flag && flag.trim() ? { code: flag.trim().toUpperCase(), name: name ?? "" } : null;

export function apiServer(s: Server) {
  return {
    id: s.serverId,
    name: s.name,
    address: s.publicaddress || `${s.address}:${s.port}`,
    map: s.act_map || null,
    players: s.act_players,
    bots: playerCount(s.act_players, s.bots, s.max_players).bots,
    maxPlayers: s.max_players,
    mapStarted: s.map_started || null,
    kills: Number(s.kills),
    headshots: Number(s.headshots),
    hpk: share(s.headshots, s.kills),
    suicides: Number(s.suicides),
    rounds: Number(s.rounds),
    ctWins: Number(s.ct_wins),
    tWins: Number(s.ts_wins),
    bombsPlanted: Number(s.bombs_planted),
    bombsDefused: Number(s.bombs_defused),
    country: s.country_code || null,
    version: s.server_version || null,
    os: s.server_os || null,
    vac: s.server_vac === "secure" ? true : s.server_vac === "insecure" ? false : null,
  };
}

export function apiLivePlayer(p: LivePlayer) {
  return {
    // Bots and hidden players (id 0, see getLivePlayers) have no id.
    id: p.is_bot || !p.player_id ? null : p.player_id,
    name: p.name,
    bot: !!p.is_bot,
    team: p.team || null,
    kills: p.kills,
    deaths: p.deaths,
    headshots: p.headshots,
    hpk: share(p.headshots, p.kills),
    rounds: Number(p.rounds),
    shots: Number(p.shots),
    hits: Number(p.hits),
    accuracy: share(p.hits, p.shots),
    // Latency in ms; null while unknown.
    ping: Number(p.ping) || null,
    points: p.skill,
    pointsChange: p.skill_change,
    rank: p.position,
    // Deprecated names of points and pointsChange.
    skill: p.skill,
    skillChange: p.skill_change,
    connectedSince: p.connected || null,
    dead: !!p.is_dead,
    country: p.flag ? { code: p.flag.trim().toUpperCase(), name: p.country } : null,
  };
}

// A row of the website's player ranking (RankingTable). position: the row's
// number in this list (the # column); rank: the place in the whole ranking
// by points (1 + players with more points, as on the profile).
// Inactive players (ranked = false) have no place in the ranking: rank null.
export function apiRankingRow(r: RankingRow, position: number, activityDays: number, ranked = true) {
  return {
    position,
    rank: ranked ? (r.globalRank ?? position) : null,
    id: r.playerId,
    name: r.name,
    country: r.flag ? { code: r.flag.trim().toUpperCase(), name: r.country } : null,
    points: Number(r.skill),
    // Deprecated name of points.
    skill: Number(r.skill),
    kills: r.kills,
    deaths: r.deaths,
    headshots: r.headshots,
    kpd: kpd(r.kills, r.deaths),
    hpk: share(r.headshots, r.kills),
    accuracy: share(r.hits, r.shots),
    connectionTime: r.connection_time,
    firstConnect: r.first_connect ?? null,
    lastEvent: r.last_event,
    activity: activity(r.last_event, activityDays),
  };
}

// Country (null for bots and unknown places) and bot flag of players in a
// top list, from their latest connect.
export async function playerTags(ids: number[]) {
  const flags = await getPlayerFlags(ids);
  return (id: number) => {
    const f = flags.get(Number(id));
    return { country: f && f.flag !== "bot" ? apiCountry(f.flag, f.country) : null, bot: f?.flag === "bot" };
  };
}

// A clan row of the clan ranking or a clan page. flag: the most common
// country of its members (getClanFlags).
export function apiClan(c: ClanRow, flag: { flag: string; country: string } | undefined) {
  return {
    id: Number(c.clanId),
    tag: c.tag,
    name: c.name,
    homepage: /^https?:\/\//i.test(c.homepage ?? "") ? c.homepage : null,
    country: flag ? apiCountry(flag.flag, flag.country) : null,
    members: Number(c.members),
    avgPoints: Number(c.skill ?? 0),
    // Deprecated name of avgPoints.
    avgSkill: Number(c.skill ?? 0),
    kills: Number(c.kills ?? 0),
    deaths: Number(c.deaths ?? 0),
    headshots: Number(c.headshots ?? 0),
    kpd: kpd(c.kills ?? 0, c.deaths ?? 0),
    hpk: share(c.headshots ?? 0, c.kills ?? 0),
    connectionTime: Number(c.connection_time ?? 0),
    lastEvent: c.last_event === null ? null : Number(c.last_event),
  };
}

// wins: CT and T round wins of the map (getMapWins), as the win ratio
// column of the maps page; undefined when the ranking has no sides.
export function apiMap(m: MapRow, wins?: { ct: number; t: number }) {
  const split = wins ? winSplit(wins.ct, wins.t) : null;
  return {
    id: Number(m.id),
    name: m.map,
    kills: Number(m.kills),
    headshots: Number(m.headshots),
    hpk: share(m.headshots, m.kills),
    teamKills: Number(m.teamkills),
    teamAWins: Number(m.teama_wins),
    teamBWins: Number(m.teamb_wins),
    played: Number(m.played),
    playTime: Number(m.play_time),
    rounds: Number(m.rounds),
    ctWins: wins ? wins.ct : null,
    tWins: wins ? wins.t : null,
    // Whole percentages as the win bar shows them; null without a win.
    winRatio: split ? { ct: split.ct, t: split.t } : null,
  };
}

// A row of the server load (one per server and 10 minutes).
export function apiLoadPoint(l: { timestamp: number; act_players: number; min_players: number; max_players: number; uptime: number; map: string | null }) {
  // The collector stores the uptime in minutes; the API gives seconds.
  return { time: l.timestamp, players: l.act_players, min: l.min_players, max: l.max_players, map: l.map || null, uptime: Number(l.uptime) ? Number(l.uptime) * 60 : null };
}

// A player on a map of the website (player map, live map, clan map): only
// the GeoIP city point, never an address.
export function apiMapPlayer(p: MapPlayer & { serverId?: number; server?: string | null; inactive?: boolean }) {
  return {
    id: p.playerId,
    name: p.name,
    country: apiCountry(p.flag, p.country),
    city: p.city || null,
    lat: p.lat,
    lng: p.lng,
    rank: p.rank ?? null,
    points: Number(p.skill),
    kills: Number(p.kills),
    deaths: Number(p.deaths),
    kpd: kpd(p.kills, p.deaths),
    lastEvent: Number(p.last_event),
    server: p.serverId ? { id: p.serverId, name: p.server ?? "" } : null,
    inactive: !!p.inactive,
  };
}

export function apiMapServer(s: MapServer) {
  return {
    id: s.serverId,
    name: s.name,
    address: s.publicaddress || `${s.address}:${s.port}`,
    map: s.act_map || null,
    city: s.city || null,
    country: s.country_code ? { code: s.country_code.trim().toUpperCase(), name: s.country_name ?? "" } : null,
    lat: s.lat,
    lng: s.lng,
    online: s.online,
    uptime: s.uptime === null ? null : s.uptime * 60,
    vac: s.server_vac === "secure" ? true : s.server_vac === "insecure" ? false : null,
  };
}

// An event of the website's event lists (ranking, clan, player): who did
// what to whom. Rows with a hidden player are already left out; bots stay.
export function apiEvent(e: GameEvent, tags: (id: number) => { country: ReturnType<typeof apiCountry>; bot: boolean }) {
  const person = (id: number, name: string | null) => (id > 0 ? { id, name, ...tags(id) } : null);
  return {
    time: e.ts,
    type: e.kind,
    player: person(Number(e.actor), e.actorName),
    other: person(Number(e.other), e.otherName),
    ...eventDetail(e.kind, e.num, e.text, e.code),
    map: e.map || null,
    server: e.server || null,
  };
}

// The radar of the profile and the clan page: the last 14 days of the
// history rows against all players active in them.
export function apiRadar(history: HistoryDay[], average: RadarAverage) {
  const last14 = history.filter((h) => String(h.eventTime).slice(0, 10) >= siteDay(-13));
  const sum = (k: keyof HistoryDay) => last14.reduce((n, h) => n + Number(h[k]), 0);
  const r = (num: number, den: number) => (last14.length ? { num, den } : null);
  const ratios: PlayerRatios = {
    kpd: r(sum("kills"), sum("deaths")),
    kpm: r(sum("kills"), sum("connection_time")),
    assists: r(sum("kill_assists"), sum("kills")),
    survived: r(sum("survived_count"), sum("rounds")),
    wins: r(sum("wins"), sum("rounds")),
  };
  const round = (v: number | null) => (v === null ? null : Math.round(v * 10000) / 10000);
  return {
    days: 14,
    activeDays: last14.length,
    comparedPlayers: average.players,
    axes: radarPoints(ratios, average).map((a) => ({ axis: a.key, value: round(a.value), average: round(a.avg), relative: round(a.rel), noData: a.noData })),
  };
}

// A weapon row of a player or a clan (profile and clan page tables).
export function apiWeaponUse(w: PlayerWeapon) {
  return {
    code: w.code,
    name: w.name,
    kills: Number(w.kills),
    deaths: Number(w.deaths),
    headshots: Number(w.headshots),
    shots: Number(w.shots),
    hits: Number(w.hits),
    damage: Number(w.damage),
    kpd: kpd(w.kills, w.deaths),
    hpk: share(w.headshots, w.kills),
    accuracy: share(w.hits, w.shots),
    damagePerHit: Number(w.hits) ? Math.round((Number(w.damage) / Number(w.hits)) * 100) / 100 : null,
    shotsPerKill: Number(w.kills) ? Math.round((Number(w.shots) / Number(w.kills)) * 100) / 100 : null,
    hitboxes: Object.fromEntries(ZONES.map((z) => [z, Number(w[z])])),
  };
}

// Style of a banner (?style=, the id of a design template); null: the
// active skin. An unknown template falls back to the skin, as on the site.
export function styleArg(q: { get(name: string): string | null }): string | null {
  const v = q.get("style");
  if (v === null || v === "") return null;
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(v)) throw new ApiError(400, "invalid style: template id (a-z, 0-9, _ and -, at most 32 characters)");
  return v;
}
