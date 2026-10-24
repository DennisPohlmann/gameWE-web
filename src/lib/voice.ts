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
    // "TeamSpeak 3" etc., from the server version; "TeamSpeak" when unknown.
    type: string;
    // What the box shows as address, and where it links to. Both may be
    // set by the admin (gamewe_ts_display, gamewe_ts_link) for a DNS/SRV
    // name; the query always uses the real host and ports.
    address: string;
    link: string;
    password: string;
    // null when the query could not be read.
    clients: number | null;
    max: number | null;
    channels: number | null;
  } | null;
  discord: { name: string; type: string; invite: string; online: number | null } | null;
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
  "gamewe_ts_display",
  "gamewe_ts_link",
  "gamewe_ts_show_clients",
  "gamewe_discord_invite",
  "gamewe_discord_guild",
] as const;

const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$|^\d{1,3}(\.\d{1,3}){3}$/i;

// Accepted forms of the settings (also used by the admin form).
export function tsHost(v: string): string {
  const s = v.trim().toLowerCase();
  return HOST.test(s) ? s : "";
}

// Shown instead of host:port: printable text, at most 100 characters.
export function tsDisplay(v: string): string {
  const s = v.trim();
  return s.length <= 100 && !/[\p{Cc}\p{Cf}]/u.test(s) ? s : "";
}

// Connect link that replaces the generated ts3server:// link. Only the
// TeamSpeak schemes and https, with a host name and an optional query
// (e.g. ts3server://ts.example.org?port=9987&nickname=Guest).
export function tsLink(v: string): string {
  const s = v.trim();
  if (s.length > 255 || /[\s"'<>\\`]/.test(s)) return "";
  const m = /^(ts3server|teamspeak|https):\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?$/i.exec(s);
  if (!m) return "";
  const hostPort = /^(.+?)(?::(\d{1,5}))?$/.exec(m[2]);
  if (!hostPort || !tsHost(hostPort[1]) || (hostPort[2] && Number(hostPort[2]) > 65535)) return "";
  if (m[1].toLowerCase() !== "https" && m[3] && m[3] !== "/") return "";
  return s;
}

// The generated connect link for host[:port].
export function tsDefaultLink(address: string): string {
  return `ts3server://${address.replace(/:(\d+)$/, "?port=$1")}`;
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
let detailCache: { at: number; key: string; value: VoiceDetail | null } | null = null;
let detailInflight: Promise<VoiceDetail | null> | null = null;
let inflight: Promise<VoiceBox> | null = null;
let discordCache: { at: number; id: string; value: { name: string; online: number } | null } | null = null;

async function options(): Promise<Record<string, string> | null> {
  try {
    const rows = await query<{ keyname: string; value: string }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [[...KEYS]]);
    return Object.fromEntries(rows.map((r) => [r.keyname, r.value]));
  } catch {
    return null;
  }
}

export async function getVoiceBox(): Promise<VoiceBox> {
  const o = await options();
  if (!o) return { ts: null, discord: null };
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
    invite || guild ? loadDiscord(guild).then((d) => ({ name: d?.name ?? "Discord", type: "Discord", invite, online: d?.online ?? null })) : null,
  ]);
  return { ts, discord };
}

async function loadTs(host: string, voicePort: number, queryPort: number, o: Record<string, string>): Promise<VoiceBox["ts"]> {
  const real = voicePort === 9987 ? host : `${host}:${voicePort}`;
  const base = {
    name: (o.gamewe_ts_name ?? "").trim(),
    type: "TeamSpeak",
    address: tsDisplay(o.gamewe_ts_display ?? "") || real,
    link: tsLink(o.gamewe_ts_link ?? "") || tsDefaultLink(real),
    password: (o.gamewe_ts_password ?? "").trim(),
    clients: null,
    max: null,
    channels: null,
  };
  try {
    const [[info = {}]] = await tsQuery(host, queryPort, voicePort, (o.gamewe_ts_query_user ?? "").trim(), o.gamewe_ts_query_password ?? "", ["serverinfo"]);
    const num = (k: string) => (info[k] !== undefined && /^\d+$/.test(info[k]) ? Number(info[k]) : null);
    const online = num("virtualserver_clientsonline");
    const queries = num("virtualserver_queryclientsonline") ?? 0;
    return {
      ...base,
      name: base.name || (info.virtualserver_name ?? "").slice(0, 80) || host,
      type: tsType(info.virtualserver_version),
      clients: online === null ? null : Math.max(0, online - queries),
      max: num("virtualserver_maxclients"),
      channels: num("virtualserver_channelsonline"),
    };
  } catch (e) {
    console.warn(`TeamSpeak query: ${e instanceof Error ? e.message : e}`);
    return { ...base, name: base.name || host };
  }
}

// Detail page of the TeamSpeak server (/voice): server data, channel tree
// and the people online, read in one ServerQuery connection and kept for a
// minute. null when no TeamSpeak server is set up.

