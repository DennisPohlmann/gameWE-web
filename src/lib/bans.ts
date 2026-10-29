import "server-only";
import { banKind, mainReason, mergeBans, steamBanEntry, type BanEntry, type BanKind } from "./ban-merge";
import { getBanPlayers, getBanRecords, getPlayerBans, getPlayersBySteam, getRecentPlayers, type BanPlayer, type PlayerDetail } from "./data";
import { fmtBanMinutes, nowUnix, steamIds } from "./format";
import type { Dict } from "./i18n";
import { getSettings } from "./settings";
import { getSourcebans, peekSourcebans, type SbState } from "./sourcebans";
import { getSteamBans, getSteamProfile, steamBansAvailable } from "./steam";

// The bans the public site shows, for the bans page, the profile and the
// API alike: bans the collector recorded from the server logs, bans from
// SourceBans (address under Settings → Bans) and VAC/game bans from Steam
// (Steam Web API key, Settings → Steam). Never IP addresses or chat.

// How many of the most recently active players (with inactive: of the most
// recently seen inactive ones) are checked for Steam bans.
export const VAC_PLAYERS = 1000;
export const MAX_ROWS = 500;

type T = Pick<Dict, "banStatePermanent">;

// One ban of a player from one source, before the bans of a player are
// merged into one row (ban-merge.ts).
type Found = { player: BanPlayer; ban: BanEntry };

// A banned player with all running bans (VAC first); at is the newest.
export type BanRow = { player: BanPlayer; bans: BanEntry[]; at: number | null; dateText: string; reason: string };

// sourcebans: the state of the SourceBans list (null: not set up);
// always: the sources the site checks (their badges always show).
export type RankingBans = { rows: BanRow[]; sourcebans: "loading" | "error" | "unknown" | "ok" | null; sourcebansUrl: string; always: BanKind[] };

// The banned players of a ranking, newest ban first, at most MAX_ROWS: those
// still in the ranking (hlstats_Players) or, with inactive, those the
// collector moved to hlstats_PlayersInactive (the bans page's two tabs).
export async function getRankingBans(game: string, t: T, inactive = false): Promise<RankingBans> {
  const [{ sourcebansUrl }, steamBans] = await Promise.all([getSettings(), steamBansAvailable()]);
  const [records, sb, vac] = await Promise.all([
    getBanRecords(game, MAX_ROWS),
    sourcebansUrl ? sbRows(game, sourcebansUrl) : null,
    steamBans ? vacRows(game, inactive) : [],
  ]);
  const recordPlayers = await getBanPlayers(records.map((r) => Number(r.playerId)));
  const recordRows = records.flatMap((r): Found[] => {
    const player = recordPlayers.get(Number(r.playerId));
    if (!player) return [];
    const len = Number(r.length_minutes);
    return [{ player, ban: { kind: banKind(r.ban_type), at: Number(r.banned_at) || null, dateText: "", reason: r.reason ?? "", length: len ? fmtBanMinutes(len) : t.banStatePermanent, until: Number(r.ends_at) || null } }];
  });
  // A player is listed once, with one badge per kind of ban (a SourceBans
  // ban the collector recorded and the same ban on the list are one).
  const rows: BanRow[] = mergeBans([...recordRows, ...(sb?.rows ?? []), ...vac], (p) => Number(p.playerId))
    .filter((m) => !!Number(m.player.inactive) === inactive)
    .map((m) => ({ ...m, reason: mainReason(m.bans) }));
  // Newest first; without a date at the end.
  rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const always: BanKind[] = [...(steamBans ? (["vac"] as const) : []), ...(sourcebansUrl ? (["sourcebans"] as const) : [])];
  return { rows: rows.slice(0, MAX_ROWS), sourcebans: sb?.state ?? null, sourcebansUrl, always };
}

