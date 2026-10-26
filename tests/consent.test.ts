// Cookie consent: the stored value, the form choices, the origin check and
// that Steam pictures and maps stay blocked without consent.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONSENT_VERSION,
  NO_CONSENT,
  chosenCategories,
  externalImage,
  parseConsent,
  sameOrigin,
  serializeConsent,
} from "../src/lib/consent.ts";

const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

test("no cookie, garbage or another version means: not answered, nothing allowed", () => {
  for (const raw of [undefined, null, "", "x", "1", "1.maps-bogus", "2.maps-steam", "0.", "1.maps;steam", "1.MAPS", `${CONSENT_VERSION}.maps-steam-`]) {
    assert.deepEqual(parseConsent(raw), NO_CONSENT, String(raw));
  }
});

test("stored choices round-trip", () => {
  assert.deepEqual(parseConsent(serializeConsent([])), { answered: true, maps: false, steam: false });
  assert.deepEqual(parseConsent(serializeConsent(["steam"])), { answered: true, maps: false, steam: true });
  assert.deepEqual(parseConsent(serializeConsent(["steam", "maps", "maps"])), { answered: true, maps: true, steam: true });
  assert.equal(serializeConsent(["steam", "maps"]), `${CONSENT_VERSION}.maps-steam`);
});

test("form choices: all, necessary, save with checkboxes, allow one more", () => {
  assert.deepEqual(chosenCategories(form({ choice: "all" }), NO_CONSENT), ["maps", "steam"]);
  assert.deepEqual(chosenCategories(form({ choice: "necessary", maps: "1", steam: "1" }), NO_CONSENT), []);
  assert.deepEqual(chosenCategories(form({ choice: "save", steam: "1" }), NO_CONSENT), ["steam"]);
  assert.deepEqual(chosenCategories(form({ choice: "save", maps: "yes" }), NO_CONSENT), []);
  const steamOnly = parseConsent(serializeConsent(["steam"]));
  assert.deepEqual(chosenCategories(form({ choice: "allow", category: "maps" }), steamOnly), ["maps", "steam"]);
  assert.equal(chosenCategories(form({ choice: "allow", category: "ads" }), steamOnly), null);
  assert.equal(chosenCategories(form({ choice: "bogus" }), steamOnly), null);
  assert.equal(chosenCategories(form({}), steamOnly), null);
});

test("Steam pictures only with consent to them", () => {
  const url = "https://avatars.steamstatic.com/x_full.jpg";
  assert.equal(externalImage(NO_CONSENT, url), null);
  assert.equal(externalImage(parseConsent("1."), url), null);
  assert.equal(externalImage(parseConsent("1.maps"), url), null);
  assert.equal(externalImage(parseConsent("1.steam"), url), url);
  assert.equal(externalImage(parseConsent("1.steam"), null), null);
});

test("the choice is only taken from the site itself", () => {
  assert.equal(sameOrigin("https://stats.example.org", "stats.example.org"), true);
  assert.equal(sameOrigin("https://evil.example", "stats.example.org"), false);
  assert.equal(sameOrigin(null, "stats.example.org"), false);
  assert.equal(sameOrigin("null", "stats.example.org"), false);
  assert.equal(sameOrigin("null", "stats.example.org", "same-origin"), true);
  assert.equal(sameOrigin("https://stats.example.org", "stats.example.org", "cross-site"), false);
  assert.equal(sameOrigin("https://stats.example.org", "stats.example.org", "same-site"), false);
});

