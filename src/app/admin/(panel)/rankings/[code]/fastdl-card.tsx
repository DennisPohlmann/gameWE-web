import Link from "next/link";
import { rankingFastdlAction } from "../../../actions";
import { SecretControl } from "@/components/admin/secret-control";
import { rankingFastdl, rankingFastdlAccess } from "@/lib/admin-ranking-bots";
import { adminQuery } from "@/lib/db";
import { accessKey } from "@/lib/fastdl-access";
import { noAutofill } from "@/lib/autofill";
import type { Lang } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

const T = {
  de: {
    title: "FastDL",
    label: "Eigene FastDL-Adresse",
    help: "Der Ordner über maps/ (sv_downloadurl), nur für dieses Ranking. Leer: Es gilt die globale Adresse. Nur öffentliche Adressen (FASTDL_ALLOW_PRIVATE=1 erlaubt private), keine Weiterleitungen, höchstens 512 MB Download und 1 GB entpackt.",
    accessHelp: "Was der Download zusätzlich sendet, nur für dieses Ranking. Ein leeres Feld nimmt den Wert aus Einstellungen → Karten & Ereignisse, der für alle Rankings gilt. Setzt dieses Ranking Token oder Benutzer, gilt nur seine Anmeldung; der Token gewinnt über den Benutzer. Über http:// gehen Token und Passwort unverschlüsselt durchs Netz.",
    agent: "User-Agent",
    referer: "Referer",
    token: "Bearer-Token",
    user: "Benutzer (Basic-Auth)",
    password: "Passwort (Basic-Auth)",
    header: "Weiterer Header („Name: Wert“)",
    off: "Radarbilder per FastDL sind ausgeschaltet; die Adresse wirkt erst mit dem Schalter.",
    link: "Zu den Einstellungen",
    save: "Speichern",
    saved: "Gespeichert.",
    bad: "Keine gültige Adresse: nur http(s), ohne Benutzer und Passwort.",
    badField: "Bitte prüfe das Feld „{f}“: keine Steuerzeichen, Benutzer ohne Doppelpunkt, Header als „Name: Wert“ (nicht Host, Authorization, User-Agent, Referer).",
  },
  en: {
    title: "FastDL",
    label: "Own FastDL address",
    help: "The folder above maps/ (sv_downloadurl), for this ranking only. Empty: the global address applies. Public addresses only (FASTDL_ALLOW_PRIVATE=1 allows private ones), no redirects, at most 512 MB download and 1 GB unpacked.",
    accessHelp: "What the download sends besides, for this ranking only. An empty field takes the value from Settings → Maps & events, which applies to all rankings. When this ranking sets a token or a user, only its own authentication applies; the token wins over the user. Over http:// token and password cross the network unencrypted.",
    agent: "User-Agent",
    referer: "Referer",
    token: "Bearer token",
    user: "User (basic auth)",
    password: "Password (basic auth)",
    header: "One more header (\"Name: value\")",
    off: "Radar pictures by FastDL are switched off; the address works only with the switch on.",
    link: "To the settings",
    save: "Save",
    saved: "Saved.",
    bad: "Not a valid address: http(s) only, no user or password.",
    badField: "Please check the field \"{f}\": no control characters, a user without a colon, the header as \"Name: value\" (not Host, Authorization, User-Agent, Referer).",
  },
};

type Field = "agent" | "referer" | "token" | "user" | "password" | "header";

// The FastDL address of one ranking and what its downloads send, overriding
// the global settings (admins only). Secrets are never shown again.
export async function FastdlCard({ game, lang, status }: { game: string; lang: Lang; status?: string }) {
  const t = T[lang === "de" ? "de" : "en"];
  const [url, access, { fastdlOn, fastdlUrl }, globals] = await Promise.all([
    rankingFastdl(game),
    rankingFastdlAccess(game),
    getSettings(),
    adminQuery<{ keyname: string; value: string }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [[accessKey("agent"), accessKey("referer"), accessKey("user")]]),
  ]);
  // The global value as the placeholder: what an empty field takes.
  const inherited = (f: "agent" | "referer" | "user") => globals.find((r) => r.keyname === accessKey(f))?.value ?? "";
  const badField = status?.startsWith("bad-") ? (status.slice(4) as Field) : null;
  const row = (f: Field, control: React.ReactNode) => (
    <div className="field" key={f}>
      <div className="l">
        <b>
          <label htmlFor={`fastdl-${f}`}>{t[f]}</label>
        </b>
      </div>
      <div className="c">{control}</div>
    </div>
  );
  const plain = (f: "agent" | "referer" | "user") =>
    row(f, <input {...noAutofill} id={`fastdl-${f}`} name={f} type="text" maxLength={255} defaultValue={access[f]} placeholder={inherited(f)} aria-invalid={badField === f || undefined} spellCheck={false} />);
  const secret = (f: "token" | "password" | "header") => row(f, <SecretControl id={`fastdl-${f}`} name={f} maxLength={255} set={access[f]} invalid={badField === f} lang={lang} />);
  return (
    <section className="card" id="fastdl">
      <header>
        <h2>{t.title}</h2>
      </header>
      {status === "saved" ? <p className="notice">{t.saved}</p> : null}
      {status === "bad" ? <p className="notice error">{t.bad}</p> : null}
      {badField ? <p className="notice error">{t.badField.replace("{f}", t[badField] ?? badField)}</p> : null}
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
        <p className="muted">{t.accessHelp}</p>
        {plain("agent")}
        {plain("referer")}
        {secret("token")}
        {plain("user")}
        {secret("password")}
        {secret("header")}
        <button type="submit" className="button primary">
          {t.save}
        </button>
      </form>
    </section>
  );
}
