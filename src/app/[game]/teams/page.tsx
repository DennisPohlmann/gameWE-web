import type { Metadata } from "next";
import { Rich } from "@/components/rich";
import { Empty, PctBar, Section, SortTh, TableWrap, strParam } from "@/components/ui";
import { getRoles, getTeams, type TeamRow } from "@/lib/data";
import { fmtDuration, fmtNum } from "@/lib/format";
import { fill, getDict, type Dict, type Lang } from "@/lib/i18n";
import { rowShares, shareTotals, sortTeams, teamSort } from "@/lib/shares";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.teams };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

// gameME's teams/roles page: time, kills and deaths of each team and role
// with their share of the table's total. Each table sorts with its own
// params (tsort/tdir, rsort/rdir), so sorting one keeps the other.
export default async function TeamsPage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: SP }) {
  const { game } = await params;
  const sp = await searchParams;
  const { lang, t } = await getDict();
  // Rows without any time, kill or death (e.g. a team code seen once) say nothing.
  const used = (r: TeamRow) => Number(r.time_played) > 0 || Number(r.kills) > 0 || Number(r.deaths) > 0;
  const [teams, roles] = (await Promise.all([getTeams(game), getRoles(game)])).map((rows) => rows.filter(used));
  // Only known sort keys go back into the links; the default (time, desc) is left out.
  const sortOf = (v: string) => (teamSort(v) === "time" ? undefined : teamSort(v));
  const dirOf = (v: string) => (v === "asc" ? "asc" : undefined);
  const state = {
    tsort: sortOf(strParam(sp.tsort)),
    tdir: dirOf(strParam(sp.tdir)),
    rsort: sortOf(strParam(sp.rsort)),
    rdir: dirOf(strParam(sp.rdir)),
  };
  const table = (rows: TeamRow[], label: string, p: "t" | "r") => (
    <TeamTable rows={rows} label={label} t={t} lang={lang} base={`/${game}/teams`} state={state} sortParam={`${p}sort`} dirParam={`${p}dir`} />
  );
  return (
    <>
      <Section title={t.teamsTitle}>{teams.length ? table(teams, t.team, "t") : <Empty>{t.noData}</Empty>}</Section>
      {roles.length ? <Section title={t.rolesTitle}>{table(roles, t.role, "r")}</Section> : null}
    </>
  );
}

function TeamTable({
  rows,
  label,
  t,
  lang,
  base,
  state,
  sortParam,
  dirParam,
}: {
  rows: TeamRow[];
  label: string;
  t: Dict;
  lang: Lang;
  base: string;
  state: Record<string, string | undefined>;
  sortParam: string;
  dirParam: string;
}) {
  const sort = teamSort(state[sortParam] ?? "");
  const flipped = state[dirParam] === "asc";
  const total = shareTotals(rows);
  const sorted = sortTeams(rows, sort, flipped);
  // The other table's params stay in the links.
  const sortProps = { current: sort, asc: flipped, base, params: state, sortParam, dirParam };
  const th = (text: string, k: string, cls = "num") => <SortTh label={text} sortKey={k} className={cls} {...sortProps} />;
  return (
    <>
      <p className="lead">
        <Rich text={fill(t.killsTotal, { kills: fmtNum(total.kills, lang) })} />
      </p>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              {th(label, "name", "")}
              {th(t.time, "time")}
              <th className="barcell">{t.timePct}</th>
              {th(t.kills, "kills")}
              <th className="barcell">{t.killsPct}</th>
              {th(t.deaths, "deaths")}
              <th className="barcell">{t.deathsPct}</th>
              {th(t.kpdShort, "kpd")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const s = rowShares(r, total);
              return (
                <tr key={r.id}>
                  <td className="rank">{i + 1}</td>
                  <td>{r.name}</td>
                  <td className="num">{fmtDuration(Number(r.time_played))}</td>
                  <td className="barcell">
                    <PctBar value={s.timePct} lang={lang} tone="share" />
                  </td>
                  <td className="num">{s.fought ? fmtNum(Number(r.kills), lang) : "-"}</td>
                  <td className="barcell">
                    <PctBar value={s.killsPct} lang={lang} tone="share" />
                  </td>
                  <td className="num">{s.fought ? fmtNum(Number(r.deaths), lang) : "-"}</td>
                  <td className="barcell">
                    <PctBar value={s.deathsPct} lang={lang} tone="share" />
                  </td>
                  <td className="num">{fmtNum(s.kpd, lang, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}
