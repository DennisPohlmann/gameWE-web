"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sourcebansBase } from "@/lib/sourcebans";
import { getEntity } from "@/lib/admin-entities";
import { deleteRow, getRow, InputError, isDuplicateKey, keptValues, optionList, otherServerAt, rawOptions, saveRow, withColumns } from "@/lib/admin-data";
import { allServers, assignServers, copyDefinitions, rankingBaseGames } from "@/lib/admin-rankings";
import { baseGameOf, sameBaseGame } from "@/lib/games";
import { RAW_GROUP, READONLY_OPTIONS, homeValue, linkValue, rawKeyAllowed, settingGroups } from "@/lib/admin-settings";
import { headerOrder } from "@/lib/header-links";
import { ADMIN_THEME_COOKIE, isAdminTheme } from "@/lib/admin-theme";
import { basePath } from "@/lib/base-path";
import { canonicalIp } from "@/lib/ip";
import { LEVEL_ADMIN, adminSecret, cookieSecure, cancelPendingLogin, changePassword, login, loginCode, logout, requireAdmin } from "@/lib/auth";
import { adminExec, adminQuery, upsert } from "@/lib/db";
import { imageUrl, invalidateSettings } from "@/lib/settings";
import { steamKey } from "@/lib/config";
import { invalidateSteamKey } from "@/lib/steam";
import { listTemplates } from "@/lib/templates";
import { jobsAvailable, queueReset, resetMode } from "@/lib/reset";
import { hallSettings, saveHallSettings } from "@/lib/admin-hall";
import { invalidateHallOfFame } from "@/lib/hall-of-fame";
import { MAX_EVERY, parseSchedule, scheduleValue } from "@/lib/hall-period";
import { addParams, safeReturnTo, withReturnTo } from "@/lib/return-to";
import { discordGuild, discordInvite, tsDisplay, tsHost, tsLink } from "@/lib/voice";
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
  if (id === null && !e.canCreate) redirect(list);
  if (id !== null && !(await getRow(e, id))) redirect(list);
  if (e.key === "users" && id === user.username && Number(form.get("acclevel")) < LEVEL_ADMIN && user.acclevel >= LEVEL_ADMIN) {
    redirect(editHref(e.key, id, form, { error: "self" }));
  }
  // A server only moves into a ranking of the same base game.
  if (e.key === "servers" && id !== null) {
    const row = await getRow(e, id);
    const from = String(row?.game ?? "").trim();
    const to = String(form.get("game") ?? "").trim();
    const bases = await rankingBaseGames();
    if (from !== to && !sameBaseGame(bases.get(from) ?? null, bases.get(to) ?? null)) {
      redirect(editHref(e.key, id, form, { error: "mismatch" }));
    }
  }
  // One server per IP and port: point to the existing one instead of the
  // database's duplicate key error, and keep the input of a new server.
  const kept = e.key === "servers" && id === null ? keptValues(e, form) : {};
  if (e.key === "servers") {
    const address = canonicalIp(String(form.get("address") ?? "").trim());
    const port = Number(String(form.get("port") ?? "").trim());
    if (address && Number.isInteger(port)) {
      const other = await otherServerAt(address, port, id);
      if (other !== null) redirect(editHref(e.key, rawId, form, { error: "duplicate", dup: String(other), ...kept }));
    }
  }
  let saved: string;
  try {
    saved = await saveRow(e, id, form);
  } catch (err) {
    if (err instanceof InputError) redirect(editHref(e.key, rawId, form, { error: "field", field: err.message, ...kept }));
    // Another admin saved the same IP and port in the meantime.
    if (e.key === "servers" && isDuplicateKey(err)) redirect(editHref(e.key, rawId, form, { error: "duplicate", ...kept }));
    const msg = err instanceof Error ? err.message.slice(0, 200) : "?";
    console.error("admin save:", err);
    redirect(editHref(e.key, rawId, form, { error: "db", msg }));
  }
  // A new ranking takes the definitions of its template.
  if (e.key === "games" && id === null) {
    const template = String(form.get("template") ?? "");
    const code = String(form.get("code") ?? "").trim();
    if (template && (await optionList("games")).some(([v]) => v === template)) {
      try {
        await copyDefinitions(code, template);
        // Only where the database has the column.
        const base = e.fields.some((f) => f.name === "realgame") ? (await rankingBaseGames()).get(template) : null;
        if (base) await adminExec(`UPDATE hlstats_Games SET realgame = ? WHERE code = ? AND (realgame IS NULL OR realgame = '')`, [base, code]);
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 200) : "?";
        console.error("admin copy definitions:", err);
        redirect(editHref(e.key, saved, form, { error: "db", msg }));
      }
    }
  }
  redirect(editHref(e.key, saved, form, { saved: "1" }));
}

