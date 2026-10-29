import type { Metadata } from "next";
import Link from "next/link";
import { Rich } from "@/components/rich";
import { Empty, Pager, PctBar, ROW_OPTIONS, Section, SortTh, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { getActions } from "@/lib/data";
import { fmtNum, localeOf } from "@/lib/format";
import { fill, getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { actionBonus, actionName, actionShares, actionSort, sortActions } from "@/lib/shares";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.actions };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

// gameME's actions list: action, skill bonus, how often it was achieved and
// its share of all actions. Sortable (?sort=name|bonus|count&dir=asc) and
// paged like the other long tables.
export default async function ActionsPage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: SP }) {
  const { game } = await params;
  const sp = await searchParams;
  const { lang, t } = await getDict();
  const [rows, { pageSize }] = await Promise.all([getActions(game), getSettings()]);
  const sort = actionSort(strParam(sp.sort));
  const flipped = strParam(sp.dir) === "asc";
  const limit = rowsParam(sp.rows, pageSize);
  const pages = Math.max(1, Math.ceil(rows.length / limit));
  const page = Math.min(pageParam(sp.page), pages);
  const offset = (page - 1) * limit;
  const { total, pct } = actionShares(rows);
  const shown = sortActions(rows, sort, flipped).slice(offset, offset + limit);
  const base = `/${game}/actions`;
  const keep = { sort: sort === "count" ? undefined : sort, dir: flipped ? "asc" : undefined, rows: limit !== pageSize ? limit : undefined };
  const sortProps = { current: sort, asc: flipped, base, params: { rows: keep.rows } };
  const th = (label: string, k: string, cls = "num") => <SortTh label={label} sortKey={k} className={cls} {...sortProps} />;
  return (
    <Section title={t.actions}>
      {rows.length ? (
        <>
          <p className="lead">
            <Rich text={fill(t.actionsTotal, { n: fmtNum(total, lang) })} />
          </p>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  {th(t.action, "name", "")}
                  {th(t.skillBonus, "bonus")}
                  {th(t.achieved, "count")}
                  <th className="barcell">{t.achievedPct}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a, i) => (
                  <tr key={a.id}>
                    <td className="rank">{offset + i + 1}</td>
                    <td>
                      <Link prefetch={false} className="player" href={`/${game}/actions/${a.id}`}>
                        {actionName(a)}
                      </Link>
                    </td>
                    <td className="num">{fmtNum(actionBonus(a), lang)}</td>
                    <td className="num">{fmtNum(Number(a.count), lang)}</td>
                    <td className="barcell">
                      <PctBar value={pct(a)} lang={lang} tone="share" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          {rows.length > ROW_OPTIONS[0] ? (
            <Pager base={base} params={keep} page={page} pages={pages} total={rows.length} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
          ) : null}
        </>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </Section>
  );
}
