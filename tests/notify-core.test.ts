// Notifications (lib/notify-core.ts): what the web lets through to the
// collector, and the stored forms it shares with it.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { badOwn, ntfyTokenOk, ownNtfyOk, ownTokenKey, notifySettingValue, ntfyBase, ownValue, parseOwn, parseStatus, recipients, userHash } from "../src/lib/notify-core.ts";

test("shared e-mail recipients: checked, each once, at most 20", () => {
  assert.equal(recipients("a@example.org; b@example.org a@example.org"), "a@example.org, b@example.org");
  assert.equal(recipients("a@example.org, nope"), null);
  assert.equal(recipients("a@example.org\r\nBcc: x@example.org"), null);
  assert.equal(recipients(Array.from({ length: 21 }, (_, i) => `u${i}@example.org`).join(",")), null);
});

test("server fields: ntfy https only, no header injection", () => {
  assert.equal(ntfyBase("https://ntfy.example.org/"), "https://ntfy.example.org");
  assert.equal(ntfyBase("http://ntfy.example.org"), null);
  assert.equal(ntfyBase("https://user:pw@ntfy.example.org"), null);
  assert.equal(notifySettingValue("gamewe_notify_smtp_host", "smtp.example.org\r\nX"), null);
  assert.equal(notifySettingValue("gamewe_notify_email_from", "x@example.org>\r\nBcc: y@example.org"), null);
  assert.equal(notifySettingValue("gamewe_notify_telegram_token", "123:short"), null);
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
  assert.equal(ownTokenKey("Admin"), `gamewe_notifyu_${userHash("admin")}_ntfy_token`);
});

test("an admin's own ntfy token: the characters ntfy uses, no header injection", () => {
  assert.ok(ntfyTokenOk("tk_AbC123-_x"));
  for (const bad of ["", "tk_a b", "tk_a\r\nX-Evil: 1", "x".repeat(129)]) assert.equal(ntfyTokenOk(bad), false, bad);
});
