"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getEntity } from "@/lib/admin-entities";
import { getRow, keptValues, optionList, withColumns } from "@/lib/admin-data";
import { OpError, assignServersTo, deleteEntity, deleteRole, saveRole, deletePlayer, moveServer, resetRanking, saveEntity, savePrivacy, saveSettings, setGlobalHall, setHallEntry, setRankingBots, setRankingFastdl, setRankingFastdlAccess, setRankingHall, setRankingVac } from "@/lib/admin-ops";
import { ADMIN_THEME_COOKIE, isAdminTheme } from "@/lib/admin-theme";
import { basePath } from "@/lib/base-path";
import { expiryDays, tokenName, tokenScopes } from "@/lib/api-token-core";
import { createToken, purgeTokens, revokeToken } from "@/lib/api-tokens";
import { adminSecret, brakedCode, confirmIdentity, cookieSecure, cancelPendingLogin, changePassword, login, loginCode, logout, newChallenge, passkeyHost, passkeyLogin, requireAdmin, requirePerm, takeChallenge } from "@/lib/auth";
import { normalizePerms } from "@/lib/admin-perms";
import { ALGS, MAX_PER_USER, checkRegistration, passkeyHash, passkeyName, rpIdOf, userHandle, type Assertion, type Registration } from "@/lib/passkey-core";
import { addPasskey, deletePasskey, listPasskeys, passkeyOnly, setPasskeyOnly } from "@/lib/passkeys";
import { codeMode, codeStepHref } from "@/lib/login-code";
import { resetMode } from "@/lib/reset";
import { apiEnabled, getSettings } from "@/lib/settings";
import { qrData } from "@/components/qr-code";
import { addParams, safeReturnTo, withReturnTo } from "@/lib/return-to";
import { rankingPageHref, resettableRankings } from "@/lib/admin-rankings";
import { presetRanking, rankingServersHref } from "@/lib/ranking-preset";
import { checkCode, consumeStep, newBackupCodes, newSecret, otpauthUri, readSecret, removeBackupCodes, removeSecret, secondFactor, storeBackupCodes, storeSecret } from "@/lib/totp";
import { ACCESS_SECRETS, FASTDL_ACCESS, accessKey, type AccessField } from "@/lib/fastdl-access";
import { allSettings } from "@/lib/admin-settings";
import { adminQuery } from "@/lib/db";
import { secretOptions, secretsOf } from "@/lib/secret-options";

