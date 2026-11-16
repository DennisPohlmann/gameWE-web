import { notFound } from "next/navigation";
import { saveSettingsAction, smtpTestAction } from "../../../actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { notifyState, type OwnState } from "@/lib/admin-notify";
import { NotifyStatusLine } from "@/components/admin/notify-status";
import { Section } from "@/components/ui";
import { NOTIFY_T } from "@/lib/admin-texts";
import { Icon } from "@/components/admin/icons";
import { PageHead } from "@/components/admin/page-head";
import { SecretControl } from "@/components/admin/secret-control";
import { HeaderLinksEditor, type EditorRow, type HeaderLinksText } from "@/components/header-links-editor";
import { headerOrder } from "@/lib/header-links";
import { dicts } from "@/translations";
import { rawOptions } from "@/lib/admin-data";
import { adminDict, localized, tr } from "@/lib/admin-i18n";
import { RAW_GROUP, adminOnlyOption, rawOptionHelp, READONLY_OPTIONS, allSettings, settingGroups, settingsReader, type Setting } from "@/lib/admin-settings";
import { requirePerm } from "@/lib/auth";
import { allowed } from "@/lib/admin-perms";
import { PERM_T } from "@/lib/admin-texts";
import { ENV_FALLBACK, envFormValues, valueSource } from "@/lib/config";
import { noAutofill } from "@/lib/autofill";
import { pageSizeStep } from "@/lib/page-size";
import { adminQuery } from "@/lib/db";
import { fill, getAdminLang } from "@/lib/i18n";
import { secretOptions } from "@/lib/secret-options";
import { replacedTemplate } from "@/lib/skin-fallback";
import { listTemplates } from "@/lib/templates";
import { voiceType } from "@/lib/voice";
import type { Lang } from "@/lib/i18n";


// One page of the settings: the settings of one group (lib/admin-settings.ts)
// or the raw hlstats_Options rows, in one form with its own save bar.
export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePerm("settings.view");
  // Without settings.edit the page is only shown; protected settings need settings.protected.
  const canEdit = allowed(user, "settings.edit");
  const canProtected = allowed(user, "settings.protected");
  const { group: groupId } = await params;
  const group = settingGroups.find((g) => g.id === groupId);
  const isRaw = groupId === RAW_GROUP;
  if (!group && !isRaw) notFound();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const u = a.ui;
  const sp = await searchParams;
  const items = group?.items ?? [];
  const [rows, templates, raw, notify] = await Promise.all([
    // All settings: some pages show values of others (header links: SourceBans).
    adminQuery<{ keyname: string; value: string }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [allSettings.map((s) => s.key)]),
    items.some((s) => s.type === "template") ? listTemplates() : Promise.resolve([]),
    isRaw ? rawOptions() : Promise.resolve([]),
    groupId === "notifications" ? notifyState(user.username) : Promise.resolve(null),
  ]);
  const values: Record<string, string> = { ...Object.fromEntries(rows.map((r) => [r.keyname, r.value])), ...(await secretOptions()) };
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
      // a choice (select) or a switch (bool: its checkbox with value 1)
      return `form:not(:has(select[name="${k}"] option[value="${v}"]:checked, input[type="checkbox"][name="${k}"][value="${v}"]:checked)) [data-show="${c}"]{display:none}`;
    })
    .join("\n");
  const bad = allSettings.find((s) => s.key === sp.field);
  const badRaw = sp.field?.startsWith("raw:") ? sp.field.slice(4) : sp.field === "raw_new" ? a.rawNewKey : null;
  const t = dicts[lang];
  const areaTitle = { website: u.navWebsite, services: u.navServices, collector: u.navCollector, admin: u.navAccess, advanced: u.navAccess };
  const title = group ? tr(group.title, lang) : u.rawOptions;

  return (
    <>
      <PageHead
        crumbs={[[u.areaSettings, "/admin/settings"], [areaTitle[group?.area ?? "advanced"]], [title]]}
        title={title}
        intro={group ? group.help && tr(group.help, lang) : a.rawHelp}
      />
      {sp.saved ? <p className="notice">{a.saved}</p> : null}
      {bad ? <p className="notice error">{fill(a.invalidField, { f: tr(bad.label, lang) })}</p> : null}
      {badRaw ? <p className="notice error">{fill(a.invalidField, { f: badRaw })}</p> : null}
      {css ? <style>{css}</style> : null}
      {canEdit ? null : <p className="notice">{localized(PERM_T, lang).readOnly}</p>}
      <form action={saveSettingsAction}>
        <input type="hidden" name="group" value={groupId} />
        <fieldset className="adm-ro" disabled={!canEdit}>
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
                  readOnly={!canEdit || (s.minLevel !== undefined && !canProtected)}
                  lang={lang}
                  templates={templates}
                  stored={values[s.key] !== undefined && values[s.key] !== ""}
                  bad={bad?.key === s.key}
                />
              ),
            )}
            {isRaw ? <RawFields raw={raw} lang={lang} protectedOk={canProtected} /> : null}
          </div>
        </section>
        <div className="savebar">
          <span className="msg">
            <Icon name="info" />
            {{ web: u.saveHint, collector: u.saveHintCollector, both: u.saveHintBoth }[settingsReader(group)]}
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
      {notify ? <SmtpTest own={notify.own.find((o) => o.channel === "email")!} jobs={notify.jobs} collector={notify.collector} lang={lang} queued={sp.notify === "test" ? sp.job : undefined} noJobs={sp.notify === "nojobs"} /> : null}
    </>
  );
}

