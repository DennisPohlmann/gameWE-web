import { notFound } from "next/navigation";
import { saveSettingsAction } from "../../../actions";
import { Icon } from "@/components/admin/icons";
import { PageHead } from "@/components/admin/page-head";
import { SecretControl } from "@/components/admin/secret-control";
import { HeaderLinksEditor, type EditorRow, type HeaderLinksText } from "@/components/header-links-editor";
import { headerOrder } from "@/lib/header-links";
import { dicts } from "@/translations";
import { rawOptions } from "@/lib/admin-data";
import { adminDict } from "@/lib/admin-i18n";
import { RAW_GROUP, rawOptionHelp, READONLY_OPTIONS, allSettings, settingGroups, type Setting } from "@/lib/admin-settings";
import { requireAdmin } from "@/lib/auth";
import { ENV_FALLBACK, envFormValues, valueSource } from "@/lib/config";
import { noAutofill } from "@/lib/autofill";
import { pageSizeStep } from "@/lib/page-size";
import { adminQuery } from "@/lib/db";
import { fill, getAdminLang } from "@/lib/i18n";
import { replacedTemplate } from "@/lib/skin-fallback";
import { listTemplates } from "@/lib/templates";
import { voiceType } from "@/lib/voice";

type Lang = "de" | "en";

