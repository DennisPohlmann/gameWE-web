// Notifications (lib/notify-core.ts): what the web lets through to the
// collector, and the stored forms it shares with it.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { badOwn, joinNtfy, ntfyTokenOk, ownNtfyOk, ownTokenKey, notifySettingValue, ntfyBase, ownValue, parseOwn, parseStatus, splitNtfy, tokenOk, userHash } from "../src/lib/notify-core.ts";

test("server fields: ntfy https only, no header injection", () => {
  assert.equal(ntfyBase("https://ntfy.example.org/"), "https://ntfy.example.org");
  assert.equal(ntfyBase("http://ntfy.example.org"), null);
  assert.equal(ntfyBase("https://user:pw@ntfy.example.org"), null);
  assert.equal(notifySettingValue("gamewe_notify_smtp_host", "smtp.example.org\r\nX"), null);
  assert.equal(notifySettingValue("gamewe_notify_email_from", "x@example.org>\r\nBcc: y@example.org"), null);
  assert.equal(notifySettingValue("gamewe_notify_telegram_token", "x"), undefined); // no setting any more: per admin
  assert.equal(notifySettingValue("gamewe_page_size", "x"), undefined);
});

test("an admin's own: one bad channel is reported, nothing else counts", () => {
  assert.equal(badOwn({ email: { to: "me@example.org", events: ["reset"] }, ntfy: { to: "bad topic!", events: [] } }), "ntfy");
  assert.equal(badOwn({ telegram: { to: "@my_channel", events: ["update"] }, email: { to: "", events: [] } }), null);
  assert.equal(badOwn({ email: { to: "me@example.org", events: ["nope" as "reset"] } }), "email");
  // ntfy: a topic or a topic on an own https server
  assert.equal(badOwn({ ntfy: { to: "https://ntfy.example.org/my-topic", events: ["hof"] } }), null);
  assert.ok(ownNtfyOk("my_topic") && ownNtfyOk("https://push.example.org/ntfy/my-topic"));
  for (const bad of ["http://ntfy.example.org/t", "https://ntfy.example.org/", "https://ntfy.example.org/a b", "https://u:p@ntfy.example.org/t", "https://ntfy.example.org/t?x=1", "https://topic"]) assert.equal(ownNtfyOk(bad), false, bad);
  const v = ownValue({ to: "me@example.org", events: ["update", "reset"] });
  assert.equal(v, "reset,update|me@example.org");
  assert.deepEqual(parseOwn(v), { to: "me@example.org", events: ["reset", "update"] });
  assert.deepEqual(parseOwn(null), { to: "", events: [] });
});

test("status and hash as the collector writes and reads them", () => {
  assert.deepEqual(parseStatus("1794806121|ok"), { at: 1794806121, ok: true, error: "" });
  assert.deepEqual(parseStatus("1794806121|error|ntfy: Forbidden"), { at: 1794806121, ok: false, error: "ntfy: Forbidden" });
  assert.equal(parseStatus("garbage"), null);
  // internal/notify reads the same 32 hex digits (lower-case, trimmed name)
  assert.equal(userHash(" Admin "), userHash("admin"));
  assert.match(userHash("admin"), /^[0-9a-f]{32}$/);
  // internal/notify UserTokenKey and IsUserSecret
  assert.equal(ownTokenKey("Admin", "ntfy"), `gamewe_notifyu_${userHash("admin")}_ntfy_token`);
  assert.equal(ownTokenKey("Admin", "telegram"), `gamewe_notifyu_${userHash("admin")}_telegram_token`);
});

test("an admin's own tokens: what Telegram and ntfy use, no header injection", () => {
  assert.ok(ntfyTokenOk("tk_AbC123-_x"));
  for (const bad of ["", "tk_a b", "tk_a\r\nX-Evil: 1", "x".repeat(129)]) assert.equal(ntfyTokenOk(bad), false, bad);
  assert.ok(tokenOk("telegram", "123456:ABCdefGHIjklMNOpqrSTUvwxYZ012345678"));
  assert.equal(tokenOk("telegram", "tk_AbC123-_x"), false);
});

test("the ntfy server and topic fields of My account", () => {
  assert.equal(joinNtfy("", "mine"), "mine");
  assert.equal(joinNtfy("https://ntfy.sh/", "mine"), "mine");
  assert.equal(joinNtfy("https://push.example.org/ntfy/", "mine"), "https://push.example.org/ntfy/mine");
  assert.equal(joinNtfy("https://push.example.org", ""), ""); // no topic: the channel is removed
  assert.equal(ownNtfyOk(joinNtfy("http://push.example.org", "mine")), false); // a bad server stays and is refused
  assert.deepEqual(splitNtfy("https://push.example.org/ntfy/mine"), { server: "https://push.example.org/ntfy", topic: "mine" });
  assert.deepEqual(splitNtfy("mine"), { server: "", topic: "mine" });
});
