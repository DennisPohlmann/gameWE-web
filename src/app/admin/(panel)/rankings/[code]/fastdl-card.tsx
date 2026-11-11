import Link from "next/link";
import { rankingFastdlAction } from "../../../actions";
import { SecretControl } from "@/components/admin/secret-control";
import { rankingFastdl, rankingFastdlAccess } from "@/lib/admin-ranking-bots";
import { adminQuery } from "@/lib/db";
import { accessKey } from "@/lib/fastdl-access";
import { noAutofill } from "@/lib/autofill";
import type { Lang } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { localized } from "@/lib/admin-i18n";
import { FASTDL_T } from "@/lib/admin-texts";

type Field = "agent" | "referer" | "token" | "user" | "password" | "header";

// The FastDL address of one ranking and what its downloads send, overriding
// the global settings (admins only). Secrets show only through their eye button.
export async function FastdlCard({ game, lang, status }: { game: string; lang: Lang; status?: string }) {
  const t = localized(FASTDL_T, lang);
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
  const secret = (f: "token" | "password" | "header") => row(f, <SecretControl id={`fastdl-${f}`} name={f} maxLength={255} set={access[f]} invalid={badField === f} reveal={`fastdl:${game}:${f}`} lang={lang} />);
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
                {t.off} <Link prefetch={false} href="/admin/settings/maps">{t.link} →</Link>
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
