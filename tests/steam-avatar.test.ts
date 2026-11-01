// Steam avatar URLs: only https on Steam's own image hosts (lib/steam-avatar.ts).
// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { STEAM_AVATAR_HOSTS, steamAvatarUrl } from "../src/lib/steam-avatar";

test("avatars only from Steam's image hosts over https", () => {
  for (const h of STEAM_AVATAR_HOSTS) assert.equal(steamAvatarUrl(`https://${h}/abc_full.jpg`), `https://${h}/abc_full.jpg`);
  for (const bad of [
    "http://avatars.steamstatic.com/abc_full.jpg",
    "https://avatars.steamstatic.com.evil.example/a.jpg",
    "https://evil.example/avatars.steamstatic.com/a.jpg",
    "https://user@avatars.steamstatic.com/a.jpg",
    "https://avatars.steamstatic.com:8443/a.jpg",
    "https://127.0.0.1/a.jpg",
    "javascript:alert(1)",
    "not a url",
    "",
    null,
    undefined,
  ]) assert.equal(steamAvatarUrl(bad), null, String(bad));
});