// One page of the settings: the settings of one group (lib/admin-settings.ts)
// or the raw hlstats_Options rows, in one form with its own save bar.
export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAdmin();
  const { group: groupId } = await params;
  const group = settingGroups.find((g) => g.id === groupId);
  const isRaw = groupId === RAW_GROUP;
  if (!group && !isRaw) notFound();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const u = a.ui;
  const sp = await searchParams;
  const items = group?.items ?? [];
  const [rows, templates, raw] = await Promise.all([
    // All settings: some pages show values of others (header links: SourceBans).
    adminQuery<{ keyname: string; value: string }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [allSettings.map((s) => s.key)]),
    items.some((s) => s.type === "template") ? listTemplates() : Promise.resolve([]),
    isRaw ? rawOptions() : Promise.resolve([]),
  ]);
  const values: Record<string, string> = Object.fromEntries(rows.map((r) => [r.keyname, r.value]));
  // Settings that older installations set in the environment (lib/config.ts):
  // where the value comes from, and the environment's value while none is stored.
  const envValues = envFormValues();
  const source = (key: string) => (key in ENV_FALLBACK ? valueSource(key as keyof typeof ENV_FALLBACK, values[key]) : "db");
  // Older installations have no voice type yet: preselect what is set up.
  if (items.some((s) => s.key === "gamewe_voice_type")) values.gamewe_voice_type = voiceType(values);
  // An old free page size (e.g. 30 or 500) shows as the step the site uses.
  if (values.gamewe_page_size) values.gamewe_page_size = String(pageSizeStep(values.gamewe_page_size) ?? values.gamewe_page_size);
  // Fields that depend on a choice are hidden by CSS while the choice
  // differs, so switching needs no script.
  const conditional = [...new Set(items.flatMap((s) => (s.show ? [`${s.show.key}=${s.show.value}`] : [])))];
  const css = conditional
    .map((c) => {
      const [k, v] = c.split("=");
      return `form:not(:has(select[name="${k}"] option[value="${v}"]:checked)) [data-show="${c}"]{display:none}`;
    })
    .join("\n");
  const bad = allSettings.find((s) => s.key === sp.field);
  const badRaw = sp.field?.startsWith("raw:") ? sp.field.slice(4) : sp.field === "raw_new" ? a.rawNewKey : null;
  const t = dicts[lang];
  const areaTitle = { website: u.navWebsite, services: u.navServices, collector: u.navCollector, advanced: u.navAdvanced };
  const title = group ? group.title[lang] : u.rawOptions;

  return (
    <>
      <PageHead
        crumbs={[[u.areaSettings, "/admin/settings"], [areaTitle[group?.area ?? "advanced"]], [title]]}
        title={title}
        intro={group ? group.help?.[lang] : a.rawHelp}
      />
      {sp.saved ? <p className="notice">{a.saved}</p> : null}
      {bad ? <p className="notice error">{fill(a.invalidField, { f: bad.label[lang] })}</p> : null}
      {badRaw ? <p className="notice error">{fill(a.invalidField, { f: badRaw })}</p> : null}
      {css ? <style>{css}</style> : null}
      <form action={saveSettingsAction}>
        <input type="hidden" name="group" value={groupId} />
        <section className="card">
          {group?.id === "header" ? (
            <>
              <p className="settings-help">{a.hlHelp}</p>
              <div className="hl-editor-wrap">
                <HeaderLinksEditor
                  initial={headerRows(values, t, a.hlSourcebans)}
                  homeName={t.contents}
                  badField={bad?.key}
                  text={Object.fromEntries(Object.entries(a).filter(([k]) => k.startsWith("hl"))) as HeaderLinksText}
                />
              </div>
            </>
          ) : null}
          <div className="fields">
            {items.map((s) =>
              s.type === "order" || s.type === "home" || s.type === "link" ? null : (
                <SettingField
                  key={s.key}
                  s={s}
                  value={values[s.key] || (source(s.key) === "env" ? envValues[s.key] : undefined)}
                  fromEnv={source(s.key) === "env" ? ENV_FALLBACK[s.key as keyof typeof ENV_FALLBACK] : undefined}
                  readOnly={s.minLevel !== undefined && user.acclevel < s.minLevel}
                  lang={lang}
                  templates={templates}
                  stored={values[s.key] !== undefined && values[s.key] !== ""}
                  bad={bad?.key === s.key}
                />
              ),
            )}
            {isRaw ? <RawFields raw={raw} lang={lang} /> : null}
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

function SettingField({
  s,
  value,
  lang,
  templates,
  stored,
  bad,
  fromEnv,
  readOnly,
}: {
  s: Setting;
  value: string | undefined;
  fromEnv?: string;
  readOnly: boolean;
  lang: Lang;
  templates: { id: string; name: { de: string; en: string } }[];
  stored: boolean;
  bad: boolean;
}) {
  const a = adminDict(lang);
  const v = value ?? s.def;
  const id = `f-${s.key}`;
  let control;
  if (s.type === "bool") {
    // The hidden 0 is sent when the switch is off (lib: saveSettingsAction).
    control = (
      <label className="switch">
        <input type="hidden" name={s.key} value="0" />
        <input {...noAutofill} id={id} type="checkbox" name={s.key} value="1" defaultChecked={v === "1"} />
        <i aria-hidden="true" />
        <span className="on-t">{a.ui.on}</span>
        <span className="off-t">{a.ui.off}</span>
      </label>
    );
  } else if (s.type === "choice") {
    control = (
      <select {...noAutofill} id={id} name={s.key} defaultValue={v}>
        {s.choices?.map(([c, l]) => (
          <option key={c} value={c}>
            {l[lang]}
          </option>
        ))}
      </select>
    );
  } else if (s.type === "template") {
    // A removed built-in template shows (and saves) its replacement.
    const pick = replacedTemplate(v, templates.map((t) => t.id));
    control = (
      <select {...noAutofill} id={id} name={s.key} defaultValue={pick}>
        {templates.some((t) => t.id === pick) ? null : <option value={pick}>{pick} (?)</option>}
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name[lang]}
          </option>
        ))}
      </select>
    );
  } else if (s.type === "secret") {
    // Only "set" or "not set", never the value (also not one from the environment).
    control = <SecretControl id={id} name={s.key} maxLength={255} set={Boolean(stored)} fromEnv={Boolean(fromEnv)} disabled={readOnly} invalid={bad} lang={lang} />;
  } else {
    control = (
      <input
        {...noAutofill}
        id={id}
        name={s.key}
        defaultValue={v}
        type={s.type === "number" ? "number" : "text"}
        min={s.min}
        max={s.max}
        maxLength={255}
        aria-invalid={bad || undefined}
      />
    );
  }
  return (
    <div className="field" data-show={s.show ? `${s.show.key}=${s.show.value}` : undefined}>
      <div className="l">
        <b>
          <label htmlFor={id}>{s.label[lang]}</label>
        </b>
        {s.help ? <span>{s.help[lang]}</span> : null}
        {fromEnv && s.type !== "secret" ? <span className="env-note">{fill(a.fromEnv, { v: fromEnv })}</span> : null}
        {readOnly ? <span className="env-note">{fill(a.levelOnly, { n: String(s.minLevel) })}</span> : null}
        <code>{s.key}</code>
      </div>
      <div className="c">{control}</div>
    </div>
  );
}