export type VoiceClient = { name: string; away: boolean; muted: boolean; deaf: boolean; country: string };

export type VoiceChannel = {
  id: number;
  name: string;
  // Spacer channels ([spacer], [cspacer], [rspacer], [*spacer] on the top
  // level): how the client draws their text.
  spacer: "left" | "center" | "right" | "repeat" | null;
  topic: string;
  password: boolean;
  // People in the channel (also when their names are hidden).
  count: number;
  clients: VoiceClient[];
  children: VoiceChannel[];
};

export type VoiceInfo = {
  uptime: number | null;
  created: number | null;
  version: string;
  platform: string;
  clientConnections: number | null;
  queryConnections: number | null;
  securityLevel: number | null;
  ping: number | null;
  packetLoss: number | null;
  bandwidthIn: number | null;
  bandwidthOut: number | null;
  bytesIn: number | null;
  bytesOut: number | null;
  bannerUrl: string;
  welcome: string;
};

export type VoiceDetail = {
  box: NonNullable<VoiceBox["ts"]>;
  // false: the query failed, only the settings are known.
  ok: boolean;
  info: VoiceInfo | null;
  channels: VoiceChannel[];
  showClients: boolean;
};

export async function getVoiceDetail(): Promise<VoiceDetail | null> {
  const o = await options();
  if (!o || voiceType(o) !== "teamspeak" || !tsHost(o.gamewe_ts_host ?? "")) return null;
  const key = KEYS.map((k) => o[k] ?? "").join("\n");
  if (detailCache && detailCache.key === key && Date.now() - detailCache.at < 60_000) return detailCache.value;
  detailInflight ??= loadDetail(o).finally(() => (detailInflight = null));
  const value = await detailInflight;
  detailCache = { at: Date.now(), key, value };
  return value;
}

async function loadDetail(o: Record<string, string>): Promise<VoiceDetail | null> {
  const host = tsHost(o.gamewe_ts_host ?? "");
  const voicePort = port(o.gamewe_ts_port, 9987);
  const real = voicePort === 9987 ? host : `${host}:${voicePort}`;
  const showClients = (o.gamewe_ts_show_clients ?? "1") !== "0";
  const box: VoiceDetail["box"] = {
    name: (o.gamewe_ts_name ?? "").trim() || host,
    type: "TeamSpeak",
    address: tsDisplay(o.gamewe_ts_display ?? "") || real,
    link: tsLink(o.gamewe_ts_link ?? "") || tsDefaultLink(real),
    password: (o.gamewe_ts_password ?? "").trim(),
    clients: null,
    max: null,
    channels: null,
  };
  let answers: Record<string, string>[][];
  try {
    answers = await tsQuery(host, port(o.gamewe_ts_query_port, 10011), voicePort, (o.gamewe_ts_query_user ?? "").trim(), o.gamewe_ts_query_password ?? "", [
      "serverinfo",
      "channellist -topic -flags",
      "clientlist -away -voice -country",
    ]);
  } catch (e) {
    console.warn(`TeamSpeak query: ${e instanceof Error ? e.message : e}`);
    return { box, ok: false, info: null, channels: [], showClients };
  }
  const [[si = {}], channelRows, clientRows] = answers;
  const num = (r: Record<string, string>, k: string) => (r[k] !== undefined && /^\d+(\.\d+)?$/.test(r[k]) ? Number(r[k]) : null);
  const text = (v: string | undefined, max: number) => (v ?? "").replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? c : "")).slice(0, max);
  const people = clientRows.filter((c) => c.client_type === "0");
  const online = num(si, "virtualserver_clientsonline");
  const queries = num(si, "virtualserver_queryclientsonline") ?? 0;
  box.name = (o.gamewe_ts_name ?? "").trim() || text(si.virtualserver_name, 80) || host;
  box.type = tsType(si.virtualserver_version);
  box.clients = online === null ? people.length : Math.max(0, online - queries);
  box.max = num(si, "virtualserver_maxclients");
  box.channels = num(si, "virtualserver_channelsonline");

  const banner = si.virtualserver_hostbanner_url ?? "";
  const info: VoiceInfo = {
    uptime: num(si, "virtualserver_uptime"),
    created: num(si, "virtualserver_created"),
    version: text(si.virtualserver_version, 60),
    platform: text(si.virtualserver_platform, 40),
    clientConnections: num(si, "virtualserver_client_connections"),
    queryConnections: num(si, "virtualserver_query_client_connections"),
    securityLevel: num(si, "virtualserver_needed_identity_security_level"),
    ping: num(si, "virtualserver_total_ping"),
    packetLoss: num(si, "virtualserver_total_packetloss_total"),
    bandwidthIn: num(si, "connection_bandwidth_received_last_second_total"),
    bandwidthOut: num(si, "connection_bandwidth_sent_last_second_total"),
    bytesIn: num(si, "connection_bytes_received_total"),
    bytesOut: num(si, "connection_bytes_sent_total"),
    bannerUrl: /^https?:\/\/[^\s"'<>]{1,250}$/i.test(banner) ? banner : "",
    welcome: stripBBCode(text(si.virtualserver_welcomemessage, 2000)),
  };

  // Channels: parent "pid", order "channel_order" (the id of the channel
  // above, 0 = first).
  const byParent = new Map<number, Record<string, string>[]>();
  for (const c of channelRows.slice(0, 2000)) {
    const pid = Number(c.pid) || 0;
    byParent.set(pid, [...(byParent.get(pid) ?? []), c]);
  }
  const clientsIn = new Map<number, VoiceClient[]>();
  for (const c of people) {
    const cid = Number(c.cid) || 0;
    clientsIn.set(cid, [
      ...(clientsIn.get(cid) ?? []),
      {
        name: text(c.client_nickname, 40),
        away: c.client_away === "1",
        muted: c.client_input_muted === "1" || c.client_input_hardware === "0",
        deaf: c.client_output_muted === "1" || c.client_output_hardware === "0",
        country: /^[A-Z]{2}$/.test(c.client_country ?? "") ? c.client_country.toLowerCase() : "",
      },
    ]);
  }
  for (const list of clientsIn.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  const seen = new Set<number>();
  const build = (pid: number, depth: number): VoiceChannel[] => {
    const rows = byParent.get(pid) ?? [];
    const next = new Map(rows.map((r) => [Number(r.channel_order) || 0, r]));
    const ordered: Record<string, string>[] = [];
    for (let cur = next.get(0); cur && ordered.length < rows.length; cur = next.get(Number(cur.cid))) ordered.push(cur);
    // Anything the order chain missed goes at the end.
    for (const r of rows) if (!ordered.includes(r)) ordered.push(r);
    return ordered.flatMap((r) => {
      const id = Number(r.cid);
      if (!id || seen.has(id) || depth > 20) return [];
      seen.add(id);
      const raw = text(r.channel_name, 80);
      const sp = pid === 0 ? /^\[([*cr]?)spacer[^\]]*\](.*)$/i.exec(raw) : null;
      return [
        {
          id,
          name: sp ? sp[2] : raw,
          spacer: sp ? ({ "*": "repeat", c: "center", r: "right" } as const)[sp[1].toLowerCase() as "*" | "c" | "r"] ?? "left" : null,
          topic: text(r.channel_topic, 120),
          password: r.channel_flag_password === "1",
          count: (clientsIn.get(id) ?? []).length,
          clients: showClients ? (clientsIn.get(id) ?? []) : [],
          children: build(id, depth + 1),
        },
      ];
    });
  };
  return { box, ok: true, info, channels: build(0, 0), showClients };
}

