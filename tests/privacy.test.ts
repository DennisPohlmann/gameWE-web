// Privacy page: the operator's form (validation, splitting over several
// hlstats_Options rows, safe text) and the generated lists.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CONSENT_CATEGORIES } from "../src/lib/consent.ts";
import { STORAGE, browserThirdParties, imageHosts, serverThirdParties, type InventoryInput } from "../src/lib/privacy-inventory.ts";
import { ALL_OPERATOR_KEYS, TEXT_CHUNK, TEXT_MAX, cleanText, linkParts, operatorValues, readOperator, textBlocks, validEmail } from "../src/lib/privacy-operator.ts";

const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

function saved(o: Record<string, string>) {
  const res = operatorValues(form(o));
  assert.ok("values" in res, JSON.stringify(res));
  return Object.fromEntries(res.values);
}

test("every key fits old HLstatsX:CE tables (keyname 32, value 128)", () => {
  for (const k of ALL_OPERATOR_KEYS) assert.ok(k.length <= 32, k);
  const rows = saved({ name: "N", address: "A", email: "a@example.org", text: "ü😀".repeat(TEXT_MAX / 2) });
  for (const [k, v] of Object.entries(rows)) {
    assert.ok(ALL_OPERATOR_KEYS.includes(k), k);
    assert.ok(Array.from(v).length <= 128, k);
  }
});

test("long text is split and read back unchanged, also emoji at a chunk border", () => {
  const text = "a".repeat(TEXT_CHUNK - 1) + "😀" + "Zeile 2\n\nAbsatz 2 " + "x".repeat(500);
  const rows = saved({ name: "Max Mustermann", address: "Weg 1\n12345 Ort", email: "info@example.org", text });
  const back = readOperator(rows);
  assert.equal(back.text, text);
  assert.equal(back.address, "Weg 1\n12345 Ort");
  assert.equal(back.name, "Max Mustermann");
});

test("a shorter text clears the rows of a longer one", () => {
  const rows = saved({ text: "kurz" });
  const filled = Object.entries(rows).filter(([k, v]) => k.startsWith("gamewe_privacy_text_") && v);
  assert.deepEqual(filled, [["gamewe_privacy_text_1", "kurz"]]);
});

test("bad fields are refused", () => {
  assert.deepEqual(operatorValues(form({ email: "no-at-sign" })), { field: "email" });
  assert.deepEqual(operatorValues(form({ email: "a@b" })), { field: "email" });
  assert.deepEqual(operatorValues(form({ email: "x@example.org\nBcc: y@example.org" })), { field: "email" });
  assert.deepEqual(operatorValues(form({ name: "n".repeat(121) })), { field: "name" });
  assert.deepEqual(operatorValues(form({ address: "1\n2\n3\n4\n5\n6\n7" })), { field: "address" });
  assert.deepEqual(operatorValues(form({ text: "t".repeat(TEXT_MAX + 1) })), { field: "text" });
  assert.ok("values" in operatorValues(form({})));
  assert.ok(validEmail("datenschutz@clan.example.org"));
});

test("control characters, direction marks and CRLF are cleaned", () => {
  assert.equal(cleanText("a\r\nb‮c\u0000d​\n\n\n\ne  "), "a\nbcd\n\ne");
  assert.equal(saved({ name: " Max\n  Muster " }).gamewe_privacy_name, "Max Muster");
});

test("the free text becomes text and safe links, never HTML", () => {
  const blocks = textBlocks('<script>alert(1)</script>\nSiehe https://example.org/x. oder javascript:alert(1)\n\nMail: a@example.org');
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0][0], [{ text: "<script>alert(1)</script>" }]);
  assert.deepEqual(blocks[0][1], [{ text: "Siehe " }, { href: "https://example.org/x", text: "https://example.org/x" }, { text: ". oder javascript:alert(1)" }]);
  assert.deepEqual(blocks[1][0], [{ text: "Mail: " }, { href: "mailto:a@example.org", text: "a@example.org" }]);
  for (const p of linkParts('x "https://e.org/a"onmouseover=1 y')) if ("href" in p) assert.ok(!/["<>]/.test(p.href));
});

const base: InventoryInput = { mapStyle: "auto", satellite: "", maps: true, steamProfiles: true, voice: "none", sourcebans: false, images: [], ownHost: "stats.example.org" };

test("every outside host the browser loads needs a consent category, except the operator's pictures", () => {
  const rows = browserThirdParties({ ...base, images: ["https://cdn.example.net/logo.png", "/own.png"] });
  for (const r of rows) {
    if (r.purpose === "tpOperatorImages") assert.equal(r.consent, null);
    else assert.ok(r.consent && CONSENT_CATEGORIES.includes(r.consent), r.provider);
  }
  const hosts = rows.flatMap((r) => r.hosts);
  for (const h of ["tile.openstreetmap.org", "avatars.steamstatic.com", "tiles.maps.eox.at", "cdn.example.net"]) assert.ok(hosts.includes(h), h);
  // The EOX labels come from EOX itself, CARTO only as the tile set.
  assert.ok(!hosts.includes("basemaps.cartocdn.com"));
});

test("the lists follow the settings", () => {
  const hosts = (i: InventoryInput) => browserThirdParties(i).flatMap((r) => r.hosts);
  assert.ok(hosts({ ...base, mapStyle: "carto-dark", satellite: "off" }).includes("basemaps.cartocdn.com"));
  assert.ok(!hosts({ ...base, satellite: "off" }).includes("tiles.maps.eox.at"));
  assert.ok(hosts({ ...base, satellite: "esri" }).includes("server.arcgisonline.com"));
  assert.ok(hosts({ ...base, satellite: "esri" }).includes("ibasemaps-api.arcgis.com"));
  assert.ok(!hosts({ ...base, satellite: "esri" }).includes("tiles.maps.eox.at"));
  assert.ok(hosts({ ...base, mapStyle: "topo", satellite: "off" }).includes("tile.opentopomap.org"));
  assert.deepEqual(hosts({ ...base, maps: false, steamProfiles: false }), []);
  assert.ok(serverThirdParties({ ...base, voice: "discord" }).some((r) => r.provider === "Discord"));
  assert.ok(!serverThirdParties(base).some((r) => r.provider === "Discord"));
  assert.ok(serverThirdParties(base).every((r) => r.consent === null));
});

test("operator pictures: only other hosts, each once", () => {
  assert.deepEqual(imageHosts(["/a.png", "https://stats.example.org/b.png", "https://CDN.example.net/c.png", "https://cdn.example.net/d.png", "http://x.example/e.png", "data:x"], "stats.example.org"), ["cdn.example.net", "x.example"]);
});

test("the storage list names the consent cookie and has no duplicates", () => {
  const names = STORAGE.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
  for (const n of ["gamewe_consent", "gamewe_lang", "gamewe_session", "gamewe-map-view"]) assert.ok(names.includes(n), n);
});
