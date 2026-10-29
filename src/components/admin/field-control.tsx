import type { Field } from "@/lib/admin-entities";
import { noAutofill } from "@/lib/autofill";

// The input of one entity field (select, password, secret, text or number),
// shared by the edit page of an entity and the settings card of a ranking.
// opts: the choices of a select (null for a plain input); locked: shown
// read-only (readonly or createOnly on an existing row); secretSet: a secret
// is stored, shown as dots.
export function FieldControl({
  f,
  value,
  opts,
  locked,
  isNew,
  secretSet,
  id,
}: {
  f: Field;
  value: string | number | null | undefined;
  opts: [string, string][] | null;
  locked: boolean;
  isNew: boolean;
  secretSet?: boolean;
  id?: string;
}) {
  if (opts && !locked)
    return (
      <select {...noAutofill} id={id} name={f.name} defaultValue={value === null || value === undefined ? "" : String(value)} required={f.required}>
        {!f.required || value === undefined ? <option value="" /> : null}
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    );
  if (f.type === "password") return <input {...noAutofill} id={id} name={f.name} type="password" minLength={10} required={isNew} />;
  if (f.type === "secret") return <input {...noAutofill} id={id} name={f.name} type="password" maxLength={f.max} placeholder={secretSet ? "••••••••" : ""} />;
  return (
    <input
      {...noAutofill}
      id={id}
      name={f.name}
      defaultValue={value === null || value === undefined ? "" : String(value)}
      type={f.type === "number" ? "number" : "text"}
      inputMode={f.type === "decimal" ? "decimal" : undefined}
      required={f.required && !locked}
      readOnly={locked}
      maxLength={f.max}
    />
  );
}
