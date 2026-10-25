import "server-only";
import { ApiError, kpd, share } from "./api-params";
import { basePath } from "./base-path";
import { clientIp } from "./client-ip";
import { activity } from "./format";
import { getGame, getPlayer, getPlayerFlags, noProfile, type ClanRow, type LivePlayer, type MapRow, type RankingRow, type Server } from "./data";
import { playerCount } from "./player-count";

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

export async function api(handler: () => Promise<unknown | null>): Promise<Response> {
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

// A player the API may show: not hidden from the ranking (hideranking, which
// also covers banned players), not a bot without a profile, in a visible
// ranking. Anything else is answered like an unknown player (404).
export async function publicPlayer(id: number | null) {
  if (!id) return undefined;
  const p = await getPlayer(id);
  if (!p || p.hideranking || (await noProfile(p)) || !(await getGame(p.game))) return undefined;
  return p;
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
    kills: s.kills,
    headshots: s.headshots,
    rounds: s.rounds,
    country: s.country_code || null,
    version: s.server_version || null,
    os: s.server_os || null,
    vac: s.server_vac === "secure" ? true : s.server_vac === "insecure" ? false : null,
  };
}

export function apiLivePlayer(p: LivePlayer) {
  return {
    id: p.is_bot ? null : p.player_id,
    name: p.name,
    bot: !!p.is_bot,
    team: p.team || null,
    kills: p.kills,
    deaths: p.deaths,
    headshots: p.headshots,
    skill: p.skill,
    skillChange: p.skill_change,
    rank: p.position,
    connectedSince: p.connected || null,
    dead: !!p.is_dead,
    country: p.flag ? { code: p.flag.trim().toUpperCase(), name: p.country } : null,
  };
}

export function apiRankingRow(r: RankingRow, rank: number, activityDays: number) {
  return {
    rank,
    id: r.playerId,
    name: r.name,
    country: r.flag ? { code: r.flag.trim().toUpperCase(), name: r.country } : null,
    skill: r.skill,
    kills: r.kills,
    deaths: r.deaths,
    headshots: r.headshots,
    kpd: Math.round((r.kills / Math.max(1, r.deaths)) * 100) / 100,
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

export function apiMap(m: MapRow) {
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
  };
}
