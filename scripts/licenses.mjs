// Writes src/lib/npm-licenses.json, the npm packages of the /licenses page,
// from package-lock.json: every package a production install has (not
// "dev"), with version and license, plus the devDependencies whose code is
// shipped to the browser (vendored by scripts/vendor.mjs). Runs before
// `next dev` and `next build`; `npm test` fails when the file is stale.
//
//   node scripts/licenses.mjs           write the file
//   node scripts/licenses.mjs --check   only compare, exit 1 when stale
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
// devDependencies that end up in the browser.
const SHIPPED_DEV = { "@scalar/api-reference": "browser bundle of /api (public/vendor/scalar)" };

// A few packages leave "license" out of the lock file; their package.json has it.
function licenseOf(path, entry) {
  if (entry.license) return entry.license;
  const file = join(root, path, "package.json");
  if (existsSync(file)) {
    const p = JSON.parse(readFileSync(file, "utf8"));
    if (typeof p.license === "string") return p.license;
  }
  return "UNKNOWN";
}

const rows = [];
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith("node_modules/")) continue;
  const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
  const shipped = SHIPPED_DEV[name];
  if (entry.dev && !shipped) continue;
  rows.push({
    name,
    version: entry.version,
    license: licenseOf(path, entry),
    // Prebuilt binaries for one OS or CPU: only the matching one is installed.
    ...(entry.os || entry.cpu ? { platform: true } : {}),
    ...(shipped ? { note: shipped } : {}),
  });
}
// Bundled inside Next.js (next/og: signatures and banners), not in the lock file.
const og = join(root, "node_modules/next/dist/compiled/@vercel/og/package.json");
if (existsSync(og)) {
  const p = JSON.parse(readFileSync(og, "utf8"));
  rows.push({ name: "@vercel/og", version: p.version, license: p.license, note: "bundled in next (next/og)" });
}
rows.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const text = JSON.stringify(rows, null, 1) + "\n";
const target = join(root, "src/lib/npm-licenses.json");
const old = existsSync(target) ? readFileSync(target, "utf8") : "";
if (process.argv.includes("--check")) {
  if (old !== text) {
    console.error("src/lib/npm-licenses.json is stale: run node scripts/licenses.mjs");
    process.exit(1);
  }
} else if (old !== text) {
  writeFileSync(target, text);
  console.log(`src/lib/npm-licenses.json: ${rows.length} packages`);
}
