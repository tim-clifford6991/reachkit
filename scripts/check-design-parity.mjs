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
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
const activeMirrors = []; // { name, target } for the freshness check
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
    activeMirrors.push({ name, target });
  }
}

// ── D. mirror freshness (content drift) ──────────────────────────────────────
// @mirrors proves the live file EXISTS; it can't prove the DS card still matches
// the live component's CONTENT. This lock pins a hash of each mirrored live file
// at the moment its DS mirror was last reconciled. When a live component changes,
// its DS mirror is flagged STALE until someone reviews it and re-blesses the lock
// (`pnpm bless:design`). Warn, don't fail: a live edit shouldn't block unrelated
// work — but the staleness is now visible in every CI + pre-commit run.
const LOCK = ".design-sync/mirror-lock.json";
const bless = process.argv.includes("--bless");
const hashOf = (rel) => createHash("sha256").update(readFileSync(p(rel))).digest("hex").slice(0, 16);
const lock = existsSync(p(LOCK)) ? JSON.parse(readFileSync(p(LOCK), "utf8")) : {};
const nextLock = {};
let staleCount = 0;
for (const { name, target } of activeMirrors) {
  const h = hashOf(target);
  nextLock[name] = { mirror: target, hash: h };
  if (!bless && lock[name] && lock[name].hash !== h) {
    staleCount++;
    warn(`mirror STALE: live ${target} changed since ${name} was last reconciled — review the DS card, update .design-sync/ds-src/${name}.tsx, then \`pnpm bless:design\` and re-run /design-sync.`);
  }
}
if (bless) {
  // Transparent bless: enumerate exactly what is being re-pinned, and support
  // scoping to named components (`pnpm bless:design -- ResultsScreen …`) so a
  // whole-lock bless can't silently swallow unreviewed drift on other cards.
  const scopeArgs = process.argv.slice(process.argv.indexOf("--bless") + 1).filter((a) => !a.startsWith("-"));
  const scoped = scopeArgs.length > 0;
  const outLock = {};
  const rePinned = [];
  for (const [name, entry] of Object.entries(nextLock)) {
    const prior = lock[name];
    const changed = !prior || prior.hash !== entry.hash;
    if (scoped && changed && !scopeArgs.includes(name)) {
      // Out of scope — keep the OLD pin so its staleness stays visible.
      outLock[name] = prior ?? entry;
      continue;
    }
    outLock[name] = entry;
    if (changed) rePinned.push(`  bless: ${name} (${entry.mirror} ${prior ? `${prior.hash} → ` : "new pin "}${entry.hash})`);
  }
  writeFileSync(p(LOCK), JSON.stringify(outLock, null, 2) + "\n");
  if (rePinned.length) {
    console.log(`re-pinned ${rePinned.length} mirror(s):`);
    for (const line of rePinned) console.log(line);
  } else {
    console.log("nothing to re-pin — lock already matches the live tree.");
  }
  console.log(`blessed ${LOCK} — ${Object.keys(outLock).length} mirrors pinned${scoped ? ` (scoped to: ${scopeArgs.join(", ")})` : ""}.`);
  process.exit(0);
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

// Coverage ratchet: the uncovered count is pinned and may only shrink. A new
// live component in a covered glob must ship with a DS mirror (or the baseline
// consciously raised — which the Change Protocol forbids without a documented
// reason). When coverage improves, lower the baseline to pin the win.
const COVERAGE_BASELINE = ".design-sync/coverage-baseline.json";
const baseline = existsSync(p(COVERAGE_BASELINE))
  ? JSON.parse(readFileSync(p(COVERAGE_BASELINE), "utf8"))
  : null;
if (baseline && typeof baseline.uncovered === "number") {
  if (uncovered.length > baseline.uncovered) {
    err(
      `design coverage REGRESSED: ${uncovered.length} unmirrored live component(s) > pinned baseline ${baseline.uncovered} (${COVERAGE_BASELINE}). New components in [${COVER_GLOBS.join(", ")}] must ship with a ds-src @mirrors card.`,
    );
  } else if (uncovered.length < baseline.uncovered) {
    warn(`design coverage improved (${uncovered.length} < baseline ${baseline.uncovered}) — lower "uncovered" in ${COVERAGE_BASELINE} to ${uncovered.length} to pin the win.`);
  }
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
