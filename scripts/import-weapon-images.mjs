#!/usr/bin/env node
// Imports the weapon images of HLstatsX: Community Edition (GPL-2.0-or-later,
// https://github.com/NomisCZ/hlstatsx-community-edition) into
// public/weapons/<base game>/<code>.webp and writes the size list
// src/lib/weapon-images.ts. Only needed when the images change; the result is
// committed.
//
//   node scripts/import-weapon-images.mjs <hlstatsx checkout>
//
// Most of the original images carry the weapon's name as text. It is taken
// out (see CLEAN), the image is cropped to the weapon and re-encoded as
// lossless WebP; file names are lower-cased like the weapon codes. Images
// where the text cannot be taken out cleanly are left out (SKIP), so the site
// shows the weapon's name instead.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// gameWE base game (src/lib/games.ts) -> folder in hlstatsimg/games.
const GAMES = {
  css: "css",
  csgo: "csgo",
  cstrike: "cstrike",
  tf: "tf",
  tfc: "tfc",
  hl2mp: "hl2mp",
  valve: "valve",
  dods: "dods",
  dod: "dod",
  ns: "ns",
  l4d: "l4d",
  l4d2: "l4d2",
  insurgency: "insmod",
};

// Images left out: the text overlaps the weapon too much, the image is only
// text, or it shows no weapon. Checked by eye after cleaning.
const SKIP = {
  css: ["prop_physics", "smokegrenade_projectile"],
  dod: ["mortar"],
  ns: ["acidrocket", "bite2gun", "bitegun", "charge", "claws", "devour", "divinewind", "grenade", "healingspray", "heavymachinegun", "knife", "leap", "machinegun", "offensechamber", "parasite", "pistol", "resourcetower", "shotgun", "siegeturret", "spikegun", "spitgunspit", "sporegunprojectile", "swipe", "team_advturretfactory", "team_turretfactory", "turret", "welder"],
  tf: [
    "ball", "battleaxe", "battleneedle", "big_earner", "boston_basher", "candy_cane", "claidheamohmor", "crusaders_crossbow",
    "deflect_arrow", "deflect_flare", "deflect_flare_detonator", "deflect_huntsman_flyingburn", "deflect_promode", "deflect_rocket", "deflect_sticky",
    "demokatana", "eternal_reward", "eviction_notice", "frontier_justice", "headtaker", "kunai", "lava_axe", "lava_bat", "liberty_launcher",
    "loch_n_load", "market_gardener", "nonnonviolent_protest", "persian_persuader", "powerjack", "revolver", "scotland_shard", "short_stop",
    "sledgehammer", "solemn_vow", "southern_hospitality", "steel_fists", "sword", "sydney_sleeper", "syringegun_medic", "telefrag",
    "tf_projectile_arrow_fire", "tf_projectile_energy_ball", "tf_pumpkin_bomb", "thirddegree", "ullapool_caber", "ullapool_caber_explosion",
    "unarmed_combat", "warrior_spirit", "world",
  ],
};

// HL2DM: the name is a dark word with a light glow left of the weapon; cut
// off at the column where the weapon starts.
const HL2_CUT = { "357": 36, ar2: 36, combine_ball: 62, crossbow_bolt: 75, crowbar: 62, env_explosion: 73, grenade_frag: 64, physbox: 65, physics: 59, pistol: 46, rpg_missile: 39, shotgun: 63, slam: 41, smg1: 41, smg1_grenade: 75, stunstick: 69, telefrag: 61, turret_floor: 48 };

// How the text comes out:
// erase: white letters with a dark outline over the weapon (CS:S, TF2);
// color: white letters next to an orange/yellow weapon (HLDM, TFC, DoD:S, L4D, INS, NS);
// cut:   HL2DM, see HL2_CUT; none: the images carry no text.
const CLEAN = { css: "erase", tf: "erase", valve: "color", tfc: "color", dods: "color", l4d: "color", l4d2: "color", insurgency: "color", ns: "color", hl2mp: "cut" };

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/import-weapon-images.mjs <hlstatsx checkout>");
  process.exit(1);
}
const root = new URL("..", import.meta.url).pathname;
const out = join(root, "public/weapons");
rmSync(out, { recursive: true, force: true });

// ---- pixel helpers on RGBA buffers (masks are Uint8Array of w*h)

function dilate(mask, w, h, times) {
  let m = mask;
  for (let t = 0; t < times; t++) {
    const n = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!m[y * w + x]) continue;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx;
            if (yy >= 0 && yy < h && xx >= 0 && xx < w) n[yy * w + xx] = 1;
          }
      }
    m = n;
  }
  return m;
}