// Moves servers into a ranking (edit page of the ranking).
export async function assignServersAction(form: FormData) {
  await requireAdmin(100);
  const gameId = String(form.get("__id") ?? "");
  const e = await withColumns(getEntity("games")!);
  const row = await getRow(e, gameId);
  if (!row) redirect(safeReturnTo(form.get("__returnTo"), "games"));
  const [servers, bases] = await Promise.all([allServers(), rankingBaseGames()]);
  const code = String(row.code).trim();
  const base = bases.get(code) ?? null;
  const known = new Map(servers.map((s) => [s.serverId, s]));
  const ids = form.getAll("server").map((v) => Number(v)).filter((n) => known.has(n));
  // A server only moves into a ranking of the same base game.
  if (ids.some((n) => !sameBaseGame(bases.get(known.get(n)!.game) ?? null, base))) {
    redirect(editHref("games", gameId, form, { error: "mismatch" }));
  }
  try {
    await assignServers(code, ids);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : "?";
    redirect(editHref("games", gameId, form, { error: "db", msg }));
  }
  redirect(editHref("games", gameId, form, { saved: "1" }));
}

// Takes one server out of a ranking by moving it into another one.
export async function moveServerAction(form: FormData) {
  await requireAdmin(100);
  const gameId = String(form.get("__id") ?? "");
  const serverId = Number(form.get("server"));
  const target = String(form.get("target") ?? "").trim();
  const [servers, games, bases] = await Promise.all([allServers(), optionList("games"), rankingBaseGames()]);
  const server = servers.find((s) => s.serverId === serverId);
  if (!server || !games.some(([code]) => code === target)) redirect(editHref("games", gameId, form));
  if (!sameBaseGame(bases.get(server.game) ?? null, bases.get(target) ?? null)) redirect(editHref("games", gameId, form, { error: "mismatch" }));
  try {
    await assignServers(target, [serverId]);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : "?";
    redirect(editHref("games", gameId, form, { error: "db", msg }));
  }
  redirect(editHref("games", gameId, form, { saved: "1" }));
}

export async function deleteAction(form: FormData) {
  const e = await entityFrom(form);
  const user = await requireAdmin(e.minLevel);
  const id = String(form.get("__id") ?? "");
  if (!e.canDelete || form.get("confirm") !== "1" || !(await getRow(e, id))) redirect(editHref(e.key, id, form));
  if (e.key === "users" && id === user.username) redirect(editHref(e.key, id, form, { error: "self" }));
  try {
    await deleteRow(e, id);
    if (e.key === "users") await Promise.all([removeSecret(id, false), removeSecret(id, true)]);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : "?";
    redirect(editHref(e.key, id, form, { error: "db", msg }));
  }
  redirect(addParams(safeReturnTo(form.get("__returnTo"), e.key), { deleted: "1" }));
}

function badField(group: string, field: string): never {
  redirect(`/admin/settings/${group}?field=${encodeURIComponent(field)}`);
}