export async function loginAction(form: FormData) {
  const res = await login(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
  if (res === "totp") redirect("/admin/login?step=code");
  if (res !== "ok") redirect(`/admin/login?error=${res}`);
  redirect("/admin");
}

// Sign-in with a passkey (PasskeyLogin): the challenge first, then the
// answer of the browser. A passkey is found by its id (no user name asked).
export async function passkeyLoginStartAction(): Promise<{ challenge: string; rpId: string } | { error: "nosecret" }> {
  const challenge = await newChallenge("login");
  if (!challenge) return { error: "nosecret" };
  return { challenge, rpId: rpIdOf(await passkeyHost()) };
}

export async function passkeyLoginAction(r: Assertion): Promise<{ error?: "invalid" | "expired" | "blocked" | "nosecret" }> {
  const res = await passkeyLogin(r);
  return res === "ok" ? {} : { error: res };
}

export async function loginCodeAction(form: FormData) {
  const res = await loginCode(String(form.get("code") ?? ""));
  if (res === "code") redirect(codeStepHref(codeMode(form.get("use")), "code"));
  if (res !== "ok") redirect(`/admin/login?error=${res}`);
  redirect("/admin");
}

export async function loginCancelAction() {
  await cancelPendingLogin();
  redirect("/admin/login");
}

// Light, dark or automatic look of the admin area (user menu); back to the
// page the button was on.
export async function adminThemeAction(form: FormData) {
  await requireAdmin();
  const theme = form.get("theme");
  if (!isAdminTheme(theme)) redirect("/admin");
  (await cookies()).set(ADMIN_THEME_COOKIE, theme, {
    httpOnly: true,
    sameSite: "strict",
    secure: await cookieSecure(),
    path: `${basePath}/admin`,
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(adminReferer(await headers()));
}

// The admin page a form was sent from (same host, below /admin), else /admin.
function adminReferer(h: Headers): string {
  try {
    const u = new URL(h.get("referer") ?? "");
    if (u.host === h.get("host") && (u.pathname === `${basePath}/admin` || u.pathname.startsWith(`${basePath}/admin/`))) {
      return u.pathname.slice(basePath.length) + u.search;
    }
  } catch {}
  return "/admin";
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

// Edit page of a row; keeps the list it was opened from (returnTo).
function editHref(entity: string, id: string, form: FormData, params: Record<string, string | undefined> = {}) {
  return addParams(withReturnTo(`/admin/${entity}/${encodeURIComponent(id)}`, safeReturnTo(form.get("__returnTo"), entity), entity), params);
}

async function entityFrom(form: FormData) {
  const e = getEntity(String(form.get("__entity") ?? ""));
  if (!e) redirect("/admin");
  return withColumns(e);
}

export async function saveAction(form: FormData) {
  const e = await entityFrom(form);
  const user = await requirePerm(e.perm.edit);
  const rawId = String(form.get("__id") ?? "");
  const id = rawId === "new" ? null : rawId;
  const list = safeReturnTo(form.get("__returnTo"), e.key);
  // A new server from a ranking's page ("Add server") goes into that ranking
  // (only an existing one) and the save returns there.
  const ranking = e.key === "servers" && id === null ? presetRanking(form.get("__ranking"), (await optionList("games")).map(([c]) => c)) : null;
  // The input of a new server or ranking is kept after an error.
  const kept =
    e.key === "servers" && id === null
      ? { ...keptValues(e, form), game: ranking ?? undefined }
      : e.key === "games" && id === null
        ? { ...keptValues(e, form), v_template: String(form.get("template") ?? "").trim().slice(0, 32) || undefined }
        : {};
  // A ranking is edited on its own page; its errors and the saved notice go
  // to the settings card there.
  const ownPage = e.key === "games" && id !== null;
  const back = async (params: Record<string, string | undefined>) => (ownPage ? rankingPageHref(rawId, params, "settings") : editHref(e.key, rawId, form, params));
  let saved: string;
  try {
    // The rights checkboxes of an admin's page (the hidden __perms marks them as sent).
    // With __role an admin role (its id), empty: the admin's own rights.
    const sent = e.key === "users" && form.get("__perms") === "1";
    const roleIn = sent ? String(form.get("__role") ?? "") : "";
    const role = !sent ? undefined : roleIn === "" ? null : roleIn;
    const perms = sent && role === null ? normalizePerms(form.getAll("perm").map(String)) : undefined;
    saved = await saveEntity({ user }, e, id, form, { ranking, perms, role });
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    const c = err.code;
    if (c === "cannot" || c === "notfound") redirect(list);
    if (c === "self" || c === "mismatch" || c === "password" || c === "lastadmin" || c === "perm") redirect(await back({ error: c }));
    if (c === "duplicate") redirect(editHref(e.key, rawId, form, { error: "duplicate", dup: err.detail.dup, ...kept }));
    if (c === "field") redirect(await back({ error: "field", field: err.detail.field, ...kept }));
    // A new ranking is saved, but its template's definitions failed.
    if (err.detail.saved) redirect(editHref(e.key, err.detail.saved, form, { error: "db", msg: err.detail.msg }));
    redirect(await back({ error: "db", msg: err.detail.msg ?? "?", game: ranking ?? undefined }));
  }
  if (ranking) redirect(rankingServersHref(ranking, { saved: "server" }));
  // A new ranking opens on its page too.
  if (e.key === "games") redirect(await rankingPageHref(saved, { saved: "settings" }, "settings"));
  redirect(editHref(e.key, saved, form, { saved: "1" }));
}

// Moves servers into a ranking (servers card of the ranking's page).
export async function assignServersAction(form: FormData) {
  const user = await requirePerm("servers.edit");
  const gameId = String(form.get("__id") ?? "");
  const e = await withColumns(getEntity("games")!);
  const row = await getRow(e, gameId);
  if (!row) redirect("/admin/rankings");
  const ids = form.getAll("server").map((v) => Number(v));
  try {
    await assignServersTo({ user }, String(row.code).trim(), ids);
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    redirect(await rankingPageHref(gameId, err.code === "mismatch" ? { serr: "mismatch" } : { serr: "db", msg: err.detail.msg ?? "?" }, "servers"));
  }
  redirect(await rankingPageHref(gameId, { saved: "servers" }, "servers"));
}

// Takes one server out of a ranking by moving it into another one.
export async function moveServerAction(form: FormData) {
  const user = await requirePerm("servers.edit");
  const gameId = String(form.get("__id") ?? "");
  try {
    await moveServer({ user }, Number(form.get("server")), String(form.get("target") ?? "").trim());
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    if (err.code === "notfound" || err.code === "input") redirect(await rankingPageHref(gameId, {}, "servers"));
    redirect(await rankingPageHref(gameId, err.code === "mismatch" ? { serr: "mismatch" } : { serr: "db", msg: err.detail.msg ?? "?" }, "servers"));
  }
  redirect(await rankingPageHref(gameId, { saved: "servers" }, "servers"));
}

export async function deleteAction(form: FormData) {
  const e = await entityFrom(form);
  const user = await requirePerm(e.perm.edit);
  const id = String(form.get("__id") ?? "");
  if (form.get("confirm") !== "1") redirect(editHref(e.key, id, form));
  try {
    await deleteEntity({ user }, e, id);
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    if (err.code === "self" || err.code === "lastadmin") redirect(editHref(e.key, id, form, { error: err.code }));
    if (err.code === "db") redirect(editHref(e.key, id, form, { error: "db", msg: err.detail.msg ?? "?" }));
    redirect(editHref(e.key, id, form));
  }
  redirect(addParams(safeReturnTo(form.get("__returnTo"), e.key), { deleted: "1" }));
}

// Erases a player with everything recorded about them (right players.erase), confirmed
// by the checkbox; the collector does it, the job list shows the result.
export async function deletePlayerAction(form: FormData) {
  const user = await requirePerm("players.erase");
  const id = String(form.get("id") ?? "");
  const back = `/admin/players/${encodeURIComponent(id)}`;
  if (form.get("confirm") !== "1") redirect(back);
  try {
    await deletePlayer({ user }, id);
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    if (err.code === "db") redirect(`${back}?error=db&msg=${encodeURIComponent(err.detail.msg ?? "?")}`);
    if (err.code === "nojobs") redirect("/admin/jobs");
    redirect("/admin/players");
  }
  redirect("/admin/jobs");
}

// One settings page (/admin/settings/<group>) is one form: only the settings
// of that group, or on the raw page the raw rows, are read and written.
export async function saveSettingsAction(form: FormData) {
  const user = await requirePerm("settings.edit");
  const page = String(form.get("group") ?? "");
  try {
    await saveSettings({ user }, page, form);
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    if (err.code === "field") redirect(`/admin/settings/${page}?field=${encodeURIComponent(err.detail.field)}`);
    redirect("/admin/settings");
  }
  redirect(`/admin/settings/${page}?saved=1`);
}

// The operator's part of the privacy page (Admin → Website → Privacy):
// checked and split by lib/privacy-operator.ts, written with the admin user.
export async function savePrivacyAction(form: FormData) {
  const user = await requirePerm("settings.edit");
  try {
    await savePrivacy({ user }, form);
  } catch (err) {
    if (err instanceof OpError && err.code === "field") redirect(`/admin/privacy?field=${err.detail.field}`);
    throw err;
  }
  redirect("/admin/privacy?saved=1");
}

// TOTP for the signed-in user's own account: a new secret waits as "pending"
// until a code from the app confirms it.
async function totpUser() {
  const user = await requireAdmin();
  const secret = adminSecret();
  if (!secret) redirect("/admin/account");
  return { user: user.username, secret };
}

// The key, its otpauth link and QR code answer the form (TotpSetup) once:
// every start makes a new key, and the page never shows a pending one again.
export type TotpStartState = { key?: string; uri?: string; qr?: { size: number; d: string } };

export async function totpStartAction(): Promise<TotpStartState> {
  const { user, secret } = await totpUser();
  if ((await readSecret(user, secret)) !== null) return {};
  const key = newSecret();
  await storeSecret(user, key, secret, true);
  const uri = otpauthUri(key, user, (await getSettings()).siteName || "gameWE");
  return { key, uri, qr: qrData(uri) };
}

export async function totpCancelAction() {
  const { user } = await totpUser();
  await removeSecret(user, true);
  redirect("/admin/account");
}

// Turning TOTP on and making new backup codes answer the form (BackupCodesForm)
// with the codes, shown once: never in a URL, cookie or log.
export type BackupCodesState = { codes?: string[]; error?: "code"; at?: number };

export async function totpConfirmAction(_prev: BackupCodesState, form: FormData): Promise<BackupCodesState> {
  const { user, secret } = await totpUser();
  const at = Date.now();
  const pending = await readSecret(user, secret, true);
  const step = pending ? checkCode(pending, String(form.get("code") ?? "")) : null;
  if (!pending || step === null || !consumeStep(user, step)) return { error: "code", at };
  await storeSecret(user, pending, secret, false);
  await removeSecret(user, true);
  const codes = newBackupCodes();
  await storeBackupCodes(user, codes, secret);
  return { codes, at };
}

// New backup codes (the old ones stop working): needs the current code
// from the app, not a backup code.
export async function totpBackupCodesAction(_prev: BackupCodesState, form: FormData): Promise<BackupCodesState> {
  const { user, secret } = await totpUser();
  const at = Date.now();
  const active = await readSecret(user, secret);
  const right = await brakedCode(user, async () => {
    const step = active ? checkCode(active, String(form.get("code") ?? "")) : null;
    return step !== null && consumeStep(user, step);
  });
  if (right !== "ok") return { error: "code", at };
  const codes = newBackupCodes();
  await storeBackupCodes(user, codes, secret);
  return { codes, at };
}

// With the current code or a backup code (the app may be lost).
export async function totpDisableAction(form: FormData) {
  const { user, secret } = await totpUser();
  const active = await readSecret(user, secret);
  const right = await brakedCode(user, async () => active !== null && (await secondFactor(user, active, String(form.get("code") ?? ""), secret)) !== null);
  if (right !== "ok") redirect("/admin/account?error=code");
  await removeSecret(user, false);
  await removeBackupCodes(user);
  // Whoever had the old second factor may have made a token with it.
  await purgeTokens(user);
  redirect("/admin/account?done=off");
}

// Passkeys of the signed-in user's own account (lib/passkeys.ts). A new one
// is confirmed with the password (and TOTP code) first, like an API token;
// the browser then makes it and passkeyAddAction checks and stores it.
export type PasskeyAddError = "name" | "wrong" | "code" | "blocked" | "nosecret" | "limit" | "expired" | "invalid" | "duplicate";
export type PasskeyOptions = { challenge: string; rpId: string; rpName: string; user: { id: string; name: string }; exclude: string[]; algs: number[] };

export async function passkeyAddStartAction(form: FormData): Promise<PasskeyOptions | { error: PasskeyAddError }> {
  const user = await requireAdmin();
  if (!passkeyName(form.get("name"))) return { error: "name" };
  const mine = await listPasskeys(user.username);
  if (mine.length >= MAX_PER_USER) return { error: "limit" };
  const ok = await confirmIdentity(user.username, String(form.get("password") ?? ""), String(form.get("code") ?? ""));
  if (ok !== "ok") return { error: ok };
  const challenge = await newChallenge("add", user.username);
  if (!challenge) return { error: "nosecret" };
  return {
    challenge,
    rpId: rpIdOf(await passkeyHost()),
    rpName: (await getSettings()).siteName || "gameWE",
    user: { id: userHandle(user.username), name: user.username },
    exclude: mine.map((p) => p.id),
    algs: [...ALGS],
  };
}

export async function passkeyAddAction(name: string, r: Registration): Promise<{ error?: PasskeyAddError; added?: string }> {
  const user = await requireAdmin();
  const n = passkeyName(name);
  if (!n) return { error: "name" };
  const challenge = await takeChallenge("add", user.username);
  if (!challenge) return { error: "expired" };
  const reg = checkRegistration(r, { challenge, host: await passkeyHost(), type: "webauthn.create" });
  if (!reg) return { error: "invalid" };
  if ((await listPasskeys(user.username)).length >= MAX_PER_USER) return { error: "limit" };
  if ((await addPasskey({ owner: user.username, name: n, id: reg.id, key: reg.key, alg: reg.alg }, reg.counter)) !== "ok") return { error: "duplicate" };
  console.info(`gameWE: passkey "${n}" added by ${user.username}`);
  revalidatePath("/admin/account");
  // The page marks the new passkey by this.
  return { added: passkeyHash(reg.id) };
}

// While "only passkey" is on, the last passkey stays: the account would lock itself out.
export async function deletePasskeyAction(form: FormData) {
  const user = await requireAdmin();
  const mine = await listPasskeys(user.username);
  if ((await passkeyOnly(user.username)) && mine.length <= 1) redirect("/admin/account?pk=keep#passkeys");
  const r = await deletePasskey(user.username, String(form.get("id") ?? ""));
  if (r) console.info(`gameWE: passkey "${r.name}" deleted by ${user.username}`);
  redirect(`/admin/account?pk=${r ? "deleted" : "unknown"}#passkeys`);
}

export async function passkeyOnlyAction(form: FormData) {
  const user = await requireAdmin();
  const on = form.getAll("only").map(String).includes("1");
  if (on && (await listPasskeys(user.username)).length === 0) redirect("/admin/account?pk=few#passkeys");
  await setPasskeyOnly(user.username, on);
  console.info(`gameWE: sign-in ${on ? "only with a passkey" : "with a passkey or the password"} for ${user.username}`);
  redirect(`/admin/account?pk=${on ? "only" : "any"}#passkeys`);
}

// Own password (Mein Konto).
export async function changePasswordAction(form: FormData) {
  const user = await requireAdmin();
  const next = String(form.get("next") ?? "");
  if (next !== String(form.get("repeat") ?? "")) redirect("/admin/account?pw=mismatch");
  const r = await changePassword(user.username, String(form.get("current") ?? ""), next);
  // Whoever had the old password may have made a token with it.
  if (r === "ok") await purgeTokens(user.username);
  redirect(`/admin/account?pw=${r === "ok" ? "saved" : r}`);
}

// API tokens of the signed-in user's own account (lib/api-tokens.ts): a new
// one needs the password and, with TOTP, the current code. The plain token
// goes back to the form once (never into a URL, cookie or log). With
// the API off both actions refuse, like the hidden section.
export type TokenFormState = { token?: string; name?: string; error?: "name" | "scope" | "expiry" | "wrong" | "code" | "blocked" | "nosecret" | "limit" | "long" | "disabled"; at?: number };

export async function createApiTokenAction(_prev: TokenFormState, form: FormData): Promise<TokenFormState> {
  const user = await requireAdmin();
  const at = Date.now();
  if (!(await apiEnabled())) return { error: "disabled", at };
  const name = tokenName(form.get("name"));
  if (!name) return { error: "name", at };
  const scopes = tokenScopes(form.getAll("scope"));
  if (!scopes) return { error: "scope", at };
  const days = expiryDays(form.get("expiry"));
  if (days === null) return { error: "expiry", at };
  const ok = await confirmIdentity(user.username, String(form.get("password") ?? ""), String(form.get("code") ?? ""));
  if (ok !== "ok") return { error: ok, at };
  const res = await createToken(user.username, name, scopes, days);
  if ("error" in res) return { error: res.error, at };
  console.info(`gameWE: API token "${name}" (${scopes.join(", ")}) created by ${user.username}${days ? `, expires in ${days} days` : ""}`);
  revalidatePath("/admin/account");
  return { token: res.token, name, at };
}

export async function revokeApiTokenAction(form: FormData) {
  const user = await requireAdmin();
  if (!(await apiEnabled())) redirect("/admin/account?token=disabled#api-tokens");
  const r = await revokeToken(user.username, String(form.get("id") ?? ""));
  if (r) console.info(`gameWE: API token "${r.name}" revoked by ${user.username}`);
  redirect(`/admin/account?token=${r ? "revoked" : "unknown"}#api-tokens`);
}

// Ranking reset (lib/reset.ts): right resets, confirmed in the dialog of the
// reset page (the ranking's code typed, then its confirm button).
export async function resetRankingAction(form: FormData) {
  const user = await requirePerm("resets");
  const game = String(form.get("game") ?? "");
  const mode = resetMode(form.get("mode"));
  // Only rankings with servers: templates are never reset.
  const games = await resettableRankings();
  if (!games.some(([code]) => code === game) || !mode) redirect("/admin/reset?error=input");
  if (form.get("confirmed") !== "yes" || String(form.get("typed") ?? "").trim().toLowerCase() !== game.toLowerCase()) {
    redirect(`/admin/reset?error=confirm&game=${encodeURIComponent(game)}`);
  }
  let job: { id: number; existing: boolean };
  try {
    job = await resetRanking({ user }, game, mode);
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    if (err.code === "db") redirect(`/admin/reset?error=db&game=${encodeURIComponent(game)}`);
    if (err.code === "notfound" || err.code === "template") redirect("/admin/reset?error=input");
    redirect("/admin/reset");
  }
  redirect(`/admin/reset?job=${job.id}${job.existing ? "&existing=1" : ""}`);
}

// Bot settings of one ranking (lib/admin-ranking-bots.ts), on the ranking's
// admin page: right rankings.edit. Switching the ranking of bots also shows or hides
// the ranking's existing bots.
export async function rankingBotsAction(form: FormData) {
  const user = await requirePerm("rankings.edit");
  const game = String(form.get("game") ?? "");
  // The switches send a hidden 0 and, when on, a 1 as well.
  const on = (name: string) => form.getAll(name).map(String).includes("1");
  let n: number;
  try {
    n = await setRankingBots({ user }, game, { ranked: on("ranked"), points: on("points"), kills: on("kills"), stats: on("stats") });
  } catch (err) {
    if (err instanceof OpError) redirect("/admin/rankings");
    throw err;
  }
  redirect(`/admin/rankings/${encodeURIComponent(game)}?bots=saved${n ? `&n=${n}` : ""}#bots`);
}

// The VAC block of one ranking (gamewe_block_vac_<game>), on the ranking's
// admin page: right rankings.edit.
export async function rankingVacAction(form: FormData) {
  const user = await requirePerm("rankings.edit");
  const game = String(form.get("game") ?? "");
  // The switch sends a hidden 0 and, when on, a 1 as well.
  try {
    await setRankingVac({ user }, game, form.getAll("block").map(String).includes("1"));
  } catch (err) {
    if (err instanceof OpError) redirect("/admin/rankings");
    throw err;
  }
  redirect(`/admin/rankings/${encodeURIComponent(game)}?vac=saved#vac`);
}

// The FastDL address of one ranking (gamewe_fastdl_url_<game>), on the ranking's
// admin page: right rankings.edit.
export async function rankingFastdlAction(form: FormData) {
  const user = await requirePerm("rankings.edit");
  const game = String(form.get("game") ?? "");
  const page = `/admin/rankings/${encodeURIComponent(game)}`;
  try {
    await setRankingFastdl({ user }, game, String(form.get("url") ?? ""));
    const access = Object.fromEntries(FASTDL_ACCESS.map((f) => [f, String(form.get(f) ?? "")]));
    await setRankingFastdlAccess({ user }, game, access, FASTDL_ACCESS.filter((f) => form.get(`${f}__clear`) === "1"));
  } catch (err) {
    if (err instanceof OpError) redirect(err.code !== "field" ? "/admin/rankings" : err.detail.field === "url" ? `${page}?fastdl=bad#fastdl` : `${page}?fastdl=bad-${encodeURIComponent(err.detail.field ?? "")}#fastdl`);
    throw err;
  }
  redirect(`${page}?fastdl=saved#fastdl`);
}

// Scheduled ranking reset and hall of fame of one ranking (lib/admin-hall.ts),
// on the ranking's admin page: right resets. Turning a schedule on or changing
// it must be confirmed (the ranking is then reset at the end of every period).
export async function hallOfFameSettingsAction(form: FormData) {
  const user = await requirePerm("resets");
  const game = String(form.get("game") ?? "");
  const back = `/admin/rankings/${encodeURIComponent(game)}`;
  try {
    await setRankingHall({ user }, game, String(form.get("source") ?? ""), resetMode(form.get("mode")), String(form.get("page") ?? ""), form);
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    if (err.code === "notfound" || err.code === "template") redirect("/admin/rankings");
    redirect(`${back}?hof=${err.code === "table" ? "table" : err.code === "confirm" ? "confirm" : "input"}#hall-of-fame`);
  }
  redirect(`${back}?hof=saved#hall-of-fame`);
}

// The reset schedule for all rankings (Admin > Rankings).
export async function globalHallAction(form: FormData) {
  const user = await requirePerm("resets");
  const back = "/admin/reset";
  const enabled = form.get("enabled") === "yes";
  try {
    await setGlobalHall({ user }, enabled, resetMode(form.get("mode")), form);
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    redirect(`${back}?hof=${err.code === "confirm" ? "confirm" : "input"}#hall-of-fame`);
  }
  redirect(`${back}?hof=${enabled ? "on" : "off"}#hall-of-fame`);
}

// Removes or brings back hall of fame entries: one place, or a whole period
// (place empty).
export async function hallEntryAction(form: FormData) {
  const user = await requirePerm("resets");
  const game = String(form.get("game") ?? "");
  const back = `/admin/rankings/${encodeURIComponent(game)}/hall-of-fame`;
  const start = String(form.get("start") ?? "");
  const placeRaw = String(form.get("place") ?? "");
  const op = String(form.get("op") ?? "");
  try {
    await setHallEntry({ user }, game, start, placeRaw === "" ? null : Number(placeRaw), op, form.get("confirm") === "yes");
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    if (err.code === "notfound") redirect("/admin/rankings");
    redirect(err.code === "confirm" ? `${back}?hof=confirm#p-${start}` : `${back}?hof=input`);
  }
  redirect(`${back}?hof=${op === "remove" ? "removed" : "restored"}#p-${start}`);
}

// The stored value of one secret for its eye button (SecretControl), loaded
// only on click and only for an admin allowed to change it; never part of
// the page. ref: "entity:<entity>:<id>:<field>", "setting:<key>" or
// "fastdl:<ranking>:<field>". A value only from the environment stays hidden.
export async function revealSecretAction(ref: string): Promise<string> {
  await requireAdmin();
  const [kind, a = "", b = "", c = ""] = ref.split(":");
  if (kind === "entity") {
    const e = getEntity(a);
    if (!e?.fields.some((f) => f.name === c && f.type === "secret")) return "";
    await requirePerm(e.perm.edit);
    const [row] = await adminQuery<{ v: string | null }>(`SELECT ${c} AS v FROM ${e.table} WHERE ${e.pk} = ?`, [b]);
    return row?.v ?? "";
  }
  if (kind === "setting") {
    const s = allSettings.find((x) => x.key === a && x.type === "secret");
    if (!s) return "";
    await requirePerm(s.minLevel ? "settings.protected" : "settings.edit");
    return (await secretOptions())[a] ?? "";
  }
  if (kind === "fastdl" && ACCESS_SECRETS.includes(b as AccessField)) {
    await requirePerm("rankings.edit");
    const key = accessKey(b as AccessField, a);
    return (await secretsOf([key]))[key] ?? "";
  }
  return "";
}

// Admin roles (Settings → Admin roles, level 100 only): create or change one
// (name and rights), or delete one no admin has.
export async function saveRoleAction(form: FormData) {
  const user = await requirePerm("admin");
  const raw = String(form.get("id") ?? "");
  const id = raw === "new" ? null : raw;
  let saved: string;
  try {
    saved = await saveRole({ user }, id, form.get("name"), normalizePerms(form.getAll("perm").map(String)));
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    if (err.code === "notfound") redirect("/admin/admin-roles");
    redirect(`/admin/admin-roles/${encodeURIComponent(raw)}?error=${err.code}`);
  }
  redirect(`/admin/admin-roles/${encodeURIComponent(saved)}?saved=1`);
}

export async function deleteRoleAction(form: FormData) {
  const user = await requirePerm("admin");
  const id = String(form.get("id") ?? "");
  if (form.get("confirm") !== "1") redirect(`/admin/admin-roles/${encodeURIComponent(id)}`);
  try {
    await deleteRole({ user }, id);
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    if (err.code === "inuse") redirect(`/admin/admin-roles/${encodeURIComponent(id)}?error=inuse`);
    redirect("/admin/admin-roles");
  }
  redirect("/admin/admin-roles?deleted=1");
}
