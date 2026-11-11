import { rankingBotsAction } from "../../../actions";
import { rankingBots } from "@/lib/admin-ranking-bots";
import { adminDict, localized } from "@/lib/admin-i18n";
import { BOTS_T } from "@/lib/admin-texts";
import type { Lang } from "@/lib/i18n";

// The bot settings of one ranking (admins only).
export async function BotsCard({ game, lang, status, changed }: { game: string; lang: Lang; status?: string; changed?: string }) {
  const t = localized(BOTS_T, lang);
  const u = adminDict(lang).ui;
  const s = await rankingBots(game);
  const n = Number(changed) || 0;
  const sw = (name: string, on: boolean, label: string, help: string) => (
    <div className="field">
      <div className="l">
        <b>
          <label htmlFor={`bots-${name}`}>{label}</label>
        </b>
        <span>{help}</span>
      </div>
      <div className="c">
        <label className="switch">
          <input type="hidden" name={name} value="0" />
          <input id={`bots-${name}`} type="checkbox" name={name} value="1" defaultChecked={on} />
          <i aria-hidden="true" />
          <span className="on-t">{u.on}</span>
          <span className="off-t">{u.off}</span>
        </label>
      </div>
    </div>
  );
  return (
    <section className="card" id="bots">
      <header>
        <h2>{t.title}</h2>
      </header>
      {status === "saved" ? <p className="notice">{n ? t.savedBots.replace("{n}", String(n)) : t.saved}</p> : null}
      <form action={rankingBotsAction} className="form box bots-form">
        <input type="hidden" name="game" value={game} />
        <p>{t.intro}</p>
        {sw("ranked", s.ranked, t.ranked, t.rankedHelp)}
        {sw("points", s.points, t.points, t.pointsHelp)}
        {sw("kills", s.kills, t.kills, t.killsHelp)}
        {sw("stats", s.stats, t.stats, t.statsHelp)}
        <button type="submit" className="button primary">
          {t.save}
        </button>
        <small>{t.cli.replace("{g}", game)}</small>
      </form>
    </section>
  );
}
