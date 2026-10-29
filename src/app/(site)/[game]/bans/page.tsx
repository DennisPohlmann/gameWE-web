import type { Metadata } from "next";
import { sortHeads } from "@/components/sort-head";
import { BanBadges, banKindLabel, NameBanMark, sourcebansSearchUrl } from "@/components/ban-badges";
import { Empty, Pager, PctBar, PlayerLink, ROW_OPTIONS, Section, TableWrap, pageParam, rowsParam } from "@/components/ui";
import { banKind, mainReason, mergeBans, steamBanEntry, type BanEntry, type BanKind } from "@/lib/ban-merge";
import { gameHasShots, getBanPlayers, getBanRecords, getPlayersBySteam, getRecentPlayers, type BanPlayer } from "@/lib/data";
import { fmtBanMinutes, fmtNum, kpd, localeOf, nowUnix, ratio, steamIds } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { getSourcebans, type SbState } from "@/lib/sourcebans";
import { getSteamBans, steamBansAvailable } from "@/lib/steam";
import { sortRows, sortState } from "@/lib/table-sort";

// How many of the most recently active players are checked for Steam bans.
const VAC_PLAYERS = 1000;
const MAX_ROWS = 500;
// Rows per page unless the visitor picks another number.
const PER_PAGE = 50;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.bans };
}

// One ban of a player from one source, before the bans of a player are
// merged into one row (ban-merge.ts).
type Found = { player: BanPlayer; ban: BanEntry };

// A banned player with all running bans (VAC first); at is the newest.
type BanRow = { player: BanPlayer; bans: BanEntry[]; at: number | null; dateText: string; reason: string };

// Sort keys of the columns; by default newest first.
const banValues = {
  order: () => 0,
  name: (r: BanRow) => r.player.name,
  type: (r: BanRow): string => r.bans.map((b) => b.kind).join(","),
  reason: (r: BanRow) => r.reason,
  date: (r: BanRow) => r.at,
  kpd: (r: BanRow) => kpd(Number(r.player.kills), Number(r.player.deaths)),
  hpk: (r: BanRow) => ratio(Number(r.player.headshots), Number(r.player.kills)),
  acc: (r: BanRow) => ratio(Number(r.player.hits), Number(r.player.shots)),
};

// Banned players of a ranking, as one list like gameME's: bans the
// collector recorded from the server logs, bans from SourceBans (address
// under Settings → Bans) and VAC/game bans from Steam (Steam Web API key, Settings → Steam).
export default async function BansPage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { game } = await params;
  const sp = await searchParams;
  const { lang, t } = await getDict();
  // The type sorts by its shown names.
  const values = { ...banValues, type: (r: BanRow) => r.bans.map((b) => banKindLabel(b.kind, t)).join(", ") };
  const order = sortState(sp, values, "order");
  // Counter-Strike 2 logs no shots: no accuracy column.
  const [{ sourcebansUrl }, shots, steamBans] = await Promise.all([getSettings(), gameHasShots(game), steamBansAvailable()]);

  const [records, sb, vac] = await Promise.all([
    getBanRecords(game, MAX_ROWS),
    sourcebansUrl ? sbRows(game, sourcebansUrl) : null,
    steamBans ? vacRows(game) : [],
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
  const rows: BanRow[] = mergeBans([...recordRows, ...(sb?.rows ?? []), ...vac], (p) => Number(p.playerId)).map((m) => ({ ...m, reason: mainReason(m.bans) }));
  // Newest first; without a date at the end.
  rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const sorted = sortRows(rows, values, order.sort, order.asc).slice(0, MAX_ROWS);
  // Only one page of rows is drawn; sorting covers all of them.
  const limit = rowsParam(sp.rows, PER_PAGE);
  const pages = Math.max(1, Math.ceil(sorted.length / limit));
  const page = Math.min(pageParam(sp.page), pages);
  const offset = (page - 1) * limit;
  const keep = { ...order.keep, rows: limit !== PER_PAGE ? limit : undefined };
  const th = sortHeads(order, `/${game}/bans`, { rows: keep.rows });
  // VAC and SourceBans side by side whenever the site checks them.
  const always: BanKind[] = [...(steamBans ? (["vac"] as const) : []), ...(sourcebansUrl ? (["sourcebans"] as const) : [])];

  return (
    <Section
      title={t.banList}
      aside={
        sourcebansUrl ? (
          <a href={`${sourcebansUrl}index.php?p=banlist`} target="_blank" rel="noopener noreferrer nofollow">
            {t.sbOpen}
          </a>
        ) : null
      }
    >
      {sb?.state === "loading" ? (
        <p className="muted">{t.sbLoading}</p>
      ) : sb?.state === "error" ? (
        <p className="muted">{t.sbError}</p>
      ) : sb?.state === "unknown" ? (
        <p className="muted">{t.sbUnknown}</p>
      ) : null}
      {rows.length ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                {th(t.name, "name", "")}
                {th(t.banType, "type", "ban-type-col")}
                {th(t.banReason, "reason", "hide-sm")}
                {th(t.banDate, "date", "")}
                {th(t.kpd, "kpd", "num hide-sm")}
                {th(t.hpk, "hpk", "barcell")}
                {shots ? th(t.acc, "acc", "barcell hide-sm") : null}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(offset, offset + limit).map((r, i) => (
                <tr key={r.player.playerId}>
                  <td className="rank">{fmtNum(offset + i + 1, lang)}</td>
                  <td>
                    <PlayerLink game={game} id={r.player.playerId} name={r.player.name} flag={r.player.flag ? { flag: r.player.flag, country: r.player.country ?? "" } : null} />
                    <NameBanMark bans={r.bans} t={t} lang={lang} />
                  </td>
                  <td className="ban-type-col">
                    <BanBadges bans={r.bans} always={always} links={{ sourcebans: sourcebansSearchUrl(sourcebansUrl, steamIds(r.player.uniqueId)?.steam2) }} t={t} lang={lang} />
                  </td>
                  <td className="hide-sm">{r.reason}</td>
                  <td>{r.at ? new Date(r.at * 1000).toLocaleString(localeOf(lang), { dateStyle: "medium", timeStyle: "short" }) : r.dateText || "–"}</td>
                  <td className="num hide-sm">{fmtNum(kpd(Number(r.player.kills), Number(r.player.deaths)), lang, 2)}</td>
                  <td className="barcell">
                    <PctBar value={ratio(Number(r.player.headshots), Number(r.player.kills))} lang={lang} />
                  </td>
                  {shots ? (
                    <td className="barcell hide-sm">
                      <PctBar value={ratio(Number(r.player.hits), Number(r.player.shots))} lang={lang} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : null}
      {rows.length ? (
        <Pager base={`/${game}/bans`} params={keep} page={page} pages={pages} total={sorted.length} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
      ) : (
        <Empty>{t.bansNone}</Empty>
      )}
      <p className="muted">{t.bansHint}</p>
    </Section>
  );
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

async function vacRows(game: string): Promise<Found[]> {
  const players = await getRecentPlayers(game, VAC_PLAYERS);
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
