// Hidden players: who counts as hidden, the live list entry without id, and
// the SQL conditions. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { hiddenSql, isBotSql, isHidden, liveEntry } from "../src/lib/hidden.ts";

test("hidden means any hideranking other than 0, but never a bot", () => {
  assert.equal(isHidden({ hideranking: 0 }), false);
  assert.equal(isHidden({ hideranking: null }), false);
  assert.equal(isHidden({ hideranking: undefined }), false);
  for (const h of [1, 2, 3, "1", "2", "3"]) assert.equal(isHidden({ hideranking: h }), true, `hideranking ${h}`);
  assert.equal(isHidden({ hideranking: 1, bot: 1 }), false);
  assert.equal(isHidden({ hideranking: 2, bot: true }), false);
  assert.equal(isHidden({ hideranking: 3, bot: 0 }), true);
});

test("a hidden player stays in the live list without id", () => {
  const row = { player_id: 42, is_bot: 0, name: "Someone", kills: 3 };
  assert.deepEqual(liveEntry(row, 0), row);
  assert.deepEqual(liveEntry(row, null), row);
  assert.deepEqual(liveEntry(row, 1), { ...row, player_id: 0 });
  assert.deepEqual(liveEntry(row, 2), { ...row, player_id: 0 });
  assert.deepEqual(liveEntry(row, "3"), { ...row, player_id: 0 });
  // Bots keep their id (their link follows the "Rank bots" setting).
  const bot = { player_id: 7, is_bot: 1, name: "BOT Bob", kills: 0 };
  assert.deepEqual(liveEntry(bot, 1), bot);
});

test("the SQL conditions check hideranking and the BOT unique id of the given column", () => {
  const sql = hiddenSql("f.victimId");
  assert.match(sql, /hp\.playerId = f\.victimId/);
  assert.match(sql, /hp\.hideranking <> 0/);
  assert.match(sql, /NOT EXISTS \(SELECT 1 FROM hlstats_PlayerUniqueIds hu WHERE hu\.playerId = hp\.playerId AND hu\.uniqueId LIKE 'BOT%'\)/);
  assert.match(isBotSql("p.playerId"), /hu\.playerId = p\.playerId AND hu\.uniqueId LIKE 'BOT%'/);
  // No placeholders: the conditions can go into any query without moving its parameters.
  assert.doesNotMatch(sql, /\?/);
});
