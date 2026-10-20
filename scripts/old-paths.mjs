#!/usr/bin/env node
// Issue 1458 — check a deployment against every address an earlier ReachKit
// published (`tests/app/library/old-paths.json`): each answers 200, a 301 to
// the listed page, or 410. Reads only; one GET per address, no redirect
// followed. Exit 1 on any difference.
//
//   node scripts/old-paths.mjs https://reachkit.app
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const origin = process.argv[2];
if (!origin) {
  console.error("usage: node scripts/old-paths.mjs <origin>");
  process.exit(2);
}

const { paths } = JSON.parse(readFileSync(path.join(ROOT, "tests/app/library/old-paths.json"), "utf8"));
let bad = 0;
for (const [pathname, expected] of Object.entries(paths)) {
  let got;
  try {
    const res = await fetch(new URL(pathname, origin), { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    const location = res.headers.get("location");
    got = { status: res.status, location: location === null ? undefined : new URL(location, origin).pathname };
  } catch (error) {
    got = { status: 0, location: String(error) };
  }
  const ok = got.status === expected.status && (expected.status !== 301 || got.location === expected.location);
  if (!ok) bad++;
  const want = expected.status === 301 ? `301 ${expected.location}` : String(expected.status);
  const have = got.status === 301 || got.status === 308 ? `${got.status} ${got.location}` : String(got.status);
  console.log(`${ok ? "ok  " : "FAIL"} ${pathname}  want ${want}  got ${have}`);
}
console.log(`\n${Object.keys(paths).length - bad} of ${Object.keys(paths).length} as listed`);
process.exit(bad === 0 ? 0 : 1);
