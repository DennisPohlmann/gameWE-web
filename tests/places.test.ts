// Parameters and links of the country, state and city rankings. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePlaceQuery, placeHref, placeTypes } from "../src/lib/places.ts";

test("the state ranking sits between the country and city rankings", () => {
  assert.deepEqual(placeTypes, { countryinfo: "country", stateinfo: "state", cityinfo: "city" });
});

test("a state is read only for the state ranking, with its country", () => {
  assert.deepEqual(parsePlaceQuery({ type: "stateinfo" }), { type: "stateinfo", country: "", state: "", city: "" });
  assert.deepEqual(parsePlaceQuery({ type: "stateinfo", valuecountry: "DE", valuestate: " Bavaria " }), { type: "stateinfo", country: "de", state: "bavaria", city: "" });
  // The select sends "de:bavaria" without a chosen country, so equal names in two countries stay apart.
  assert.deepEqual(parsePlaceQuery({ type: "stateinfo", valuestate: "de:bavaria" }), { type: "stateinfo", country: "de", state: "bavaria", city: "" });
  assert.deepEqual(parsePlaceQuery({ type: "stateinfo", valuecity: "munich" }), { type: "stateinfo", country: "", state: "", city: "" });
  assert.deepEqual(parsePlaceQuery({ type: "cityinfo", valuestate: "bavaria", valuecity: "us:springfield" }), { type: "cityinfo", country: "us", state: "", city: "springfield" });
});

test("unknown kinds, bad countries and overlong or control-character names are dropped", () => {
  for (const type of ["", "junk", "constructor", "toString", "STATEINFO"]) assert.equal(parsePlaceQuery({ type }).type, "");
  assert.equal(parsePlaceQuery({ type: "countryinfo", valuecountry: "deu" }).country, "");
  assert.equal(parsePlaceQuery({ type: "stateinfo", valuestate: "x".repeat(81) }).state, "");
  assert.equal(parsePlaceQuery({ type: "stateinfo", valuestate: "x".repeat(80) }).state, "x".repeat(80));
  assert.equal(parsePlaceQuery({ type: "stateinfo", valuestate: "a\u0000b" }).state, "");
});

test("place links in gameME's form", () => {
  assert.equal(placeHref("css", "DE"), "/css/players?type=countryinfo&valuecountry=de");
  assert.equal(placeHref("css", "de", "", "Bavaria"), "/css/players?type=stateinfo&valuecountry=de&valuestate=bavaria");
  assert.equal(placeHref("css", "us", "", "New York"), "/css/players?type=stateinfo&valuecountry=us&valuestate=new+york");
  assert.equal(placeHref("css", "de", "Munich", "Bavaria"), "/css/players?type=cityinfo&valuecountry=de&valuecity=munich");
});
