// A fixed demo data set for screenshots and visual checks: always the same
// fictional players, clans, maps, kills, chat and places, so every run (and
// every skin) shows the same pages and a run can be compared with an earlier
// one (scripts/skin-shots.mjs -baseline).
//
//   node scripts/demo-data.mjs log > demo.log   game-server log lines (css)
//   node scripts/demo-data.mjs sql > demo.sql   places of the players (flags, map)
//
// Load it into an empty test database with the collector:
//   gamewe db init -f && gamewe simulate -file demo.log -f
//   psql ... < demo.sql      (or mariadb ... < demo.sql)
// Everything is invented: names, Steam IDs (STEAM_1:x:19990000nn, account
// numbers far above the ones Steam has handed out so far), addresses
// from the documentation ranges (RFC 5737) and rounded city coordinates.

const NAMES = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett",
  "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango",
  "Uniform", "Victor", "Whiskey", "Xray", "Yankee", "Zulu", "Nordlicht", "Größenwahn", "Ünal", "Łukasz",
];
// Clan tags at the start of the name (as the collector detects them).
const CLANS = [["[KoS] ", 6], ["=AxE= ", 5], ["[dW] ", 4], ["", 15]];
const PLACES = [
  ["Berlin", "Berlin", "Germany", "DE", "52.52", "13.40"],
  ["Hamburg", "Hamburg", "Germany", "DE", "53.55", "9.99"],
  ["München", "Bayern", "Germany", "DE", "48.14", "11.58"],
  ["Wien", "Wien", "Austria", "AT", "48.21", "16.37"],
  ["Zürich", "Zürich", "Switzerland", "CH", "47.37", "8.54"],
  ["Amsterdam", "Noord-Holland", "Netherlands", "NL", "52.37", "4.90"],
  ["Paris", "Île-de-France", "France", "FR", "48.86", "2.35"],
  ["Warszawa", "Mazowieckie", "Poland", "PL", "52.23", "21.01"],
  ["Stockholm", "Stockholm", "Sweden", "SE", "59.33", "18.07"],
  ["London", "England", "United Kingdom", "GB", "51.51", "-0.13"],
  ["Madrid", "Madrid", "Spain", "ES", "40.42", "-3.70"],
  ["Istanbul", "Istanbul", "Turkey", "TR", "41.01", "28.98"],
  ["New York", "New York", "United States", "US", "40.71", "-74.01"],
  ["São Paulo", "São Paulo", "Brazil", "BR", "-23.55", "-46.63"],
];
const MAPS = ["de_dust2", "de_inferno", "de_nuke", "cs_office", "de_train", "de_aztec"];
const WEAPONS = ["ak47", "m4a1", "awp", "deagle", "usp", "glock", "famas", "galil", "mp5navy", "p90", "scout", "hegrenade", "knife", "m3", "aug", "sg552"];
const CHAT = ["gg", "nice shot", "!rank", "rush b", "wer kommt mit?", "eco round", "!top10", "lol", "sry", "gl hf"];

// Small fixed pseudo-random generator (mulberry32), so the output never changes.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261029);
const pick = (a) => a[Math.floor(rand() * a.length)];

function players() {
  const out = [];
  let i = 0;
  for (const [tag, n] of CLANS) {
    for (let k = 0; k < n; k++, i++) {
      out.push({
        uid: i + 2,
        name: tag + NAMES[i],
        steam: `STEAM_1:${i % 2}:${1999000001 + i}`,
        ip: `${["192.0.2", "198.51.100", "203.0.113"][i % 3]}.${10 + i}`,
        place: PLACES[i % PLACES.length],
        skill: 0.4 + rand() * 0.6, // chance to win a duel
      });
    }
  }
  return out;
}

const who = (p, team) => `"${p.name}<${p.uid}><${p.steam}><${team}>"`;

