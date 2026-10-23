import "server-only";
import { Socket } from "node:net";
import { query } from "./db";

// Voice server box: either a TeamSpeak 3 server (people online read over its
// ServerQuery interface) or a Discord server (invite link, people online
// from its public widget). Set up under Administration → Settings → Voice
// server. The query login stays on the server; the page only gets the
// numbers. Results are kept for a minute (Discord: five minutes).

export type VoiceBox = {
  ts: {
    name: string;
    address: string;
    password: string;
    // null when the query could not be read.
    clients: number | null;
    max: number | null;
    channels: number | null;
  } | null;
  discord: { name: string; invite: string; online: number | null } | null;
};

const KEYS = [
  "gamewe_voice_type",
  "gamewe_ts_host",
  "gamewe_ts_port",
  "gamewe_ts_query_port",
  "gamewe_ts_query_user",
  "gamewe_ts_query_password",
  "gamewe_ts_password",
  "gamewe_ts_name",
  "gamewe_discord_invite",
  "gamewe_discord_guild",
] as const;

const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$|^\d{1,3}(\.\d{1,3}){3}$/i;

// Accepted forms of the settings (also used by the admin form).
export function tsHost(v: string): string {
  const s = v.trim().toLowerCase();
  return HOST.test(s) ? s : "";
}

export function discordInvite(v: string): string {
  const s = v.trim();
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/([A-Za-z0-9-]{2,40})\/?$/.exec(s);
  return m ? `https://discord.gg/${m[1]}` : "";
}

export function discordGuild(v: string): string {
  const s = v.trim();
  return /^\d{17,20}$/.test(s) ? s : "";
}

export type VoiceType = "none" | "teamspeak" | "discord";

// Which voice server the box shows. Without an explicit choice both may be
// set: then a configured TeamSpeak wins, else Discord.
export function voiceType(o: Record<string, string | undefined>): VoiceType {
  const v = (o.gamewe_voice_type ?? "").trim();
  if (v === "none" || v === "teamspeak" || v === "discord") return v;
  if (tsHost(o.gamewe_ts_host ?? "")) return "teamspeak";
  if (discordInvite(o.gamewe_discord_invite ?? "") || discordGuild(o.gamewe_discord_guild ?? "")) return "discord";
  return "none";
}

let cache: { at: number; key: string; value: VoiceBox } | null = null;
let inflight: Promise<VoiceBox> | null = null;
let discordCache: { at: number; id: string; value: { name: string; online: number } | null } | null = null;

export async function getVoiceBox(): Promise<VoiceBox> {
  let o: Record<string, string>;
  try {
    const rows = await query<{ keyname: string; value: string }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [[...KEYS]]);
    o = Object.fromEntries(rows.map((r) => [r.keyname, r.value]));
  } catch {
    return { ts: null, discord: null };
  }
  const key = KEYS.map((k) => o[k] ?? "").join("\n");
  if (cache && cache.key === key && Date.now() - cache.at < 60_000) return cache.value;
  inflight ??= load(o).finally(() => (inflight = null));
  const value = await inflight;
  cache = { at: Date.now(), key, value };
  return value;
}

function port(v: string | undefined, def: number) {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : def;
}

async function load(o: Record<string, string>): Promise<VoiceBox> {
  const type = voiceType(o);
  const host = type === "teamspeak" ? tsHost(o.gamewe_ts_host ?? "") : "";
  const invite = type === "discord" ? discordInvite(o.gamewe_discord_invite ?? "") : "";
  const guild = type === "discord" ? discordGuild(o.gamewe_discord_guild ?? "") : "";
  const [ts, discord] = await Promise.all([
    host ? loadTs(host, port(o.gamewe_ts_port, 9987), port(o.gamewe_ts_query_port, 10011), o) : null,
    invite || guild ? loadDiscord(guild).then((d) => ({ name: d?.name ?? "Discord", invite, online: d?.online ?? null })) : null,
  ]);
  return { ts, discord };
}

async function loadTs(host: string, voicePort: number, queryPort: number, o: Record<string, string>): Promise<VoiceBox["ts"]> {
  const base = {
    name: (o.gamewe_ts_name ?? "").trim(),
    address: voicePort === 9987 ? host : `${host}:${voicePort}`,
    password: (o.gamewe_ts_password ?? "").trim(),
    clients: null,
    max: null,
    channels: null,
  };
  try {
    const info = await serverInfo(host, queryPort, voicePort, (o.gamewe_ts_query_user ?? "").trim(), o.gamewe_ts_query_password ?? "");
    const num = (k: string) => (info[k] !== undefined && /^\d+$/.test(info[k]) ? Number(info[k]) : null);
    const online = num("virtualserver_clientsonline");
    const queries = num("virtualserver_queryclientsonline") ?? 0;
    return {
      ...base,
      name: base.name || (info.virtualserver_name ?? "").slice(0, 80) || host,
      clients: online === null ? null : Math.max(0, online - queries),
      max: num("virtualserver_maxclients"),
      channels: num("virtualserver_channelsonline"),
    };
  } catch (e) {
    console.warn(`TeamSpeak query: ${e instanceof Error ? e.message : e}`);
    return { ...base, name: base.name || host };
  }
}

