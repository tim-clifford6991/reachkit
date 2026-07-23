#!/usr/bin/env node
/**
 * Architecture ratchet runner (pnpm check:arch).
 *
 * Runs dependency-cruiser via its PROGRAMMATIC api rather than the CLI, because
 * the CLI hard-blocks non-LTS node (e.g. 25) while the library itself runs fine.
 * This keeps the gate working identically in CI (node 22) and on any dev machine.
 * Rules live in .dependency-cruiser.cjs. See CLAUDE.md → "Consistency harness".
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { cruise } from "dependency-cruiser";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = require(resolve(ROOT, ".dependency-cruiser.cjs"));

const TARGETS = ["lib", "app", "components", "middleware.ts"];
const result = await cruise(TARGETS, {
  ...cfg.options,
  ruleSet: { forbidden: cfg.forbidden },
  validate: true,
});

/**
 * Circular-dependency baseline (the ratchet): the no-circular rule stays at
 * `warn` severity in .dependency-cruiser.cjs, but this pinned set makes it
 * bite — a NEW cycle fails the gate, and a FIXED cycle also fails until it is
 * removed here, so the baseline only ever shrinks. Never add to this list to
 * make a regression pass (CLAUDE.md → "strict adherence, iterate forward").
 */
const KNOWN_CYCLES = new Set([
  // section-nav-active ↔ section-nav cycle retired 2026-07-23 (M2): both files
  // were part of the dead report/*-section island (zero live importers), deleted.
  "lib/badge/score-card.ts → lib/scan/report.ts",
  // 5 cycles retired 2026-07-21 (Phase S): moving ScanContext to the leaf
  // module `scan-context.ts` and `runCollect` into `collect.ts` removed the
  // `pipeline → collect` runtime edge, which had turned the whole scan tool
  // tree (collect ↔ pipeline ↔ tools ↔ check-link ↔ prompts ↔ grounding ↔
  // facts) into one tangle. The baseline only shrinks — do not re-add.
]);

const out = result.output ?? result;
const violations = out.summary?.violations ?? [];
const errors = violations.filter((v) => v.rule.severity === "error");
const warns = violations.filter((v) => v.rule.severity !== "error");

const fmt = (v) => `  ${v.rule.severity === "error" ? "✗" : "⚠"} [${v.rule.name}] ${v.from} → ${v.to}`;

if (warns.length) {
  console.log("architecture warnings:");
  for (const v of warns) console.log(fmt(v));
  console.log("");
}

// --- circular-dependency ratchet -------------------------------------------
const cycleEdges = new Set(
  violations.filter((v) => v.rule.name === "no-circular").map((v) => `${v.from} → ${v.to}`),
);
const newCycles = [...cycleEdges].filter((e) => !KNOWN_CYCLES.has(e));
const fixedCycles = [...KNOWN_CYCLES].filter((e) => !cycleEdges.has(e));
if (newCycles.length) {
  console.error(`architecture FAILED — ${newCycles.length} NEW circular dependenc${newCycles.length === 1 ? "y" : "ies"} (not in the pinned baseline):`);
  for (const e of newCycles) console.error(`  ✗ [no-circular] ${e}`);
  console.error("\nBreak the cycle. Do NOT add it to KNOWN_CYCLES — the baseline only shrinks.");
  process.exit(1);
}
if (fixedCycles.length) {
  console.error(`architecture FAILED — ${fixedCycles.length} baseline cycle(s) no longer exist:`);
  for (const e of fixedCycles) console.error(`  ✓ [no-circular] ${e} (fixed!)`);
  console.error("\nGood news — pin the win: remove these entries from KNOWN_CYCLES in scripts/check-arch.mjs so they can never come back.");
  process.exit(1);
}
if (errors.length) {
  console.error(`architecture FAILED — ${errors.length} boundary violation(s):`);
  for (const v of errors) console.error(fmt(v));
  console.error("\nThese imports cross a documented layer boundary (docs/architecture.md). Fix the import or, if the boundary genuinely moved, update .dependency-cruiser.cjs + architecture.md + CLAUDE.md in the same commit.");
  process.exit(1);
}
console.log(`architecture OK · ${out.summary?.totalCruised ?? "?"} modules cruised, 0 boundary violations.`);