// 8-connected components: label per pixel (0 = none) and size per label.
function components(mask, w, h) {
  const lab = new Int32Array(w * h);
  const sizes = [0];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || lab[i]) continue;
    const id = sizes.length;
    let size = 0;
    lab[i] = id;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (mask[q] && !lab[q]) {
            lab[q] = id;
            stack.push(q);
          }
        }
    }
    sizes.push(size);
  }
  return { lab, sizes };
}

const pixel = (d, i) => {
  const r = d[i * 4] / 255, g = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return { a: d[i * 4 + 3], mx, mn, sat: mx > 0 ? (mx - mn) / mx : 0 };
};

function keepOnly(d, w, h, keep) {
  for (let i = 0; i < w * h; i++) if (!keep[i]) d[i * 4 + 3] = 0;
}

// Drops specks smaller than `rel` of the biggest part (text remains).
function dropSmall(d, w, h, rel) {
  const vis = new Uint8Array(w * h).map((_, i) => (d[i * 4 + 3] > 24 ? 1 : 0));
  const { lab, sizes } = components(vis, w, h);
  const big = Math.max(0, ...sizes);
  const min = Math.max(6, big * rel);
  keepOnly(d, w, h, vis.map((_, i) => (lab[i] && sizes[lab[i]] >= min ? 1 : 0)));
}

function clean(mode, code, d, w, h) {
  if (mode === "erase") {
    const core = new Uint8Array(w * h).map((_, i) => {
      const p = pixel(d, i);
      return p.a > 24 && p.mn * 255 > 205 && p.sat < 0.25 ? 1 : 0;
    });
    const text = dilate(core, w, h, 3);
    keepOnly(d, w, h, text.map((t) => 1 - t));
    dropSmall(d, w, h, 0.12);
  } else if (mode === "color") {
    const colored = new Uint8Array(w * h).map((_, i) => {
      const p = pixel(d, i);
      return p.a > 24 && p.sat > 0.35 && p.mx > 0.25 ? 1 : 0;
    });
    const { lab, sizes } = components(colored, w, h);
    const keep = colored.map((_, i) => (lab[i] && sizes[lab[i]] >= 6 ? 1 : 0));
    // plus the dark outline around the weapon
    const near = dilate(keep, w, h, 2);
    keepOnly(d, w, h, keep.map((k, i) => {
      const p = pixel(d, i);
      return k || (near[i] && p.a > 24 && p.mx < 0.35) ? 1 : 0;
    }));
  } else if (mode === "cut") {
    for (let y = 0; y < h; y++) for (let x = 0; x < HL2_CUT[code] && x < w; x++) d[(y * w + x) * 4 + 3] = 0;
    dropSmall(d, w, h, 0.05);
  }
}

// Bounding box of the visible pixels, null when (almost) nothing is left.
function bbox(d, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 24) {
        n++;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
  return n < 30 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

const sizes = {};
const skipped = [];
let total = 0;
for (const [game, dir] of Object.entries(GAMES)) {
  const from = join(src, "web/hlstatsimg/games", dir, "weapons");
  mkdirSync(join(out, game), { recursive: true });
  sizes[game] = {};
  for (const f of readdirSync(from).sort()) {
    const m = /^([a-z0-9_.-]+)\.(png|gif)$/i.exec(f);
    if (!m) continue;
    const code = m[1].toLowerCase();
    if (SKIP[dir]?.includes(code)) {
      skipped.push(`${game}/${code}`);
      continue;
    }
    const { data, info } = await sharp(join(from, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    if (CLEAN[game]) clean(CLEAN[game], code, data, w, h);
    const box = bbox(data, w, h);
    if (!box) {
      skipped.push(`${game}/${code}`);
      continue;
    }
    const res = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .extract(box)
      .webp({ lossless: true, effort: 6 })
      .toFile(join(out, game, `${code}.webp`));
    sizes[game][code] = [res.width, res.height];
    total += res.size;
  }
}

const lines = Object.entries(sizes).map(
  ([game, codes]) =>
    `  ${game}: {\n${Object.entries(codes)
      .map(([c, [w, h]]) => `    ${JSON.stringify(c)}: [${w}, ${h}],`)
      .join("\n")}\n  },`,
);
writeFileSync(
  join(root, "src/lib/weapon-images.ts"),
  `// Generated by scripts/import-weapon-images.mjs, do not edit.
// Weapon images in public/weapons/<base game>/<code>.webp with their width
// and height, from HLstatsX: Community Edition (GPL-2.0-or-later, see
// THIRD-PARTY-LICENSES.md), with the weapon names taken out of the images.
export const WEAPON_IMAGES: Readonly<Record<string, Readonly<Record<string, readonly [number, number]>>>> = {
${lines.join("\n")}
};
`,
);
console.log(`${Object.values(sizes).reduce((n, c) => n + Object.keys(c).length, 0)} images, ${total} bytes; left out: ${skipped.length}`);
console.log(skipped.join(" "));
