import "server-only";
import { adminQuery, likeOp, query, queryOne, type Param } from "./db";
import { steamIds } from "./format";

// A player's history pages: events, daily sessions and won awards.

export const EVENT_KINDS = [
  "connect",
  "entry",
  "disconnect",
  "team",
  "role",
  "name",
  "action",
  "playeraction",
  "teambonus",
  "kill",
  "death",
  "suicide",
  "teamkill",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export type PlayerEvent = {
  ts: number;
  kind: EventKind;
  num: number; // bonus, headshot flag
  other: number; // the other player's id, 0 if none
  text: string; // action/team/role/weapon name, old name
  code: string; // action/team/role/weapon code, new name
  map: string | null;
};

// One SELECT per event table, all with the same columns. The IP address of
// hlstats_Events_Connects is never read.
function sources(kinds: EventKind[]): string[] {
  const m = `LEFT JOIN hlstats_Maps m ON m.id = e.map`;
  const all: Record<EventKind, string> = {
    connect: `SELECT e.timestamp_id AS ts, 'connect' AS kind, 0 AS num, 0 AS other, '' AS text, '' AS code, m.map AS map
              FROM hlstats_Events_Connects e ${m} WHERE e.playerId = ?`,
    entry: `SELECT e.timestamp_id AS ts, 'entry' AS kind, 0 AS num, 0 AS other, '' AS text, '' AS code, m.map AS map FROM hlstats_Events_Entries e ${m} WHERE e.playerId = ?`,
    disconnect: `SELECT e.timestamp_id AS ts, 'disconnect' AS kind, 0 AS num, 0 AS other, '' AS text, '' AS code, m.map AS map FROM hlstats_Events_Disconnects e ${m} WHERE e.playerId = ?`,
    team: `SELECT e.timestamp_id AS ts, 'team' AS kind, 0 AS num, 0 AS other, COALESCE(t.name, '') AS text, COALESCE(t.code, '') AS code, m.map AS map
           FROM hlstats_Events_ChangeTeam e LEFT JOIN hlstats_Teams t ON t.teamId = e.team ${m} WHERE e.playerId = ?`,
    role: `SELECT e.timestamp_id AS ts, 'role' AS kind, 0 AS num, 0 AS other, COALESCE(r.name, '') AS text, COALESCE(r.code, '') AS code, m.map AS map
           FROM hlstats_Events_ChangeRole e LEFT JOIN hlstats_Roles r ON r.roleId = e.role ${m} WHERE e.playerId = ?`,
    name: `SELECT e.timestamp_id AS ts, 'name' AS kind, 0 AS num, 0 AS other, e.oldName AS text, e.newName AS code, m.map AS map FROM hlstats_Events_ChangeName e ${m} WHERE e.playerId = ?`,
    action: `SELECT e.timestamp_id AS ts, 'action' AS kind, e.bonus AS num, 0 AS other, COALESCE(a.description, '') AS text, COALESCE(a.code, '') AS code, m.map AS map
             FROM hlstats_Events_PlayerActions e LEFT JOIN hlstats_Actions a ON a.id = e.actionId ${m} WHERE e.playerId = ?`,
    playeraction: `SELECT e.timestamp_id AS ts, 'playeraction' AS kind, e.bonus AS num, e.victimId AS other, COALESCE(a.description, '') AS text, COALESCE(a.code, '') AS code, m.map AS map
                   FROM hlstats_Events_PlayerPlayerActions e LEFT JOIN hlstats_Actions a ON a.id = e.actionId ${m} WHERE e.playerId = ?`,
    teambonus: `SELECT e.timestamp_id AS ts, 'teambonus' AS kind, e.bonus AS num, 0 AS other, COALESCE(a.description, '') AS text, COALESCE(a.code, '') AS code, m.map AS map
                FROM hlstats_Events_TeamBonuses e LEFT JOIN hlstats_Actions a ON a.id = e.actionId ${m} WHERE e.playerId = ?`,
    kill: `SELECT e.timestamp_id AS ts, 'kill' AS kind, e.headshot AS num, e.victimId AS other, COALESCE(w.name, '') AS text, COALESCE(w.code, '') AS code, m.map AS map
           FROM hlstats_Events_Frags e LEFT JOIN hlstats_Weapons w ON w.weaponId = e.weapon ${m} WHERE e.killerId = ?`,
    death: `SELECT e.timestamp_id AS ts, 'death' AS kind, e.headshot AS num, e.killerId AS other, COALESCE(w.name, '') AS text, COALESCE(w.code, '') AS code, m.map AS map
            FROM hlstats_Events_Frags e LEFT JOIN hlstats_Weapons w ON w.weaponId = e.weapon ${m} WHERE e.victimId = ?`,
    suicide: `SELECT e.timestamp_id AS ts, 'suicide' AS kind, 0 AS num, 0 AS other, COALESCE(w.name, '') AS text, COALESCE(w.code, '') AS code, m.map AS map
              FROM hlstats_Events_Suicides e LEFT JOIN hlstats_Weapons w ON w.weaponId = e.weapon ${m} WHERE e.playerId = ?`,
    teamkill: `SELECT e.timestamp_id AS ts, 'teamkill' AS kind, 0 AS num, e.victimId AS other, COALESCE(w.name, '') AS text, COALESCE(w.code, '') AS code, m.map AS map
               FROM hlstats_Events_Teamkills e LEFT JOIN hlstats_Weapons w ON w.weaponId = e.weapon ${m} WHERE e.killerId = ?`,
  };
  return kinds.map((k) => all[k]);
}

// Table and player column of each kind, for counting (pager).
const COUNT_FROM: Record<EventKind, [string, string]> = {
  connect: ["hlstats_Events_Connects", "playerId"],
  entry: ["hlstats_Events_Entries", "playerId"],
  disconnect: ["hlstats_Events_Disconnects", "playerId"],
  team: ["hlstats_Events_ChangeTeam", "playerId"],
  role: ["hlstats_Events_ChangeRole", "playerId"],
  name: ["hlstats_Events_ChangeName", "playerId"],
  action: ["hlstats_Events_PlayerActions", "playerId"],
  playeraction: ["hlstats_Events_PlayerPlayerActions", "playerId"],
  teambonus: ["hlstats_Events_TeamBonuses", "playerId"],
  kill: ["hlstats_Events_Frags", "killerId"],
  death: ["hlstats_Events_Frags", "victimId"],
  suicide: ["hlstats_Events_Suicides", "playerId"],
  teamkill: ["hlstats_Events_Teamkills", "killerId"],
};

export async function countPlayerEvents(playerId: number, kinds: EventKind[]): Promise<number> {
  const counts = await Promise.all(
    kinds.map((k) => queryOne<{ n: number | string }>(`SELECT COUNT(*) AS n FROM ${COUNT_FROM[k][0]} WHERE ${COUNT_FROM[k][1]} = ?`, [playerId])),
  );
  return counts.reduce((a, c) => a + Number(c?.n ?? 0), 0);
}

// Newest first. Each table contributes at most offset+limit rows, so a long
// frag history is not read in full.
export async function getPlayerEvents(playerId: number, kinds: EventKind[], limit: number, offset: number) {
  const n = offset + limit;
  const parts = sources(kinds).map((s) => `(${s} ORDER BY 1 DESC LIMIT ${Number(n)})`);
  const rows = await query<PlayerEvent>(
    `SELECT * FROM (${parts.join(" UNION ALL ")}) x ORDER BY ts DESC, kind LIMIT ? OFFSET ?`,
    [...kinds.map(() => playerId), limit, offset],
  );
  const ids = [...new Set(rows.map((r) => Number(r.other)).filter((x) => x > 0))];
  const names = ids.length
    ? await query<{ playerId: number; lastName: string }>(`SELECT playerId, lastName FROM hlstats_Players_Data WHERE playerId IN (?)`, [ids])
    : [];
  const byId = new Map(names.map((x) => [Number(x.playerId), x.lastName]));
  return rows.map((r) => ({
    ...r,
    ts: Number(r.ts),
    num: Number(r.num),
    other: Number(r.other),
    otherName: byId.get(Number(r.other)) ?? null,
  }));
}

export type SessionDay = {
  eventTime: string;
  skill: number;
  skill_change: number;
  connection_time: number;
  rounds: number;
  wins: number;
  kills: number;
  deaths: number;
  kill_streak: number;
  headshots: number;
  shots: number;
  hits: number;
};

export async function getPlayerSessions(playerId: number, limit: number, offset: number) {
  const [rows, count] = await Promise.all([
    query<SessionDay>(
      `SELECT eventTime, skill, skill_change, connection_time, rounds, wins, kills, deaths, kill_streak, headshots, shots, hits
       FROM hlstats_Players_History WHERE playerId = ? ORDER BY eventTime DESC LIMIT ? OFFSET ?`,
      [playerId, limit, offset],
    ),
    queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM hlstats_Players_History WHERE playerId = ?`, [playerId]),
  ]);
  return { rows, total: Number(count?.n ?? 0) };
}

export type AwardWin = { date: string; awardId: number; code: string; name: string; verb: string; winner_count: number };

export async function getPlayerAwardWins(playerId: number, limit: number, offset: number) {
  const [rows, count] = await Promise.all([
    query<AwardWin>(
      `SELECT h.date, a.awardId, a.code, a.name, a.verb, h.winner_count
       FROM hlstats_Awards_History h JOIN hlstats_Awards a ON a.awardId = h.award_id
       WHERE h.winner_id = ? ORDER BY h.date DESC, a.name LIMIT ? OFFSET ?`,
      [playerId, limit, offset],
    ),
    queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM hlstats_Awards_History WHERE winner_id = ?`, [playerId]),
  ]);
  return { rows, total: Number(count?.n ?? 0) };
}

