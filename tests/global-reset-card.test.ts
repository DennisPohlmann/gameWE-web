// The scheduled reset for all rankings is on the reset page (Admin > Reset
// ranking), not at the end of Admin > Rankings; old links still get there.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = (f: string) => readFileSync(f, "utf8");
const reset = src("src/app/admin/(panel)/reset/page.tsx");
const rankings = src("src/app/admin/(panel)/rankings/page.tsx");
const actions = src("src/app/admin/actions.ts");

test("the card is on the reset page, level 100 as before", () => {
  assert.match(reset, /import \{ GlobalHallCard \} from "\.\/global-hall-card"/);
  assert.match(reset, /<GlobalHallCard lang=\{lang\} status=\{sp\.hof\}/);
  assert.match(reset, /await requireAdmin\(LEVEL_ADMIN\)/);
  // Also when the jobs table is missing: the schedule does not need it.
  const missing = reset.slice(reset.indexOf("if (!(await jobsAvailable()))"), reset.indexOf("const games ="));
  assert.match(missing, /\{scheduled\}/);
  // Templates (no servers) never follow it.
  assert.match(reset, /rankingSummaries\(\)\)\.filter\(\(r\) => r\.servers > 0\)/);
  assert.match(src("src/app/admin/(panel)/reset/global-hall-card.tsx"), /id="hall-of-fame"/);
});

test("the rankings list no longer has it, old links go to the reset page", () => {
  assert.doesNotMatch(rankings, /GlobalHallCard/);
  assert.match(rankings, /<HashRedirect hash="hall-of-fame" to="\/admin\/reset#hall-of-fame" \/>/);
  // ?hof= after saving (before the move) only for level 100, known values only.
  assert.match(rankings, /if \(isAdmin && hof && \["on", "off", "input", "confirm"\]\.includes\(hof\)\) redirect\(`\/admin\/reset\?hof=\$\{hof\}#hall-of-fame`\)/);
});

test("saving returns to the reset page and links point there", () => {
  const action = actions.slice(actions.indexOf("export async function globalHallAction"), actions.indexOf("export async function hallEntryAction"));
  assert.match(action, /requireAdmin\(LEVEL_ADMIN\)/);
  assert.match(action, /const back = "\/admin\/reset";/);
  assert.match(src("src/app/admin/(panel)/rankings/[code]/hall-of-fame-card.tsx"), /href="\/admin\/reset#hall-of-fame"/);
  assert.match(src("src/app/admin/(panel)/jobs/page.tsx"), /"\/admin\/reset#hall-of-fame"/);
  assert.doesNotMatch(src("src/app/admin/(panel)/rankings/[code]/hall-of-fame-card.tsx"), /\/admin\/rankings#hall-of-fame/);
});
