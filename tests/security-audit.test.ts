import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { request } from "node:http";
import { test } from "node:test";
import { hiddenSql } from "../src/lib/hidden";

// Fixes of the security audit of 2026-11. The auth and admin code imports
// next/headers and cannot load here: those checks read the source, as in
// admin-api.test.ts.
const src = (f: string) => readFileSync(f, "utf8");

test("hiddenSql also finds a hidden player in the inactive table", () => {
  const sql = hiddenSql("x.id");
  assert.match(sql, /FROM hlstats_Players hp WHERE hp\.playerId = x\.id/);
  assert.match(sql, /FROM hlstats_PlayersInactive hi WHERE hi\.playerId = x\.id AND hi\.hideranking <> 0/);
  assert.match(sql, /^\(.*\)$/s, "an OR stays one condition");
  assert.match(src("src/lib/data.ts"), /CASE WHEN \$\{hiddenSql\("o\.playerId"\)\} THEN 1 ELSE 0 END AS hidden/);
});

test("level 100 rows cannot be written through the raw options below level 100", () => {
  const ops = src("src/lib/admin-ops.ts");
  assert.match(ops, /acclevel < LEVEL_ADMIN && adminOnlyOption\(key\)\) bad/);
  assert.match(ops, /acclevel < LEVEL_ADMIN && adminOnlyOption\(newKey\)\)/);
  const s = src("src/lib/admin-settings.ts");
  for (const p of ["gamewe_reset_", "gamewe_hof_", "gamewe_block_vac_", "gamewe_rank_bots_", "gamewe_fastdl_url_", "gamewe_geoip_db"]) assert.ok(s.includes(`"${p}"`), p);
  assert.match(src("src/app/admin/(panel)/settings/[group]/page.tsx"), /level < LEVEL_ADMIN && adminOnlyOption\(r\.keyname\)/);
});

test("the ServerQuery target and login are level 100, and the form does not send them below it", () => {
  const s = src("src/lib/admin-settings.ts");
  for (const k of ["gamewe_ts_host", "gamewe_ts_query_port", "gamewe_ts_query_user", "gamewe_ts_query_password"]) {
    assert.match(s, new RegExp(`key: "${k}".*minLevel: 100`), k);
  }
  assert.match(src("src/app/admin/(panel)/settings/[group]/page.tsx"), /defaultValue=\{v\}\s+disabled=\{readOnly\}/);
});

test("sessions and tokens end with the credentials", () => {
  const auth = src("src/lib/auth.ts");
  assert.match(auth, /data\.i <= Number\(ended\.value\)/, "currentAdmin refuses ended sessions");
  assert.match(auth.slice(auth.indexOf("export async function logout")), /revokeSessions/);
  assert.match(auth.slice(auth.indexOf("export async function changePassword"), auth.indexOf("export async function confirmIdentity")), /revokeSessions/);
  assert.match(src("src/lib/admin-ops.ts"), /purgeTokens\(id\), revokeSessions\(id\)/);
  const a = src("src/app/admin/actions.ts");
  assert.match(a.slice(a.indexOf("function totpDisableAction")), /purgeTokens\(user\)/);
  assert.match(a.slice(a.indexOf("function changePasswordAction")), /purgeTokens\(user\.username\)/);
  const cli = src("scripts/create-admin.mjs");
  assert.match(cli, /epochKey/);
  assert.match(cli, /gamewe\\\\_apitoken/);
});

