"use server";

import { redirect } from "next/navigation";
import { sourcebansBase } from "@/lib/sourcebans";
import { getEntity } from "@/lib/admin-entities";
import { deleteRow, getRow, InputError, optionList, saveRow, withColumns } from "@/lib/admin-data";
import { allServers, assignServers, copyDefinitions, rankingBaseGames } from "@/lib/admin-rankings";
import { baseGameOf, sameBaseGame } from "@/lib/games";
import { allSettings, linkValue } from "@/lib/admin-settings";
import { LEVEL_ADMIN, adminSecret, cancelPendingLogin, changePassword, login, loginCode, logout, requireAdmin } from "@/lib/auth";
import { adminExec, upsert } from "@/lib/db";
import { imageUrl, invalidateSettings } from "@/lib/settings";
import { listTemplates } from "@/lib/templates";
import { jobsAvailable, queueReset } from "@/lib/reset";
import { discordGuild, discordInvite, tsCountry, tsDisplay, tsHost, tsLink } from "@/lib/voice";
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

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
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
  if (id === null && !e.canCreate) redirect(`/admin/${e.key}`);
  if (id !== null && !(await getRow(e, id))) redirect(`/admin/${e.key}`);
  if (e.key === "users" && id === user.username && Number(form.get("acclevel")) < LEVEL_ADMIN && user.acclevel >= LEVEL_ADMIN) {
    redirect(`/admin/${e.key}/${encodeURIComponent(id)}?error=self`);
  }
  // A server only moves into a ranking of the same base game.
  if (e.key === "servers" && id !== null) {
    const row = await getRow(e, id);
    const from = String(row?.game ?? "").trim();
    const to = String(form.get("game") ?? "").trim();
    const bases = await rankingBaseGames();
    if (from !== to && !sameBaseGame(bases.get(from) ?? null, bases.get(to) ?? null)) {
      redirect(`/admin/${e.key}/${encodeURIComponent(id)}?error=mismatch`);
    }
  }
  let saved: string;
  try {
    saved = await saveRow(e, id, form);
  } catch (err) {
    const back = `/admin/${e.key}/${encodeURIComponent(rawId)}`;
    if (err instanceof InputError) redirect(`${back}?error=field&field=${encodeURIComponent(err.message)}`);
    const msg = err instanceof Error ? err.message.slice(0, 200) : "?";
    console.error("admin save:", err);
    redirect(`${back}?error=db&msg=${encodeURIComponent(msg)}`);
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
        redirect(`/admin/${e.key}/${encodeURIComponent(saved)}?error=db&msg=${encodeURIComponent(msg)}`);
      }
    }
  }
  redirect(`/admin/${e.key}/${encodeURIComponent(saved)}?saved=1`);
}

// Moves servers into a ranking (edit page of the ranking).
export async function assignServersAction(form: FormData) {
  await requireAdmin(100);
  const gameId = String(form.get("__id") ?? "");
  const e = await withColumns(getEntity("games")!);
  const row = await getRow(e, gameId);
  if (!row) redirect("/admin/games");
  const [servers, bases] = await Promise.all([allServers(), rankingBaseGames()]);
  const code = String(row.code).trim();
  const base = bases.get(code) ?? null;
  const known = new Map(servers.map((s) => [s.serverId, s]));
  const ids = form.getAll("server").map((v) => Number(v)).filter((n) => known.has(n));
  // A server only moves into a ranking of the same base game.
  if (ids.some((n) => !sameBaseGame(bases.get(known.get(n)!.game) ?? null, base))) {
    redirect(`/admin/games/${encodeURIComponent(gameId)}?error=mismatch`);
  }
  try {
    await assignServers(code, ids);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : "?";
    redirect(`/admin/games/${encodeURIComponent(gameId)}?error=db&msg=${encodeURIComponent(msg)}`);
  }
  redirect(`/admin/games/${encodeURIComponent(gameId)}?saved=1`);
}

// Takes one server out of a ranking by moving it into another one.
export async function moveServerAction(form: FormData) {
  await requireAdmin(100);
  const gameId = String(form.get("__id") ?? "");
  const back = `/admin/games/${encodeURIComponent(gameId)}`;
  const serverId = Number(form.get("server"));
  const target = String(form.get("target") ?? "").trim();
  const [servers, games, bases] = await Promise.all([allServers(), optionList("games"), rankingBaseGames()]);
  const server = servers.find((s) => s.serverId === serverId);
  if (!server || !games.some(([code]) => code === target)) redirect(back);
  if (!sameBaseGame(bases.get(server.game) ?? null, bases.get(target) ?? null)) redirect(`${back}?error=mismatch`);
  try {
    await assignServers(target, [serverId]);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : "?";
    redirect(`${back}?error=db&msg=${encodeURIComponent(msg)}`);
  }
  redirect(`${back}?saved=1`);
}

