import Form from "next/form";
import Link from "next/link";
import { Empty, Pager, ROW_OPTIONS, Section, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { optionList } from "@/lib/admin-data";
import { adminDict } from "@/lib/admin-i18n";
import { requireAdmin } from "@/lib/auth";
import { noAutofill } from "@/lib/autofill";
import { fmtDateTime, fmtNum, localeOf } from "@/lib/format";
import { countIps, searchIps } from "@/lib/history";
import { fill, getDict } from "@/lib/i18n";

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
  const [rows, total, games] = await Promise.all([
    searchIps({ ...filter, limit, offset: (page - 1) * limit }),
    countIps(filter),
    optionList("games"),
  ]);
  const base = "/admin/ips";
  const gameName = new Map(games);
  return (
    <>
      <h1>{a.ips}</h1>
      <p className="lead">{a.ipsHelp}</p>
      <Section
        title={a.ips}
        aside={
          <Form className="search" action={base}>
            <select {...noAutofill} name="game" defaultValue={game} aria-label={a.allGames}>
              <option value="">{a.allGames}</option>
              {games.map(([v, l]) => (
                <option key={v} value={v}>
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
            <input {...noAutofill} type="search" name="q" defaultValue={q} placeholder={t.search} aria-label={t.search} maxLength={100} />
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
                    <th>{t.ipAddress}</th>
                    <th>{t.player}</th>
                    <th className="hide-sm">{t.steamId}</th>
                    <th className="hide-sm">{t.ranking}</th>
                    <th className="num">{t.connections}</th>
                    <th className="hide-sm">{t.firstConnect}</th>
                    <th>{t.lastConnect}</th>
                    <th className="hide-sm">{t.ipHost}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.ip}-${r.playerId}`}>
                      <td className="nowrap">
                        {r.ip === "-" ? (
                          "-"
                        ) : (
                          <Link href={`${base}?q=${encodeURIComponent(r.ip)}`} title={a.ipsSame}>
                            {r.ip}
                          </Link>
                        )}
                      </td>
                      <td>
                        {r.game ? (
                          <Link href={`/${encodeURIComponent(r.game)}/players/${r.playerId}/ips`}>{r.name || `#${r.playerId}`}</Link>
                        ) : (
                          r.name || `#${r.playerId}`
                        )}
                      </td>
                      <td className="hide-sm nowrap">
                        {r.uniqueId ? <Link href={`${base}?q=${encodeURIComponent(r.uniqueId)}`}>{r.uniqueId}</Link> : "-"}
                      </td>
                      <td className="hide-sm">{gameName.get(r.game) ?? r.game}</td>
                      <td className="num">{fmtNum(r.connects, lang)}</td>
                      <td className="hide-sm muted nowrap">{fmtDateTime(r.first, lang)}</td>
                      <td className="muted nowrap">{fmtDateTime(r.last, lang)}</td>
                      <td className="hide-sm muted wrap-cell">{r.hostname || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pager
              base={base}
              params={{ game: game || undefined, q: q || undefined, days: days || undefined, rows: limit !== 100 ? limit : undefined }}
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