// The welcome message as plain text: BBCode tags and links removed.
function stripBBCode(s: string): string {
  return s
    .replace(/\[(\/?)(b|i|u|s|color|size|url|img|left|right|center|list|\*|hr|table|tr|td|th)(=[^\]]*)?\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// "3.13.7 [Build: 1655727713]" -> "TeamSpeak 3".
export function tsType(version: string | undefined): string {
  const major = /^(\d{1,2})\./.exec(version ?? "")?.[1];
  return major ? `TeamSpeak ${major}` : "TeamSpeak";
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
// and runs `commands`. Returns the answer of each command as a list of
// entries ("|"-separated), each a map of its key=value pairs.
function tsQuery(host: string, queryPort: number, voicePort: number, user: string, pass: string, commands: string[]): Promise<Record<string, string>[][]> {
  const setup = [...(user ? [`login client_login_name=${esc(user)} client_login_password=${esc(pass)}`] : []), `use port=${voicePort}`];
  const all = [...setup, ...commands];
  const answers: Record<string, string>[][] = [];
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
      if (buf.length + data.length > 512 * 1024) return fail("answer too long");
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
            sock.write(`${all[0]}\n`);
          } else if (line !== "TS3") return fail("not a TeamSpeak 3 query port");
          continue;
        }
        if (!line.startsWith("error ")) {
          data += line;
          continue;
        }
        const id = /\bid=(\d+)/.exec(line)?.[1];
        if (id !== "0") return fail(`error ${id ?? "?"} ${unesc(/\bmsg=(\S+)/.exec(line)?.[1] ?? "")}`.slice(0, 120));
        if (step >= setup.length) answers.push(parseAnswer(data));
        data = "";
        step++;
        if (step < all.length) {
          sock.write(`${all[step]}\n`);
          continue;
        }
        done = true;
        sock.end("quit\n");
        return resolve(answers);
      }
    });
    sock.connect(queryPort, host);
  });
}

function parseAnswer(data: string): Record<string, string>[] {
  if (!data) return [];
  return data.split("|").map((entry) => {
    const out: Record<string, string> = {};
    for (const pair of entry.split(" ")) {
      const i = pair.indexOf("=");
      if (i > 0) out[pair.slice(0, i)] = unesc(pair.slice(i + 1));
      else if (pair) out[pair] = "";
    }
    return out;
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