export async function deleteAction(form: FormData) {
  const e = await entityFrom(form);
  const user = await requireAdmin(e.minLevel);
  const id = String(form.get("__id") ?? "");
  if (!e.canDelete || form.get("confirm") !== "1" || !(await getRow(e, id))) redirect(`/admin/${e.key}/${encodeURIComponent(id)}`);
  if (e.key === "users" && id === user.username) redirect(`/admin/${e.key}/${encodeURIComponent(id)}?error=self`);
  try {
    await deleteRow(e, id);
    if (e.key === "users") await Promise.all([removeSecret(id, false), removeSecret(id, true)]);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : "?";
    redirect(`/admin/${e.key}/${encodeURIComponent(id)}?error=db&msg=${encodeURIComponent(msg)}`);
  }
  redirect(`/admin/${e.key}?deleted=1`);
}

export async function saveSettingsAction(form: FormData) {
  await requireAdmin();
  const values: [string, string][] = [];
  for (const s of allSettings) {
    if (s.type === "link") {
      const v = linkValue(String(form.get(`${s.key}__label`) ?? ""), String(form.get(`${s.key}__url`) ?? ""));
      if (v === null) redirect(`/admin/settings?field=${s.key}`);
      values.push([s.key, v]);
      continue;
    }
    if (s.type === "secret") {
      // Empty keeps the stored value; the checkbox clears it.
      const v = String(form.get(s.key) ?? "");
      if (form.get(`${s.key}__clear`) === "1") values.push([s.key, ""]);
      else if (v) {
        if (v.length > 255 || /[\r\n]/.test(v)) redirect(`/admin/settings?field=${s.key}`);
        values.push([s.key, v]);
      }
      continue;
    }
    const v = String(form.get(s.key) ?? "").trim();
    if (s.type === "number") {
      const n = Number(v);
      if (!v || !Number.isInteger(n) || (s.min !== undefined && n < s.min) || (s.max !== undefined && n > s.max)) {
        redirect(`/admin/settings?field=${s.key}`);
      }
    } else if (
      (s.type === "bool" && v !== "0" && v !== "1") ||
      (s.type === "choice" && !s.choices?.some(([c]) => c === v)) ||
      (s.type === "template" && !(await listTemplates()).some((t) => t.id === v))
    ) {
      redirect(`/admin/settings?field=${s.key}`);
    } else if (v.length > 255) {
      redirect(`/admin/settings?field=${s.key}`);
    } else if (s.key === "gamewe_ts_host" && v) {
      const host = tsHost(v);
      if (!host) redirect(`/admin/settings?field=${s.key}`);
      values.push([s.key, host]);
      continue;
    } else if ((s.key === "gamewe_ts_display" && v && !tsDisplay(v)) || (s.key === "gamewe_ts_link" && v && !tsLink(v))) {
      redirect(`/admin/settings?field=${s.key}`);
    } else if (s.key === "gamewe_ts_country" && v) {
      const c = tsCountry(v);
      if (!c) redirect(`/admin/settings?field=${s.key}`);
      values.push([s.key, c.toUpperCase()]);
      continue;
    } else if (s.key === "gamewe_discord_invite" && v) {
      const invite = discordInvite(v);
      if (!invite) redirect(`/admin/settings?field=${s.key}`);
      values.push([s.key, invite]);
      continue;
    } else if (s.key === "gamewe_discord_guild" && v && !discordGuild(v)) {
      redirect(`/admin/settings?field=${s.key}`);
    } else if ((s.key === "gamewe_header_logo" || s.key === "gamewe_favicon" || s.key === "gamewe_apple_icon") && v && !imageUrl(v)) {
      redirect(`/admin/settings?field=${s.key}`);
    } else if ((s.key === "gamewe_title_format" || s.key === "gamewe_title_ranking") && !v.includes("{page}")) {
      redirect(`/admin/settings?field=${s.key}`);
    } else if (s.key === "gamewe_sourcebans_url" && v) {
      const base = sourcebansBase(v);
      if (!base) redirect(`/admin/settings?field=${s.key}`);
      values.push([s.key, base]);
      continue;
    }
    values.push([s.key, v]);
  }
  for (const [k, v] of values) {
    await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [k, v]);
  }
  invalidateSettings();
  redirect("/admin/settings?saved=1");
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

// Ranking reset (lib/reset.ts): admins only, the ranking's code typed again
// and the collector confirmed as stopped.
export async function resetRankingAction(form: FormData) {
  const user = await requireAdmin(LEVEL_ADMIN);
  const game = String(form.get("game") ?? "");
  const mode = form.get("mode") === "all" ? "all" : form.get("mode") === "stats" ? "stats" : null;
  const games = await optionList("games");
  if (!games.some(([code]) => code === game) || !mode) redirect("/admin/reset?error=input");
  if (String(form.get("confirm") ?? "").trim() !== game) {
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
