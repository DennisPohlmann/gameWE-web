// Draws the top-down radar picture of a Source map and its calibration for
// gameWE; see README.md.
//
//   npm run radar -- <map.bsp> <map.nav or -> <out.png> <out.json> [<lower split>]
import { readFileSync } from "node:fs";
import { Bsp } from "./bsp.ts";
import { render } from "./render.ts";

const args = process.argv.slice(2);
if (args.length < 4) {
  console.error("usage: npm run radar -- <map.bsp> <map.nav or -> <out.png> <out.json> [<lower split>]");
  process.exit(1);
}
const split = args.length > 4 ? Number(args[4]) : null;
if (split !== null && (args[4].trim() === "" || Number.isNaN(split))) {
  console.error(`not a height: ${args[4]}`);
  process.exit(1);
}
try {
  console.log(render(new Bsp(readFileSync(args[0])), args[1], args[2], args[3], split));
} catch (e) {
  console.error(e);
  process.exit(1);
}
