// Old HLstatsX:CE addresses move to this site's pages (src/lib/legacy-urls.ts),
// and the canonical link keeps only the parameters that choose content
// (src/lib/canonical.ts). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { legacyTarget, type LegacyLookups, type LegacyScript } from "../src/lib/legacy-urls.ts";
import { canonicalPath } from "../src/lib/canonical.ts";

const look: LegacyLookups = {
  async gameOf(kind, id) {
    return ({ player: { 12: "css" }, clan: { 3: "tf" }, server: { 2: "csgo" } } as Record<string, Record<number, string>>)[kind][id] ?? null;
  },
  async actionId(game, code) {
    return game === "css" && code === "Planted_The_Bomb" ? 41 : null;
  },
};
const go = (q: string, script: LegacyScript = "hlstats.php") => legacyTarget(script, new URLSearchParams(q), look);

test("old HLstatsX:CE links move to the new pages", async () => {
  const cases: [string, string | null][] = [
    ["", "/"],
    ["game=css", "/css"],
    ["mode=contents&game=css", "/css"],
    ["mode=nonsense&game=css", "/css"],
    ["mode=players&game=css", "/css/players"],
    ["mode=players", "/"],
    ["mode=clans&game=css", "/css/clans"],
    ["mode=maps&game=css&sort=kills", "/css/maps"],
    ["mode=bans&game=css", "/css/bans"],
    ["mode=playerinfo&player=12", "/css/players/12"],
    ["mode=playerinfo&player=12&game=tf&tab=weapons", "/css/players/12"],
    ["mode=playerinfo&player=99", null],
    ["mode=playerinfo&player=abc", null],
    ["mode=playerinfo&uniqueid=STEAM_0:1:2&game=css", "/search?q=STEAM_0%3A1%3A2&st=uniqueid&game=css"],
    ["mode=playerhistory&player=12", "/css/players/12/events"],
    ["mode=playersessions&player=12", "/css/players/12/sessions"],
    ["mode=playerawards&player=12", "/css/players/12/awards"],
    ["mode=chathistory&player=12", "/css/players/12/chat"],
    ["mode=claninfo&clan=3", "/tf/clans/3"],
    ["mode=claninfo&clan=4", null],
    ["mode=servers&server_id=2", "/csgo/servers/2"],
    ["mode=servers&game=css", "/css"],
    ["mode=weaponinfo&weapon=ak47&game=css", "/css/weapons/ak47"],
    ["mode=weaponinfo&weapon=ak47", "/"],
    ["mode=mapinfo&map=de_dust2&game=css", "/css/maps/de_dust2"],
    ["mode=mapinfo&map=workshop/123/de_x&game=csgo", "/csgo/maps/workshop%2F123%2Fde_x"],
    ["mode=actioninfo&action=Planted_The_Bomb&game=css", "/css/actions/41"],
    ["mode=actioninfo&action=Unknown&game=css", "/css/actions"],
    ["mode=awards&game=css&tab=ranks", "/css/awards?view=ranks"],
    ["mode=awards&game=css&tab=daily", "/css/awards"],
    ["mode=rankinfo&rank=5&game=css", "/css/awards?view=ranks"],
    ["mode=ribboninfo&ribbon=5&game=css", "/css/awards?view=ribbons"],
    ["mode=dailyawardinfo&award=5&game=css", "/css/awards"],
    ["mode=countryclansinfo&flag=DE&game=css", "/css/clans"],
    ["mode=rolesinfo&role=scout&game=tf", "/tf/teams"],
    ["mode=search&q=dennis&st=player&game=css", "/search?q=dennis&st=names&game=css"],
    ["mode=search", "/search"],
    ["mode=help", "/help"],
    ["mode=teamspeak&game=css&tsId=1", "/voice"],
    ["mode=admin", "/admin"],
    // A game code that is no code never reaches the Location header.
    ["mode=players&game=//evil.example", "/"],
    ["mode=players&game=css%0d%0aSet-Cookie:x", "/"],
  ];
  for (const [q, want] of cases) assert.equal(await go(q), want, q);
});

test("in-game pages, signatures and server banners", async () => {
  assert.equal(await go("mode=statsme&player=12", "ingame.php"), "/css/players/12");
  assert.equal(await go("mode=kills&player=12&game=css", "ingame.php"), "/css/players/12");
  assert.equal(await go("mode=weapons&game=css", "ingame.php"), "/css/weapons");
  assert.equal(await go("mode=status&game=css", "ingame.php"), "/css");
  assert.equal(await go("mode=mapinfo&map=de_dust2&game=css", "ingame.php"), "/css/maps/de_dust2");
  assert.equal(await go("player_id=12&background=random", "sig.php"), "/sig/12.png");
  assert.equal(await go("", "sig.php"), null);
  assert.equal(await go("server_id=2&game=csgo", "status.php"), "/banner/csgo/server/2.png");
  assert.equal(await go("server_id=7", "status.php"), null);
  assert.equal(await go("mode=players&game=css", "index.php"), "/css/players");
});

test("the canonical address keeps only what chooses the content", () => {
  assert.equal(canonicalPath("/css/players"), "/css/players");
  assert.equal(canonicalPath("/css/players?sort=kills&dir=asc&rows=100"), "/css/players");
  assert.equal(canonicalPath("/css/players?page=1"), "/css/players");
  assert.equal(canonicalPath("/css/players?page=3&sort=kills"), "/css/players?page=3");
  assert.equal(canonicalPath("/css/awards?rank=2&view=ranks&utm_source=x"), "/css/awards?view=ranks&rank=2");
  assert.equal(canonicalPath("/css/players/12?tab=weapons"), "/css/players/12?tab=weapons");
  assert.equal(canonicalPath("/search?q=dennis"), "/search");
  assert.equal(canonicalPath("//evil.example/x"), null);
  assert.equal(canonicalPath("evil"), null);
  assert.equal(canonicalPath(null), null);
});
