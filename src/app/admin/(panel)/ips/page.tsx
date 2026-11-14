import Form from "next/form";
import { PageHead } from "@/components/admin/page-head";
import Link from "next/link";
import { Empty, Pager, ROW_OPTIONS, Section, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { optionList } from "@/lib/admin-data";
import { adminDict } from "@/lib/admin-i18n";
import { requireAdmin } from "@/lib/auth";
import { noAutofill } from "@/lib/autofill";
import { fmtDateTime, fmtNum, localeOf } from "@/lib/format";
import { countIps, searchIps } from "@/lib/history";
import { fill, getDict } from "@/lib/i18n";
import { sortHeads, SortInputs } from "@/components/sort-head";
import { ipSorts, sortState } from "@/lib/table-sort";

const PERIODS = [7, 30, 90, 365];

// All stored player addresses (hlstats_Events_Connects), searchable, for
// admins only; the public pages never show them.
export default async function AdminIps({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { lang, t } = await getDict();
  const a = adminDict(lang);
  const sp = await searchParams;
  const game = strParam(sp.game);
  const q = strParam(sp.q).slice(0, 100);
  const daysParam = Number.parseInt(strParam(sp.days), 10);
  const days = PERIODS.includes(daysParam) ? daysParam : 0;
  const page = pageParam(sp.page);
  const limit = rowsParam(sp.rows, 100);
  const filter = { q: q || undefined, game: game || undefined, days: days || undefined };
  const order = sortState(sp, ipSorts, "last");
  const [rows, total, games] = await Promise.all([
    searchIps({ ...filter, limit, offset: (page - 1) * limit, sort: order.sort, asc: order.asc }),
    countIps(filter),
    optionList("games", true),
  ]);
  const base = "/admin/ips";
  const keep = { ...filter, ...order.keep, rows: limit !== 100 ? limit : undefined };
  const th = sortHeads(order, base, keep);
  const gameName = new Map(games);
  return (
    <>
      <PageHead crumbs={[[a.ui.areaSettings, "/admin/settings"], [a.ui.navModeration], [a.ips]]} title={a.ips} intro={a.ipsHelp} />
      <Section
        title={a.ips}
        aside={
          <Form className="search" action={base}>
            <select {...noAutofill} name="game" defaultValue={game} aria-label={a.allGames}>
              <option value="">{a.allGames}</option>
              {games.map(([v, l]) => (
                <option key={v} value={v} dir="auto">
                  {l}
                </option>
              ))}
            </select>
            <select {...noAutofill} name="days" defaultValue={days ? String(days) : ""} aria-label={a.ipsPeriod}>
              <option value="">{a.ipsAllTime}</option>
              {PERIODS.map((n) => (
                <option key={n} value={n}>
                  {fill(a.ipsDays, { n: String(n) })}
                </option>
              ))}
            </select>
            <SortInputs keep={order.keep} />
            <input {...noAutofill} type="search" name="q" dir="auto" defaultValue={q} placeholder={a.ipsSearch} aria-label={a.ipsSearch} maxLength={100} />
            <button type="submit">{a.filter}</button>
          </Form>
        }
      >
        {rows.length ? (
          <>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    {th(t.ipAddress, "ip", "")}
                    {th(t.player, "name", "")}
                    {th(t.steamId, "steam", "hide-sm")}
                    {th(t.ranking, "game", "hide-sm")}
                    {th(t.connections, "connects")}
                    {th(t.firstConnect, "first", "hide-sm")}
                    {th(t.lastConnect, "last", "")}
                    {th(t.ipHost, "host", "hide-sm")}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.ip}-${r.playerId}`}>
                      <td className="nowrap">
                        {r.ip === "-" ? (
                          "-"
                        ) : (
                          <Link prefetch={false} href={`${base}?q=${encodeURIComponent(r.ip)}`} title={a.ipsSame}>
                            {r.ip}
                          </Link>
                        )}
                      </td>
                      <td>
                        {r.game ? (
                          <Link prefetch={false} href={`/${encodeURIComponent(r.game)}/players/${r.playerId}/ips`}><bdi>{r.name || `#${r.playerId}`}</bdi></Link>
                        ) : (
                          <bdi>{r.name || `#${r.playerId}`}</bdi>
                        )}
                      </td>
                      <td className="hide-sm nowrap">
                        {r.uniqueId ? <Link prefetch={false} href={`${base}?q=${encodeURIComponent(r.uniqueId)}`}>{r.uniqueId}</Link> : "-"}
                      </td>
                      <td className="hide-sm"><bdi>{gameName.get(r.game) ?? r.game}</bdi></td>
                      <td className="num">{fmtNum(r.connects, lang)}</td>
                      <td className="hide-sm muted nowrap">{fmtDateTime(r.first, lang)}</td>
                      <td className="muted nowrap">{fmtDateTime(r.last, lang)}</td>
                      <td className="hide-sm muted wrap-cell"><bdi>{r.hostname || "-"}</bdi></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pager
              base={base}
              params={keep}
              page={page}
              pages={Math.max(1, Math.ceil(total / limit))}
              total={total}
              rows={{ value: limit, options: ROW_OPTIONS }}
              locale={localeOf(lang)}
              labels={a.pager}
            />
          </>
        ) : (
          <Empty>{q ? t.noResults : t.noData}</Empty>
        )}
      </Section>
    </>
  );
}
