import { noAutofill } from "@/lib/autofill";
import { adminDict } from "@/lib/admin-i18n";
import type { Lang } from "@/lib/i18n";

// The input of a secret (entity field or setting): whether one is stored as
// a pill, never the value; an empty field keeps it, and the Remove switch
// (`<name>__clear`, see secret-field.ts) deletes it on save. isNew: a row
// not saved yet, nothing to show.
export function SecretControl({
  id,
  name,
  maxLength,
  set,
  fromEnv,
  disabled,
  invalid,
  isNew,
  lang,
}: {
  id: string;
  name: string;
  maxLength?: number;
  set: boolean;
  fromEnv?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  isNew?: boolean;
  lang: Lang;
}) {
  const a = adminDict(lang);
  const placeholder = disabled ? (set || fromEnv ? a.secretSetLocked : a.secretEmpty) : set ? a.secretSet : fromEnv ? a.secretSetEnv : isNew ? "" : a.secretEmpty;
  return (
    <span className="secret-control">
      <input
        {...noAutofill}
        id={id}
        name={name}
        type="password"
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={isNew ? undefined : `${id}-state`}
      />
      {isNew ? null : (
        <span className="secret-state" id={`${id}-state`}>
          <span className={`pill secret-now${set || fromEnv ? " ok" : ""}`}>{set ? a.secretStateSet : fromEnv ? a.secretStateEnv : a.secretStateEmpty}</span>
          {set && !disabled ? (
            <>
              <span className="pill bad secret-drop">{a.secretRemoving}</span>
              <span className="secret-clear">
                <input type="checkbox" id={`${id}-clear`} name={`${name}__clear`} value="1" />
                <label htmlFor={`${id}-clear`}>{a.secretRemove}</label>
              </span>
            </>
          ) : null}
        </span>
      )}
    </span>
  );
}
