// Runs before `next dev` and `next build`:
// 1. copies the Scalar API reference (MIT, a devDependency) to
//    public/vendor/scalar/, so /api serves it from this site, no CDN;
// 2. fails when a route under src/app/api/v1 has no entry in
//    src/lib/openapi.ts, so the documentation on /api stays complete.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const scalar = join(root, "node_modules/@scalar/api-reference");
const out = join(root, "public/vendor/scalar");
mkdirSync(out, { recursive: true });
// Without the source map comment: the map is not shipped.
const bundle = readFileSync(join(scalar, "dist/browser/standalone.js"), "utf8").replace(/\n\/\/# sourceMappingURL=\S+\s*$/, "\n");
writeFileSync(join(out, "standalone.js"), bundle);
// api-reference has no LICENSE file of its own; its @scalar packages carry the same MIT text.
writeFileSync(join(out, "LICENSE.txt"), readFileSync(join(root, "node_modules/@scalar/components/LICENSE")));

const v1 = join(root, "src/app/api/v1");
const routes = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name === "route.ts") routes.push(relative(v1, dir).split(sep).filter(Boolean));
  }
})(v1);
const documented = new Set([...readFileSync(join(root, "src/lib/openapi.ts"), "utf8").matchAll(/^\s+path: "([^"]+)",$/gm)].map((m) => m[1]));
// [id] -> {id}; the index (/api/v1 itself) is documented separately.
const missing = routes
  .filter((parts) => parts.length > 0)
  .map((parts) => "/" + parts.map((s) => s.replace(/^\[(\w+)\]$/, "{$1}")).join("/"))
  .filter((p) => !documented.has(p));
if (missing.length) {
  console.error(`API routes without documentation in src/lib/openapi.ts: ${missing.join(", ")}`);
  process.exit(1);
}
