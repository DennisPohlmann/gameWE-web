import type { Metadata } from "next";
import { Bar, Empty, Section, TableWrap } from "@/components/ui";
import { getRoles, getTeams, type TeamRow } from "@/lib/data";
import { fmtDuration, fmtNum, fmtPct, kpd, ratio } from "@/lib/format";
import { getDict, type Dict, type Lang } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.teams };
}

export default async function TeamsPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const { lang, t } = await getDict();
  const [teams, roles] = await Promise.all([getTeams(game), getRoles(game)]);
  return (
    <>
      <Section title={t.team}>
        {teams.length ? <TeamTable rows={teams} t={t} lang={lang} /> : <Empty>{t.noData}</Empty>}
      </Section>
      {roles.length ? (
        <Section title={t.role}>
          <TeamTable rows={roles} t={t} lang={lang} />
        </Section>
      ) : null}
    </>
  );
}

function TeamTable({ rows, t, lang }: { rows: TeamRow[]; t: Dict; lang: Lang }) {
  const joined = rows.reduce((s, r) => s + r.joined, 0);
  const time = rows.reduce((s, r) => s + r.time_played, 0);
  const hasCounters = rows.some((r) => r.time_played > 0 || r.kills > 0);
  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            <th>{t.name}</th>
            {joined ? (
              <>
                <th className="num">{t.joined}</th>
                <th className="barcell">{t.share}</th>
              </>
            ) : null}
            {hasCounters ? (
              <>
                <th className="num">{t.time}</th>
                {!joined ? <th className="barcell">{t.share}</th> : null}
                <th className="num">{t.kills}</th>
                <th className="num">{t.deaths}</th>
                <th className="num">{t.kpd}</th>
                <th className="num">{t.wins}</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              {joined ? (
                <>
                  <td className="num">{fmtNum(r.joined, lang)}</td>
                  <td className="barcell">
                    <Bar value={ratio(r.joined, joined)} label={fmtPct(ratio(r.joined, joined), lang)} />
                  </td>
                </>
              ) : null}
              {hasCounters ? (
                <>
                  <td className="num">{fmtDuration(r.time_played)}</td>
                  {!joined ? (
                    <td className="barcell">
                      <Bar value={ratio(r.time_played, time)} label={fmtPct(ratio(r.time_played, time), lang)} />
                    </td>
                  ) : null}
                  <td className="num">{fmtNum(r.kills, lang)}</td>
                  <td className="num">{fmtNum(r.deaths, lang)}</td>
                  <td className="num">{fmtNum(kpd(r.kills, r.deaths), lang, 2)}</td>
                  <td className="num">{fmtNum(r.wins, lang)}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
