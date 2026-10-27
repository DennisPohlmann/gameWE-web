// The tile sets of the player maps (src/lib/map-styles.ts): OpenStreetMap
// only; a stored style that is no longer offered shows the design's map.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapStyleId, mapStyles } from "../src/lib/map-styles.ts";

test("only OpenStreetMap tiles", () => {
  assert.deepEqual(Object.keys(mapStyles).sort(), ["osm", "osm-dark"]);
  for (const s of Object.values(mapStyles)) assert.match(s.url, /^https:\/\/tile\.openstreetmap\.org\//);
});

test("former styles and unknown values fall back to auto", () => {
  assert.equal(mapStyleId("osm"), "osm");
  assert.equal(mapStyleId(" osm-dark "), "osm-dark");
  for (const s of [undefined, "", "auto", "hot", "topo", "carto-light", "carto-voyager", "carto-dark", "nope"]) assert.equal(mapStyleId(s), "auto", String(s));
});
