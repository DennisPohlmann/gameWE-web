import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AwardBoard, AwardDayTable } from "@/components/award-board";
import { AwardCalendar } from "@/components/award-calendar";
import { RankBadge, Ribbon, RibbonLevel, rankName, ribbonClassName } from "@/components/badges";
import { sortHeads } from "@/components/sort-head";
import { Bar, Empty, Pager, PlayerLink, ROW_OPTIONS, Section, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import {
  getAwardDays,
  getLastAwardDay,
  getAwards,
  getMostDecorated,
  getRankCounts,
  getRankedCount,
  getRankPlayers,
  getRanks,
  getRibbonClasses,
  getRibbonHolders,
  getRibbonLeaders,
  rankFor,
  reachedClass,
  ribbonFor,
  ribbonProgress,
  type RibbonHolder,
} from "@/lib/awards";
import { getPlayerFlags } from "@/lib/data";
import { siteDay } from "@/lib/day";
import { activity, fmtDuration, fmtNum, fmtPct, localeOf } from "@/lib/format";
import { fill, getDict, type Dict, type Lang } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { rankPlayerSorts, sortRows, sortState, type SortState } from "@/lib/table-sort";

type SP = Promise<Record<string, string | string[] | undefined>>;
type Keep = Record<string, string | number | undefined>;

// The most decorated players stand beside the ranks and ribbons tables, so
// they sort with their own params.
const DECO = { sortParam: "dsort", dirParam: "ddir" };
type Decorated = Awaited<ReturnType<typeof getMostDecorated>>[number];
const decoratedValues = {
  wins: (p: Decorated) => Number(p.wins),
  name: (p: Decorated) => p.name,
};
// Holders of one ribbon, most wins first.
const holderValues = {
  wins: (h: RibbonHolder) => Number(h.wins),
  name: (h: RibbonHolder) => h.name,
  last: (h: RibbonHolder) => h.last,
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.awards };
}

// gameME's awards section: daily awards, their history, ranks and ribbons.
export default async function AwardsPage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: SP }) {
  const { game } = await params;
  const sp = await searchParams;
  const { lang, t } = await getDict();
  const view = strParam(sp.view);
  const base = `/${game}/awards`;
  const tabs = [
    ["", t.dailyAwards],
    ["history", t.awardHistory],
    ["ranks", t.ranks],
    ["ribbons", t.ribbons],
  ] as const;
  const current = tabs.some(([k]) => k === view) ? view : "";
  const deco = sortState(sp, decoratedValues, "wins", DECO);
  const rankOrder = sortState(sp, rankPlayerSorts, "kills");
  const holderOrder = sortState(sp, holderValues, "wins");
  const rows = rowsParam(sp.rows, 0) || undefined;
  const page = pageParam(sp.page);
  const rank = strParam(sp.rank);
  const award = strParam(sp.award);
  const cls = strParam(sp.class);

  return (
    <>
      <div className="block">
        <div className="container subtab-bar">
          <span className="subtabs">
            {tabs.map(([k, label]) => (
              <Link prefetch={false} key={k} href={k ? `${base}?view=${k}` : base} className={current === k ? "active" : undefined}>
                {label}
              </Link>
            ))}
          </span>
        </div>
      </div>
      {current === "" ? <AwardBoard game={game} t={t} lang={lang} sort={{ sp, base, params: {} }} /> : null}
      {current === "history" ? <History game={game} t={t} lang={lang} sp={sp} date={strParam(sp.date)} month={strParam(sp.month)} /> : null}
      {current === "ranks" ? (
        <WithDecorated game={game} t={t} lang={lang} order={deco} base={base} params={{ view: "ranks", rank: rank || undefined, page: page > 1 ? page : undefined, rows, ...rankOrder.keep }}>
          <Ranks game={game} t={t} lang={lang} rank={rank} page={page} rows={sp.rows} order={rankOrder} keep={deco.keep} />
        </WithDecorated>
      ) : null}
      {current === "ribbons" ? (
        <WithDecorated game={game} t={t} lang={lang} order={deco} base={base} params={{ view: "ribbons", award: award || undefined, class: cls || undefined, ...holderOrder.keep }}>
          <Ribbons game={game} t={t} lang={lang} award={award} cls={cls} order={holderOrder} keep={deco.keep} />
        </WithDecorated>
      ) : null}
    </>
  );
}

