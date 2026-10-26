import Link from "next/link";
import { rankingVacAction } from "../../../actions";
import { adminDict } from "@/lib/admin-i18n";
import type { Lang } from "@/lib/i18n";

const T = {
  de: {
    title: "VAC-Sperre",
    intro: "Der Collector übernimmt die Änderung innerhalb einer Minute.",
    block: "VAC-gebannte Spieler blockieren",
    blockHelp:
      "An: Bei jedem Connect fragt der Collector die Steam Web API, ob der Spieler einen VAC-Ban hat, auch aus einem anderen Spiel. Solche Spieler werden mit „VAC ban on record“ gekickt, bekommen trotzdem ein Profil, sammeln keine Punkte und stehen nur in der Bannliste (gelbes VAC). Die Server brauchen ein RCON-Passwort. Ohne Steam-Schlüssel oder wenn Steam nicht antwortet, wird niemand blockiert. Aus (Standard): nichts wird geprüft; laufende VAC-Sperren dieses Rankings enden und die Spieler sind wieder im Ranking.",
    save: "Speichern",
    saved: "Gespeichert.",
    cli: "Auf der Konsole: gamewe game set {g} -block-vac=true|false",
  },
  en: {
    title: "VAC block",
    intro: "The collector picks up a change within a minute.",
    block: "Block VAC-banned players",
    blockHelp:
      "On: at every connect the collector asks the Steam Web API whether the player has a VAC ban on record, also from another game. Such players are kicked with \"VAC ban on record\", still get a profile, collect no points and are listed only on the bans page (yellow VAC). The servers need an RCON password. Without a Steam key or when Steam does not answer, nobody is blocked. Off (default): nothing is checked; running VAC blocks of this ranking end and the players are back in the ranking.",
    save: "Save",
    saved: "Saved.",
    cli: "From the console: gamewe game set {g} -block-vac=true|false",
  },
};

// The VAC block of one ranking (admins only). keyStored: a Steam Web API key
// is stored in the database, the only one the collector reads.
export function VacCard({ game, lang, on, keyStored, status }: { game: string; lang: Lang; on: boolean; keyStored: boolean; status?: string }) {
  const t = T[lang === "de" ? "de" : "en"];
  const a = adminDict(lang);
  const u = a.ui;
  return (
    <section className="card" id="vac">
      <header>
        <h2>{t.title}</h2>
      </header>
      {status === "saved" ? <p className="notice">{t.saved}</p> : null}
      <form action={rankingVacAction} className="form box bots-form">
        <input type="hidden" name="game" value={game} />
        <p>{t.intro}</p>
        <div className="field">
          <div className="l">
            <b>
              <label htmlFor="vac-block">{t.block}</label>
            </b>
            <span>{t.blockHelp}</span>
            {!keyStored ? (
              <span className="warn-text">
                {a.vacNoKey} <Link href="/admin/settings/steam">{a.vacNoKeyLink} →</Link>
              </span>
            ) : null}
          </div>
          <div className="c">
            <label className="switch">
              <input type="hidden" name="block" value="0" />
              <input id="vac-block" type="checkbox" name="block" value="1" defaultChecked={on} />
              <i aria-hidden="true" />
              <span className="on-t">{u.on}</span>
              <span className="off-t">{u.off}</span>
            </label>
          </div>
        </div>
        <button type="submit" className="button primary">
          {t.save}
        </button>
        <small>{t.cli.replace("{g}", game)}</small>
      </form>
    </section>
  );
}
