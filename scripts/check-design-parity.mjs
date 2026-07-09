#!/usr/bin/env node
/**
 * Design-consistency ratchet (pnpm check:design).
 *
 * Makes the Claude Design system and the app codebase machine-checked against
 * each other. Static only — no runtime, no fixtures, no network. Exits non-zero
 * with a precise diff on any drift so CI/pre-commit blocks the regression.
 *
 * Three checks:
 *   A. Token parity   — every --c-* in app/globals.css must equal its
 *      counterpart in .design-sync/tokens.css (the committed DS source of truth),
 *      in both light and dark scopes.
 *   B. Band parity    — --c-band-* in app/globals.css must equal SCORE_BANDS in
 *      lib/scan/score-bands.ts (the single source of truth for score colors).
 *   C. Mirror parity  — every @mirrors <path> tag in .design-sync/ds-src/*.tsx
 *      must resolve to a real live file; live components in curated globs with
 *      no design mirror are reported (warning) as a coverage gap.
 *
 * See CLAUDE.md → "Consistency harness + Change Protocol".
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const p = (rel) => resolve(ROOT, rel);

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ── helpers ────────────────────────────────────────────────────────────────
/** Normalize a CSS value so cosmetic differences (case, whitespace) don't drift.
 *  Applied identically to both sides, so oklch/rgba spacing collapses safely. */
const norm = (v) => v.toLowerCase().replace(/\s+/g, "");

/** Extract --c-* declarations from a CSS file, split into light + dark scopes.
 *  Dark scope = anything inside the (single, flat) `.dark { … }` block; the rest
 *  is light. Works for both @theme/:root (light) and .dark blocks. */
function readCTokens(file) {
  const css = readFileSync(p(file), "utf8");
  const openMatch = css.match(/\.dark\s*\{/);
  let darkStart = -1;
  let darkEnd = -1;
  if (openMatch) {
    darkStart = openMatch.index;
    darkEnd = css.indexOf("}", darkStart);
  }
  const light = {};
  const dark = {};
  const re = /(--c-[a-z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(css))) {
    const key = m[1];
    const val = m[2].trim();
    const inDark = darkStart >= 0 && m.index > darkStart && m.index < darkEnd;
    (inDark ? dark : light)[key] = val;
  }
  return { light, dark };
}

// ── A + B. token & band parity ───────────────────────────────────────────────
const app = readCTokens("app/globals.css");
const ds = readCTokens(".design-sync/tokens.css");

for (const scope of ["light", "dark"]) {
  for (const [key, appVal] of Object.entries(app[scope])) {
    const dsVal = ds[scope][key];
    if (dsVal === undefined) {
      err(`token MISSING in .design-sync/tokens.css [${scope}]: ${key} (globals.css = ${appVal})`);
    } else if (norm(appVal) !== norm(dsVal)) {
      err(`token DRIFT [${scope}] ${key}: globals.css = ${appVal}  ·  DS = ${dsVal}`);
    }
  }
  // DS-only extras are allowed (design conveniences) but surfaced.
  for (const key of Object.keys(ds[scope])) {
    if (app[scope][key] === undefined) warn(`DS-only token [${scope}]: ${key} (not in app/globals.css)`);
  }
}

// Band parity: globals --c-band-* must equal SCORE_BANDS colors.
const bandsSrc = readFileSync(p("lib/scan/score-bands.ts"), "utf8");
const bandRe = /key:\s*"([a-z]+)"[^}]*?color:\s*"([^"]+)"/g;
let b;
let bandCount = 0;
while ((b = bandRe.exec(bandsSrc))) {
  bandCount++;
  const [, key, color] = b;
  const cssVar = `--c-band-${key}`;
  const cssVal = app.light[cssVar];
  if (cssVal === undefined) {
    err(`band MISSING in app/globals.css: ${cssVar} (SCORE_BANDS.${key} = ${color})`);
  } else if (norm(cssVal) !== norm(color)) {
    err(`band DRIFT ${cssVar}: globals.css = ${cssVal}  ·  SCORE_BANDS.${key} = ${color}`);
  }
}
if (bandCount === 0) err("could not parse SCORE_BANDS from lib/scan/score-bands.ts");

