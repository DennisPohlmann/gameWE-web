import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction, loginCancelAction, loginCodeAction } from "../../actions";
import { Logo } from "@/components/admin/nav";
import { basePath } from "@/lib/base-path";
import { adminSecret, currentAdmin, pendingLogin } from "@/lib/auth";
import { adminDict } from "@/lib/admin-i18n";
import { adminQuery } from "@/lib/db";
import { getAdminLang } from "@/lib/i18n";
import { codeMode, codeStepHref } from "@/lib/login-code";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; step?: string; use?: string }>;
}) {
  if (await currentAdmin()) redirect("/admin");
  const a = adminDict(await getAdminLang());
  const { error, step, use } = await searchParams;
  const mode = codeMode(use);
  const pending = step === "code" ? await pendingLogin() : null;
  const noSecret = !adminSecret();
  // A wrong DB_ADMIN_USER or missing rights must not end in a blank error page.
  let n = -1;
  try {
    [{ n }] = await adminQuery<{ n: number }>(
      `SELECT COUNT(*) AS n FROM hlstats_Users`,
    );
  } catch (err) {
    console.error("admin database:", err);
  }
  const msg =
    error === "invalid"
      ? a.invalid
      : error === "code"
        ? mode === "backup"
          ? a.backupCodeInvalid
          : a.codeInvalid
        : error === "blocked"
          ? a.blocked
          : error === "expired" || (step === "code" && !pending)
            ? a.totpExpired
            : null;
  return (
    <div className="adm-login">
    <div className="login">
      <span className="adm-brand">
        <Logo />
        <span>
          game<b>WE</b>
        </span>
        <small>Admin</small>
      </span>
      <h1>{a.login}</h1>
      {noSecret ? <p className="notice error">{a.nosecret}</p> : null}
      {n === 0 ? <p className="notice">{a.noUsers}</p> : null}
      {n < 0 ? <p className="notice error">{a.dbAdminError}</p> : null}
      {msg ? <p className="notice error">{msg}</p> : null}
      {pending ? (
        <>
          {mode === "backup" ? (
            <form action={loginCodeAction} className="form">
              <p>{a.totpStepBackup}</p>
              <input type="hidden" name="use" value="backup" />
              <label>
                {a.totpBackupCode}
                <input
                  name="code"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={12}
                  required
                  autoFocus
                />
                <small>{a.totpBackupCodeHint}</small>
              </label>
              <button type="submit" className="button">
                {a.login}
              </button>
            </form>
          ) : (
            <form action={loginCodeAction} className="form">
              <p>{a.totpStep}</p>
              <label>
                {a.totpCode}
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,7}"
                  maxLength={7}
                  required
                  autoFocus
                />
                <small>{a.totpCodeHint}</small>
              </label>
              <button type="submit" className="button">
                {a.login}
              </button>
            </form>
          )}
          <p className="code-switch">
            <Link href={codeStepHref(mode === "backup" ? "totp" : "backup")} replace>
              {mode === "backup" ? a.totpUseApp : a.totpUseBackup}
            </Link>
          </p>
          <form action={loginCancelAction}>
            <button type="submit" className="linkish">
              {a.totpCancel}
            </button>
          </form>
        </>
      ) : (
        <form action={loginAction} className="form">
          <label>
            {a.username}
            <input
              name="username"
              autoComplete="username"
              required
              maxLength={128}
            />
          </label>
          <label>
            {a.password}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="button" disabled={noSecret}>
            {a.login}
          </button>
        </form>
      )}
      <p className="login-foot">
        <a href={`${basePath}/`}>← {a.toSite}</a>
      </p>
    </div>
    </div>
  );
}
