import Link from "next/link";
import { rankingVacAction } from "../../../actions";
import { adminDict, localized } from "@/lib/admin-i18n";
import { VAC_T } from "@/lib/admin-texts";
import type { Lang } from "@/lib/i18n";

// The VAC block of one ranking (admins only). keyStored: a Steam Web API key
// is stored in the database, the only one the collector reads.
export function VacCard({ game, lang, on, keyStored, status }: { game: string; lang: Lang; on: boolean; keyStored: boolean; status?: string }) {
  const t = localized(VAC_T, lang);
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