// ── C. mirror parity ─────────────────────────────────────────────────────────
// Every ACTIVE (non-archived) ds-src component must declare a resolving @mirrors
// tag naming its live counterpart — so the design system can only contain
// components that reflect something that actually ships. Archived components
// (layout.mjs META `archived: true`) are exempt: they are retained-but-dead by
// design. This is the convergence ratchet: a new active component with no live
// mirror, or a mirror whose live file disappears, fails the build.
const DS_SRC = ".design-sync/ds-src";
// Parse the archived set from layout.mjs META. `archived: true` is always placed
// before the first `}` of each entry, so scanning up to it is sufficient.
const layoutSrc = readFileSync(p(`${DS_SRC}/layout.mjs`), "utf8");
const archived = new Set();
{
  const metaRe = /([A-Z]\w+):\s*\{([^}]*)\}/g;
  let mm;
  while ((mm = metaRe.exec(layoutSrc))) {
    if (/archived:\s*true/.test(mm[2])) archived.add(mm[1]);
  }
}
const mirroredLive = new Set();
let taggedCount = 0;
for (const f of readdirSync(p(DS_SRC)).filter((f) => f.endsWith(".tsx") && f !== "index.tsx")) {
  const name = f.replace(/\.tsx$/, "");
  if (archived.has(name)) continue; // retained-but-dead — exempt from mirror parity
  const src = readFileSync(p(`${DS_SRC}/${f}`), "utf8");
  const tag = src.match(/@mirrors\s+([^\s*]+)/);
  if (!tag) {
    err(`active ds-src has NO @mirrors tag: ${DS_SRC}/${f} — add /* @mirrors <live-path> */ (or /* @mirrors - */ for a primitive), or archive it in layout.mjs META`);
    continue;
  }
  const target = tag[1];
  if (target === "-" || target === "none" || target === "primitive") continue; // documented primitive (no 1:1 live file)
  taggedCount++;
  if (!existsSync(p(target))) {
    err(`mirror BROKEN: ${DS_SRC}/${f} → @mirrors ${target} (live file does not exist)`);
  } else {
    mirroredLive.add(resolve(ROOT, target));
  }
}

// Coverage gap (warning): live components with no design mirror.
const COVER_GLOBS = ["components/app/intel", "components/report", "components/sections"];
const walk = (dir) => {
  const abs = p(dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(`${dir}/${d.name}`) : d.name.endsWith(".tsx") ? [`${dir}/${d.name}`] : [],
  );
};
const uncovered = [];
for (const g of COVER_GLOBS) {
  for (const rel of walk(g)) {
    if (!mirroredLive.has(resolve(ROOT, rel))) uncovered.push(rel);
  }
}
if (taggedCount === 0) {
  warn("no @mirrors tags found in .design-sync/ds-src — mirror parity is a no-op until components are tagged");
}
if (uncovered.length) {
  warn(`${uncovered.length} live component(s) in [${COVER_GLOBS.join(", ")}] have no @mirrors design mirror (coverage gap):`);
  for (const u of uncovered.slice(0, 12)) warn(`    · ${u}`);
  if (uncovered.length > 12) warn(`    · …and ${uncovered.length - 12} more`);
}

// ── report ───────────────────────────────────────────────────────────────────
if (warnings.length) {
  console.log("design-parity warnings:");
  for (const w of warnings) console.log(`  ⚠ ${w}`);
  console.log("");
}
if (errors.length) {
  console.error(`design-parity FAILED — ${errors.length} drift(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error("\nReconcile the design system with the app (see CLAUDE.md → Consistency harness), then re-run.");
  process.exit(1);
}
console.log(`design-parity OK · ${Object.keys(app.light).length} light + ${Object.keys(app.dark).length} dark --c-* tokens, ${bandCount} score bands, ${taggedCount} @mirrors tags verified.`);
