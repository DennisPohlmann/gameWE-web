import { saveAction } from "../../../actions";
import { FieldControl } from "@/components/admin/field-control";
import { getRow, optionList, withColumns } from "@/lib/admin-data";
import { getEntity } from "@/lib/admin-entities";
import { adminDict } from "@/lib/admin-i18n";
import { fill } from "@/lib/i18n";

// Name, game, visibility and order of one ranking (level 100, as the games
// entity): the fields of /admin/games/<id>, saved by the same action, which
// returns here.
export async function SettingsCard({ id, lang, sp }: { id: number; lang: "de" | "en"; sp: Record<string, string | undefined> }) {
  const e = await withColumns(getEntity("games")!);
  const row = await getRow(e, String(id));
  if (!row) return null;
  const a = adminDict(lang);
  const u = a.ui;
  const fields = e.fields.filter((f) => !f.virtual);
  const games = fields.some((f) => f.options === "games") ? await optionList("games") : [];
  const bad = fields.find((f) => f.name === sp.field);
  const error =
    sp.error === "field"
      ? fill(a.invalidField, { f: bad?.label[lang] ?? sp.field ?? "" })
      : sp.error === "db"
        ? fill(a.dbWriteError, { msg: sp.msg ?? "" })
        : sp.error === "mismatch"
          ? a.gameMismatch
          : null;
  return (
    <section className="card" id="settings">
      <header>
        <h2>{u.settings}</h2>
      </header>
      <p className="muted">{u.settingsIntro}</p>
      {!e.fields.some((f) => f.name === "realgame") ? <p className="notice error">{a.realgameMissing}</p> : null}
      {sp.saved === "settings" || sp.saved === "1" ? <p className="notice">{u.settingsSaved}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
      <form action={saveAction} className="form box bots-form">
        <input type="hidden" name="__entity" value={e.key} />
        <input type="hidden" name="__id" value={String(id)} />
        {fields.map((f) => {
          const opts = Array.isArray(f.options)
            ? f.options.map(([v, l]): [string, string] => [v, typeof l === "string" ? l : l[lang]])
            : f.options === "games"
              ? games
              : null;
          return (
            <div className="field" key={f.name}>
              <div className="l">
                <b>
                  <label htmlFor={`rk-${f.name}`}>{f.label[lang]}</label>
                </b>
                {f.help ? <span>{f.help[lang]}</span> : null}
              </div>
              <div className="c">
                <FieldControl
                  id={`rk-${f.name}`}
                  f={f}
                  value={(row as Record<string, string | number | null>)[f.name]}
                  opts={opts}
                  locked={Boolean(f.readonly || f.createOnly)}
                  isNew={false}
                />
              </div>
            </div>
          );
        })}
        <button type="submit" className="button primary">
          {a.save}
        </button>
      </form>
    </section>
  );
}
