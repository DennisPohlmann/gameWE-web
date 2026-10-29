import { rankingBotsAction } from "../../../actions";
import { rankingBots } from "@/lib/admin-ranking-bots";
import { adminDict } from "@/lib/admin-i18n";
import type { Lang } from "@/lib/i18n";

const T = {
  de: {
    title: "Bots",
    intro: "Bots werden immer erfasst und mit ihren Stats auf den Serverseiten gezeigt. Hier legst du fest, wie sie in diesem Ranking zählen. Der Collector übernimmt die Änderung innerhalb einer Minute.",
    ranked: "Bots im Ranking",
    rankedHelp:
      "An: Bots werden wie Spieler gerankt, können Platz 1 sein und Awards gewinnen. Aus: Sie fehlen in Ranglisten und Awards, ihre Namen sind nicht verlinkt. Das Umschalten gilt sofort auch für die vorhandenen Bots dieses Rankings.",
    points: "Punkte für Bot-Kills",
    pointsHelp:
      "An: Ein Bot zählt bei den Punkten wie ein Spieler. Wer einen Bot abschießt, bekommt die normalen Kill-Punkte samt Headshot-Bonus und Killserie, und wer von einem Bot getötet wird, verliert Punkte. Aus: Kills an und durch Bots bringen und kosten keine Punkte, also auch keinen Headshot-Bonus und keine Killserie. Ob sie in der Statistik mitzählen, regeln die Schalter darunter.",
    kills: "Bot-Kills für den Karriere-Rang",
    killsHelp:
      "An: Ein abgeschossener Bot zählt für den Karriere-Rang (Private, General …) mit. Aus: Für den Rang zählen nur Kills an Spielern.",
    stats: "Bots in der Statistik",
    statsHelp:
      "An: Alles gegen Bots zählt in der Statistik wie gegen Spieler: Kills, Tode, Headshots, K/D, Serien, Tagesverlauf sowie die Karten- und Gegner-Tabellen. Aus: Die Kills werden gespeichert und erscheinen in den Ereignissen, ändern aber die Statistik der Spieler nicht. Left 4 Dead zählt Kills an der KI immer. Das gilt für neue Kills; bisherige Zahlen bleiben, wie sie sind.",
    save: "Speichern",
    saved: "Gespeichert.",
    savedBots: "Gespeichert. {n} vorhandene Bots wurden angepasst.",
    cli: "Auf der Konsole: gamewe game set {g} -rank-bots=true|false -bot-points=true|false -bot-kills=true|false -bot-stats=true|false",
  },
  en: {
    title: "Bots",
    intro: "Bots are always recorded and shown with their stats on the server pages. Here you decide how they count in this ranking. The collector picks up a change within a minute.",
    ranked: "Bots in the ranking",
    rankedHelp:
      "On: bots are ranked like players, can be number 1 and win awards. Off: they stay out of rankings and awards, their names are not linked. Switching also applies at once to the existing bots of this ranking.",
    points: "Points for bot kills",
    pointsHelp:
      "On: a bot counts like a player for points. Killing a bot gives the normal kill points including the headshot bonus and kill streaks, and being killed by a bot costs points. Off: kills of and by bots give and cost no points, so no headshot bonus and no kill streak either. Whether they count in the stats is up to the switches below.",
    kills: "Bot kills for the career rank",
    killsHelp:
      "On: a bot shot down counts for the career rank (Private, General …). Off: only kills of players count for the rank.",
    stats: "Bots in the stats",
    statsHelp:
      "On: everything against bots counts in the stats as against players: kills, deaths, headshots, K/D, streaks, the daily history and the map and opponent tables. Off: the kills are stored and shown in the events but do not change the players' stats. Left 4 Dead always counts kills of the AI. This applies to new kills; the numbers so far stay as they are.",
    save: "Save",
    saved: "Saved.",
    savedBots: "Saved. {n} existing bots were updated.",
    cli: "From the console: gamewe game set {g} -rank-bots=true|false -bot-points=true|false -bot-kills=true|false -bot-stats=true|false",
  },
};

// The bot settings of one ranking (admins only).
export async function BotsCard({ game, lang, status, changed }: { game: string; lang: Lang; status?: string; changed?: string }) {
  const t = T[lang === "de" ? "de" : "en"];
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
