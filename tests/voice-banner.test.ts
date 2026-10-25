// Data of the TeamSpeak banner. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { voiceBannerData } from "../src/lib/banners/voice-banner-data.ts";

const ts = { name: "Clan TS", type: "TeamSpeak 3", country: "de", address: "ts.example.org", clients: 12, max: 32, channels: 25, uptime: 90061 };

test("online: live numbers and the share of the slots", () => {
  const d = voiceBannerData(ts);
  assert.equal(d.online, true);
  assert.equal(d.clients, 12);
  assert.equal(d.max, 32);
  assert.equal(d.share, 12 / 32);
  assert.equal(d.channels, 25);
  assert.equal(d.uptime, 90061);
  assert.equal(voiceBannerData({ ...ts, clients: 40 }).share, 1);
  assert.equal(voiceBannerData({ ...ts, max: 0 }).share, 0);
  assert.equal(voiceBannerData({ ...ts, max: null }).share, 0);
});

test("query failed: offline without numbers, name and address stay", () => {
  const d = voiceBannerData({ ...ts, clients: null, max: null, channels: null, uptime: null });
  assert.deepEqual(d, { name: "Clan TS", type: "TeamSpeak 3", country: "de", address: "ts.example.org", online: false, clients: null, max: null, share: 0, channels: null, uptime: null });
});

test("the server password and query settings never reach the banner", () => {
  const box = { ...ts, password: "secret-pw", link: "ts3server://ts.example.org", queryUser: "serveradmin", queryPassword: "q-secret", queryPort: 10011 };
  const d = voiceBannerData(box);
  assert.deepEqual(Object.keys(d).sort(), ["address", "channels", "clients", "country", "max", "name", "online", "share", "type", "uptime"]);
  const json = JSON.stringify(d);
  for (const s of ["secret-pw", "q-secret", "serveradmin", "10011"]) assert.ok(!json.includes(s), s);
});
