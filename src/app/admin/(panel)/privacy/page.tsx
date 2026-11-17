import { headers } from "next/headers";
import type { ReactNode } from "react";
import { savePrivacyAction } from "../../actions";
import { Icon } from "@/components/admin/icons";
import { PageHead } from "@/components/admin/page-head";
import { adminDict, localized, tr } from "@/lib/admin-i18n";
import { settingGroups } from "@/lib/admin-settings";
import { allowed } from "@/lib/admin-perms";
import { PERM_T } from "@/lib/admin-texts";
import { requirePerm } from "@/lib/auth";
import { noAutofill } from "@/lib/autofill";
import { basePath } from "@/lib/base-path";
import { adminQuery } from "@/lib/db";
import { fill, getAdminLang } from "@/lib/i18n";
import { imageHosts } from "@/lib/privacy-inventory";
import { ALL_OPERATOR_KEYS, LIMITS, OPERATOR_KEYS, TEXT_MAX, readOperator, type Operator } from "@/lib/privacy-operator";
import { getSettings } from "@/lib/settings";

// Everything about privacy on one page: the operator's part of the public
// privacy page (lib/privacy-operator.ts) and what the collector stores
// (settings group "privacy", all switches), saved together.
export default async function PrivacyAdminPage({ searchParams }: { searchParams: Promise<{ saved?: string; field?: string }> }) {
  const user = await requirePerm("settings.view");
  const canEdit = allowed(user, "settings.edit");
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const u = a.ui;
  const sp = await searchParams;
  const stores = settingGroups.find((g) => g.id === "privacy")!.items;
  const [rows, s, host] = await Promise.all([
    adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [[...ALL_OPERATOR_KEYS, ...stores.map((x) => x.key)]]),
    getSettings(),
    headers().then((h) => h.get("host") ?? ""),
  ]);
  const stored = Object.fromEntries(rows.map((r) => [r.keyname, r.value ?? ""]));
  const o = readOperator(stored);
  const external = imageHosts([s.logoUrl, s.headerLogo, s.favicon, s.appleIcon].filter(Boolean), host);
  const labels: Record<keyof Operator, string> = { name: a.privacyName, address: a.privacyAddress, email: a.privacyEmail, text: a.privacyText };
  const bad = sp.field && sp.field in labels ? (sp.field as keyof Operator) : null;
  const badStore = stores.find((x) => x.key === sp.field);
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
        crumbs={[[u.areaSettings, "/admin/settings"], [u.navWebsite], [u.privacy]]}
        title={u.privacy}
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
      {badStore ? <p className="notice error">{fill(a.invalidField, { f: tr(badStore.label, lang) })}</p> : null}
      {external.length ? <p className="notice info">{fill(a.privacyExternal, { hosts: external.join(", ") })}</p> : null}
      {canEdit ? null : <p className="notice">{localized(PERM_T, lang).readOnly}</p>}
      <form action={savePrivacyAction}>
        <fieldset className="adm-ro" disabled={!canEdit}>
        <section className="card">
          <div className="fields">
            {field("name", a.privacyNameHint, <input {...noAutofill} id="p-name" name="name" dir="auto" defaultValue={o.name} maxLength={LIMITS.name} aria-invalid={bad === "name" || undefined} />)}
            {field(
              "address",
              a.privacyAddressHint,
              <textarea {...noAutofill} id="p-address" name="address" dir="auto" defaultValue={o.address} maxLength={LIMITS.address} rows={4} aria-invalid={bad === "address" || undefined} />,
            )}
            {field("email", null, <input {...noAutofill} id="p-email" name="email" type="email" defaultValue={o.email} maxLength={LIMITS.email} aria-invalid={bad === "email" || undefined} />)}
            {field(
              "text",
              fill(a.privacyTextHint, { n: String(TEXT_MAX) }),
              <textarea {...noAutofill} id="p-text" name="text" defaultValue={o.text} maxLength={TEXT_MAX} rows={10} aria-invalid={bad === "text" || undefined} />,
            )}
            <h3 className="fields-section">{tr(settingGroups.find((g) => g.id === "privacy")!.title, lang)}</h3>
            {stores.map((x) => (
              <div className="field" key={x.key}>
                <div className="l">
                  <b>
                    <label htmlFor={`f-${x.key}`}>{tr(x.label, lang)}</label>
                  </b>
                  {x.help ? <span>{tr(x.help, lang)}</span> : null}
                  <code>{x.key}</code>
                </div>
                <div className="c">
                  {/* The hidden 0 is sent when the switch is off (saveSettings). */}
                  <label className="switch">
                    <input type="hidden" name={x.key} value="0" />
                    <input {...noAutofill} id={`f-${x.key}`} type="checkbox" name={x.key} value="1" defaultChecked={(stored[x.key] || x.def) === "1"} />
                    <i aria-hidden="true" />
                    <span className="on-t">{u.on}</span>
                    <span className="off-t">{u.off}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>
        <div className="savebar">
          <span className="msg">
            <Icon name="info" />
            {u.saveHintBoth}
          </span>
          <span className="unsaved-note">{u.unsaved}</span>
          <span className="btns">
            <a className="button" href="">
              {u.discard}
            </a>
            <button type="submit" className="button primary">
              {a.save}
            </button>
          </span>
        </div>
        </fieldset>
      </form>
    </>
  );
}
