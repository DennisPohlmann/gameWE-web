"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getEntity } from "@/lib/admin-entities";
import { getRow, keptValues, optionList, withColumns } from "@/lib/admin-data";
import { OpError, assignServersTo, deleteEntity, moveServer, resetRanking, saveEntity, savePrivacy, saveSettings, setGlobalHall, setHallEntry, setRankingBots, setRankingHall, setRankingVac } from "@/lib/admin-ops";
import { ADMIN_THEME_COOKIE, isAdminTheme } from "@/lib/admin-theme";
import { basePath } from "@/lib/base-path";
import { expiryDays, tokenName } from "@/lib/api-token-core";
import { createToken, revokeToken } from "@/lib/api-tokens";
import { apiEnabled } from "@/lib/api-switch";
import { LEVEL_ADMIN, adminSecret, confirmIdentity, cookieSecure, cancelPendingLogin, changePassword, login, loginCode, logout, requireAdmin } from "@/lib/auth";
import { resetMode } from "@/lib/reset";
import { addParams, safeReturnTo, withReturnTo } from "@/lib/return-to";
import { rankingPageHref, resettableRankings } from "@/lib/admin-rankings";
import { presetRanking, rankingServersHref } from "@/lib/ranking-preset";
import { checkCode, consumeStep, newSecret, readSecret, removeSecret, storeSecret } from "@/lib/totp";