// The addresses a player connected from, newest first. Admins only: the
// caller must have checked the login (see loadHistoryPlayer).
export type PlayerIp = { ip: string; connects: number; first: number; last: number; hostname: string };

export async function getPlayerIps(playerId: number): Promise<PlayerIp[]> {
  const rows = await adminQuery<{ ip: number | string; connects: number; first: number; last: number; hostname: string | null }>(
    `SELECT ipAddress AS ip, COUNT(*) AS connects, MIN(timestamp_id) AS first, MAX(timestamp_id) AS last, MAX(hostname) AS hostname
     FROM hlstats_Events_Connects WHERE playerId = ? GROUP BY ipAddress ORDER BY last DESC LIMIT 500`,
    [playerId],
  );
  return rows.map((r) => ({ ip: ipv4(r.ip), connects: Number(r.connects), first: Number(r.first), last: Number(r.last), hostname: r.hostname ?? "" }));
}

// IPv4 addresses are stored as an unsigned 32-bit number; a text address
// (older databases) is shown as it is.
function ipv4(v: number | string): string {
  if (typeof v === "string" && /[.:]/.test(v)) return v;
  let n = Number(v);
  // A signed 32-bit column (PostgreSQL integer) holds the upper half negative.
  if (n < 0 && n >= -0x80000000) n += 0x100000000;
  if (!Number.isSafeInteger(n) || n <= 0 || n > 0xffffffff) return "-";
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export async function getPlayerChatCount(playerId: number) {
  const [r] = await adminQuery<{ n: number }>(`SELECT COUNT(*) AS n FROM hlstats_Events_Chat WHERE playerId = ?`, [playerId]);
  return Number(r?.n ?? 0);
}

// ---------------------------------------------------------------- ranking

// The latest events of a ranking (all its servers), for its start page:
// kills, actions, joins and so on, never chat or addresses. Hidden players
// are left out (bots stay); a hidden opponent is shown without a name.
export const GAME_EVENT_KINDS = ["entry", "disconnect", "team", "action", "playeraction", "teambonus", "kill", "suicide", "teamkill"] as const;
export type GameEventKind = (typeof GAME_EVENT_KINDS)[number];
// Shown in the live box: kills and the actions the daily awards count
// (bomb planted, GunGame level, ...); no joins, leaves or team changes.
const LIVE_KINDS: GameEventKind[] = ["kill", "action", "playeraction", "teambonus"];
export type GameEvent = Omit<PlayerEvent, "kind"> & { kind: GameEventKind; actor: number; actorName: string | null; otherName: string | null; server: string };

// The server of an event (server_id on the event tables) comes with newer
// collector init scripts; without it the server column is left out. Looked up
// again every 5 minutes while missing.
let serverCol: { ok: Promise<boolean>; at: number } | undefined;
export async function hasEventServer() {
  if (!serverCol || (Date.now() - serverCol.at > 300_000 && !(await serverCol.ok))) {
    serverCol = { ok: query(`SELECT server_id FROM hlstats_Events_Frags WHERE 1 = 0`).then(() => true, () => false), at: Date.now() };
  }
  return serverCol.ok;
}

function gameSources(withServer: boolean): string[] {
  // Only the name of the server, never other columns of hlstats_Servers.
  const m = withServer
    ? `LEFT JOIN hlstats_Maps m ON m.id = e.map LEFT JOIN (SELECT serverId, name FROM hlstats_Servers) s ON s.serverId = e.server_id`
    : `LEFT JOIN hlstats_Maps m ON m.id = e.map`;
  const srv = withServer ? `COALESCE(s.name, '') AS server` : `'' AS server`;
  const all: Record<GameEventKind, string> = {
    entry: `SELECT e.timestamp_id AS ts, 'entry' AS kind, e.playerId AS actor, 0 AS num, 0 AS other, '' AS text, '' AS code, m.map AS map, ${srv} FROM hlstats_Events_Entries e ${m} WHERE e.game_id = ?`,
    disconnect: `SELECT e.timestamp_id AS ts, 'disconnect' AS kind, e.playerId AS actor, 0 AS num, 0 AS other, '' AS text, '' AS code, m.map AS map, ${srv} FROM hlstats_Events_Disconnects e ${m} WHERE e.game_id = ?`,
    team: `SELECT e.timestamp_id AS ts, 'team' AS kind, e.playerId AS actor, 0 AS num, 0 AS other, COALESCE(t.name, '') AS text, COALESCE(t.code, '') AS code, m.map AS map, ${srv}
           FROM hlstats_Events_ChangeTeam e LEFT JOIN hlstats_Teams t ON t.teamId = e.team ${m} WHERE e.game_id = ?`,
    action: `SELECT e.timestamp_id AS ts, 'action' AS kind, e.playerId AS actor, e.bonus AS num, 0 AS other, COALESCE(a.description, '') AS text, COALESCE(a.code, '') AS code, m.map AS map, ${srv}
             FROM hlstats_Events_PlayerActions e LEFT JOIN hlstats_Actions a ON a.id = e.actionId ${m} WHERE e.game_id = ?`,
    playeraction: `SELECT e.timestamp_id AS ts, 'playeraction' AS kind, e.playerId AS actor, e.bonus AS num, e.victimId AS other, COALESCE(a.description, '') AS text, COALESCE(a.code, '') AS code, m.map AS map, ${srv}
                   FROM hlstats_Events_PlayerPlayerActions e LEFT JOIN hlstats_Actions a ON a.id = e.actionId ${m} WHERE e.game_id = ?`,
    teambonus: `SELECT e.timestamp_id AS ts, 'teambonus' AS kind, e.playerId AS actor, e.bonus AS num, 0 AS other, COALESCE(a.description, '') AS text, COALESCE(a.code, '') AS code, m.map AS map, ${srv}
                FROM hlstats_Events_TeamBonuses e LEFT JOIN hlstats_Actions a ON a.id = e.actionId ${m} WHERE e.game_id = ?`,
    kill: `SELECT e.timestamp_id AS ts, 'kill' AS kind, e.killerId AS actor, e.headshot AS num, e.victimId AS other, COALESCE(w.name, '') AS text, COALESCE(w.code, '') AS code, m.map AS map, ${srv}
           FROM hlstats_Events_Frags e LEFT JOIN hlstats_Weapons w ON w.weaponId = e.weapon ${m} WHERE e.game_id = ?`,
    suicide: `SELECT e.timestamp_id AS ts, 'suicide' AS kind, e.playerId AS actor, 0 AS num, 0 AS other, COALESCE(w.name, '') AS text, COALESCE(w.code, '') AS code, m.map AS map, ${srv}
              FROM hlstats_Events_Suicides e LEFT JOIN hlstats_Weapons w ON w.weaponId = e.weapon ${m} WHERE e.game_id = ?`,
    teamkill: `SELECT e.timestamp_id AS ts, 'teamkill' AS kind, e.killerId AS actor, 0 AS num, e.victimId AS other, COALESCE(w.name, '') AS text, COALESCE(w.code, '') AS code, m.map AS map, ${srv}
               FROM hlstats_Events_Teamkills e LEFT JOIN hlstats_Weapons w ON w.weaponId = e.weapon ${m} WHERE e.game_id = ?`,
  };
  return LIVE_KINDS.map((k) => all[k]);
}

const gameCache = new Map<string, { at: number; value: Promise<GameEvent[]> }>();

// Kept for 30 seconds per ranking.
export function getGameEvents(game: string, limit: number): Promise<GameEvent[]> {
  const key = `${game}|${limit}`;
  const hit = gameCache.get(key);
  if (hit && Date.now() - hit.at < 3_000) return hit.value;
  if (gameCache.size > 100) gameCache.clear();
  const value = loadGameEvents(game, limit);
  gameCache.set(key, { at: Date.now(), value });
  value.catch(() => gameCache.delete(key));
  return value;
}

async function loadGameEvents(game: string, limit: number): Promise<GameEvent[]> {
  const g = await queryOne<{ id: number }>(`SELECT id FROM hlstats_Games WHERE code = ?`, [game]);
  if (!g) return [];
  // More rows than shown, as hidden players are dropped afterwards.
  const n = limit * 3;
  const parts = gameSources(await hasEventServer()).map((s) => `(${s} ORDER BY 1 DESC LIMIT ${Number(n)})`);
  const rows = await query<Omit<GameEvent, "actorName" | "otherName">>(
    `SELECT * FROM (${parts.join(" UNION ALL ")}) x ORDER BY ts DESC, kind LIMIT ?`,
    [...LIVE_KINDS.map(() => Number(g.id)), n],
  );
  const ids = [...new Set(rows.flatMap((r) => [Number(r.actor), Number(r.other)]).filter((x) => x > 0))];
  const people = ids.length
    ? await query<{ playerId: number; name: string | null; hideranking: number; bot: number }>(
        `SELECT p.playerId, d.lastName AS name, p.hideranking,
                CASE WHEN EXISTS (SELECT 1 FROM hlstats_PlayerUniqueIds u WHERE u.playerId = p.playerId AND u.uniqueId LIKE 'BOT%') THEN 1 ELSE 0 END AS bot
         FROM hlstats_Players p LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId WHERE p.playerId IN (?)`,
        [ids],
      )
    : [];
  const visible = new Map(people.filter((x) => Number(x.hideranking) === 0 || Number(x.bot)).map((x) => [Number(x.playerId), x.name]));
  return rows
    .filter((r) => visible.has(Number(r.actor)))
    .slice(0, limit)
    .map((r) => {
      const other = Number(r.other);
      return {
        ...r,
        ts: Number(r.ts),
        num: Number(r.num),
        actor: Number(r.actor),
        server: r.server ?? "",
        actorName: visible.get(Number(r.actor)) ?? null,
        // A hidden opponent: no id, no name.
        other: visible.has(other) ? other : 0,
        otherName: visible.get(other) ?? null,
      };
    });
}


// ---------------------------------------------------------------- admin: IP search

// All stored connect addresses, one row per address and player. Admins only:
// the caller must have checked the login. q is an IPv4 address or its start
// ("84.12."), a Steam ID, or part of a player name or host name.
export type IpHit = {
  ip: string;
  playerId: number;
  name: string | null;
  game: string;
  uniqueId: string | null;
  connects: number;
  first: number;
  last: number;
  hostname: string;
};

export type IpFilter = { q?: string; game?: string; days?: number };

const SIGNED = 0x100000000;

// Range of an IPv4 address or prefix, e.g. "84.12" -> 84.12.0.0 .. 84.12.255.255.
function ipRange(q: string): [number, number] | null {
  const m = /^(\d{1,3})(?:\.(\d{1,3}))?(?:\.(\d{1,3}))?(?:\.(\d{1,3}))?\.?$/.exec(q);
  if (!m || !q.includes(".")) return null;
  const parts = m.slice(1).filter((x) => x !== undefined).map(Number);
  if (parts.some((x) => x > 255)) return null;
  let lo = 0;
  for (let i = 0; i < 4; i++) lo = lo * 256 + (parts[i] ?? 0);
  return [lo, lo + 256 ** (4 - parts.length) - 1];
}

function ipWhere(f: IpFilter): { where: string; params: Param[] } {
  // 0: connect without a stored address (gamewe_store_player_ip off).
  const where: string[] = [`c.ipAddress <> 0`];
  const params: Param[] = [];
  const q = (f.q ?? "").trim().slice(0, 100);
  if (f.game) {
    where.push(`p.game = ?`);
    params.push(f.game);
  }
  if (f.days && f.days > 0) {
    where.push(`c.timestamp_id >= ?`);
    params.push(Math.floor(Date.now() / 1000) - f.days * 86400);
  }
  if (q) {
    const range = ipRange(q);
    const ids = range ? null : steamIds(q);
    if (range) {
      // Unsigned (MariaDB) or signed (PostgreSQL integer) storage; compared
      // as a decimal so neither bound overflows the column type.
      where.push(`((c.ipAddress + 0.0) BETWEEN ? AND ? OR (c.ipAddress + 0.0) BETWEEN ? AND ?)`);
      params.push(range[0], range[1], range[0] - SIGNED, range[1] - SIGNED);
    } else if (ids) {
      const acc = BigInt(ids.steam64) - 76561197960265728n;
      const y = acc % 2n;
      const z = acc / 2n;
      where.push(`c.playerId IN (SELECT u.playerId FROM hlstats_PlayerUniqueIds u WHERE u.uniqueId IN (?))`);
      params.push([`${y}:${z}`, `STEAM_0:${y}:${z}`, `STEAM_1:${y}:${z}`, `[U:1:${acc}]`, `U:1:${acc}`, ids.steam64]);
    } else {
      const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      where.push(`(d.lastName ${likeOp()} ? OR c.hostname ${likeOp()} ?)`);
      params.push(like, like);
    }
  }
  return { where: `WHERE ${where.join(" AND ")}`, params };
}

const IP_FROM = `FROM hlstats_Events_Connects c
     LEFT JOIN hlstats_Players p ON p.playerId = c.playerId
     LEFT JOIN hlstats_Players_Data d ON d.playerId = c.playerId`;

export async function searchIps(f: IpFilter & { limit: number; offset: number }): Promise<IpHit[]> {
  const { where, params } = ipWhere(f);
  const rows = await adminQuery<{
    ip: number | string;
    playerId: number;
    name: string | null;
    game: string | null;
    uniqueId: string | null;
    connects: number;
    first: number;
    last: number;
    hostname: string | null;
  }>(
    `SELECT c.ipAddress AS ip, c.playerId, MAX(d.lastName) AS name, MAX(TRIM(p.game)) AS game,
            (SELECT MAX(u.uniqueId) FROM hlstats_PlayerUniqueIds u WHERE u.playerId = c.playerId) AS uniqueId,
            COUNT(*) AS connects, MIN(c.timestamp_id) AS first, MAX(c.timestamp_id) AS last, MAX(c.hostname) AS hostname
     ${IP_FROM} ${where}
     GROUP BY c.ipAddress, c.playerId ORDER BY last DESC, c.playerId LIMIT ? OFFSET ?`,
    [...params, Math.max(1, Math.floor(f.limit)), Math.max(0, Math.floor(f.offset))],
  );
  return rows.map((r) => ({
    ip: ipv4(r.ip),
    playerId: Number(r.playerId),
    name: r.name,
    game: r.game ?? "",
    uniqueId: r.uniqueId,
    connects: Number(r.connects),
    first: Number(r.first),
    last: Number(r.last),
    hostname: r.hostname ?? "",
  }));
}

export async function countIps(f: IpFilter): Promise<number> {
  const { where, params } = ipWhere(f);
  const rows = await adminQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM (SELECT c.ipAddress, c.playerId ${IP_FROM} ${where} GROUP BY c.ipAddress, c.playerId) t`,
    params,
  );
  return Number(rows[0]?.n ?? 0);
}