// One settings page (/admin/settings/<group>) is one form: only the settings
// of that group, or on the raw page the raw rows, are read and written.
export async function saveSettingsAction(form: FormData) {
  const user = await requireAdmin();
  const groupSent = String(form.get("group") ?? "");
  const group = settingGroups.find((g) => g.id === groupSent);
  const isRaw = groupSent === RAW_GROUP;
  if (!group && !isRaw) redirect("/admin/settings");
  const page = group?.id ?? RAW_GROUP;
  const bad: (field: string) => never = (field) => badField(page, field);
  const items = group?.items ?? [];
  const values: [string, string][] = [];
  for (const s of items) {
    if (s.minLevel !== undefined && user.acclevel < s.minLevel) {
      // Read-only for this admin: a sent value is refused, nothing is written.
      if (form.get(s.key) || form.get(`${s.key}__clear`)) bad(s.key);
      continue;
    }
    if (s.type === "order") {
      // Sent by the header links list; without it the stored order stays.
      const v = form.get(s.key);
      if (v !== null) values.push([s.key, headerOrder(String(v)).join(",")]);
      continue;
    }
    if (s.type === "home") {
      const v = homeValue(String(form.get(`${s.key}__label`) ?? ""), String(form.get(`${s.key}__url`) ?? ""));
      if (v === null) bad(s.key);
      values.push([s.key, v]);
      continue;
    }
    if (s.type === "link") {
      const v = linkValue(String(form.get(`${s.key}__label`) ?? ""), String(form.get(`${s.key}__url`) ?? ""));
      if (v === null) bad(s.key);
      values.push([s.key, v]);
      continue;
    }
    if (s.type === "secret") {
      // Empty keeps the stored value; the checkbox clears it.
      const v = String(form.get(s.key) ?? "");
      if (form.get(`${s.key}__clear`) === "1") values.push([s.key, ""]);
      else if (v) {
        if (v.length > 255 || /[\r\n]/.test(v)) bad(s.key);
        if (s.key === "gamewe_steam_api_key" && !steamKey(v)) bad(s.key);
        values.push([s.key, s.key === "gamewe_steam_api_key" ? v.trim() : v]);
      }
      continue;
    }
    if (s.type === "bool") {
      // A switch: the hidden "0" always, "1" as well when it is on.
      const sent = form.getAll(s.key).map(String);
      if (!sent.length || sent.some((x) => x !== "0" && x !== "1")) bad(s.key);
      values.push([s.key, sent.includes("1") ? "1" : "0"]);
      continue;
    }
    const v = String(form.get(s.key) ?? "").trim();
    if (s.type === "number") {
      const n = Number(v);
      if (!v || !Number.isInteger(n) || (s.min !== undefined && n < s.min) || (s.max !== undefined && n > s.max)) {
        bad(s.key);
      }
    } else if (
      (s.type === "choice" && !s.choices?.some(([c]) => c === v)) ||
      (s.type === "template" && !(await listTemplates()).some((t) => t.id === v))
    ) {
      bad(s.key);
    } else if (v.length > 255) {
      bad(s.key);
    } else if (s.key === "gamewe_ts_host" && v) {
      const host = tsHost(v);
      if (!host) bad(s.key);
      values.push([s.key, host]);
      continue;
    } else if ((s.key === "gamewe_ts_display" && v && !tsDisplay(v)) || (s.key === "gamewe_ts_link" && v && !tsLink(v))) {
      bad(s.key);
    } else if (s.key === "gamewe_discord_invite" && v) {
      const invite = discordInvite(v);
      if (!invite) bad(s.key);
      values.push([s.key, invite]);
      continue;
    } else if (s.key === "gamewe_discord_guild" && v && !discordGuild(v)) {
      bad(s.key);
    } else if ((s.key === "gamewe_header_logo" || s.key === "gamewe_favicon" || s.key === "gamewe_apple_icon") && v && !imageUrl(v)) {
      bad(s.key);
    } else if ((s.key === "gamewe_title_format" || s.key === "gamewe_title_ranking") && !v.includes("{page}")) {
      bad(s.key);
    } else if (s.key === "gamewe_sourcebans_url" && v) {
      const base = sourcebansBase(v);
      if (!base) bad(s.key);
      values.push([s.key, base]);
      continue;
    }
    values.push([s.key, v]);
  }
  const removed: string[] = [];
  if (isRaw) {
    // Other keys (raw values): the form sends each key with its index; only
    // keys that exist as raw rows are written or deleted.
    const rawKeys = new Set((await rawOptions()).map((r) => r.keyname));
    for (const [name, entry] of form.entries()) {
      const m = /^raw_key_(\d{1,4})$/.exec(name);
      if (!m) continue;
      const key = String(entry);
      if (!rawKeys.has(key) || READONLY_OPTIONS.includes(key)) continue;
      if (form.get(`raw_del_${m[1]}`) === "1") {
        removed.push(key);
        continue;
      }
      const v = String(form.get(`raw_val_${m[1]}`) ?? "");
      if (v.length > 255 || /[\r\n]/.test(v)) bad(`raw:${key}`);
      values.push([key, v]);
    }
    const newKey = String(form.get("raw_new_key") ?? "").trim();
    if (newKey) {
      const v = String(form.get("raw_new_val") ?? "");
      if (!rawKeyAllowed(newKey) || rawKeys.has(newKey) || v.length > 255 || /[\r\n]/.test(v)) bad("raw_new");
      const exists = await adminQuery(`SELECT keyname FROM hlstats_Options WHERE keyname = ?`, [newKey]);
      if (exists.length) bad("raw_new");
      values.push([newKey, v]);
    }
  }
  for (const [k, v] of values) {
    await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [k, v]);
  }
  for (const k of removed) await adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [k]);
  invalidateSettings();
  invalidateSteamKey();
  redirect(`/admin/settings/${page}?saved=1`);
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