export async function loginAction(form: FormData) {
  const res = await login(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
  if (res === "totp") redirect("/admin/login?step=code");
  if (res !== "ok") redirect(`/admin/login?error=${res}`);
  redirect("/admin");
}

export async function loginCodeAction(form: FormData) {
  const res = await loginCode(String(form.get("code") ?? ""));
  if (res === "code") redirect("/admin/login?step=code&error=code");
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
  const user = await requireAdmin(e.minLevel);
  const rawId = String(form.get("__id") ?? "");
  const id = rawId === "new" ? null : rawId;
  const list = safeReturnTo(form.get("__returnTo"), e.key);
  // A new server from a ranking's page ("Add server") goes into that ranking
  // (only an existing one) and the save returns there.
  const ranking = e.key === "servers" && id === null ? presetRanking(form.get("__ranking"), (await optionList("games")).map(([c]) => c)) : null;
  // The input of a new server is kept after an error.
  const kept = e.key === "servers" && id === null ? { ...keptValues(e, form), game: ranking ?? undefined } : {};
  // A ranking is edited on its own page; its errors and the saved notice go
  // to the settings card there.
  const ownPage = e.key === "games" && id !== null;
  const back = async (params: Record<string, string | undefined>) => (ownPage ? rankingPageHref(rawId, params, "settings") : editHref(e.key, rawId, form, params));
  let saved: string;
  try {
    saved = await saveEntity({ user }, e, id, form, { ranking });
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    const c = err.code;
    if (c === "cannot" || c === "notfound") redirect(list);
    if (c === "self" || c === "mismatch" || c === "password") redirect(await back({ error: c }));
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
  const user = await requireAdmin(100);
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
  const user = await requireAdmin(100);
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
  const user = await requireAdmin(e.minLevel);
  const id = String(form.get("__id") ?? "");
  if (form.get("confirm") !== "1") redirect(editHref(e.key, id, form));
  try {
    await deleteEntity({ user }, e, id);
  } catch (err) {
    if (!(err instanceof OpError)) throw err;
    if (err.code === "self") redirect(editHref(e.key, id, form, { error: "self" }));
    if (err.code === "db") redirect(editHref(e.key, id, form, { error: "db", msg: err.detail.msg ?? "?" }));
    redirect(editHref(e.key, id, form));
  }
  redirect(addParams(safeReturnTo(form.get("__returnTo"), e.key), { deleted: "1" }));
}

// One settings page (/admin/settings/<group>) is one form: only the settings
// of that group, or on the raw page the raw rows, are read and written.
export async function saveSettingsAction(form: FormData) {
  const user = await requireAdmin();
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
  const user = await requireAdmin();
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

export async function totpStartAction() {
  const { user, secret } = await totpUser();
  if ((await readSecret(user, secret)) === null) await storeSecret(user, newSecret(), secret, true);
  redirect("/admin/account");
}

export async function totpCancelAction() {
  const { user } = await totpUser();
  await removeSecret(user, true);
  redirect("/admin/account");
}

export async function totpConfirmAction(form: FormData) {
  const { user, secret } = await totpUser();
  const pending = await readSecret(user, secret, true);
  const step = pending ? checkCode(pending, String(form.get("code") ?? "")) : null;
  if (!pending || step === null || !consumeStep(user, step)) redirect("/admin/account?error=code");
  await storeSecret(user, pending, secret, false);
  await removeSecret(user, true);
  redirect("/admin/account?done=on");
}

export async function totpDisableAction(form: FormData) {
  const { user, secret } = await totpUser();
  const active = await readSecret(user, secret);
  const step = active ? checkCode(active, String(form.get("code") ?? "")) : null;
  if (step === null || !consumeStep(user, step)) redirect("/admin/account?error=code");
  await removeSecret(user, false);
  redirect("/admin/account?done=off");
}

// Own password (Mein Konto).
export async function changePasswordAction(form: FormData) {
  const user = await requireAdmin();
  const next = String(form.get("next") ?? "");
  if (next !== String(form.get("repeat") ?? "")) redirect("/admin/account?pw=mismatch");
  const r = await changePassword(user.username, String(form.get("current") ?? ""), next);
  redirect(`/admin/account?pw=${r === "ok" ? "saved" : r}`);
}

// API tokens of the signed-in user's own account (lib/api-tokens.ts): a new
// one needs the password and, with TOTP, the current code. The plain token
// goes back to the form once (never into a URL, cookie or log). With
// API_ENABLED=off both actions refuse, like the hidden section.
export type TokenFormState = { token?: string; name?: string; error?: "name" | "expiry" | "wrong" | "code" | "blocked" | "nosecret" | "limit" | "long" | "disabled"; at?: number };

export async function createApiTokenAction(_prev: TokenFormState, form: FormData): Promise<TokenFormState> {
  const user = await requireAdmin();
  const at = Date.now();
  if (!apiEnabled()) return { error: "disabled", at };
  const name = tokenName(form.get("name"));
  if (!name) return { error: "name", at };
  const days = expiryDays(form.get("expiry"));
  if (days === null) return { error: "expiry", at };
  const ok = await confirmIdentity(user.username, String(form.get("password") ?? ""), String(form.get("code") ?? ""));
  if (ok !== "ok") return { error: ok, at };
  const res = await createToken(user.username, name, days);
  if ("error" in res) return { error: res.error, at };
  console.info(`gameWE: API token "${name}" created by ${user.username}${days ? `, expires in ${days} days` : ""}`);
  revalidatePath("/admin/account");
  return { token: res.token, name, at };
}

export async function revokeApiTokenAction(form: FormData) {
  const user = await requireAdmin();
  if (!apiEnabled()) redirect("/admin/account?token=disabled#api-tokens");
  const r = await revokeToken(user.username, String(form.get("id") ?? ""));
  if (r) console.info(`gameWE: API token "${r.name}" revoked by ${user.username}`);
  redirect(`/admin/account?token=${r ? "revoked" : "unknown"}#api-tokens`);
}

// Ranking reset (lib/reset.ts): admins only, confirmed in the dialog of the
// reset page (the checkbox "deleted for good" and its confirm button).
export async function resetRankingAction(form: FormData) {
  const user = await requireAdmin(LEVEL_ADMIN);
  const game = String(form.get("game") ?? "");
  const mode = resetMode(form.get("mode"));
  // Only rankings with servers: templates are never reset.
  const games = await resettableRankings();
  if (!games.some(([code]) => code === game) || !mode) redirect("/admin/reset?error=input");
  if (form.get("confirmed") !== "yes" || form.get("understood") !== "yes") {
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
// admin page: admins only. Switching the ranking of bots also shows or hides
// the ranking's existing bots.
export async function rankingBotsAction(form: FormData) {
  const user = await requireAdmin(LEVEL_ADMIN);
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
// admin page: admins only.
export async function rankingVacAction(form: FormData) {
  const user = await requireAdmin(LEVEL_ADMIN);
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

// Scheduled ranking reset and hall of fame of one ranking (lib/admin-hall.ts),
// on the ranking's admin page: admins only. Turning a schedule on or changing
// it must be confirmed (the ranking is then reset at the end of every period).
export async function hallOfFameSettingsAction(form: FormData) {
  const user = await requireAdmin(LEVEL_ADMIN);
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
  const user = await requireAdmin(LEVEL_ADMIN);
  const back = "/admin/rankings";
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
  const user = await requireAdmin(LEVEL_ADMIN);
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
