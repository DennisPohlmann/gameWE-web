// Header tabs: order, defaults of older installations and form validation.
// Run with `npm test` (node --test, Node's built-in type stripping).
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ORDER, headerOrder, headerTabs, homeValue, linkProblem, linkValue, parseHome, parseLink } from "../src/lib/header-links.ts";

const t = { home: "Home", search: "Search", help: "Help", licenses: "Licenses", privacy: "Privacy" };
const ids = (tabs: { id: string }[]) => tabs.map((x) => x.id);

test("no stored order keeps the old default order", () => {
  assert.deepEqual(headerOrder(undefined), DEFAULT_ORDER);
  assert.deepEqual(headerOrder(""), DEFAULT_ORDER);
  assert.deepEqual(DEFAULT_ORDER.slice(0, 7), ["home", "search", "help", "licenses", "privacy", "sourcebans", "link1"]);
});

test("stored order wins; unknown and repeated ids are dropped, missing ones appended", () => {
  const o = headerOrder(" link2 ,HOME,bogus,help,link2,,javascript:alert(1)");
  assert.deepEqual(o.slice(0, 3), ["link2", "home", "help"]);
  assert.equal(o.length, DEFAULT_ORDER.length);
  assert.equal(new Set(o).size, o.length);
  assert.deepEqual(o.slice(3), ["search", "licenses", "privacy", "sourcebans", "link1", "link3", "link4", "link5", "link6"]);
});

test("an existing installation without order renders as before", () => {
  // e.g. one own link "Info" in slot 1, SourceBans configured.
  const tabs = headerTabs(
    { order: headerOrder(undefined), home: parseHome(undefined), links: [parseLink("Info|https://example.org/info"), null, null, null, null, null], sourcebansUrl: "https://bans.example.org/" },
    t,
  );
  assert.deepEqual(ids(tabs), ["home", "search", "help", "licenses", "privacy", "sourcebans", "link1"]);
  assert.deepEqual(tabs[0], { id: "home", label: "Home", href: "/", kind: "page" });
  assert.deepEqual(tabs[4], { id: "privacy", label: "Privacy", href: "/privacy", kind: "page" });
  assert.equal(tabs[6].label, "Info");
  assert.equal(tabs[6].kind, "external");
});

test("tabs follow the saved order; SourceBans only when configured", () => {
  const links = [parseLink("Info|/info"), null, parseLink("Forum|https://example.org"), null, null, null];
  const order = headerOrder("link3,licenses,home,sourcebans,link1");
  assert.deepEqual(ids(headerTabs({ order, home: parseHome(""), links, sourcebansUrl: "" }, t)), ["link3", "licenses", "privacy", "home", "link1", "search", "help"]);
  assert.deepEqual(ids(headerTabs({ order, home: parseHome(""), links, sourcebansUrl: "https://bans.example.org/" }, t)).slice(0, 5), ["link3", "licenses", "privacy", "home", "sourcebans"]);
});

test("Privacy: after Licenses in an order saved before it existed, else where it was saved", () => {
  assert.deepEqual(headerOrder("home,licenses,search,help,sourcebans").slice(0, 3), ["home", "licenses", "privacy"]);
  assert.deepEqual(headerOrder("privacy,home,licenses,search").slice(0, 3), ["privacy", "home", "licenses"]);
  assert.equal(headerOrder("home,licenses").filter((id) => id === "privacy").length, 1);
});

test("SourceBans tab is left out when an own link already points there", () => {
  const links = [parseLink("Bans|https://bans.example.org/index.php"), null, null, null, null, null];
  const tabs = headerTabs({ order: headerOrder(""), home: parseHome(""), links, sourcebansUrl: "https://bans.example.org/" }, t);
  assert.ok(!ids(tabs).includes("sourcebans"));
});

test("Home label and address", () => {
  const order = headerOrder("");
  const links = Array(6).fill(null);
  assert.deepEqual(headerTabs({ order, home: parseHome("Start|"), links, sourcebansUrl: "" }, t)[0], { id: "home", label: "Start", href: "/", kind: "page" });
  assert.equal(headerTabs({ order, home: parseHome("|/portal"), links, sourcebansUrl: "" }, t)[0].kind, "path");
  assert.equal(headerTabs({ order, home: parseHome("Clan|https://example.org"), links, sourcebansUrl: "" }, t)[0].kind, "external");
  // Unsafe stored address falls back to the start page.
  assert.equal(headerTabs({ order, home: parseHome("X|javascript:alert(1)"), links, sourcebansUrl: "" }, t)[0].href, "/");
  assert.equal(headerTabs({ order, home: parseHome("X|//evil.example"), links, sourcebansUrl: "" }, t)[0].href, "/");
  assert.equal(parseLink("X|//evil.example"), null);
});

test("own link validation", () => {
  assert.equal(linkValue("", ""), "");
  assert.equal(linkValue("Forum", "www.example.org"), "Forum|https://www.example.org");
  assert.equal(linkValue("Info", "/info"), "Info|/info");
  assert.equal(linkValue("Info", "//evil.example"), null);
  assert.equal(linkValue("Info", "javascript:alert(1)"), null);
  assert.equal(linkValue("A|B", "/x"), null);
  assert.equal(linkProblem("", "/x"), "label");
  assert.equal(linkProblem("Info", ""), "url");
  assert.equal(linkProblem("Info", "not a url"), "both");
  assert.equal(linkProblem("x".repeat(61), "/x"), "long");
  assert.equal(linkProblem("Info", "https://example.org"), null);
});

test("Home validation", () => {
  assert.equal(homeValue("", ""), "");
  assert.equal(homeValue("Start", ""), "Start|");
  assert.equal(homeValue("", "/portal"), "|/portal");
  assert.equal(homeValue("Start", "example.org"), "Start|https://example.org");
  assert.equal(homeValue("Start", "javascript:alert(1)"), null);
  assert.equal(homeValue("a|b", ""), null);
});