// The rows of hlstats_Options without a field of their own.
function RawFields({ raw, lang }: { raw: { keyname: string; value: string }[]; lang: Lang }) {
  const a = adminDict(lang);
  return (
    <>
      {raw.length ? null : <p className="settings-help">{a.rawNone}</p>}
      {raw.map((r, i) => {
        const help = rawOptionHelp(r.keyname, lang) ?? a.rawUnknown;
        return (
          <div className="field" key={r.keyname}>
            <div className="l">
              <b>
                <code>{r.keyname}</code>
              </b>
              <span>{READONLY_OPTIONS.includes(r.keyname) ? `${a.rawReadonly} ${help}` : help}</span>
            </div>
            <div className="c">
              {READONLY_OPTIONS.includes(r.keyname) ? (
                <input {...noAutofill} value={r.value} readOnly aria-readonly="true" aria-label={r.keyname} />
              ) : (
                <>
                  <input type="hidden" name={`raw_key_${i}`} value={r.keyname} />
                  <input {...noAutofill} name={`raw_val_${i}`} defaultValue={r.value} maxLength={255} aria-label={r.keyname} />
                  <label className="check">
                    <input type="checkbox" name={`raw_del_${i}`} value="1" /> {a.rawDelete}
                  </label>
                </>
              )}
            </div>
          </div>
        );
      })}
      <div className="field">
        <div className="l">
          <b>{a.rawNewKey}</b>
          <span>{a.rawNewHelp}</span>
        </div>
        <div className="c">
          <span className="link-fields">
            <input {...noAutofill} name="raw_new_key" placeholder={a.rawNewKey} aria-label={a.rawNewKey} maxLength={128} pattern="[A-Za-z0-9_.\-]{1,128}" />
            <input {...noAutofill} name="raw_new_val" placeholder={a.rawNewValue} aria-label={a.rawNewValue} maxLength={255} />
          </span>
        </div>
      </div>
    </>
  );
}

// Header tabs in the stored order (older installations: the default).
function headerRows(values: Record<string, string>, t: (typeof dicts)[keyof typeof dicts], sourcebans: string): EditorRow[] {
  return headerOrder(values.gamewe_header_order).map((id) => {
    if (id === "home") {
      const [label = "", url = ""] = (values.gamewe_header_home ?? "").split("|");
      return { id, kind: "home", label, url, hidden: false };
    }
    if (id === "search" || id === "help" || id === "licenses" || id === "privacy") {
      return { id, kind: "builtin", label: id === "search" ? t.searchTitle : id === "privacy" ? t.privacy.title : t[id], url: "", hidden: false };
    }
    if (id === "sourcebans") return { id, kind: "sourcebans", label: sourcebans, url: "", hidden: !values.gamewe_sourcebans_url?.trim() };
    const v = values[`gamewe_link_${id.slice(4)}`] ?? "";
    return { id, kind: "custom", label: v.split("|")[0] ?? "", url: v.split("|").slice(1).join("|"), hidden: !v.trim() };
  });
}
