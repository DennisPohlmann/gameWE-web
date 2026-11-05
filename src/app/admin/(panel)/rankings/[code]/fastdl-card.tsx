import Link from "next/link";
import { rankingFastdlAction } from "../../../actions";
import { rankingFastdl } from "@/lib/admin-ranking-bots";
import type { Lang } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

const T = {
  de: {
    title: "FastDL",
    label: "Eigene FastDL-Adresse",
    help: "Der Ordner über maps/ (sv_downloadurl), nur für dieses Ranking. Leer: Es gilt die globale Adresse. Nur öffentliche Adressen (FASTDL_ALLOW_PRIVATE=1 erlaubt private), keine Weiterleitungen, höchstens 512 MB Download und 1 GB entpackt.",
    off: "Radarbilder per FastDL sind ausgeschaltet; die Adresse wirkt erst mit dem Schalter.",
    link: "Zu den Einstellungen",
    save: "Speichern",
    saved: "Gespeichert.",
    bad: "Keine gültige Adresse: nur http(s), ohne Benutzer und Passwort.",
  },
  en: {
    title: "FastDL",
    label: "Own FastDL address",
    help: "The folder above maps/ (sv_downloadurl), for this ranking only. Empty: the global address applies. Public addresses only (FASTDL_ALLOW_PRIVATE=1 allows private ones), no redirects, at most 512 MB download and 1 GB unpacked.",
    off: "Radar pictures by FastDL are switched off; the address works only with the switch on.",
    link: "To the settings",
    save: "Save",
    saved: "Saved.",
    bad: "Not a valid address: http(s) only, no user or password.",
  },
};

// The FastDL address of one ranking, overriding the global one (admins only).
export async function FastdlCard({ game, lang, status }: { game: string; lang: Lang; status?: string }) {
  const t = T[lang === "de" ? "de" : "en"];
  const [url, { fastdlOn, fastdlUrl }] = await Promise.all([rankingFastdl(game), getSettings()]);
  return (
    <section className="card" id="fastdl">
      <header>
        <h2>{t.title}</h2>
      </header>
      {status === "saved" ? <p className="notice">{t.saved}</p> : null}
      {status === "bad" ? <p className="notice error">{t.bad}</p> : null}
      <form action={rankingFastdlAction} className="form box bots-form">
        <input type="hidden" name="game" value={game} />
        <div className="field">
          <div className="l">
            <b>
              <label htmlFor="fastdl-url">{t.label}</label>
            </b>
            <span>{t.help}</span>
            {!fastdlOn ? (
              <span className="warn-text">
                {t.off} <Link href="/admin/settings/maps">{t.link} →</Link>
              </span>
            ) : null}
          </div>
          <div className="c">
            <input id="fastdl-url" name="url" type="text" maxLength={255} defaultValue={url} placeholder={fastdlUrl} aria-invalid={status === "bad" || undefined} autoComplete="off" spellCheck={false} />
          </div>
        </div>
        <button type="submit" className="button primary">
          {t.save}
        </button>
      </form>
    </section>
  );
}
