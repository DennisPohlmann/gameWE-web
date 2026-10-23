import { changePasswordAction, totpCancelAction, totpConfirmAction, totpDisableAction, totpStartAction } from "../../actions";
import { QrCode } from "@/components/qr-code";
import { Section } from "@/components/ui";
import { adminDict } from "@/lib/admin-i18n";
import { adminSecret, requireAdmin } from "@/lib/auth";
import { getAdminLang } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { otpauthUri, readSecret } from "@/lib/totp";

// The signed-in user's own account: password and optional TOTP.
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; done?: string; pw?: string }> }) {
  const user = await requireAdmin();
  const a = adminDict(await getAdminLang());
  const { error, done, pw } = await searchParams;
  const secret = adminSecret();
  const active = secret ? await readSecret(user.username, secret) : null;
  const pending = secret && active === null ? await readSecret(user.username, secret, true) : null;
  const issuer = (await getSettings()).siteName || "gameWE";
  const codeInput = <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required aria-label={a.totpCode} />;
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
              <form action={totpDisableAction} className="form">
                <label>
                  {a.totpCode}
                  {codeInput}
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
                <input readOnly value={pending.replace(/(.{4})/g, "$1 ").trim()} className="mono" />
              </label>
              <label>
                {a.totpUri}
                <input readOnly value={otpauthUri(pending, user.username, issuer)} className="mono" />
              </label>
              <form action={totpConfirmAction} className="form">
                <label>
                  {a.totpCode}
                  {codeInput}
                  <small>{a.totpConfirmHint}</small>
                </label>
                <button type="submit" className="button">
                  {a.totpConfirm}
                </button>
              </form>
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
    </>
  );
}
