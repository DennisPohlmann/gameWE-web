import { createHash } from "node:crypto";

// Notifications by e-mail, Telegram and ntfy. The collector sends them
// (internal/notify of gameWE-collector); the web stores what it needs in
// hlstats_Options and the passwords and tokens in hlstats_gamewe_secrets:
//   gamewe_notify_<channel>                 1: the channel is on
//   gamewe_notify_<channel>_<event>         1/0: the shared recipients get the event
//   gamewe_notify_email_to, _telegram_chat, _ntfy_topic   the shared recipients
//   gamewe_notify_smtp_*, _email_from, _telegram_token, _ntfy_url, _ntfy_token
//   gamewe_notifyu_<hash>_<channel>         an admin's own: "<events>|<address>"
//   gamewe_notify_last_<channel>, gamewe_notifyu_<hash>_last_<channel>
//                                           written by the collector: "<unix>|ok" or "<unix>|error|<text>"
// A test message is a job "notify-test" (mode: the channel; game: the
// admin's hash, empty for the shared recipients). No database access, so
// `npm test` can load it. Keep it in step with the collector.

export const CHANNELS = ["email", "telegram", "ntfy"] as const;
export type Channel = (typeof CHANNELS)[number];
export const isChannel = (v: unknown): v is Channel => typeof v === "string" && (CHANNELS as readonly string[]).includes(v);

// A new event: add it here and in the collector (notify.Events, its texts
// and where it is sent), with its texts in NOTIFY_T (admin-texts.ts).
export const EVENTS = ["reset", "hof", "update"] as const;
export type NotifyEvent = (typeof EVENTS)[number];
export const isEvent = (v: unknown): v is NotifyEvent => typeof v === "string" && (EVENTS as readonly string[]).includes(v);

export const MAX_RECIPIENTS = 20;
export const NOTIFY_USER_PREFIX = "gamewe_notifyu_";
export const NOTIFY_SECRETS = ["gamewe_notify_smtp_password", "gamewe_notify_telegram_token", "gamewe_notify_ntfy_token"];

export const channelKey = (c: Channel) => `gamewe_notify_${c}`;
export const sharedToKey: Record<Channel, string> = { email: "gamewe_notify_email_to", telegram: "gamewe_notify_telegram_chat", ntfy: "gamewe_notify_ntfy_topic" };
export const statusKey = (c: Channel, hash = "") => (hash ? `${NOTIFY_USER_PREFIX}${hash}_last_${c}` : `gamewe_notify_last_${c}`);

// The hash of an admin's keys: the one of their rights (admin-perms.ts permsKey).
export const userHash = (user: string) => createHash("sha256").update(user.trim().toLowerCase()).digest("hex").slice(0, 32);
export const ownKey = (user: string, c: Channel) => `${NOTIFY_USER_PREFIX}${userHash(user)}_${c}`;

// The rows of an admin's own notifications (removed with the admin).
export const ownNotifyKeys = (user: string) => CHANNELS.flatMap((c) => [ownKey(user, c), statusKey(c, userHash(user))]);

// ---------------------------------------------------------------- values

const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const CHAT = /^(-?[0-9]{1,20}|@[A-Za-z][A-Za-z0-9_]{3,31})$/;
const TOPIC = /^[A-Za-z0-9_-]{1,64}$/;
const BOT_TOKEN = /^[0-9]{1,20}:[A-Za-z0-9_-]{20,100}$/;
const HOST = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$|^\[[0-9A-Fa-f:.]{2,45}\]$/;

export const emailOk = (v: string) => v.length <= 200 && EMAIL.test(v);

// Comma, semicolon or space separated addresses, each once; null if one is
// bad, there is none or more than MAX_RECIPIENTS. Stored comma separated.
export function recipients(v: string): string | null {
  const list = [...new Set(v.split(/[\s,;]+/).filter(Boolean))];
  if (!list.length || list.length > MAX_RECIPIENTS || !list.every(emailOk)) return null;
  const out = list.join(", ");
  return out.length <= 255 ? out : null;
}

// The address of a channel (one e-mail address for an admin's own; the
// shared e-mail recipients use recipients()).
export function addressOk(c: Channel, v: string): boolean {
  if (c === "email") return emailOk(v);
  if (c === "telegram") return CHAT.test(v);
  return TOPIC.test(v);
}

export const botTokenOk = (v: string) => BOT_TOKEN.test(v);
export const hostOk = (v: string) => v.length <= 253 && HOST.test(v);

// The ntfy server: https without user, query or fragment, no trailing slash.
export function ntfyBase(v: string): string | null {
  const s = v.trim().replace(/\/+$/, "");
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password || u.search || u.hash || s.length > 255) return null;
    return s;
  } catch {
    return null;
  }
}

// A checked value of a setting of the notifications page (empty allowed for
// optional ones), null if it is bad; undefined: no notify setting.
export function notifySettingValue(key: string, v: string): string | null | undefined {
  switch (key) {
    case "gamewe_notify_email_to":
      return v ? recipients(v) : "";
    case "gamewe_notify_email_from":
      return !v || emailOk(v) ? v : null;
    case "gamewe_notify_smtp_host":
      return !v || hostOk(v) ? v : null;
    case "gamewe_notify_smtp_user":
      return /[\u0000-\u001f]/.test(v) ? null : v;
    case "gamewe_notify_telegram_chat":
      return !v || addressOk("telegram", v) ? v : null;
    case "gamewe_notify_ntfy_topic":
      return !v || addressOk("ntfy", v) ? v : null;
    case "gamewe_notify_ntfy_url":
      return v ? ntfyBase(v) : "";
    case "gamewe_notify_telegram_token":
      return botTokenOk(v) ? v : null;
    case "gamewe_notify_ntfy_token":
      return /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : null;
  }
  return undefined;
}

// ---------------------------------------------------------------- an admin's own

export type Own = { to: string; events: NotifyEvent[] };

// The first channel of values with a bad address or event, else null:
// saving checks all before writing any.
export function badOwn(values: Partial<Record<Channel, Own>>): Channel | null {
  for (const c of CHANNELS) {
    const v = values[c];
    if (v && ((v.to.trim() && !addressOk(c, v.to.trim())) || !v.events.every(isEvent))) return c;
  }
  return null;
}

export const ownValue = (o: Own) => `${EVENTS.filter((e) => o.events.includes(e)).join(",")}|${o.to}`;

export function parseOwn(raw: string | null | undefined): Own {
  const i = (raw ?? "").indexOf("|");
  if (i < 0) return { to: "", events: [] };
  const events = raw!.slice(0, i).split(",").map((s) => s.trim()).filter(isEvent);
  return { to: raw!.slice(i + 1).trim(), events: EVENTS.filter((e) => events.includes(e)) };
}

// ---------------------------------------------------------------- status

export type NotifyStatus = { at: number; ok: boolean; error: string } | null;

export function parseStatus(raw: string | null | undefined): NotifyStatus {
  const m = /^(\d{1,12})\|(ok|error)(?:\|(.*))?$/s.exec((raw ?? "").trim());
  return m ? { at: Number(m[1]), ok: m[2] === "ok", error: m[3] ?? "" } : null;
}
