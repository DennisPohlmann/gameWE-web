import { saveOwnNotifyAction, changePasswordAction, displayNameAction, createApiTokenAction, deletePasskeyAction, passkeyOnlyAction, revokeApiTokenAction, totpBackupCodesAction, totpCancelAction, totpConfirmAction, totpDisableAction, totpStartAction } from "../../../actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HashRedirect } from "@/components/admin/hash-redirect";
import { PageHead } from "@/components/admin/page-head";
import { RevealInput } from "@/components/admin/reveal-input";
import { SecretControl } from "@/components/admin/secret-control";
import { BackupCodesForm, type BackupCodesText } from "@/components/admin/backup-codes-form";
import { ApiTokenForm } from "@/components/admin/api-token-form";
import { PasskeyAdd } from "@/components/admin/passkey-add";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Icon, type IconName } from "@/components/admin/icons";
import { TotpSetup } from "@/components/admin/totp-setup";
import { Section } from "@/components/ui";
import { EXPIRY_DAYS } from "@/lib/api-token-core";
import { listTokens } from "@/lib/api-tokens";
import { adminSecret, displayNames, requireAdmin } from "@/lib/auth";
import { noAutofill } from "@/lib/autofill";
import { basePath } from "@/lib/base-path";
import { fmtDateTime, nowUnix } from "@/lib/format";
import { fill, getAdminLang } from "@/lib/i18n";
import { apiEnabled, getSettings } from "@/lib/settings";
import { BACKUP_CODES, countBackupCodes, readSecret } from "@/lib/totp";
import { MAX_PER_USER } from "@/lib/passkey-core";
import { listPasskeys, passkeyOnly } from "@/lib/passkeys";
import { NotifyStatusLine } from "@/components/admin/notify-status";
import { adminDict, localized, tr } from "@/lib/admin-i18n";
import { notifyState } from "@/lib/admin-notify";
import { NOTIFY_EVENT_LABELS } from "@/lib/admin-settings";
import { NOTIFY_T } from "@/lib/admin-texts";
import { DEFAULT_NTFY, isChannel, splitNtfy } from "@/lib/notify-core";

// The signed-in user's own account: /admin/account shows every part at a
// glance, each part (display name and password, passkeys, how to sign in,
// optional TOTP with its backup codes, API tokens, only a notice while the
// API is off, notifications) has its own page /admin/account/<part>, listed
// in the side menu (components/admin/nav.tsx, ACCOUNT_PARTS there too).
const PARTS = ["profile", "passkeys", "sign-in", "totp", "api-tokens", "notifications"];
// Old links to a part of the one long page (/admin/account#totp).
const OLD_HASHES: [string, string][] = [["name", "profile"], ["password", "profile"], ...PARTS.slice(1).map((p): [string, string] => [p, p])];