// A test e-mail through the shared SMTP server to the admin's own address
// (My account → Notifications), with the outcome of its last message.
function SmtpTest({ own, jobs, collector, lang, queued, noJobs }: { own: OwnState; jobs: boolean; collector: boolean; lang: Lang; queued?: string; noJobs: boolean }) {
  const n = localized(NOTIFY_T, lang);
  const waiting = collector && own.test && (own.test.status === "pending" || own.test.status === "running");
  return (
    <Section title={n.smtpTitle} id="smtp-test" className="notify-test">
      <div className="form">
        <p className="muted">
          {n.smtpIntro}
          {own.ready && own.to ? (
            <>
              {" "}
              {n.smtpTo.split("{a}")[0]}
              <bdi dir="ltr">{own.to}</bdi>
              {n.smtpTo.split("{a}")[1]}
            </>
          ) : null}
        </p>
        {queued && /^\d+$/.test(queued) ? <p className="notice" role="status">{fill(n.testQueued, { id: queued })}</p> : null}
        {noJobs || !jobs ? <p className="notice error">{n.noJobs}</p> : null}
        {!own.ready ? <p className="notice">{n.smtpNotReady}</p> : !own.to ? <p className="notice">{n.smtpNoAddress}</p> : null}
        {own.ready && own.to ? <NotifyStatusLine status={own.status} test={own.test} lang={lang} /> : null}
        {waiting ? <AutoRefresh seconds={3} /> : null}
        <form action={smtpTestAction}>
          <button type="submit" className="button" disabled={!jobs || !own.ready || !own.to}>
            <Icon name="bell" />
            {n.smtpTest}
          </button>
        </form>
      </div>
    </Section>
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
        <input type="hidden" name={s.key} value="0" disabled={readOnly} />
        <input {...noAutofill} id={id} type="checkbox" name={s.key} value="1" defaultChecked={v === "1"} disabled={readOnly} />
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
            {tr(l, lang)}
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
            {tr(t.name, lang)}
          </option>
        ))}
      </select>
    );
  } else if (s.type === "secret") {
    // "set" or "not set"; the eye button loads a stored value on click, never one from the environment.
    control = <SecretControl id={id} name={s.key} maxLength={255} set={Boolean(stored)} fromEnv={Boolean(fromEnv)} disabled={readOnly} invalid={bad} reveal={`setting:${s.key}`} lang={lang} />;
  } else {
    control = (
      <input
        {...noAutofill}
        id={id}
        name={s.key}
        defaultValue={v}
        disabled={readOnly}
        type={s.type === "number" ? "number" : "text"}
        dir={s.type === "number" ? undefined : "auto"}
        min={s.min}
        max={s.max}
        maxLength={255}
        aria-invalid={bad || undefined}
      />
    );
  }
  return (
    <>
    {s.section ? <h3 className="fields-section">{tr(s.section, lang)}</h3> : null}
    <div className="field" data-show={s.show ? `${s.show.key}=${s.show.value}` : undefined}>
      <div className="l">
        <b>
          <label htmlFor={id}>{tr(s.label, lang)}</label>
        </b>
        {s.help ? <span>{tr(s.help, lang)}</span> : null}
        {fromEnv && s.type !== "secret" ? <span className="env-note">{fill(a.fromEnv, { v: fromEnv })}</span> : null}
        {readOnly ? <span className="env-note">{fill(a.levelOnly, { n: String(s.minLevel) })}</span> : null}
        <code>{s.key}</code>
      </div>
      <div className="c">{control}</div>
    </div>
    </>
  );
}

// The rows of hlstats_Options without a field of their own.
function RawFields({ raw, lang, protectedOk }: { raw: { keyname: string; value: string }[]; lang: Lang; protectedOk: boolean }) {
  const a = adminDict(lang);
  return (
    <>
      {raw.length ? null : <p className="settings-help">{a.rawNone}</p>}
      {raw.map((r, i) => {
        const help = rawOptionHelp(r.keyname, lang) ?? a.rawUnknown;
        const locked = READONLY_OPTIONS.includes(r.keyname) || (!protectedOk && adminOnlyOption(r.keyname));
        return (
          <div className="field" key={r.keyname}>
            <div className="l">
              <b>
                <code>{r.keyname}</code>
              </b>
              <span>{locked ? `${a.rawReadonly} ${help}` : help}</span>
            </div>
            <div className="c">
              {locked ? (
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
