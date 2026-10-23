import "server-only";
import { clientIp } from "./client-ip";
import { activity } from "./format";
import type { LivePlayer, RankingRow, Server } from "./data";

// Public read-only JSON API (/api/v1/...). Only data the website shows to
// everyone: no IPs, no chat, no hidden players, no RCON or admin data.

const LIMIT = 120; // requests per IP and minute
const hits = new Map<string, { n: number; until: number }>();

export async function api(handler: () => Promise<unknown | null>): Promise<Response> {
  const ip = await clientIp();
  const now = Date.now();
  const h = hits.get(ip);
  if (h && h.until > now && h.n >= LIMIT) {
    return json({ error: "rate limit" }, 429, { "retry-after": String(Math.ceil((h.until - now) / 1000)) });
  }
  if (!h || h.until <= now) {
    if (hits.size > 10000) hits.clear();
    hits.set(ip, { n: 1, until: now + 60_000 });
  } else h.n++;
  try {
    const data = await handler();
    return data === null ? json({ error: "not found" }, 404) : json(data, 200);
  } catch (err) {
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

export function apiServer(s: Server) {
  return {
    id: s.serverId,
    name: s.name,
    address: s.publicaddress || `${s.address}:${s.port}`,
    map: s.act_map || null,
    players: s.act_players,
    maxPlayers: s.max_players,
    mapStarted: s.map_started || null,
    kills: s.kills,
    headshots: s.headshots,
    rounds: s.rounds,
    country: s.country_code || null,
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
    connectionTime: r.connection_time,
    lastEvent: r.last_event,
    activity: activity(r.last_event, activityDays),
  };
}