export default async function AccountPage({ params, searchParams }: { params: Promise<{ part?: string[] }>; searchParams: Promise<{ error?: string; done?: string; pw?: string; token?: string; pk?: string; new?: string; notify?: string; field?: string; job?: string; name?: string }> }) {
  const user = await requireAdmin();
  const part = (await params).part?.join("/") ?? "";
  if (part && !PARTS.includes(part)) notFound();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const { error, done, pw, token, pk, new: fresh, notify, field, job, name: nameState } = await searchParams;
  const shown = (await displayNames([user.username])).get(user.username) ?? "";
  const nt = localized(NOTIFY_T, lang);
  const ns = await notifyState(user.username);
  const notifyOn = ns.own.filter((o) => o.to && o.events.length && o.ready).length;
  const passkeys = await listPasskeys(user.username);
  const only = await passkeyOnly(user.username);
  const added = pk === "added" ? passkeys.find((p) => p.hash === fresh) : undefined;
  const pkNotice = { deleted: a.pkDeleted, only: a.pkOnlyOn, any: a.pkOnlyOff }[pk ?? ""];
  const pkError = { few: a.pkErrFew, keep: a.pkErrKeep }[pk ?? ""];
  const api = await apiEnabled();
  const tokens = api ? await listTokens(user.username) : [];
  const now = nowUnix();
  const secret = adminSecret();
  const active = secret ? await readSecret(user.username, secret) : null;
  const pending = secret && active === null ? await readSecret(user.username, secret, true) : null;
  const backupLeft = active !== null ? await countBackupCodes(user.username) : 0;
  const issuer = (await getSettings()).siteName || "gameWE";
  const titles: Record<string, string> = { profile: `${a.nameTitle} & ${a.password}`, passkeys: a.pkTitle, "sign-in": a.pkModeTitle, totp: a.totp, "api-tokens": a.tokTitle, notifications: nt.title };
  const backupText = (hint: string, submit: string): BackupCodesText => ({
    code: a.totpCode,
    show: a.valueShow,
    hide: a.valueHide,
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
      {part ? (
        <PageHead crumbs={[[a.account, "/admin/account"], [titles[part]]]} title={titles[part]} />
      ) : (
        <>
          <PageHead crumbs={[[a.account]]} title={a.account} intro={a.accountIntro} />
          {OLD_HASHES.map(([hash, p]) => (
            <HashRedirect key={hash} hash={hash} to={`/admin/account/${p}`} />
          ))}
          {/* The state of every part at a glance; each tile opens its page. */}
          <nav className="grid kpis acc-glance" aria-label={a.accGlance}>
            <Tile href="profile" icon="user" k={titles.profile} v={shown || user.username} s={user.username} text />
            <Tile href="passkeys" icon="key" k={a.pkTitle} v={String(passkeys.length)} s={passkeys.length ? a.accPkSome : a.accPkNone} state={passkeys.length ? "ok" : undefined} />
            <Tile href="sign-in" icon="lock" k={a.pkModeTitle} v={only ? a.accModeOnly : a.accModeAny} s={a.accModeSub} text />
            <Tile href="totp" icon="shield" k={a.totp} v={active !== null ? a.accOn : a.accOff} s={a.accTotpSub} state={active !== null ? "ok" : undefined} text />
            <Tile href="api-tokens" icon="code" k={a.tokTitle} v={api ? String(tokens.length) : a.accOff} s={a.accTokSub} text={!api} />
            <Tile href="notifications" icon="bell" k={nt.title} v={String(notifyOn)} s={nt.tile} state={notifyOn ? "ok" : undefined} />
          </nav>
        </>
      )}
      {part === "profile" ? (
      <>
      <Section title={a.nameTitle} id="name">
        {nameState === "saved" ? <p className="notice">{a.nameSaved}</p> : null}
        {nameState === "invalid" ? <p className="notice error">{a.nameInvalid}</p> : null}
        <form action={displayNameAction} className="form">
          <label>
            {a.nameLabel}
            <input {...noAutofill} name="name" dir="auto" maxLength={40} defaultValue={shown} placeholder={user.username} />
            <small>{fill(a.nameHint, { u: user.username })}</small>
          </label>
          <button type="submit" className="button primary">
            {a.nameSave}
          </button>
        </form>
      </Section>
      {pw === "saved" ? <p className="notice">{a.pwSaved}</p> : null}
      {pw && pw !== "saved" ? (
        <p className="notice error">{pw === "wrong" ? a.pwWrong : pw === "mismatch" ? a.pwMismatch : pw === "short" ? a.pwShort : a.pwBlocked}</p>
      ) : null}
      <Section title={a.pwTitle} id="password">
        <form action={changePasswordAction} className="form">
          <input type="text" name="username" value={user.username} autoComplete="username" readOnly hidden />
          <label>
            {a.pwCurrent}
            <RevealInput show={a.secretShow} hide={a.secretHide} name="current" autoComplete="current-password" required />
          </label>
          <label>
            {a.pwNew}
            <RevealInput show={a.secretShow} hide={a.secretHide} name="next" autoComplete="new-password" minLength={10} maxLength={200} required />
            <small>{a.pwHint}</small>
          </label>
          <label>
            {a.pwRepeat}
            <RevealInput show={a.secretShow} hide={a.secretHide} name="repeat" autoComplete="new-password" minLength={10} maxLength={200} required />
          </label>
          <button type="submit" className="button">
            {a.pwSave}
          </button>
        </form>
      </Section>
      </>
      ) : null}
      {part === "passkeys" ? (
      <Section title={a.pkTitle} id="passkeys" aside={<span className={passkeys.length ? "pill ok" : "pill"}>{passkeys.length}</span>}>
        <div className="form">
          <p className="muted">{a.pkIntro}</p>
          {added ? (
            <p className="notice pk-added" role="status">
              <Icon name="check" />
              <span>{fill(a.pkAddedName, { n: added.name })}</span>
            </p>
          ) : null}
          {pk === "deleted" ? <p className="notice">{pkNotice}</p> : null}
          {pk === "keep" ? <p className="notice error">{pkError}</p> : null}
          {passkeys.length ? (
            <ul className="pk-list">
              {passkeys.map((p) => (
                <li key={p.hash} id={`pk-${p.hash}`} className={p.hash === added?.hash ? "pk-item fresh" : "pk-item"}>
                  <span className="pk-icon" aria-hidden="true">
                    <Icon name="key" />
                  </span>
                  <span className="pk-main">
                    <b dir="auto">{p.name}</b>
                    {p.hash === added?.hash ? <span className="pill ok">{a.pkNew}</span> : null}
                    <small>
                      {a.tokCreated}: {fmtDateTime(p.created, lang)} · {a.tokLastUsed}: {p.lastUsed ? fmtDateTime(p.lastUsed, lang) : a.tokNotUsed}
                    </small>
                  </span>
                  <form action={deletePasskeyAction}>
                    <input type="hidden" name="id" value={p.hash} />
                    <ConfirmButton
                      className="button small danger"
                      label={a.pkDelete}
                      title={fill(a.pkDeleteTitle, { n: p.name })}
                      yes={a.deleteYes}
                      text={{ cancel: a.confirmCancel }}
                      disabled={only && passkeys.length <= 1}
                    >
                      <p>{a.pkDeleteBody}</p>
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">{a.pkNone}</p>
          )}
          <div className="box sub-box">
            <h3>{a.pkAdd}</h3>
            <p className="muted">{a.pkAddIntro}</p>
            <PasskeyAdd
              key={pk ?? ""}
              totp={active !== null}
              text={{
                name: a.tokName,
                nameHint: a.pkNameHint,
                password: a.tokPassword,
                show: a.secretShow,
                hide: a.secretHide,
                code: a.tokCode,
                add: a.pkAdd,
                added: a.pkAdded,
                unsupported: a.pkUnsupported,
                failed: a.pkFailed,
                errors: {
                  name: a.tokErrName,
                  wrong: a.tokErrWrong,
                  code: a.tokErrCode,
                  blocked: a.pwBlocked,
                  nosecret: a.nosecret,
                  limit: fill(a.pkErrLimit, { n: String(MAX_PER_USER) }),
                  expired: a.pkErrExpired,
                  invalid: a.pkErrInvalid,
                  duplicate: a.pkErrDuplicate,
                },
              }}
            />
          </div>
        </div>
      </Section>
      ) : null}
      {part === "sign-in" ? (
      <Section title={a.pkModeTitle} id="sign-in" aside={<span className={only ? "pill ok" : "pill"}>{only ? a.accModeOnly : a.accModeAny}</span>}>
        <form action={passkeyOnlyAction} className="form">
          {pk === "only" || pk === "any" ? <p className="notice">{pkNotice}</p> : null}
          {pk === "few" ? <p className="notice error">{pkError}</p> : null}
          <fieldset className="choice-cards" aria-label={a.pkModeTitle}>
            <label className="check">
              <input type="radio" name="only" value="0" defaultChecked={!only} />
              <span>{a.pkModeAny}</span>
            </label>
            <label className="check">
              <input type="radio" name="only" value="1" defaultChecked={only} disabled={!only && !passkeys.length} />
              <span>{a.pkModeOnly}</span>
            </label>
          </fieldset>
          <small>{a.pkModeHint}</small>
          <button type="submit" className="button">
            {a.pkModeSave}
          </button>
        </form>
      </Section>
      ) : null}
      {part === "totp" ? (
      <>
      {error === "code" ? <p className="notice error">{a.codeInvalid}</p> : null}
      {done === "on" ? <p className="notice">{a.totpEnabled}</p> : done === "off" ? <p className="notice">{a.totpDisabled}</p> : null}
      {!secret ? <p className="notice error">{a.nosecret}</p> : null}
      <Section title={a.totp} id="totp" aside={<span className={active !== null ? "pill ok" : "pill"}>{active !== null ? a.accOn : a.accOff}</span>}>
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
          ) : (
            <TotpSetup
              start={totpStartAction}
              confirm={totpConfirmAction}
              cancel={totpCancelAction}
              started={pending !== null}
              disabled={!secret}
              text={{ off: a.totpOff, start: a.totpStart, restart: a.totpRestart, gone: a.totpQrGone, qr: a.totpQr, key: a.totpSecret, uri: a.totpUri, show: a.valueShow, hide: a.valueHide, cancel: a.totpCancel }}
              backup={backupText(a.totpConfirmHint, a.totpConfirm)}
              user={user.username}
              site={issuer}
            />
          )}
          <small>{a.totpReset}</small>
        </div>
      </Section>
      </>
      ) : null}
      {part === "api-tokens" && !api ? (
        <Section title={a.tokTitle} id="api-tokens">
          <div className="form">
            <p className="notice">{a.tokOff}</p>
          </div>
        </Section>
      ) : null}
      {part === "api-tokens" && api ? (
        <Section title={a.tokTitle} id="api-tokens" aside={<span className="pill">{tokens.length}</span>}>
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
                    <th>{a.tokScopes}</th>
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
                      <td data-l={`${a.tokScopes}:`}>{t.scopes.join(", ")}</td>
                      <td data-l={`${a.tokCreated}:`}>{fmtDateTime(t.created, lang)}</td>
                      <td data-l={`${a.tokLastUsed}:`}>{t.lastUsed ? fmtDateTime(t.lastUsed, lang) : a.tokNotUsed}</td>
                      <td data-l={`${a.tokExpires}:`}>
                        {!t.expires ? a.tokNever : t.expires <= now ? <span className="pill bad">{a.tokExpired}</span> : fmtDateTime(t.expires, lang)}
                      </td>
                      <td className="end">
                        <form action={revokeApiTokenAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmButton className="button small danger" label={a.tokRevoke} title={fill(a.tokRevokeTitle, { n: t.name })} yes={a.tokRevoke} text={{ cancel: a.confirmCancel }}>
                            <p>{a.tokRevokeBody}</p>
                          </ConfirmButton>
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
                scopes: a.tokScopes,
                scope: { read: a.tokScopeRead, write: a.tokScopeWrite, mcp: a.tokScopeMcp },
                expiry: a.tokExpiry,
                never: a.tokNever,
                days: a.tokDays,
                password: a.tokPassword,
                show: a.secretShow,
                hide: a.secretHide,
                valueShow: a.valueShow,
                valueHide: a.valueHide,
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
                  scope: a.tokErrScope,
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
      {part === "notifications" ? (
      <Section title={nt.title} id="notifications" aside={<span className={notifyOn ? "pill ok" : "pill"}>{notifyOn}</span>}>
        <form action={saveOwnNotifyAction} className="form notify-own">
          <p className="muted">{nt.intro}</p>
          {notify === "saved" ? <p className="notice" role="status">{nt.saved}</p> : null}
          {notify === "test" && job && /^\d+$/.test(job) ? <p className="notice" role="status">{fill(nt.testQueued, { id: job })}</p> : null}
          {notify === "bad" ? <p className="notice error">{fill(nt.bad, { c: isChannel(field) ? nt.channel[field] : "" })}</p> : null}
          {notify === "nojobs" || !ns.jobs ? <p className="notice error">{nt.noJobs}</p> : !ns.collector ? <p className="notice">{nt.noCollector}</p> : null}
          {ns.own.map((o) => {
            // E-mail needs the site's SMTP server; Telegram and ntfy are the admin's own.
            const locked = o.channel === "email" && !o.ready;
            const ntfy = splitNtfy(o.to);
            const token = (c: "telegram" | "ntfy", label: string, hint: string) => (
              <div className="notify-token">
                <label htmlFor={`notify-${c}-token`}>{label}</label>
                <SecretControl id={`notify-${c}-token`} name={`notify_${c}_token`} maxLength={128} set={o.token} invalid={notify === "bad" && field === c} lang={lang} />
                <small>{hint}</small>
              </div>
            );
            return (
              <div key={o.channel} className={locked ? "notify-ch off" : "notify-ch"}>
                <h3>
                  <Icon name="bell" />
                  {nt.channel[o.channel]}
                </h3>
                {locked ? <small>{nt.notSetUp}</small> : null}
                {o.channel === "telegram" ? token("telegram", nt.botToken, nt.botTokenHint) : null}
                {o.channel === "ntfy" ? (
                  <label>
                    {nt.server}
                    <input {...noAutofill} name="notify_ntfy_server" defaultValue={ntfy.server} placeholder={DEFAULT_NTFY} type="url" dir="ltr" maxLength={200} aria-invalid={(notify === "bad" && field === "ntfy") || undefined} />
                    <small>{nt.serverHint}</small>
                  </label>
                ) : null}
                <label>
                  {nt.to[o.channel]}
                  <input
                    {...noAutofill}
                    name={`notify_${o.channel}`}
                    defaultValue={o.channel === "ntfy" ? ntfy.topic : o.to}
                    type={o.channel === "email" ? "email" : "text"}
                    dir="ltr"
                    maxLength={200}
                    disabled={locked}
                    aria-invalid={(notify === "bad" && field === o.channel) || undefined}
                  />
                  <small>{nt.toHint[o.channel]}</small>
                </label>
                {o.channel === "ntfy" ? token("ntfy", nt.token, nt.tokenHint) : null}
                {/* a locked channel keeps what is stored */}
                {locked ? (
                  <>
                    <input type="hidden" name={`notify_${o.channel}`} value={o.to} />
                    {o.events.map((e) => (
                      <input key={e} type="hidden" name={`notify_${o.channel}_${e}`} value="1" />
                    ))}
                  </>
                ) : null}
                <fieldset className="ev" disabled={locked}>
                  <legend>{nt.events}</legend>
                  {NOTIFY_EVENT_LABELS.map(([e, label]) => (
                    <label key={e} className="check">
                      <input type="checkbox" name={`notify_${o.channel}_${e}`} value="1" defaultChecked={o.events.includes(e)} />
                      <span>{tr(label, lang)}</span>
                    </label>
                  ))}
                </fieldset>
                {locked ? null : <NotifyStatusLine status={o.status} test={o.test} lang={lang} />}
                {o.ready ? (
                  <div className="row">
                    <button type="submit" name="test" value={o.channel} className="button small" disabled={!ns.jobs}>
                      {nt.saveTest}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
          <div className="btns">
            <button type="submit" className="button primary">
              {nt.save}
            </button>
          </div>
        </form>
      </Section>
      ) : null}
    </>
  );
}

function Tile({ href, icon, k, v, s, state, text }: { href: string; icon: IconName; k: string; v: string; s: string; state?: "ok"; text?: boolean }) {
  return (
    <Link prefetch={false} className={`card kpi kpi-link acc-tile${state ? ` ${state}` : ""}`} href={`/admin/account/${href}`}>
      <div className="k">
        <Icon name={icon} />
        {k}
      </div>
      <div className={text ? "v kpi-text" : "v"}><bdi>{v}</bdi></div>
      <div className="s"><bdi>{s}</bdi></div>
    </Link>
  );
}
