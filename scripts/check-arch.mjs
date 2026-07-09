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
if (errors.length) {
  console.error(`architecture FAILED — ${errors.length} boundary violation(s):`);
  for (const v of errors) console.error(fmt(v));
  console.error("\nThese imports cross a documented layer boundary (docs/architecture.md). Fix the import or, if the boundary genuinely moved, update .dependency-cruiser.cjs + architecture.md + CLAUDE.md in the same commit.");
  process.exit(1);
}
console.log(`architecture OK · ${out.summary?.totalCruised ?? "?"} modules cruised, 0 boundary violations.`);
