import { headers } from "next/headers";
import type { ReactNode } from "react";
import { savePrivacyAction } from "../../actions";
import { Icon } from "@/components/admin/icons";
import { PageHead } from "@/components/admin/page-head";
import { adminDict } from "@/lib/admin-i18n";
import { requireAdmin } from "@/lib/auth";
import { noAutofill } from "@/lib/autofill";
import { basePath } from "@/lib/base-path";
import { adminQuery } from "@/lib/db";
import { fill, getAdminLang } from "@/lib/i18n";
import { imageHosts } from "@/lib/privacy-inventory";
import { ALL_OPERATOR_KEYS, LIMITS, OPERATOR_KEYS, TEXT_MAX, readOperator, type Operator } from "@/lib/privacy-operator";
import { getSettings } from "@/lib/settings";

// The operator's part of the public privacy page (lib/privacy-operator.ts).
export default async function PrivacyAdminPage({ searchParams }: { searchParams: Promise<{ saved?: string; field?: string }> }) {
  await requireAdmin();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const u = a.ui;
  const sp = await searchParams;
  const [rows, s, host] = await Promise.all([
    adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [ALL_OPERATOR_KEYS]),
    getSettings(),
    headers().then((h) => h.get("host") ?? ""),
  ]);
  const o = readOperator(Object.fromEntries(rows.map((r) => [r.keyname, r.value ?? ""])));
  const external = imageHosts([s.logoUrl, s.headerLogo, s.favicon, s.appleIcon].filter(Boolean), host);
  const labels: Record<keyof Operator, string> = { name: a.privacyName, address: a.privacyAddress, email: a.privacyEmail, text: a.privacyText };
  const bad = sp.field && sp.field in labels ? (sp.field as keyof Operator) : null;
  const field = (k: keyof Operator, help: string | null, control: ReactNode) => (
    <div className="field">
      <div className="l">
        <b>
          <label htmlFor={`p-${k}`}>{labels[k]}</label>
        </b>
        {help ? <span>{help}</span> : null}
        <code>{k === "text" ? "gamewe_privacy_text_*" : OPERATOR_KEYS[k]}</code>
      </div>
      <div className="c">{control}</div>
    </div>
  );
  return (
    <>
      <PageHead
        crumbs={[[u.areaSettings, "/admin/settings"], [u.navWebsite], [a.privacyTitle]]}
        title={a.privacyTitle}
        intro={a.privacyIntro}
        actions={
          <a className="button" href={`${basePath}/privacy`} target="_blank" rel="noopener">
            <Icon name="external" />
            {a.privacyView}
          </a>
        }
      />
      <p className="notice warn" role="note">
        <Icon name="warn" /> {a.privacyDisclaimer}
      </p>
      {sp.saved ? <p className="notice">{a.saved}</p> : null}
      {bad ? <p className="notice error">{fill(a.invalidField, { f: labels[bad] })}</p> : null}
      {external.length ? <p className="notice info">{fill(a.privacyExternal, { hosts: external.join(", ") })}</p> : null}
      <form action={savePrivacyAction}>
        <section className="card">
          <div className="fields">
            {field("name", a.privacyNameHint, <input {...noAutofill} id="p-name" name="name" defaultValue={o.name} maxLength={LIMITS.name} aria-invalid={bad === "name" || undefined} />)}
            {field(
              "address",
              a.privacyAddressHint,
              <textarea {...noAutofill} id="p-address" name="address" defaultValue={o.address} maxLength={LIMITS.address} rows={4} aria-invalid={bad === "address" || undefined} />,
            )}
            {field("email", null, <input {...noAutofill} id="p-email" name="email" type="email" defaultValue={o.email} maxLength={LIMITS.email} aria-invalid={bad === "email" || undefined} />)}
            {field(
              "text",
              fill(a.privacyTextHint, { n: String(TEXT_MAX) }),
              <textarea {...noAutofill} id="p-text" name="text" defaultValue={o.text} maxLength={TEXT_MAX} rows={10} aria-invalid={bad === "text" || undefined} />,
            )}
          </div>
        </section>
        <div className="savebar">
          <span className="msg">
            <Icon name="info" />
            {u.saveHint}
          </span>
          <span className="btns">
            <a className="button" href="">
              {u.discard}
            </a>
            <button type="submit" className="button primary">
              {a.save}
            </button>
          </span>
        </div>
      </form>
    </>
  );
}