type P = { game: string; t: Dict; lang: Lang };

// Award history: a month calendar to pick a past day and that day's winners.
// Days can be picked up to the last day with stored awards (yesterday while
// none are stored); today and later have no awards yet. Without a date, or
// with one after that day, the last day is shown.
async function History({ game, t, lang, sp, date, month }: P & { sp: Record<string, string | string[] | undefined>; date: string; month: string }) {
  const today = siteDay();
  const yesterday = siteDay(-1);
  const stored = await getLastAwardDay(game);
  const last = stored && stored < today ? stored : yesterday;
  const valid = (d: string) =>
    /^\d{4}-\d\d-\d\d$/.test(d) && d >= "2000-01-01" && d <= last && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
  const day = valid(date) ? date : last;
  const mon = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= "2000-01" && month <= last.slice(0, 7) ? month : day.slice(0, 7);
  const days = await getAwardDays(game, mon);
  return (
    <div className="awards-daily">
      <div className="block">
        <AwardCalendar base={`/${game}/awards?view=history`} month={mon} selected={day} today={today} last={last} stored={days} t={t} locale={localeOf(lang)} />
      </div>
      <AwardDayTable game={game} day={day} t={t} lang={lang} sort={{ sp, base: `/${game}/awards`, params: { view: "history", date: valid(date) ? date : undefined, month: month === mon ? month : undefined } }} />
    </div>
  );
}

