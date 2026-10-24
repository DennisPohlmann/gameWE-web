import type { Metadata } from "next";
import Form from "next/form";
import { AutoForm } from "@/components/auto-form";
import { Bar, Section, TableWrap, strParam } from "@/components/ui";
import { Weapon } from "@/components/weapon";
import { getGames, getHelpActions, getHelpWeapons, getPointSettings } from "@/lib/data";
import { fmtNum } from "@/lib/format";
import { fill, getDict } from "@/lib/i18n";
import { weaponImages } from "@/lib/weapons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.help };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

// gameME's help page, with what the gameWE collector really does
// (collector 1.6): the points formula with the configured values, the
// action bonuses and weapon modifiers from the database, the chat commands.
export default async function HelpPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { lang, t } = await getDict();
  const games = await getGames();
  const rawGame = strParam(sp.game);
  // Actions and weapons per ranking: the first ranking unless one is chosen.
  const game = games.some((g) => g.code === rawGame) ? rawGame : (games[0]?.code ?? "");
  const [actions, weapons, pts] = await Promise.all([getHelpActions(game), getHelpWeapons(game), getPointSettings()]);
  const imagesOf = (code: string) => weaponImages(games.find((g) => g.code === code)?.realgame);
  const yn = (v: string) => (v === "1" ? t.yes : t.no);
  const signed = (n: number) => (n > 0 ? `+${fmtNum(n, lang)}` : fmtNum(n, lang));
  const questions = [
    ["points", t.helpQPoints],
    ["weapons", t.helpQWeapons],
    ["commands", t.helpQCommands],
    ["hide", t.helpQHide],
  ] as const;
  const kp = pts.gamewe_kill_points;
  const commands: [string, string][] = [
    ["!rank, !statsme, !session, !status", t.helpCmdRank],
    ["!next", t.helpCmdNext],
    ["!top10, !top", t.helpCmdTop],
    ["!hideranking [on|off]", t.helpCmdHide],
    ["!settings, !gamewe_settings", t.helpCmdSettings],
    ["!help", t.helpCmdHelp],
  ];

  // Ranking choice for the actions and weapons tables (loads at once).
  const gameTabs = (anchor: string) =>
    games.length > 1 ? (
      <AutoForm action={`/help#${anchor}`} className="search help-games">
        <select name="game" defaultValue={game} aria-label={t.ranking}>
          {games.map((g) => (
            <option key={g.code} value={g.code}>
              {g.name}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit">{t.show}</button>
        </noscript>
      </AutoForm>
    ) : null;

  const maxMod = Math.max(1, ...weapons.map((w) => Number(w.modifier)));
  const tiles: [string, string, "good" | "bad" | ""][] = [
    [t.helpStartPoints, fmtNum(pts.gamewe_start_skill, lang), ""],
    [t.helpKillBase, `+${fmtNum(kp, lang)}`, "good"],
    [t.helpKillMax, `+${fmtNum(kp * 4, lang)}`, "good"],
    [t.headshotsLabel, `+${fmtNum(pts.gamewe_headshot_bonus, lang)}`, pts.gamewe_headshot_bonus ? "good" : ""],
    [t.teamkills, `−${fmtNum(pts.gamewe_teamkill_penalty, lang)}`, "bad"],
    [t.suicides, `−${fmtNum(pts.gamewe_suicide_penalty, lang)}`, "bad"],
  ];
  const types = (a: (typeof actions)[number]) =>
    (
      [
        [a.for_PlayerActions, t.helpColPlayer],
        [a.for_PlayerPlayerActions, t.helpColPvp],
        [a.for_TeamActions, t.helpColTeam],
        [a.for_WorldActions, t.helpColWorld],
      ] as const
    ).filter(([v]) => v === "1");
  const reward = (n: number) => <span className={n > 0 ? "good" : n < 0 ? "bad" : "muted"}>{signed(n)}</span>;

  return (
    <>
      <Section
        title={t.help}
        aside={
          <Form action="/help" className="search">
            <select name="game" defaultValue={game} aria-label={t.ranking}>
              {games.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name}
                </option>
              ))}
            </select>
            <button type="submit">{t.show}</button>
          </Form>
        }
      >
        <nav className="help-toc" aria-label={t.helpQuestions}>
          {questions.map(([id, q], i) => (
            <a key={id} href={`#${id}`} className="help-card">
              <span className="help-num">{i + 1}</span>
              <span>{q}</span>
            </a>
          ))}
        </nav>
      </Section>

      <Section title={`1. ${t.helpQPoints}`}>
        <div className="help" id="points">
          <p>{fill(t.helpPointsIntro, { start: fmtNum(pts.gamewe_start_skill, lang) })}</p>
          <div className="help-tiles">
            {tiles.map(([k, v, c]) => (
              <div key={k} className="help-tile">
                <span>{k}</span>
                <b className={c || undefined}>{v}</b>
              </div>
            ))}
          </div>
          <div className="help-formula">
            <div className="help-formula-main">{fill(t.helpFormula, { k: kp, max: kp * 4 })}</div>
            <div className="help-formula-sides">
              <span className="good">{t.helpFormulaKiller}</span>
              <span className="bad">{t.helpFormulaVictim}</span>
            </div>
          </div>
          <p>{t.helpPointsDeath}</p>
          <ul className="help-rules">
            <li>{fill(pts.gamewe_headshot_bonus ? t.helpHeadshotBonus : t.helpHeadshot, { n: pts.gamewe_headshot_bonus })}</li>
            <li>{fill(t.helpTeamkill, { n: pts.gamewe_teamkill_penalty })}</li>
            <li>{fill(t.helpSuicide, { n: pts.gamewe_suicide_penalty })}</li>
            <li>{t.helpPvp}</li>
            <li>{t.helpStreak}</li>
            <li>{t.helpWin}</li>
            <li>{t.helpFloor}</li>
            {pts.gamewe_rank_bots ? null : <li>{t.helpBots}</li>}
          </ul>
          <h3>{t.helpActionsIntro}</h3>
          {gameTabs("actions")}
          {actions.length ? (
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>{t.helpColAction}</th>
                    <th className="hide-sm">{t.helpColType}</th>
                    <th className="num">{t.helpColPlayerReward}</th>
                    <th className="num">{t.helpColTeamReward}</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={`${a.game}-${a.code}`}>
                      <td>{a.description || a.code}</td>
                      <td className="hide-sm">
                        {types(a).map(([, label]) => (
                          <span key={label} className="help-type">
                            {label}
                          </span>
                        ))}
                      </td>
                      <td className="num">{reward(Number(a.reward_player))}</td>
                      <td className="num">
                        {Number(a.reward_team) ? (
                          <>
                            {a.teamName || a.team ? <span className="muted">{a.teamName || a.team} </span> : null}
                            {reward(Number(a.reward_team))}
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <p className="muted">{t.noData}</p>
          )}
        </div>
      </Section>

      <Section title={`2. ${t.helpQWeapons}`}>
        <div className="help" id="weapons">
          <p>{t.helpWeaponsText}</p>
          {gameTabs("weapons")}
          {weapons.length ? (
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>{t.name}</th>
                    <th className="hide-sm">{t.weapon}</th>
                    <th className="barcell">{t.modifier}</th>
                  </tr>
                </thead>
                <tbody>
                  {weapons.map((w) => (
                    <tr key={`${w.game}-${w.code}`}>
                      <td>
                        <Weapon set={imagesOf(w.game)} code={w.code} name={w.name} />
                      </td>
                      <td className="hide-sm">
                        <code>{w.code}</code>
                      </td>
                      <td className="barcell">
                        <Bar value={Number(w.modifier) / maxMod} label={fmtNum(Number(w.modifier), lang, 2)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <p className="muted">{t.noData}</p>
          )}
        </div>
      </Section>

      <Section title={`3. ${t.helpQCommands}`}>
        <div className="help" id="commands">
          <p>{t.helpCommandsIntro}</p>
          <div className="help-cmds">
            {commands.map(([c, d]) => (
              <div key={c} className="help-cmd">
                <div>
                  {c.split(", ").map((x) => (
                    <code key={x}>{x}</code>
                  ))}
                </div>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title={`4. ${t.helpQHide}`}>
        <div className="help" id="hide">
          <p className="help-note">{t.helpHideText}</p>
        </div>
      </Section>

    </>
  );
}
