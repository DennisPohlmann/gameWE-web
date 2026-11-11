// A select that loads a new page and a pager link show at once that they are
// loading (src/components/pending.tsx), instead of nothing until the server
// answers. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (f: string) => readFileSync(f, "utf8");

test("the auto-submitting forms mark themselves busy from the submit on", () => {
  for (const f of ["src/components/auto-form.tsx", "src/components/place-select.tsx"]) {
    const s = read(f);
    assert.match(s, /const \[pending, start\] = useSubmitPending\(\)/, f);
    assert.match(s, /onSubmit=\{start\} aria-busy=\{pending \|\| undefined\}/, f);
  }
});

test("the busy state ends when the address changes, or after 10 s", () => {
  const s = read("src/components/pending.tsx");
  assert.match(s, /useEffect\(\(\) => setPending\(false\), \[at\]\)/);
  assert.match(s, /setTimeout\(\(\) => setPending\(false\), 10_000\)/);
});

test("every pager link carries the loading mark", () => {
  const ui = read("src/components/ui.tsx");
  const pager = ui.slice(ui.indexOf("export function Pager("), ui.indexOf("// Rows per page a visitor can pick"));
  const links = pager.match(/<Link[\s\S]*?<\/Link>/g) ?? [];
  assert.equal(links.length, 8);
  for (const l of links) assert.match(l, /<LinkPending \/>/);
});

test("the busy look is styled", () => {
  const css = read("src/app/(site)/globals.css");
  assert.match(css, /\.link-pending \{/);
  assert.match(css, /form\[aria-busy="true"\] select/);
});
