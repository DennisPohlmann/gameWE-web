// The sums over the players per location: Misc countries and connect
// methods, and the country, state and city selects of the player list,
// grouped like MariaDB's utf8mb4_unicode_ci. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { connectTypes, miscCountries, placeOptions, type PlaceCount } from "../src/lib/place-counts.ts";

const row = (p: Partial<PlaceCount>): PlaceCount => ({
  flag: "DE", country: "Germany", state: "Bavaria", city: "München", located: true, type: 0, hidden: false, n: 1, ...p,
});

const rows: PlaceCount[] = [
  row({ n: 5 }),
  row({ city: "Munchen ", n: 2, type: 1 }),
  row({ state: "Berlin", city: "Berlin", n: 4 }),
  row({ state: "02", city: "Nürnberg", n: 3 }),
  row({ flag: "AT", country: "Austria", state: "Vienna", city: "Vienna", n: 6, type: 2 }),
  row({ flag: "AT", country: "Austria", state: "Vienna", city: "Vienna", n: 9, hidden: true, type: 2 }),
  row({ flag: "", country: "", state: "", city: "", n: 1 }),
  row({ flag: null, country: null, state: null, city: null, located: false, n: 7, type: 1 }),
];

test("Misc countries: ranked players only, no location as one empty entry", () => {
  assert.deepEqual(miscCountries(rows), [
    { flag: "DE", country: "Germany", n: 14 },
    { flag: "", country: "", n: 8 },
    { flag: "AT", country: "Austria", n: 6 },
  ]);
});

test("connect methods count hidden players too, method 0 is left out", () => {
  assert.deepEqual(connectTypes(rows), [
    { type: 2, n: 15 },
    { type: 1, n: 9 },
  ]);
});

test("country select: lower-case codes, located ranked players with a flag", () => {
  assert.deepEqual(
    placeOptions(rows, "country").map((o) => [o.code, o.name, o.players]),
    [["de", "Germany", 14], ["at", "Austria", 6]],
  );
});

test("state select: names only (no legacy codes), one country", () => {
  assert.deepEqual(
    placeOptions(rows, "state", "de").map((o) => [o.state, o.players]),
    [["Bavaria", 7], ["Berlin", 4]],
  );
});

test("city select: case, accents and trailing spaces are one city", () => {
  assert.deepEqual(
    placeOptions(rows, "city").map((o) => [o.code, o.city, o.players]),
    [["de", "München", 7], ["at", "Vienna", 6], ["de", "Berlin", 4], ["de", "Nürnberg", 3]],
  );
});
