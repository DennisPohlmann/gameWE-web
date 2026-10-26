// SourceBans ban list parsing: the three templates, hostile input and the
// "Steam IDs but no ban" check. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { hasSteamIds, parseBans } from "../src/lib/sourcebans-parse.ts";

// SB++ 1.8 default theme, as served by a live installation (2026-10), with
// fictional players: the "Advanced Search" box (also a tr.collapse, without
// details), a permanent web ban and an expired vote ban.
const detail = `
<table class="table table_box">
<tr class="collapse">
  <td class="text:center"> <span class="text:bold">Advanced Search</span> (Click) </td>
</tr>
<tr class="table_hide"><td colspan="1"><div class="collapse_content flex flex-jc:center">
  <label for="steam_" class="form-label"> Steam ID </label>
  <input class="form-input form-full" type="text" id="steamid" value="" />
</div></td></tr>
</table>
<table class="table table_box">
<tr class="collapse" >
  <td class="text:center"><img src="images/games/web.png" alt="MOD" />&nbsp;<img src="images/country/de.png" alt="DE" /></td>
  <td>26.10.2026, 17:48 </td>
  <td class=""> Test &amp; Co </td>
  <td class="listtable_1_permanent">Permanent </td>
</tr>
<tr class="table_hide"><td colspan="8"><div class="collapse_content"><div class="padding flex flex-jc:start" style="overflow: auto;">
  <ul class="ban_action responsive_show:desktop">
    <li class="button button-light"><a href='#' onclick="" target='_self'> <i class="fas fa-video-slash fa-lg"></i> No Demos </a></li>
    <li> <a class="button button-success" href='index.php?p=login'>Admin ? Sign In</a> </li>
  </ul>
  <ul class="ban_list_detal">
    <ul class="ban_action responsive_hide:desktop lists-mobile"> </ul>
    <li> <span><i class="fas fa-user"></i> Player</span> <span>Test &amp; Co</span> </li>
    <li> <span><i class="fab fa-steam-symbol"></i> Steam ID</span> <span>STEAM_0:1:12345</span> </li>
    <li> <span><i class="fab fa-steam-symbol"></i> Steam3 ID</span> <span> <a href="http://steamcommunity.com/profiles/[U:1:24691]" target="_blank" rel="noopener">[U:1:24691]</a> </span> </li>
    <li> <span><i class="fab fa-steam-symbol"></i> Steam Community</span> <span> <a href="http://steamcommunity.com/profiles/76561197960290419" target="_blank" rel="noopener">76561197960290419</a> </span> </li>
    <li> <span><i class="fas fa-play"></i> Invoked on</span> <span>26.10.2026, 17:48 </span> </li>
    <li> <span><i class="fas fa-hourglass-half"></i> Ban length</span> <span>Permanent </span> </li>
    <li> <span><i class="fas fa-clock"></i> Expires on</span> <span class="text:italic">Not applicable</span> </li>
    <li> <span><i class="fas fa-question"></i> Reason</span> <span>Inappropriate Language</span> </li>
    <li> <span><i class="fas fa-ban"></i> Total Bans</span> <span>No previous bans</span> </li>
    <li> <span><i class="fas fa-server"></i> Banned from </span> <span > Web Ban </span> </li>
    <li> <span><i class="fas fa-ban"></i> Blocked (1)</span> <i><span title="Server: 192.0.2.10:27015, Date: 26.10.2026, 17:54 ">Someone Else</span></i> </li>
  </ul>
  <ul class="ban_list_comments margin-left responsive_show:desktop"><div class="padding"> None </div></ul>
</div></div></td></tr>
<tr class="collapse" onclick="xajax_ServerHostPlayers(2, 'id', 'host_5778');" >
  <td class="text:center"><img src="images/games/csource.png" alt="MOD" />&nbsp;<img src="images/country/de.png" alt="DE" /></td>
  <td>03.05.2026, 18:21 </td>
  <td class=""> Voted Out </td>
  <td class="listtable_1_unbanned">1 hr (Expired)</td>
</tr>
<tr class="table_hide"><td colspan="8"><div class="collapse_content"><div class="padding flex flex-jc:start">
  <ul class="ban_list_detal">
    <ul class="ban_action responsive_hide:desktop lists-mobile"> </ul>
    <li> <span><i class="fas fa-user"></i> Player</span> <span>Voted Out</span> </li>
    <li> <span><i class="fab fa-steam-symbol"></i> Steam ID</span> <span>STEAM_0:0:67890</span> </li>
    <li> <span><i class="fas fa-play"></i> Invoked on</span> <span>03.05.2026, 18:21 </span> </li>
    <li> <span><i class="fas fa-hourglass-half"></i> Ban length</span> <span>1 hr (Expired)</span> </li>
    <li> <span><i class="fas fa-user-shield"></i> Unban reason</span> <span class="text:italic">No reason present</span> </li>
    <li> <span><i class="fas fa-clock"></i> Expires on</span> <span>03.05.2026, 19:21 </span> </li>
    <li> <span><i class="fas fa-question"></i> Reason</span> <span>You have been banned by players votes (VOTEBAN: CHEAT!)</span> </li>
    <li> <span><i class="fas fa-server"></i> Banned from </span> <span id="host_5778"> Please Wait... </span> </li>
  </ul>
</div></div></td></tr>
</table>`;