function log() {
  const ps = players();
  const lines = [];
  for (const map of MAPS) {
    lines.push(`Loading map "${map}"`, `Started map "${map}" (CRC "-1162343117")`);
    // 10 to 16 players per map, everyone some time
    const here = ps.filter(() => rand() < 0.5).slice(0, 16);
    const team = new Map(here.map((p, k) => [p, k % 2 ? "TERRORIST" : "CT"]));
    for (const p of here) {
      lines.push(`"${p.name}<${p.uid}><${p.steam}><>" connected, address "${p.ip}:27005"`, `"${p.name}<${p.uid}><${p.steam}><>" entered the game`);
      lines.push(`${who(p, "Unassigned")} joined team "${team.get(p)}"`);
    }
    let ct = 0, t = 0;
    for (let round = 0; round < 12; round++) {
      lines.push(`World triggered "Round_Start"`);
      const alive = new Set(here);
      while ([...alive].some((p) => team.get(p) === "CT") && [...alive].some((p) => team.get(p) === "TERRORIST")) {
        const a = pick([...alive]);
        const enemies = [...alive].filter((p) => team.get(p) !== team.get(a));
        const b = pick(enemies);
        const [k, d] = rand() < a.skill / (a.skill + b.skill) ? [a, b] : [b, a];
        const w = pick(WEAPONS);
        const hs = w !== "knife" && w !== "hegrenade" && rand() < 0.3 ? " (headshot)" : "";
        const x = Math.round(rand() * 3000 - 1500), y = Math.round(rand() * 3000 - 1500);
        lines.push(`${who(k, team.get(k))} [${x} ${y} 64] killed ${who(d, team.get(d))} [${x + 120} ${y - 80} 64] with "${w}"${hs}`);
        if (rand() < 0.15) lines.push(`${who(k, team.get(k))} triggered "weaponstats" (weapon "${w}") (shots "${8 + Math.floor(rand() * 20)}") (hits "${2 + Math.floor(rand() * 6)}") (kills "1") (headshots "${hs ? 1 : 0}") (tks "0") (damage "${100 + Math.floor(rand() * 300)}") (deaths "0")`);
        alive.delete(d);
      }
      const ctWin = [...alive].some((p) => team.get(p) === "CT");
      if (!ctWin && rand() < 0.6) lines.push(`${who(pick(here.filter((p) => team.get(p) === "TERRORIST")), "TERRORIST")} triggered "Planted_The_Bomb"`);
      if (ctWin) ct++; else t++;
      lines.push(ctWin ? `Team "CT" triggered "CTs_Win" (CT "${ct}") (T "${t}")` : `Team "TERRORIST" triggered "Terrorists_Win" (CT "${ct}") (T "${t}")`);
      lines.push(`World triggered "Round_End"`);
      if (rand() < 0.5) {
        const p = pick(here);
        lines.push(`${who(p, team.get(p))} say "${pick(CHAT)}"`);
      }
    }
    for (const p of here) lines.push(`${who(p, team.get(p))} disconnected (reason "Disconnect by user.")`);
  }
  return lines.join("\n") + "\n";
}

// The collector finds places with GeoIP, which knows nothing of the
// documentation addresses; this sets them by Steam ID (works on MariaDB and
// PostgreSQL, default table prefix hlstats).
function sql() {
  const out = ["-- gameWE demo data: places of the demo players (scripts/demo-data.mjs)"];
  for (const [city, state, country, flag, lat, lng] of PLACES) {
    out.push(`INSERT INTO hlstats_Players_Locations (city, state, country, flag, lat, lng) SELECT '${city}', '${state}', '${country}', '${flag}', '${lat}', '${lng}' WHERE NOT EXISTS (SELECT 1 FROM hlstats_Players_Locations WHERE lat = '${lat}' AND lng = '${lng}');`);
  }
  for (const p of players()) {
    const [, , , , lat, lng] = p.place;
    const uid = p.steam.replace(/^STEAM_\d:/, "");
    out.push(`UPDATE hlstats_Players_Data SET location_id = (SELECT id FROM hlstats_Players_Locations WHERE lat = '${lat}' AND lng = '${lng}') WHERE playerid IN (SELECT playerid FROM hlstats_PlayerUniqueIds WHERE uniqueid = '${uid}');`);
  }
  return out.join("\n") + "\n";
}

const what = process.argv[2];
if (what === "log") process.stdout.write(log());
else if (what === "sql") process.stdout.write(sql());
else {
  console.error("usage: node scripts/demo-data.mjs log|sql");
  process.exit(2);
}
