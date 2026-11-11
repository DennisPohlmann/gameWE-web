import { revealSecretAction } from "@/app/admin/actions";
import { noAutofill } from "@/lib/autofill";
import { adminDict } from "@/lib/admin-i18n";
import type { Lang } from "@/lib/i18n";
import { RevealInput } from "./reveal-input";

// The input of a secret (entity field or setting): whether one is stored as
// a pill, never the value; an empty field keeps it, and the Remove switch
// (`<name>__clear`, see secret-field.ts) deletes it on save. isNew: a row
// not saved yet, nothing to show. The eye button shows what was typed
// (RevealInput), or with reveal (see revealSecretAction) the stored value,
// fetched on click; it is never part of the page itself.
export function SecretControl({
  id,
  name,
  maxLength,
  set,
  fromEnv,
  disabled,
  invalid,
  isNew,
  reveal,
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
  reveal?: string;
  lang: Lang;
}) {
  const a = adminDict(lang);
  const placeholder = disabled ? (set || fromEnv ? a.secretSetLocked : a.secretEmpty) : set ? a.secretSet : fromEnv ? a.secretSetEnv : isNew ? "" : a.secretEmpty;
  return (
    <span className="secret-control">
      <RevealInput
        {...noAutofill}
        show={a.secretShow}
        hide={a.secretHide}
        load={reveal && set && !disabled ? revealSecretAction.bind(null, reveal) : undefined}
        id={id}
        name={name}
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