async function sbRows(game: string, base: string) {
  const list = await getSourcebans(base);
  if (!list) return { state: "loading" as const, rows: [] as Found[] };
  const players = await getPlayersBySteam(
    game,
    list.bans.map((b) => b.steam64),
  );
  // Expired and lifted bans are not shown: the player is no longer banned.
  const old: Record<SbState, boolean> = { permanent: false, active: false, expired: true, unbanned: true };
  const rows = list.bans.flatMap((ban): Found[] => {
    const player = players.get(ban.steam64);
    if (!player || old[ban.state]) return [];
    // SB++ 2026 gives an ISO time; the classic list a text in its own format.
    const t = /^\d{4}-\d\d-\d\dT/.test(ban.date) ? Date.parse(ban.date) : NaN;
    return [{ player, ban: { kind: "sourcebans", at: Number.isNaN(t) ? null : Math.floor(t / 1000), dateText: ban.date, reason: ban.reason, length: ban.length, until: null } }];
  });
  return { state: !list.ok ? ("error" as const) : list.unknown ? ("unknown" as const) : ("ok" as const), rows };
}

async function vacRows(game: string, inactive: boolean): Promise<Found[]> {
  const players = await getRecentPlayers(game, VAC_PLAYERS, inactive);
  const bySteam = new Map(
    players.flatMap((p) => {
      const ids = steamIds(p.uniqueId);
      return ids ? [[ids.steam64, p] as const] : [];
    }),
  );
  const bans = await getSteamBans([...bySteam.keys()]);
  const now = nowUnix();
  return [...bans].flatMap(([id, b]): Found[] => {
    const player = bySteam.get(id);
    const ban = steamBanEntry(b, now);
    return player && ban ? [{ player, ban }] : [];
  });
}

// The bans of one player as the profile shows them, without the one from
// Steam (asked apart, so the page does not wait for Steam): recorded bans,
// the SourceBans list as far as it is loaded, and for a player banned in
// the ranking without a known source a plain server ban.
export async function profileBans(p: PlayerDetail, steam64: string | null, sourcebansUrl: string, t: T): Promise<BanEntry[]> {
  const out: BanEntry[] = [];
  for (const rec of await getPlayerBans(p.playerId)) {
    const len = Number(rec.length_minutes);
    out.push({ kind: banKind(rec.ban_type), reason: rec.reason ?? "", at: Number(rec.banned_at) || null, dateText: "", length: len ? fmtBanMinutes(len) : t.banStatePermanent, until: Number(rec.ends_at) || null });
  }
  if (sourcebansUrl && steam64 && !out.some((b) => b.kind === "sourcebans")) {
    const sb = peekSourcebans(sourcebansUrl)?.bans.find((b) => b.steam64 === steam64 && (b.state === "permanent" || b.state === "active"));
    if (sb) {
      const d = /^\d{4}-\d\d-\d\dT/.test(sb.date) ? Date.parse(sb.date) : NaN;
      out.push({ kind: "sourcebans", reason: sb.reason, at: Number.isNaN(d) ? null : Math.floor(d / 1000), dateText: sb.date, length: sb.state === "permanent" ? t.banStatePermanent : sb.length, until: null });
    }
  }
  if (!out.length && Number(p.hideranking) === 2) out.push({ kind: "engine", reason: "", at: null, dateText: "", length: "", until: null });
  return out;
}

// All bans of a player as the profile shows them, the one from Steam
// included: Steam's ban list with an API key, else the VAC flag of the
// Steam profile. One per kind, VAC first.
export async function playerBans(p: PlayerDetail, vacLabel: string, t: T): Promise<BanEntry[]> {
  const steam64 = steamIds(p.uniqueId)?.steam64 ?? null;
  const [{ sourcebansUrl, steamProfiles }, withKey] = await Promise.all([getSettings(), steamBansAvailable()]);
  const found = await profileBans(p, steam64, sourcebansUrl, t);
  let vac: BanEntry[] = [];
  if (steam64 && withKey) {
    const b = (await getSteamBans([steam64])).get(steam64);
    const e = b ? steamBanEntry(b, nowUnix()) : null;
    vac = e ? [e] : [];
  } else if (steam64 && steamProfiles) {
    const prof = await getSteamProfile(steam64);
    vac = prof?.vacBanned ? [{ kind: "vac", reason: vacLabel, at: null, dateText: "", length: "", until: null }] : [];
  }
  return mergeBans([...found, ...vac].map((ban) => ({ player: 0, ban })), () => 0)[0]?.bans ?? [];
}
