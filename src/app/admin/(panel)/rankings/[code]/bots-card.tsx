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
      "An: Ein Bot zählt bei den Punkten wie ein Spieler. Wer einen Bot abschießt, bekommt die normalen Kill-Punkte samt Headshot-Bonus und Killserie, und wer von einem Bot getötet wird, verliert Punkte. Aus: Kills an und durch Bots bringen und kosten keine Punkte, also auch keinen Headshot-Bonus und keine Killserie. Ob sie bei den Kills mitzählen, regelt der Schalter darunter.",
    kills: "Bot-Kills zählen als Kills",
    killsHelp:
      "An: Ein abgeschossener Bot zählt bei den Kills des Spielers mit, also für Kill-Rangliste, K/D und den Karriere-Rang. Aus: Der Kill wird gespeichert (Ereignisse, Waffen, Maps), zählt aber nicht zu den Kills und Headshots des Spielers. Wer von einem Bot getötet wird, bekommt den Tod in beiden Fällen angerechnet. Ob es Punkte gibt, regelt der Schalter darüber.",
    save: "Speichern",
    saved: "Gespeichert.",
    savedBots: "Gespeichert. {n} vorhandene Bots wurden angepasst.",
    cli: "Auf der Konsole: gamewe game set {g} -rank-bots=true|false -bot-points=true|false -bot-kills=true|false",
  },
  en: {
    title: "Bots",
    intro: "Bots are always recorded and shown with their stats on the server pages. Here you decide how they count in this ranking. The collector picks up a change within a minute.",
    ranked: "Bots in the ranking",
    rankedHelp:
      "On: bots are ranked like players, can be number 1 and win awards. Off: they stay out of rankings and awards, their names are not linked. Switching also applies at once to the existing bots of this ranking.",
    points: "Points for bot kills",
    pointsHelp:
      "On: a bot counts like a player for points. Killing a bot gives the normal kill points including the headshot bonus and kill streaks, and being killed by a bot costs points. Off: kills of and by bots give and cost no points, so no headshot bonus and no kill streak either. Whether they count as kills is the switch below.",
    kills: "Bot kills count as kills",
    killsHelp:
      "On: a bot shot down counts in the player's kills, so for the kill ranking, K/D and the career rank. Off: the kill is stored (events, weapons, maps) but not added to the player's kills and headshots. Being killed by a bot always counts as a death. Whether it gives points is the switch above.",
    save: "Save",
    saved: "Saved.",
    savedBots: "Saved. {n} existing bots were updated.",
    cli: "From the console: gamewe game set {g} -rank-bots=true|false -bot-points=true|false -bot-kills=true|false",
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
        <button type="submit" className="button primary">
          {t.save}
        </button>
        <small>{t.cli.replace("{g}", game)}</small>
      </form>
    </section>
  );
}
