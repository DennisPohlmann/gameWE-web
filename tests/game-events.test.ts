// Latest events of a ranking or a player: hidden and banned players are left
// out on every kind of event, on either side, and every kind has a text in
// every language. Run with `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { shownEvents, type EventPerson } from "../src/lib/hidden.ts";

const KINDS = ["connect", "entry", "disconnect", "team", "role", "name", "action", "playeraction", "teambonus", "kill", "suicide", "teamkill"];
// Events with another player on the other side.
const WITH_OTHER = new Set(["playeraction", "kill", "teamkill"]);

const people: EventPerson[] = [
  { playerId: 1, name: "Shown", hideranking: 0 },
  { playerId: 2, name: "Hidden", hideranking: 1 },
  { playerId: 3, name: "Banned", hideranking: 2 },
  { playerId: 4, name: "Also shown", hideranking: "0" },
  { playerId: 5, name: "BOT Bob", hideranking: 1, bot: 1 },
];
const row = (kind: string, actor: number, other = 0) => ({ ts: 100, kind, actor, other });

test("rows of a hidden or banned actor are left out, whatever the kind", () => {
  for (const kind of KINDS) {
    const rows = [row(kind, 1), row(kind, 2), row(kind, 3), row(kind, 4), row(kind, 5)];
    assert.deepEqual(
      shownEvents(rows, people, 10).map((r) => r.actor),
      [1, 4, 5],
      kind,
    );
  }
});

test("rows with a hidden or banned victim or target are left out", () => {
  for (const kind of WITH_OTHER) {
    const rows = [row(kind, 1, 4), row(kind, 1, 2), row(kind, 4, 3), row(kind, 4, 5)];
    const shown = shownEvents(rows, people, 10);
    assert.deepEqual(shown.map((r) => [r.actor, r.other]), [[1, 4], [4, 5]], kind);
    assert.deepEqual(shown.map((r) => r.otherName), ["Also shown", "BOT Bob"], kind);
  }
});

test("no name or id of a hidden player reaches the rows", () => {
  const rows = KINDS.flatMap((k) => [row(k, 1, WITH_OTHER.has(k) ? 2 : 0), row(k, 2), row(k, 3, 1), row(k, 1)]);
  const json = JSON.stringify(shownEvents(rows, people, 100));
  assert.doesNotMatch(json, /Hidden|Banned/);
  for (const r of shownEvents(rows, people, 100)) {
    assert.ok(![2, 3].includes(r.actor) && ![2, 3].includes(r.other));
  }
});

test("an actor not loaded (moved away) drops the row; an unknown other side has no id", () => {
  const shown = shownEvents([row("kill", 9, 1), row("kill", 1, 9)], people, 10);
  assert.deepEqual(shown.map((r) => [r.actor, r.other, r.otherName]), [[1, 0, null]]);
});

test("the page's own player is never hidden and keeps rows where they are the other side", () => {
  const me: EventPerson[] = [...people, { playerId: 6, name: "Me", hideranking: 0 }];
  const shown = shownEvents([row("kill", 9, 6), row("kill", 2, 6), row("kill", 6, 1)], me, 10, 6);
  assert.deepEqual(shown.map((r) => [r.actor, r.other]), [[0, 6], [6, 1]]);
});

test("at most `limit` rows, in the given order", () => {
  const rows = [1, 4, 1, 4, 1].map((a, i) => ({ ...row("entry", a), ts: 100 - i }));
  assert.deepEqual(shownEvents(rows, people, 3).map((r) => r.ts), [100, 99, 98]);
});

test("every event kind has a text in every language", () => {
  const dir = "src/translations";
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const ev: Record<string, string> = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")).evText ?? {};
    for (const k of KINDS) {
      assert.ok(typeof ev[k] === "string" && ev[k].trim(), `${f}: evText.${k}`);
      if (WITH_OTHER.has(k)) assert.match(ev[k], /\{p\}/, `${f}: evText.${k} names the other player`);
    }
  }
});