// ServerQuery escaping (TeamSpeak 3 server query manual).
const ESC: [string, string][] = [
  ["\\", "\\\\"],
  ["/", "\\/"],
  [" ", "\\s"],
  ["|", "\\p"],
  ["\x07", "\\a"],
  ["\b", "\\b"],
  ["\f", "\\f"],
  ["\n", "\\n"],
  ["\r", "\\r"],
  ["\t", "\\t"],
  ["\v", "\\v"],
];

function esc(s: string) {
  return ESC.reduce((v, [a, b]) => v.split(a).join(b), s);
}

function unesc(s: string) {
  return s.replace(/\\(.)/g, (_, c: string) => ESC.find(([, b]) => b === `\\${c}`)?.[0] ?? c);
}

// Logs in (when a user is set), selects the virtual server by its voice port
// and reads "serverinfo".
function serverInfo(host: string, queryPort: number, voicePort: number, user: string, pass: string): Promise<Record<string, string>> {
  const commands = [...(user ? [`login client_login_name=${esc(user)} client_login_password=${esc(pass)}`] : []), `use port=${voicePort}`, "serverinfo"];
  return new Promise((resolve, reject) => {
    const sock = new Socket();
    let buf = "";
    let greeted = false;
    let step = 0;
    let data = "";
    let done = false;
    const fail = (msg: string) => {
      done = true;
      sock.destroy();
      reject(new Error(msg));
    };
    sock.setTimeout(4000, () => fail("timeout"));
    sock.on("error", (e) => fail(e.message));
    sock.on("data", (chunk) => {
      if (done) return;
      buf += chunk.toString("utf8");
      if (buf.length > 64 * 1024) return fail("answer too long");
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        // Lines end with "\n\r", so the "\r" starts the next one.
        const line = buf.slice(0, nl).replace(/^\r|\r$/g, "");
        buf = buf.slice(nl + 1);
        if (!line) continue;
        if (!greeted) {
          // "TS3", then a welcome line; the first command goes after it.
          if (line.startsWith("Welcome")) {
            greeted = true;
            sock.write(`${commands[0]}\n`);
          } else if (line !== "TS3") return fail("not a TeamSpeak 3 query port");
          continue;
        }
        if (!line.startsWith("error ")) {
          data += line;
          continue;
        }
        const id = /\bid=(\d+)/.exec(line)?.[1];
        if (id !== "0") return fail(`error ${id ?? "?"} ${unesc(/\bmsg=(\S+)/.exec(line)?.[1] ?? "")}`.slice(0, 120));
        step++;
        if (step < commands.length) {
          data = "";
          sock.write(`${commands[step]}\n`);
          continue;
        }
        const out: Record<string, string> = {};
        for (const pair of data.split(" ")) {
          const i = pair.indexOf("=");
          if (i > 0) out[pair.slice(0, i)] = unesc(pair.slice(i + 1));
        }
        done = true;
        sock.end("quit\n");
        return resolve(out);
      }
    });
    sock.connect(queryPort, host);
  });
}

// Name and people online from the server's public widget (Server settings →
// Widget → Enable server widget in Discord).
async function loadDiscord(id: string): Promise<{ name: string; online: number } | null> {
  if (!id) return null;
  if (discordCache && discordCache.id === id && Date.now() - discordCache.at < 300_000) return discordCache.value;
  let value: { name: string; online: number } | null = null;
  try {
    const res = await fetch(`https://discord.com/api/guilds/${id}/widget.json`, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
      cache: "no-store",
      headers: { accept: "application/json", "user-agent": "gameWE stats" },
    });
    if (res.ok) {
      const j = (await res.json()) as { name?: unknown; presence_count?: unknown };
      value = {
        name: typeof j.name === "string" ? j.name.slice(0, 80) : "Discord",
        online: typeof j.presence_count === "number" ? j.presence_count : 0,
      };
    } else console.warn(`Discord widget: HTTP ${res.status} (is the server widget enabled?)`);
  } catch (e) {
    console.warn(`Discord widget: ${e instanceof Error ? e.message : e}`);
  }
  discordCache = { at: Date.now(), id, value };
  return value;
}
