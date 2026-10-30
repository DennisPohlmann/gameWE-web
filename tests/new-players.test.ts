// "New players" (/<game>/players?view=new): only players whose first
// connect was at most NEW_PLAYER_DAYS (7) days ago, newest first; the line on
// the ranking's page counts the same. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const data = readFileSync("src/lib/data.ts", "utf8");
const players = readFileSync("src/app/(site)/[game]/players/page.tsx", "utf8");
const start = readFileSync("src/app/(site)/[game]/page.tsx", "utf8");

test("the list filters by the first connect, not only sorts by it", () => {
  assert.match(data, /export const NEW_PLAYER_DAYS = 7;/);
  assert.match(data, /if \(opts\.newDays\) \{\s*\n[^\n]*\n\s*where\.push\(`d\.first_connect >= \?`\);/);
  // The count joins the players' data too when the filter is on.
  assert.match(data, /const countFrom = opts\.search \|\| local \|\| opts\.newDays \? from :/);
  assert.match(players, /newDays: view === "new" \? NEW_PLAYER_DAYS : undefined,/);
  assert.match(players, /sortParam\(rankingSorts, rawSort, view === "new" \? "new" :/);
  assert.match(readFileSync("src/lib/sorts.ts", "utf8"), /new: "d\.first_connect"/);
});

test("the line on the ranking's page counts the new players of 7 days, the API keeps 24 hours", () => {
  assert.match(start, /new: fmtNum\(totals\.newPlayersWeek, lang\)/);
  assert.match(data, /\[nowUnix\(\) - NEW_PLAYER_DAYS \* 86400, game\]/);
  assert.match(readFileSync("src/app/api/v1/rankings/[game]/route.ts", "utf8"), /newPlayers24h: totals\.newPlayers,/);
});

test("every language says 7 days in the line, English and German explain the list", () => {
  for (const lang of ["da", "de", "en", "es", "fr", "nl", "pl", "pt-br", "pt", "ru", "sr", "zh-cn", "zh-tw"]) {
    const d = JSON.parse(readFileSync(`src/translations/${lang}.json`, "utf8"));
    assert.doesNotMatch(d.tracking, /24/, lang);
    assert.match(d.tracking, /7/, lang);
  }
  for (const lang of ["en", "de"]) {
    const d = JSON.parse(readFileSync(`src/translations/${lang}.json`, "utf8"));
    assert.match(d.newPlayersHint, /\{n\}/, lang);
    assert.match(d.noNewPlayers, /\{n\}/, lang);
  }
});
