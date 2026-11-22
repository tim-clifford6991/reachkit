import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// The middleware answers a path under an unlisted segment without a session, so an account or API segment missing from GUARDED_SEGMENTS ships open.
const MIDDLEWARE = "src/middleware.ts";

function routeSegments(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .flatMap((d) => (d.name.startsWith("(") ? routeSegments(path.join(dir, d.name)) : [d.name]));
}

export function unguardedSegments(root) {
  const text = readFileSync(path.join(root, MIDDLEWARE), "utf8");
  const list = /export const GUARDED_SEGMENTS[^=]*=\s*\[([\s\S]*?)\];/.exec(text);
  if (!list) return [`${MIDDLEWARE} has no GUARDED_SEGMENTS list`];
  const body = list[1].replace(/\/\/.*$/gm, "");
  const consts = Object.fromEntries([...text.matchAll(/^const (\w+) = "([^"]+)";/gm)].map((m) => [m[1], m[2]]));
  const guarded = new Set([...body.matchAll(/"([^"]+)"|\b([A-Z_]+)\b/g)].map((m) => m[1] ?? consts[m[2]]));
  const served = [...routeSegments(path.join(root, "src/app/(account)")), ...(existsSync(path.join(root, "src/app/api")) ? ["api"] : [])];
  return served.filter((s) => !guarded.has(s)).map((s) => `/${s} is served from src/app but is not in ${MIDDLEWARE}'s GUARDED_SEGMENTS`);
}