// Ranking reset (lib/reset.ts): admins only, confirmed in the dialog of the
// reset page (the checkbox "deleted for good" and its confirm button).
export async function resetRankingAction(form: FormData) {
  const user = await requireAdmin(LEVEL_ADMIN);
  const game = String(form.get("game") ?? "");
  const mode = resetMode(form.get("mode"));
  const games = await optionList("games");
  if (!games.some(([code]) => code === game) || !mode) redirect("/admin/reset?error=input");
  if (form.get("confirmed") !== "yes" || form.get("understood") !== "yes") {
    redirect(`/admin/reset?error=confirm&game=${encodeURIComponent(game)}`);
  }
  if (!(await jobsAvailable())) redirect("/admin/reset");
  let job: { id: number; existing: boolean };
  try {
    job = await queueReset(game, mode, user.username);
  } catch (e) {
    console.error(`gameWE: reset job for ${game} not queued: ${e instanceof Error ? e.message : e}`);
    redirect(`/admin/reset?error=db&game=${encodeURIComponent(game)}`);
  }
  console.info(`gameWE: reset of ranking ${game} (${mode}) queued as job ${job.id} by ${user.username}${job.existing ? " (already queued)" : ""}`);
  redirect(`/admin/reset?job=${job.id}${job.existing ? "&existing=1" : ""}`);
}

// Scheduled ranking reset and hall of fame of one ranking (lib/admin-hall.ts),
// on the ranking's admin page: admins only. Turning a schedule on or changing
// it must be confirmed (the ranking is then reset at the end of every period).
export async function hallOfFameSettingsAction(form: FormData) {
  const user = await requireAdmin(LEVEL_ADMIN);
  const game = String(form.get("game") ?? "");
  const games = await optionList("games");
  if (!games.some(([code]) => code === game)) redirect("/admin/rankings");
  const back = `/admin/rankings/${encodeURIComponent(game)}`;
  const unit = String(form.get("unit") ?? "");
  const every = Number(form.get("every") ?? 1);
  const mode = resetMode(form.get("mode"));
  const page = String(form.get("page") ?? "");
  let schedule = "";
  if (unit !== "off") {
    const s = Number.isInteger(every) && every >= 1 && every <= MAX_EVERY ? parseSchedule(`${every} ${unit}`) : null;
    if (!s) redirect(`${back}?hof=input#hall-of-fame`);
    schedule = scheduleValue(s);
  }
  if (!mode || (page !== "auto" && page !== "on" && page !== "off")) redirect(`${back}?hof=input#hall-of-fame`);
  const now = await hallSettings(game);
  if (!now.table) redirect(`${back}?hof=table#hall-of-fame`);
  const changed = schedule !== scheduleValue(now.schedule) || (schedule && mode !== now.mode);
  if (schedule && changed && form.get("understood") !== "yes") redirect(`${back}?hof=confirm#hall-of-fame`);
  await saveHallSettings(game, schedule, mode, page);
  invalidateHallOfFame();
  console.info(`gameWE: reset schedule of ranking ${game} set to ${schedule || "off"}${schedule ? ` (${mode})` : ""}, hall of fame page ${page}, by ${user.username}`);
  redirect(`${back}?hof=saved#hall-of-fame`);
}