test("code checks of a signed-in user have the brake", () => {
  const a = src("src/app/admin/actions.ts");
  for (const f of ["totpBackupCodesAction", "totpDisableAction"]) assert.match(a.slice(a.indexOf(`function ${f}`), a.indexOf(`function ${f}`) + 500), /brakedCode\(user/, f);
});

test("errors never carry the bound values into logs", () => {
  assert.match(src("src/lib/db.ts"), /delete \(err as \{ sql\?: string \}\)\.sql/);
  assert.doesNotMatch(src("src/lib/admin-ops.ts"), /console\.error\("admin save:", err\)/);
});

test("the website's banner routes are limited and share a render", () => {
  for (const f of ["src/app/sig/[file]/route.tsx", "src/app/banner/[game]/route.tsx", "src/app/banner/[game]/player/[file]/route.tsx", "src/app/banner/[game]/server/[file]/route.tsx"]) {
    assert.match(src(f), /bannerBusy\(\)/, f);
  }
  for (const f of ["player", "server", "voice"]) assert.match(src(`src/lib/banners/${f}-banner.tsx`), /return cachedBanner\(/, f);
});

// Runs the preload with a small server that answers the headers it sees.
async function seen(trusted: string | undefined): Promise<Record<string, string>> {
  const script = `const http=require("http");const s=http.createServer((q,r)=>r.end(JSON.stringify(q.headers)));s.listen(0,"127.0.0.1",()=>console.log("PORT",s.address().port));`;
  const env: Record<string, string | undefined> = { PATH: process.env.PATH, ACCESS_LOG: "off" };
  if (trusted !== undefined) env.TRUSTED_PROXIES = trusted;
  const child = spawn(process.execPath, ["-r", "./scripts/access-log.cjs", "-e", script], { env: env as NodeJS.ProcessEnv });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      child.stdout.on("data", (d) => {
        const m = /PORT (\d+)/.exec(String(d));
        if (m) resolve(Number(m[1]));
      });
      child.on("exit", () => reject(new Error("server ended")));
    });
    return await new Promise((resolve, reject) => {
      const r = request({ host: "127.0.0.1", port, headers: { "x-forwarded-for": "203.0.113.7", "x-real-ip": "203.0.113.8" } }, (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => resolve(JSON.parse(b)));
      });
      r.on("error", reject);
      r.end();
    });
  } finally {
    child.kill();
  }
}

test("forwarded addresses count only from a trusted proxy", async () => {
  const fromHost = await seen(undefined);
  assert.equal(fromHost["x-forwarded-for"], "203.0.113.7", "this host is trusted by default");
  const direct = await seen("10.0.0.1,192.168.0.0/16");
  assert.equal(direct["x-forwarded-for"], undefined);
  assert.equal(direct["x-real-ip"], undefined);
  assert.equal((await seen("127.0.0.0/8"))["x-forwarded-for"], "203.0.113.7");
});

test("every ranking page checks the ranking, not only the layout", () => {
  for (const f of ["players/page.tsx", "weapons/page.tsx", "chat/page.tsx", "bans/page.tsx"]) assert.match(src(`src/app/(site)/[game]/${f}`), /await rankingGate\(\(await params\)\.game\)/, f);
  assert.match(src("src/app/(site)/[game]/servers/[id]/page.tsx"), /rankingShown\(s\.game\)/);
  assert.match(src("src/app/(site)/[game]/players/[id]/page.tsx"), /rankingShown\(p\.game\)/);
});

test("a cut-off password hash signs nobody in, and unknown names cost the same", () => {
  const auth = src("src/lib/auth.ts");
  assert.match(auth, /want\.length < 32\) return \{ ok: false/);
  assert.match(auth, /verifyPassword\(password, user \? user\.password : DUMMY_HASH\)/);
});

test("database sessions: backslash escaping holds, public statements have a deadline", () => {
  const db = src("src/lib/db.ts");
  assert.match(db, /REPLACE\(@@SESSION\.sql_mode, 'NO_BACKSLASH_ESCAPES', ''\)/);
  assert.match(db, /env\("DB_PASSWORD"\), 10, PUBLIC_STATEMENT_SECONDS/);
});

test("a server's new address clears the stored RCON password", () => {
  assert.match(src("src/lib/admin-ops.ts"), /rcon_password__clear", "1"/);
});
