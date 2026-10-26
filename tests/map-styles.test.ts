// The satellite view of the player maps (src/lib/map-styles.ts): the stored
// choice, the ArcGIS key and the layers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { esriKey, mapSatellite, satelliteId, satelliteLayers } from "../src/lib/map-styles.ts";

const texts = { mapViewMap: "Map", mapViewSatellite: "Satellite", mapView: "Map view" };

test("satellite choice defaults to EOX", () => {
  assert.equal(satelliteId(undefined), "eox");
  assert.equal(satelliteId(""), "eox");
  assert.equal(satelliteId("google"), "eox");
  assert.equal(satelliteId(" esri "), "esri");
  assert.equal(satelliteId("off"), "off");
});

test("ArcGIS key keeps only key characters", () => {
  assert.equal(esriKey("AAPK0123456789abcdef_XYZ-1.2"), "AAPK0123456789abcdef_XYZ-1.2");
  assert.equal(esriKey("short"), "");
  assert.equal(esriKey('AAPK0123456789abcdef"><script>'), "");
  assert.equal(esriKey("AAPK0123456789abcdef&f=json"), "");
  assert.equal(esriKey("A".repeat(256)), "");
});

test("EOX: imagery under EOX labels, without a key", () => {
  const [img, labels, ...rest] = satelliteLayers("eox");
  assert.equal(rest.length, 0);
  assert.match(img.url, /^https:\/\/tiles\.maps\.eox\.at\/wmts\/1\.0\.0\/s2cloudless-\d{4}_3857\/default\/g\/\{z\}\/\{y\}\/\{x\}\.jpg$/);
  assert.match(img.attribution, /EOX IT Services GmbH/);
  assert.match(img.attribution, /Copernicus Sentinel data/);
  assert.match(labels.url, /^https:\/\/tiles\.maps\.eox\.at\/wmts\/1\.0\.0\/overlay_bright_3857\/default\/g\/\{z\}\/\{y\}\/\{x\}\.png$/);
  assert.match(labels.attribution, /OpenStreetMap/);
});

test("Esri: imagery, roads and places, with the key in every tile address", () => {
  const layers = satelliteLayers("esri", "AAPK0123456789abcdef_XYZ");
  assert.equal(layers.length, 3);
  assert.match(layers[0].url, /World_Imagery/);
  assert.match(layers[0].attribution, /Esri/);
  assert.match(layers[0].url, /^https:\/\/ibasemaps-api\.arcgis\.com\/arcgis\/rest\/services\/World_Imagery\//);
  for (const l of layers.slice(1)) assert.match(l.url, /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/Reference\//);
  for (const l of layers) {
    assert.ok(l.url.endsWith("?token=AAPK0123456789abcdef_XYZ"));
  }
  for (const l of satelliteLayers("esri")) {
    assert.ok(!l.url.includes("token"));
    assert.match(l.url, /^https:\/\/server\.arcgisonline\.com\//);
  }
});

test("off: no layers and no switch", () => {
  assert.deepEqual(satelliteLayers("off"), []);
  assert.equal(mapSatellite({ mapSatellite: "off", mapEsriKey: "" }, texts), undefined);
  assert.deepEqual(mapSatellite({ mapSatellite: "eox", mapEsriKey: "" }, texts)?.satellite, "Satellite");
});
