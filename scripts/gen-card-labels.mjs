/**
 * Generate `.design-sync/card-labels.json` — what each DS card ACTUALLY RENDERS.
 *
 * WHY
 * ---
 * `check:design`'s drift gate must compare the live component's labels against
 * the card's RENDERED output, not its source (a source match is satisfied by
 * code — see ds-labels.mjs `visibleText`). The rendered HTML lives in
 * `ds-bundle/`, which is gitignored and only exists after a DS build, so CI
 * can't read it. This distils the prerender into a small COMMITTED artifact the
 * gate can read with no build step.
 *
 * STALENESS
 * ---------
 * Each entry records a hash of its `ds-src` file. If someone edits a card and
 * doesn't rebuild, the hashes diverge and `check:design` fails telling them to
 * rebuild — so the manifest can never quietly describe an older card. This is
 * the property `mirror-lock.json` lacks (it pins a hash of the LIVE file at
 * bless time, which is why a bless can certify a mirror that was never right).
 *
 * Run: node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs
 *      && node scripts/gen-card-labels.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { visibleText } from "./lib/ds-labels.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const p = (rel) => resolve(ROOT, rel);
const DS_SRC = ".design-sync/ds-src";
const OUT = ".design-sync/card-labels.json";

const manifestPath = p("ds-bundle/_ds_manifest.json");
if (!existsSync(manifestPath)) {
  console.error(
    "gen-card-labels: ds-bundle/_ds_manifest.json missing — run the DS build first:\n" +
      "  node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs",
  );
  process.exit(1);
}

// group lookup: manifest cards carry their group-qualified html path
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pathOf = new Map();
for (const c of manifest.cards ?? []) {
  const m = /components\/([^/]+)\/([^/]+)\//.exec(c.path);
  if (m) pathOf.set(m[2], c.path);
}

const out = {};
let missingRender = 0;
for (const f of readdirSync(p(DS_SRC)).sort()) {
  if (!f.endsWith(".tsx")) continue;
  const name = f.slice(0, -4);
  const htmlRel = pathOf.get(name);
  if (!htmlRel || !existsSync(p(`ds-bundle/${htmlRel}`))) {
    missingRender++;
    continue;
  }
  const srcHash = createHash("sha256").update(readFileSync(p(`${DS_SRC}/${f}`))).digest("hex").slice(0, 16);
  out[name] = { srcHash, text: visibleText(readFileSync(p(`ds-bundle/${htmlRel}`), "utf8")) };
}

writeFileSync(p(OUT), JSON.stringify(out, null, 0) + "\n");
console.log(
  `wrote ${OUT} — ${Object.keys(out).length} cards' rendered text` +
    (missingRender ? ` (${missingRender} without a prerender, skipped)` : ""),
);
