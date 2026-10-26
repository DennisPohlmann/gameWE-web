import type { Metadata } from "next";
import { sortHeads } from "@/components/sort-head";
import { Empty, PctBar, PlayerLink, Section, TableWrap } from "@/components/ui";
import { gameHasShots, getBanPlayers, getBanRecords, getPlayersBySteam, getRecentPlayers, type BanPlayer } from "@/lib/data";
import { fmtNum, kpd, localeOf, nowUnix, ratio, steamIds } from "@/lib/format";
import { getDict, type Dict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { getSourcebans, type SbState } from "@/lib/sourcebans";
import { getSteamBans, steamBansAvailable } from "@/lib/steam";
import { sortRows, sortState } from "@/lib/table-sort";

// How many of the most recently active players are checked for Steam bans.
const VAC_PLAYERS = 1000;
const MAX_ROWS = 500;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.bans };
}

type Kind = "vac" | "sourcebans" | "sourcemod" | "amx" | "engine";

type BanRow = {
  player: BanPlayer;
  kind: Kind;
  // Unix seconds; null when the source gives no usable date.
  at: number | null;
  dateText: string;
  reason: string;
  length: string;
  // Lifted or expired (SourceBans), shown greyed out.
  old: boolean;
};

// Sort keys of the columns; by default running bans first, newest first.
const banValues = {
  order: () => 0,
  name: (r: BanRow) => r.player.name,
  type: (r: BanRow): string => r.kind,
  reason: (r: BanRow) => r.reason,
  date: (r: BanRow) => r.at,
  points: (r: BanRow) => Number(r.player.skill),
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
  // The type sorts by its shown name.
  const values = { ...banValues, type: (r: BanRow) => kindLabel(r.kind, t) };
  const order = sortState(sp, values, "order");
  // Counter-Strike 2 logs no shots: no accuracy column.
  const [{ sourcebansUrl }, shots, steamBans] = await Promise.all([getSettings(), gameHasShots(game), steamBansAvailable()]);

  const [records, sb, vac] = await Promise.all([
    getBanRecords(game, MAX_ROWS),
    sourcebansUrl ? sbRows(game, sourcebansUrl) : null,
    steamBans ? vacRows(game) : [],
  ]);
  const recordPlayers = await getBanPlayers(records.map((r) => Number(r.playerId)));

  const rows: BanRow[] = [
    ...records.flatMap((r): BanRow[] => {
      const player = recordPlayers.get(Number(r.playerId));
      if (!player) return [];
      const kind = (["vac", "sourcebans", "sourcemod", "amx", "engine"] as const).find((k) => k === r.ban_type) ?? "engine";
      const len = Number(r.length_minutes);
      return [{ player, kind, at: Number(r.banned_at) || null, dateText: "", reason: r.reason ?? "", length: len ? fmtMinutes(len) : t.banStatePermanent, old: false }];
    }),
    ...(sb?.rows ?? []),
    ...vac,
  ];
  // Running bans first, newest first; without a date at the end.
  rows.sort((a, b) => Number(a.old) - Number(b.old) || (b.at ?? 0) - (a.at ?? 0));
  const sorted = sortRows(rows, values, order.sort, order.asc);
  const th = sortHeads(order, `/${game}/bans`, {});

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
      {sb?.state === "loading" ? <p className="muted">{t.sbLoading}</p> : sb?.state === "error" ? <p className="muted">{t.sbError}</p> : null}
      {rows.length ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                {th(t.name, "name", "")}
                {th(t.banType, "type", "")}
                {th(t.banReason, "reason", "hide-sm")}
                {th(t.banDate, "date", "")}
                {th(t.points, "points")}
                {th(t.kpd, "kpd", "num hide-sm")}
                {th(t.hpk, "hpk", "barcell")}
                {shots ? th(t.acc, "acc", "barcell hide-sm") : null}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, MAX_ROWS).map((r, i) => (
                <tr key={`${r.kind}-${r.player.playerId}-${i}`} className={r.old ? "ban-old" : undefined}>
                  <td className="rank">{fmtNum(i + 1, lang)}</td>
                  <td>
                    <PlayerLink game={game} id={r.player.playerId} name={r.player.name} flag={r.player.flag ? { flag: r.player.flag, country: r.player.country ?? "" } : null} />
                  </td>
                  <td>
                    <span className={`ban-type ban-${r.kind}${r.old ? " ban-lifted" : ""}`} title={[r.length, r.old ? t.banStateExpired : ""].filter(Boolean).join(" · ") || undefined}>
                      {kindLabel(r.kind, t)}
                    </span>
                  </td>
                  <td className="hide-sm">{r.reason}</td>
                  <td>{r.at ? new Date(r.at * 1000).toLocaleString(localeOf(lang), { dateStyle: "medium", timeStyle: "short" }) : r.dateText || "–"}</td>
                  <td className="num">{fmtNum(Number(r.player.skill), lang)}</td>
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
      ) : (
        <Empty>{t.bansNone}</Empty>
      )}
      <p className="muted">{t.bansHint}</p>
    </Section>
  );
}

function kindLabel(k: Kind, t: Dict): string {
  return { vac: "VAC", sourcebans: "SourceBans", sourcemod: "SourceMod", amx: "AMX", engine: t.banTypeServer }[k];
}

function fmtMinutes(m: number): string {
  if (m % 1440 === 0) return `${m / 1440} d`;
  if (m % 60 === 0) return `${m / 60} h`;
  return `${m} min`;
}

async function sbRows(game: string, base: string) {
  const list = await getSourcebans(base);
  if (!list) return { state: "loading" as const, rows: [] as BanRow[] };
  const players = await getPlayersBySteam(
    game,
    list.bans.map((b) => b.steam64),
  );
  const old: Record<SbState, boolean> = { permanent: false, active: false, expired: true, unbanned: true };
  const rows = list.bans.flatMap((ban): BanRow[] => {
    const player = players.get(ban.steam64);
    if (!player) return [];
    // SB++ 2026 gives an ISO time; the classic list a text in its own format.
    const t = /^\d{4}-\d\d-\d\dT/.test(ban.date) ? Date.parse(ban.date) : NaN;
    return [{ player, kind: "sourcebans", at: Number.isNaN(t) ? null : Math.floor(t / 1000), dateText: ban.date, reason: ban.reason, length: ban.length, old: old[ban.state] }];
  });
  return { state: list.ok ? ("ok" as const) : ("error" as const), rows };
}

async function vacRows(game: string): Promise<BanRow[]> {
  const players = await getRecentPlayers(game, VAC_PLAYERS);
  const bySteam = new Map(
    players.flatMap((p) => {
      const ids = steamIds(p.uniqueId);
      return ids ? [[ids.steam64, p] as const] : [];
    }),
  );
  const bans = await getSteamBans([...bySteam.keys()]);
  const now = nowUnix();
  return [...bans].flatMap(([id, b]): BanRow[] => {
    const player = bySteam.get(id);
    if (!player || (b.vac <= 0 && b.game <= 0)) return [];
    // Steam gives the days since the last ban, so the date is to the day.
    return [{ player, kind: "vac", at: now - b.days * 86400, dateText: "", reason: b.vac ? `${b.vac}× VAC` : `${b.game}× Game Ban`, length: "", old: false }];
  });
}
