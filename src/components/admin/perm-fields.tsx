"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// The rights boxes of an admin's page and of an admin role. A full admin
// (level 100) has every right: then every box shows checked and locked, so
// the page says at a glance what the admin may do. A restricted admin gets
// the rights of a role (boxes locked, they follow the role) or rights of
// their own (boxes to tick, presets to start from). The choice the page
// does not show stays in hidden fields, so switching back loses nothing.
// The level comes from the form's acclevel select; without one (a role's
// page) only the boxes.
export type PermFieldsText = {
  full: string;
  presets: string;
  presetsHint: string;
  access?: string;
  modeRole?: string;
  modeRoleHint?: string;
  modeOwn?: string;
  rolePick?: string;
  noRoles?: string;
  rolesManage?: string;
};

export function PermFields({
  groups,
  presets,
  initial,
  text,
  roles,
  initialRole = null,
}: {
  groups: { id: string; legend: string; perms: { id: string; label: string }[] }[];
  presets: { id: string; name: string; perms: string[] }[];
  initial: string[];
  text: PermFieldsText;
  roles?: { id: string; name: string; perms: string[] }[]; // set: an admin's page
  initialRole?: string | null;
}) {
  const [checked, setChecked] = useState(() => new Set(initial));
  const [full, setFull] = useState(false);
  const [mode, setMode] = useState<"role" | "own">(initialRole && roles?.some((r) => r.id === initialRole) ? "role" : "own");
  const [role, setRole] = useState(initialRole ?? roles?.[0]?.id ?? "");
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
  const chosen = roles?.find((r) => r.id === role);
  const byRole = !full && mode === "role" && !!chosen;
  // What the boxes show: everything (full), the role's rights, or the own ones.
  const shown = (p: string) => full || (byRole ? chosen.perms.includes(p) : checked.has(p));
  const locked = full || byRole;
  return (
    <>
      {roles ? <input type="hidden" name="__role" value={mode === "role" && chosen ? chosen.id : ""} /> : null}
      {full ? <p className="perm-full notice">{text.full}</p> : null}
      {roles && !full ? (
        <fieldset className="choice-cards perm-mode">
          <legend>{text.access}</legend>
          <label className="check">
            <input type="radio" checked={mode === "role"} onChange={() => setMode("role")} disabled={!roles.length} />
            <span>
              <b>{text.modeRole}</b>
              {roles.length ? (
                <>
                  <select aria-label={text.rolePick} value={role} onChange={(e) => (setRole(e.target.value), setMode("role"))}>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <small>{text.modeRoleHint}</small>
                </>
              ) : (
                <small>{text.noRoles}</small>
              )}
              <Link prefetch={false} href="/admin/admin-roles" className="perm-roles-link">
                {text.rolesManage} →
              </Link>
            </span>
          </label>
          <label className="check">
            <input type="radio" checked={mode === "own"} onChange={() => setMode("own")} />
            <span>
              <b>{text.modeOwn}</b>
            </span>
          </label>
        </fieldset>
      ) : null}
      {locked ? null : (
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
      <div className={locked ? "perm-groups locked" : "perm-groups"}>
        {groups.map((g) => (
          <fieldset key={g.id}>
            <legend>{g.legend}</legend>
            {g.perms.map((p) => (
              <label key={p.id} className="check">
                {locked ? (
                  <>
                    <input type="checkbox" checked={shown(p.id)} disabled readOnly />
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
