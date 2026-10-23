import { saveSettingsAction } from "../../actions";
import { Section } from "@/components/ui";
import { optionList } from "@/lib/admin-data";
import { adminDict } from "@/lib/admin-i18n";
import { allSettings, settingGroups } from "@/lib/admin-settings";
import { requireAdmin } from "@/lib/auth";
import { adminQuery } from "@/lib/db";
import { fill, getAdminLang } from "@/lib/i18n";
import { listTemplates } from "@/lib/templates";
import { voiceType } from "@/lib/voice";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const sp = await searchParams;
  const [rows, games, templates] = await Promise.all([
    adminQuery<{ keyname: string; value: string }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [
      allSettings.map((s) => s.key),
    ]),
    optionList("games"),
    listTemplates(),
  ]);
  const values: Record<string, string> = Object.fromEntries(rows.map((r) => [r.keyname, r.value]));
  // Older installations have no voice type yet: preselect what is set up.
  values.gamewe_voice_type = voiceType(values);
  // Fields that depend on a choice are hidden by CSS while the choice
  // differs, so switching needs no script.
  const conditional = [...new Set(allSettings.flatMap((s) => (s.show ? [`${s.show.key}=${s.show.value}`] : [])))];
  const css = conditional
    .map((c) => {
      const [k, v] = c.split("=");
      return `form:not(:has(select[name="${k}"] option[value="${v}"]:checked)) [data-show="${c}"]{display:none}`;
    })
    .join("\n");
  const bad = allSettings.find((s) => s.key === sp.field);

  return (
    <>
      <h1>{a.settings}</h1>
      {sp.saved ? <p className="notice">{a.saved}</p> : null}
      {bad ? <p className="notice error">{fill(a.invalidField, { f: bad.label[lang] })}</p> : null}
      {css ? <style>{css}</style> : null}
      <form action={saveSettingsAction}>
        {settingGroups.map((g) => (
          <Section key={g.title.en} title={g.title[lang]}>
            <div className="form settings-grid">
              {g.help ? <p className="settings-help">{g.help[lang]}</p> : null}
              {g.items.map((s) => {
                const v = values[s.key] ?? s.def;
                return (
                  <label key={s.key} data-show={s.show ? `${s.show.key}=${s.show.value}` : undefined}>
                    {s.label[lang]}
                    {s.type === "bool" ? (
                      <select name={s.key} defaultValue={v === "1" ? "1" : "0"}>
                        <option value="0">{lang === "de" ? "Nein" : "No"}</option>
                        <option value="1">{lang === "de" ? "Ja" : "Yes"}</option>
                      </select>
                    ) : s.type === "link" ? (
                      <span className="link-fields">
                        <input name={`${s.key}__label`} defaultValue={v.split("|")[0] ?? ""} placeholder={lang === "de" ? "Name" : "Name"} aria-label={`${s.label[lang]}: Name`} maxLength={60} />
                        <input
                          name={`${s.key}__url`}
                          defaultValue={v.split("|").slice(1).join("|")}
                          placeholder="https://example.org"
                          aria-label={`${s.label[lang]}: URL`}
                          maxLength={190}
                          inputMode="url"
                        />
                      </span>
                    ) : s.type === "choice" ? (
                      <select name={s.key} defaultValue={v}>
                        {s.choices?.map(([c, l]) => (
                          <option key={c} value={c}>
                            {l[lang]}
                          </option>
                        ))}
                      </select>
                    ) : s.type === "template" ? (
                      <select name={s.key} defaultValue={v}>
                        {templates.some((t) => t.id === v) ? null : <option value={v}>{v} (?)</option>}
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name[lang]}
                          </option>
                        ))}
                      </select>
                    ) : s.type === "secret" ? (
                      <span className="link-fields">
                        <input
                          name={s.key}
                          type="password"
                          autoComplete="new-password"
                          placeholder={values[s.key] ? a.secretSet : a.secretEmpty}
                          maxLength={255}
                        />
                        {values[s.key] ? (
                          <span className="inline">
                            <input type="checkbox" name={`${s.key}__clear`} value="1" aria-label={a.secretClear} /> {a.secretClear}
                          </span>
                        ) : null}
                      </span>
                    ) : s.type === "game" ? (
                      <select name={s.key} defaultValue={v}>
                        <option value="">-</option>
                        {games.map(([code, name]) => (
                          <option key={code} value={code}>
                            {name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={s.key}
                        defaultValue={v}
                        type={s.type === "number" ? "number" : "text"}
                        min={s.min}
                        max={s.max}
                        maxLength={255}
                      />
                    )}
                    <small className="muted">
                      <code>{s.key}</code>
                      {s.help ? ` · ${s.help[lang]}` : ""}
                    </small>
                  </label>
                );
              })}
            </div>
          </Section>
        ))}
        <p className="settings-save">
          <button type="submit" className="button">
            {a.save}
          </button>
        </p>
      </form>
    </>
  );
}