test("SB++ 1.8 default theme: bans from the detail lists, the search box is skipped", () => {
  const bans = parseBans(detail);
  assert.equal(bans.length, 2);
  assert.deepEqual(bans[0], {
    steam: "1:12345",
    name: "Test & Co",
    reason: "Inappropriate Language",
    length: "Permanent",
    date: "26.10.2026, 17:48",
    state: "permanent",
  });
  assert.deepEqual(bans[1], {
    steam: "0:67890",
    name: "Voted Out",
    reason: "You have been banned by players votes (VOTEBAN: CHEAT!)",
    length: "1 hr",
    date: "03.05.2026, 18:21",
    state: "expired",
  });
});

test("SB++ 1.8: a running timed ban and a lifted one", () => {
  const running = detail.replace("listtable_1_permanent\">Permanent", "listtable_1_banned\">2 wk").replace("<span>Permanent </span>", "<span>2 wk</span>");
  assert.equal(parseBans(running)[0].state, "active");
  assert.equal(parseBans(running)[0].length, "2 wk");
  const lifted = detail.replace("1 hr (Expired)</td>", "1 hr (Unbanned)</td>").replace("<span>1 hr (Expired)</span>", "<span>1 hr (Unbanned)</span>");
  assert.equal(parseBans(lifted)[1].state, "unbanned");
});

test("SB++ 1.8: without a Steam ID field the profile link is used, without both the ban is skipped", () => {
  const onlyProfile = detail.replace("<span>STEAM_0:1:12345</span>", "<span></span>");
  assert.equal(parseBans(onlyProfile)[0].steam, "76561197960290419");
  const none = detail.replace("<span>STEAM_0:0:67890</span>", "<span>hidden</span>");
  assert.equal(parseBans(none).length, 1);
});

test("classic template still works", () => {
  const classic = `<table><tr class="opener tbl_out"><td>x</td><td class="listtable_1_permanent">Permanent</td></tr>
    <tr><td><table>
      <tr><td> Player </td><td>Old  Name</td></tr>
      <tr><td> Steam ID </td><td>STEAM_0:0:42</td></tr>
      <tr><td> Invoked on </td><td>01-02-20 10:00</td></tr>
      <tr><td> Banlength </td><td>Permanent</td></tr>
      <tr><td> Reason </td><td>Aimbot</td></tr>
    </table></td></tr></table>`;
  assert.deepEqual(parseBans(classic), [{ steam: "0:42", name: "Old Name", reason: "Aimbot", length: "Permanent", date: "01-02-20 10:00", state: "permanent" }]);
});

test("SB++ 2026 template still works", () => {
  const html = `<tbody><tr class="ban-row" data-state="expired"><td><a class="ban-player-cell__name" href="#">New</a></td>
    <td>STEAM_0:1:7</td><td class="text-muted truncate" title="Wallhack">Wallhack</td><td class="col-length">1 d</td>
    <td><time datetime="2026-10-01T12:00:00Z">1 Oct</time></td></tr></tbody>`;
  assert.deepEqual(parseBans(html), [{ steam: "1:7", name: "New", reason: "Wallhack", length: "1 d", date: "2026-10-01T12:00:00Z", state: "expired" }]);
});

test("hostile values stay text and are cut", () => {
  const evil = detail.replace("<span>Inappropriate Language</span>", `<span><script>alert(1)</script>${"x".repeat(1000)}</span>`);
  const reason = parseBans(evil)[0].reason;
  assert.ok(!reason.includes("<"));
  assert.ok(reason.length <= 300);
});

test("Steam IDs on the page but no ban read: an unknown template", () => {
  const unknown = `<div class="ban-card"><b>Player</b> X <b>Steam</b> STEAM_0:1:99</div>`;
  assert.equal(parseBans(unknown).length, 0);
  assert.equal(hasSteamIds(unknown), true);
  assert.equal(hasSteamIds("<p>No bans</p>"), false);
});
