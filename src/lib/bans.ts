import "server-only";
import { banKind, mainReason, mergeBans, steamBanEntry, type BanEntry, type BanKind } from "./ban-merge";
import { getBanPlayers, getBanRecords, getPlayerBans, getPlayerStoredBans, getStoredBans, type BanPlayer, type PlayerDetail, type StoredBan } from "./data";
import { queryOne } from "./db";
import { fmtBanMinutes, nowUnix, steamIds } from "./format";
import type { Dict } from "./i18n";
import { BANS_PLAN_KEY, parseBansPlan } from "./job-plan";
import { getSettings } from "./settings";
import { getSteamProfile, steamBansAvailable } from "./steam";

// The bans the public site shows, for the bans page, the profile and the
// API alike, all read from the database: bans the collector recorded from
// the server logs (hlstats_Players_Bans) and the bans of every known Steam
// account that the collector's bans-sync job stores (hlstats_Bans: VAC and
// game bans from the Steam Web API, running bans of the SourceBans list).
// The site itself asks neither Steam nor SourceBans for bans. Never IP
// addresses or chat.

type T = Pick<Dict, "banStatePermanent">;

// One ban of a player from one source, before the bans of a player are
// merged into one row (ban-merge.ts).
type Found = { player: BanPlayer; ban: BanEntry };

// A banned player with all running bans (VAC first); at is the newest.
export type BanRow = { player: BanPlayer; bans: BanEntry[]; at: number | null; dateText: string; reason: string };

// sourcebans: the state of the collector's last read of the SourceBans list
// (null: no address set); stored: false while hlstats_Bans is missing (a
// collector before "all-bans": only the bans from the server logs);
// always: the sources the site checks (their badges always show).
export type RankingBans = {
  rows: BanRow[];
  sourcebans: "loading" | "error" | "unknown" | "ok" | null;
  sourcebansUrl: string;
  stored: boolean;
  always: BanKind[];
};

// The BanEntry of a stored ban, null for a row without a ban.
export function storedBanEntry(b: StoredBan, t: T): BanEntry | null {
  if (b.source === "sourcebans") {
    const len = Number(b.sb_length);
    return { kind: "sourcebans", reason: b.sb_reason ?? "", at: Number(b.sb_created) || null, dateText: "", length: len ? fmtBanMinutes(len) : t.banStatePermanent, until: Number(b.sb_ends) || null };
  }
  // Steam: the days since the last ban count from the collector's check.
  const vac = Math.max(Number(b.vac_bans), Number(b.vac_banned) ? 1 : 0);
  return steamBanEntry({ vac, game: Number(b.game_bans), days: Number(b.days_since_last_ban) }, Number(b.last_checked) || nowUnix());
}

function recordEntry(r: { ban_type: string; length_minutes: number; reason: string | null; banned_at: number; ends_at: number }, t: T): BanEntry {
  const len = Number(r.length_minutes);
  return { kind: banKind(r.ban_type), at: Number(r.banned_at) || null, dateText: "", reason: r.reason ?? "", length: len ? fmtBanMinutes(len) : t.banStatePermanent, until: Number(r.ends_at) || null };
}

// What the collector reports of its last read of the SourceBans list
// (hlstats_Options gamewe_next_bans).
async function sourcebansState(): Promise<RankingBans["sourcebans"]> {
  let v: string | undefined;
  try {
    v = (await queryOne<{ value: string | null }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, [BANS_PLAN_KEY]))?.value ?? undefined;
  } catch {
    return "loading";
  }
  const sb = parseBansPlan(v)?.sourcebans;
  if (!sb || !sb.last) return "loading";
  if (sb.error) return /unknown template/i.test(sb.error) ? "unknown" : "error";
  return "ok";
}

// Every banned player of a ranking, newest ban first: those still in the
// ranking (hlstats_Players) or, with inactive, those the collector moved
// to hlstats_PlayersInactive (the bans page's two tabs). The page and the
// API page through the rows.
export async function getRankingBans(game: string, t: T, inactive = false): Promise<RankingBans> {
  const now = nowUnix();
  const [{ sourcebansUrl }, steamBans, records, stored, sbState] = await Promise.all([
    getSettings(),
    steamBansAvailable(),
    getBanRecords(game),
    getStoredBans(game, now),
    sourcebansState(),
  ]);
  const players = await getBanPlayers([...records.map((r) => Number(r.playerId)), ...(stored ?? []).map((b) => Number(b.playerId))]);
  const found: Found[] = [];
  for (const r of records) {
    const player = players.get(Number(r.playerId));
    if (player) found.push({ player, ban: recordEntry(r, t) });
  }
  for (const b of stored ?? []) {
    const player = players.get(Number(b.playerId));
    const ban = storedBanEntry(b, t);
    if (player && ban) found.push({ player, ban });
  }
  // A player is listed once, with one badge per kind of ban (a SourceBans
  // ban the collector recorded and the same ban on the list are one).
  const rows: BanRow[] = mergeBans(found, (p) => Number(p.playerId))
    .filter((m) => !!Number(m.player.inactive) === inactive)
    .map((m) => ({ ...m, reason: mainReason(m.bans) }));
  // Newest first; without a date at the end.
  rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const always: BanKind[] = [...(steamBans ? (["vac"] as const) : []), ...(sourcebansUrl ? (["sourcebans"] as const) : [])];
  return { rows, sourcebans: sourcebansUrl ? (stored ? sbState : null) : null, sourcebansUrl, stored: stored !== null, always };
}

// The bans of one player as the profile shows them: recorded bans, the
// stored SourceBans ban, and for a player banned in the ranking without a
// known source a plain server ban. steam: the stored Steam ban (null: Steam
// was asked and shows none; undefined: not asked yet, then the VAC flag of
// the Steam profile counts).
export async function profileBans(p: PlayerDetail, t: T): Promise<{ bans: BanEntry[]; steam: BanEntry | null | undefined }> {
  const steam64 = steamIds(p.uniqueId)?.steam64 ?? null;
  const [records, stored] = await Promise.all([getPlayerBans(p.playerId), getPlayerStoredBans(p.playerId, steam64, nowUnix())]);
  const bans = records.map((r) => recordEntry(r, t));
  let steam: BanEntry | null | undefined = stored?.steamChecked ? null : undefined;
  for (const b of stored?.bans ?? []) {
    const e = storedBanEntry(b, t);
    if (!e) continue;
    if (e.kind === "vac") steam = e;
    else bans.push(e);
  }
  if (!bans.length && Number(p.hideranking) === 2) bans.push({ kind: "engine", reason: "", at: null, dateText: "", length: "", until: null });
  return { bans, steam };
}

// All bans of a player as the profile shows them, the one from Steam
// included: the stored Steam ban, else the VAC flag of the Steam profile.
// One per kind, VAC first.
export async function playerBans(p: PlayerDetail, vacLabel: string, t: T): Promise<BanEntry[]> {
  const steam64 = steamIds(p.uniqueId)?.steam64 ?? null;
  const [{ steamProfiles }, found] = await Promise.all([getSettings(), profileBans(p, t)]);
  let vac: BanEntry[] = found.steam ? [found.steam] : [];
  if (found.steam === undefined && steam64 && steamProfiles) {
    const prof = await getSteamProfile(steam64);
    vac = prof?.vacBanned ? [{ kind: "vac", reason: vacLabel, at: null, dateText: "", length: "", until: null }] : [];
  }
  return mergeBans([...found.bans, ...vac].map((ban) => ({ player: 0, ban })), () => 0)[0]?.bans ?? [];
}
