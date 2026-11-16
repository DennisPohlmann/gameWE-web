"use client";

import { useEffect, useState } from "react";

// The rights boxes of an admin's page. A full admin (level 100) has every
// right: then every box shows checked and locked, so the page says at a
// glance what the admin may do; the admin's own choice stays in hidden
// fields and comes back when the level goes down again. The level comes from
// the form's acclevel select. Presets (lib/admin-perms.ts ROLE_PRESETS) check
// the boxes of a preset; saved only with the form.
export type PermFieldsText = { full: string; presets: string; presetsHint: string };

export function PermFields({
  groups,
  presets,
  initial,
  text,
}: {
  groups: { id: string; legend: string; perms: { id: string; label: string }[] }[];
  presets: { id: string; name: string; perms: string[] }[];
  initial: string[];
  text: PermFieldsText;
}) {
  const [checked, setChecked] = useState(() => new Set(initial));
  const [full, setFull] = useState(false);
  useEffect(() => {
    const level = document.querySelector<HTMLSelectElement>('select[name="acclevel"]');
    if (!level) return;
    const sync = () => setFull(Number(level.value) >= 100);
    sync();
    level.addEventListener("change", sync);
    return () => level.removeEventListener("change", sync);
  }, []);
  const toggle = (p: string, on: boolean) =>
    setChecked((s) => {
      const n = new Set(s);
      if (on) n.add(p);
      else n.delete(p);
      return n;
    });
  return (
    <>
      {full ? (
        <p className="perm-full notice">{text.full}</p>
      ) : (
        <div className="perm-presets">
          <span>{text.presets}</span>
          {presets.map((p) => (
            <button key={p.id} type="button" className="button small" onClick={() => setChecked(new Set(p.perms))}>
              {p.name}
            </button>
          ))}
          <small className="muted">{text.presetsHint}</small>
        </div>
      )}
      <div className={full ? "perm-groups locked" : "perm-groups"}>
        {groups.map((g) => (
          <fieldset key={g.id}>
            <legend>{g.legend}</legend>
            {g.perms.map((p) => (
              <label key={p.id} className="check">
                {full ? (
                  <>
                    <input type="checkbox" checked disabled readOnly />
                    {checked.has(p.id) ? <input type="hidden" name="perm" value={p.id} /> : null}
                  </>
                ) : (
                  <input type="checkbox" name="perm" value={p.id} checked={checked.has(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />
                )}{" "}
                {p.label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </>
  );
}