// gameME shows the most decorated players next to ranks and ribbons.
async function WithDecorated({
  game,
  t,
  lang,
  order,
  base,
  params,
  children,
}: P & { order: SortState<keyof typeof decoratedValues>; base: string; params: Keep; children: ReactNode }) {
  const [loaded, ranks] = await Promise.all([getMostDecorated(game, 30), getRanks(game)]);
  const flags = await getPlayerFlags(loaded.map((p) => p.playerId));
  const top = sortRows(loaded, decoratedValues, order.sort, order.asc);
  const th = sortHeads(order, base, { ...params, ...order.keep }, DECO);
  return (
    <div className="awards-split">
      <Section title={t.mostDecorated}>
        {top.length ? (
          <TableWrap>
            <table className="decorated">
              <thead>
                <tr>
                  <th className="num">#</th>
                  {th(`${t.player} / ${t.currentRank}`, "name", "")}
                  {th(t.wins, "wins")}
                </tr>
              </thead>
              <tbody>
                {top.map((p, i) => {
                  const r = rankFor(Number(p.kills), ranks);
                  return (
                    <tr key={p.playerId}>
                      <td className="rank">{i + 1}</td>
                      {/* Name and rank one above the other: the column beside
                          ranks and ribbons is narrow. */}
                      <td className="decorated-cell">
                        <PlayerLink game={game} id={p.playerId} name={p.name} flag={flags.get(p.playerId)} />
                        {r ? (
                          <span className="decorated-rank">
                            <RankBadge name={r.name} size={18} />
                            {rankName(r.name)}
                          </span>
                        ) : null}
                      </td>
                      <td className="num">{fmtNum(Number(p.wins), lang)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <Empty>{t.noHistory}</Empty>
        )}
      </Section>
      <div>{children}</div>
    </div>
  );
}

async function Ranks({
  game,
  t,
  lang,
  rank: rawRank,
  page,
  rows,
  order,
  keep,
}: P & { rank: string; page: number; rows: string | string[] | undefined; order: SortState<keyof typeof rankPlayerSorts>; keep: Keep }) {
  const ranks = await getRanks(game);
  if (!ranks.length) return <Empty>{t.noData}</Empty>;
  const counts = await getRankCounts(game, ranks);
  const range = (r: (typeof ranks)[number]) =>
    r.next !== null
      ? fill(t.killsRange, { min: fmtNum(r.minimum, lang), max: fmtNum(r.next - 1, lang) })
      : fill(t.killsFrom, { min: fmtNum(r.minimum, lang) });
  const idx = Number.parseInt(rawRank, 10);
  const sel = Number.isInteger(idx) ? ranks[idx] : undefined;
  const { pageSize, activityDays } = await getSettings();
  const limit = rowsParam(rows, pageSize);
  const players = sel ? await getRankPlayers(game, sel, limit, (page - 1) * limit, order.sort, order.asc) : [];
  const params = { view: "ranks", rank: sel?.index, rows: limit !== pageSize ? limit : undefined, ...keep, ...order.keep };
  const th = sortHeads(order, `/${game}/awards`, params);
  const flags = await getPlayerFlags(players.map((p) => p.playerId));
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <>
      <Section title={t.ranksOverview}>
        <div className="box rank-grid">
          {ranks.map((r, i) => (
            <Link prefetch={false} key={i} href={`/${game}/awards?view=ranks&rank=${i}`} className={sel?.index === i ? "rank-cell active" : "rank-cell"}>
              <RankBadge name={r.name} size={44} />
              <b>{rankName(r.name)}</b>
              <span className="muted">{range(r)}</span>
              <span className={counts[i] ? undefined : "muted"}>
                {counts[i] ? fill(t.achievedBy, { n: fmtNum(counts[i], lang), pct: fmtPct(total ? counts[i] / total : 0, lang, 2) }) : t.noPlayers}
              </span>
            </Link>
          ))}
        </div>
      </Section>
      {sel ? (
        <Section title={`${rankName(sel.name)}: ${range(sel)}`}>
          {players.length ? (
            <>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      {th(t.player, "name", "")}
                      {th(t.kills, "kills")}
                      {/* Progress to the next rank: the kills again. */}
                      <th className="barcell">{t.share}</th>
                      {th(t.points, "skill")}
                      {th(t.time, "time", "num hide-sm")}
                      {th(t.activity, "activity", "barcell hide-sm")}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, i) => {
                      const prog = sel.next !== null ? (p.kills - sel.minimum) / (sel.next - sel.minimum) : 1;
                      const act = activity(p.last_event, activityDays);
                      return (
                        <tr key={p.playerId}>
                          <td className="rank">{(page - 1) * limit + i + 1}</td>
                          <td>
                            <PlayerLink game={game} id={p.playerId} name={p.name} flag={flags.get(p.playerId)} />
                          </td>
                          <td className="num">{fmtNum(p.kills, lang)}</td>
                          <td className="barcell">
                            <Bar value={prog} label={fmtPct(prog, lang)} />
                          </td>
                          <td className="num">{fmtNum(p.skill, lang)}</td>
                          <td className="num hide-sm">{fmtDuration(p.connection_time)}</td>
                          <td className="barcell hide-sm">
                            <Bar value={act / 100} activity label={`${act} %`} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
              <Pager
                base={`/${game}/awards`}
                params={params}
                page={page}
                pages={Math.max(1, Math.ceil(counts[sel.index] / limit))}
                total={counts[sel.index]}
                rows={{ value: limit, options: ROW_OPTIONS }}
                locale={localeOf(lang)}
                labels={t}
              />
            </>
          ) : (
            <Empty>{t.noData}</Empty>
          )}
        </Section>
      ) : (
        <p className="lead center">{fill(t.playersInRank, { n: fmtNum(total, lang) })}</p>
      )}
    </>
  );
}

async function Ribbons({
  game,
  t,
  lang,
  award,
  cls: rawCls,
  order,
  keep,
}: P & { award: string; cls: string; order: SortState<keyof typeof holderValues>; keep: Keep }) {
  const [awards, leaders, classes, ranked] = await Promise.all([getAwards(game), getRibbonLeaders(game), getRibbonClasses(game), getRankedCount(game)]);
  const ci = Number.parseInt(rawCls, 10);
  const cls = Number.isInteger(ci) && ci >= 0 && ci < classes.length ? ci : null;
  const achieved = (n: number) => (n ? fill(t.achievedBy, { n: fmtNum(n, lang), pct: fmtPct(ranked ? n / ranked : 0, lang, 2) }) : t.noPlayers);
  const id = Number.parseInt(award, 10);
  const sel = awards.find((a) => a.awardId === id);
  const loaded = sel ? await getRibbonHolders(sel.awardId, 50) : [];
  const flags = await getPlayerFlags(loaded.map((h) => h.playerId));
  const holders = sortRows(loaded, holderValues, order.sort, order.asc);
  const th = sortHeads(order, `/${game}/awards`, { view: "ribbons", award: sel?.awardId, class: cls ?? undefined, ...keep, ...order.keep });
  return (
    <>
      <Section title={t.ribbonsOverview}>
        <p>
          {fill(t.ribbonClasses, {
            classes: classes.map((c) => ribbonClassName(c.name, lang)).join(", "),
            max: classes[0]?.maximum ?? 0,
          })}
        </p>
        <p className="subtabs ribbon-classes">
          <Link prefetch={false} href={`/${game}/awards?view=ribbons`} className={cls === null ? "active" : undefined}>
            {t.allClasses}
          </Link>
          {classes.map((c, i) => (
            <Link prefetch={false} key={c.class} href={`/${game}/awards?view=ribbons&class=${i}`} className={cls === i ? "active" : undefined}>
              {ribbonClassName(c.name, lang)}
            </Link>
          ))}
        </p>
        <div className="box ribbon-grid">
          {awards.map((a) => {
            const top = leaders.get(a.awardId);
            return (
              <Link prefetch={false}
                key={a.awardId}
                href={`/${game}/awards?view=ribbons&award=${a.awardId}${cls === null ? "" : `&class=${cls}`}`}
                className={sel?.awardId === a.awardId ? "ribbon-cell active" : "ribbon-cell"}
              >
                <Ribbon
                  code={a.code}
                  title={a.name}
                  ribbon={
                    cls !== null
                      ? { index: cls, name: classes[cls].name, level: Math.max(1, classes[cls].maximum), max: Math.max(1, classes[cls].maximum) }
                      : top
                        ? ribbonFor(top.wins, classes)
                        : null
                  }
                />
                <span className="small">{achieved(top ? (cls === null ? top.holders : reachedClass(top.all, cls, classes)) : 0)}</span>
                <span className="small">
                  {top ? (
                    <>
                      {top.name ?? `#${top.playerId}`} · {fill(t.winsCount, { n: top.wins })}
                    </>
                  ) : (
                    <span className="muted">{t.notAwarded}</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </Section>
      {sel ? (
        <Section title={sel.name}>
          {holders.length ? (
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th className="num">#</th>
                    {th(t.player, "name", "")}
                    <th>{t.ribbons}</th>
                    {/* The level follows the wins. */}
                    <th>{t.ribbonLevel}</th>
                    {th(t.wins, "wins")}
                    {th(t.lastWon, "last")}
                  </tr>
                </thead>
                <tbody>
                  {holders.map((h, i) => {
                    const r = ribbonFor(h.wins, classes);
                    return (
                      <tr key={h.playerId}>
                        <td className="rank">{i + 1}</td>
                        <td>
                          <PlayerLink game={game} id={h.playerId} name={h.name} flag={flags.get(h.playerId)} />
                        </td>
                        <td>
                          <Ribbon code={sel.code} label={sel.name} title={`${sel.name}${r ? ` – ${ribbonClassName(r.name, lang)} ${r.level}` : ""}`} ribbon={r} />
                        </td>
                        <td>
                          <RibbonLevel
                            progress={ribbonProgress(Number(h.wins), classes)}
                            className={(n) => ribbonClassName(n, lang)}
                            texts={{ toNext: t.ribbonToNext, maxed: t.ribbonMaxed }}
                          />
                        </td>
                        <td className="num">{fmtNum(h.wins, lang)}</td>
                        <td className="num">{h.last}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <p>{leaders.size ? t.notAwarded : t.noHistory}</p>
          )}
        </Section>
      ) : null}
    </>
  );
}
