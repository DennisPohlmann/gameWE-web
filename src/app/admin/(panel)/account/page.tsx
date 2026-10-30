import { changePasswordAction, createApiTokenAction, revokeApiTokenAction, totpBackupCodesAction, totpCancelAction, totpConfirmAction, totpDisableAction, totpStartAction } from "../../actions";
import { BackupCodesForm, type BackupCodesText } from "@/components/admin/backup-codes-form";
import { ApiTokenForm } from "@/components/admin/api-token-form";
import { QrCode } from "@/components/qr-code";
import { Section } from "@/components/ui";
import { adminDict } from "@/lib/admin-i18n";
import { apiEnabled } from "@/lib/api-switch";
import { EXPIRY_DAYS } from "@/lib/api-token-core";
import { listTokens } from "@/lib/api-tokens";
import { adminSecret, requireAdmin } from "@/lib/auth";
import { noAutofill } from "@/lib/autofill";
import { basePath } from "@/lib/base-path";
import { fmtDateTime, nowUnix } from "@/lib/format";
import { fill, getAdminLang } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { BACKUP_CODES, countBackupCodes, otpauthUri, readSecret } from "@/lib/totp";

// The signed-in user's own account: password, optional TOTP with its backup
// codes and API tokens (only a notice while API_ENABLED is off).
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; done?: string; pw?: string; token?: string }> }) {
  const user = await requireAdmin();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const { error, done, pw, token } = await searchParams;
  const api = apiEnabled();
  const tokens = api ? await listTokens(user.username) : [];
  const now = nowUnix();
  const secret = adminSecret();
  const active = secret ? await readSecret(user.username, secret) : null;
  const pending = secret && active === null ? await readSecret(user.username, secret, true) : null;
  const backupLeft = active !== null ? await countBackupCodes(user.username) : 0;
  const issuer = (await getSettings()).siteName || "gameWE";
  const backupText = (hint: string, submit: string): BackupCodesText => ({
    code: a.totpCode,
    hint,
    submit,
    title: a.totpBackupShownTitle,
    once: a.totpBackupShownOnce,
    copy: a.totpBackupCopy,
    copied: a.totpBackupCopied,
    save: a.totpBackupSave,
    done: a.totpBackupDone,
    invalid: a.codeInvalid,
  });
  return (
    <>
      <h1>{a.account}</h1>
      <p className="lead">{a.accountIntro}</p>
      {pw === "saved" ? <p className="notice">{a.pwSaved}</p> : null}
      {pw && pw !== "saved" ? (
        <p className="notice error">{pw === "wrong" ? a.pwWrong : pw === "mismatch" ? a.pwMismatch : pw === "short" ? a.pwShort : a.pwBlocked}</p>
      ) : null}
      <Section title={a.pwTitle}>
        <form action={changePasswordAction} className="form">
          <input type="text" name="username" value={user.username} autoComplete="username" readOnly hidden />
          <label>
            {a.pwCurrent}
            <input type="password" name="current" autoComplete="current-password" required />
          </label>
          <label>
            {a.pwNew}
            <input type="password" name="next" autoComplete="new-password" minLength={10} maxLength={200} required />
            <small>{a.pwHint}</small>
          </label>
          <label>
            {a.pwRepeat}
            <input type="password" name="repeat" autoComplete="new-password" minLength={10} maxLength={200} required />
          </label>
          <button type="submit" className="button">
            {a.pwSave}
          </button>
        </form>
      </Section>
      {error === "code" ? <p className="notice error">{a.codeInvalid}</p> : null}
      {done === "on" ? <p className="notice">{a.totpEnabled}</p> : done === "off" ? <p className="notice">{a.totpDisabled}</p> : null}
      {!secret ? <p className="notice error">{a.nosecret}</p> : null}
      <Section title={a.totp}>
        <div className="form">
          <p>{a.totpIntro}</p>
          {active !== null ? (
            <>
              <p>
                <strong>{a.totpOn}</strong>
              </p>
              <h3>{a.totpBackupTitle}</h3>
              <p className={backupLeft > 2 ? undefined : "notice"}>{backupLeft ? fill(a.totpBackupLeft, { n: String(backupLeft), all: String(BACKUP_CODES) }) : a.totpBackupNone}</p>
              <BackupCodesForm action={totpBackupCodesAction} text={backupText(a.totpBackupNewHint, a.totpBackupNew)} user={user.username} site={issuer} />
              <h3>{a.totpDisable}</h3>
              <form action={totpDisableAction} className="form">
                <label>
                  {a.totpCodeOrBackup}
                  <input {...noAutofill} name="code" autoComplete="one-time-code" maxLength={12} required aria-label={a.totpCodeOrBackup} />
                  <small>{a.totpDisableHint}</small>
                </label>
                <button type="submit" className="button">
                  {a.totpDisable}
                </button>
              </form>
            </>
          ) : pending ? (
            <>
              <p>{a.totpQr}</p>
              <QrCode text={otpauthUri(pending, user.username, issuer)} label={a.totpUri} />
              <label>
                {a.totpSecret}
                <input {...noAutofill} readOnly value={pending.replace(/(.{4})/g, "$1 ").trim()} className="mono" />
              </label>
              <label>
                {a.totpUri}
                <input {...noAutofill} readOnly value={otpauthUri(pending, user.username, issuer)} className="mono" />
              </label>
              <BackupCodesForm action={totpConfirmAction} text={backupText(a.totpConfirmHint, a.totpConfirm)} user={user.username} site={issuer} />
              <form action={totpCancelAction}>
                <button type="submit" className="linkish">
                  {a.totpCancel}
                </button>
              </form>
            </>
          ) : (
            <>
              <p>{a.totpOff}</p>
              <form action={totpStartAction}>
                <button type="submit" className="button" disabled={!secret}>
                  {a.totpStart}
                </button>
              </form>
            </>
          )}
          <small>{a.totpReset}</small>
        </div>
      </Section>
      {api ? null : (
        <Section title={a.tokTitle} id="api-tokens">
          <div className="form">
            <p className="notice">{a.tokOff}</p>
          </div>
        </Section>
      )}
      {api ? (
        <Section title={a.tokTitle} id="api-tokens">
          <div className="form">
            <p>
              {a.tokIntro} <a href={`${basePath}/api`}>{`${basePath}/api`}</a>
            </p>
            {token === "revoked" ? <p className="notice">{a.tokRevoked}</p> : null}
            {tokens.length ? null : <p className="muted">{a.tokNone}</p>}
          </div>
          {tokens.length ? (
            <div className="table-wrap">
              <table className="cards">
                <thead>
                  <tr>
                    <th>{a.tokName}</th>
                    <th>{a.tokPrefix}</th>
                    <th>{a.tokCreated}</th>
                    <th>{a.tokLastUsed}</th>
                    <th>{a.tokExpires}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => (
                    <tr key={t.id}>
                      <td className="main">{t.name}</td>
                      <td data-l={`${a.tokPrefix}:`}>
                        <code>{t.prefix}…</code>
                      </td>
                      <td data-l={`${a.tokCreated}:`}>{fmtDateTime(t.created, lang)}</td>
                      <td data-l={`${a.tokLastUsed}:`}>{t.lastUsed ? fmtDateTime(t.lastUsed, lang) : a.tokNotUsed}</td>
                      <td data-l={`${a.tokExpires}:`}>
                        {!t.expires ? a.tokNever : t.expires <= now ? <span className="pill bad">{a.tokExpired}</span> : fmtDateTime(t.expires, lang)}
                      </td>
                      <td className="end">
                        <form action={revokeApiTokenAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <button type="submit" className="button danger small">
                            {a.tokRevoke}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="form">
            <ApiTokenForm
              action={createApiTokenAction}
              totp={active !== null}
              expiries={[...EXPIRY_DAYS]}
              text={{
                name: a.tokName,
                nameHint: a.tokNameHint,
                expiry: a.tokExpiry,
                never: a.tokNever,
                days: a.tokDays,
                password: a.tokPassword,
                code: a.tokCode,
                create: a.tokCreate,
                shownTitle: a.tokShownTitle,
                shownOnce: a.tokShownOnce,
                copy: a.tokCopy,
                copied: a.tokCopied,
                use: a.tokUse,
                done: a.tokDone,
                errors: {
                  name: a.tokErrName,
                  expiry: a.tokErrExpiry,
                  wrong: a.tokErrWrong,
                  code: a.tokErrCode,
                  blocked: a.pwBlocked,
                  nosecret: a.nosecret,
                  limit: a.tokErrLimit,
                  long: a.tokErrLong,
                  disabled: a.tokOff,
                },
              }}
            />
          </div>
        </Section>
      ) : null}
    </>
  );
}
