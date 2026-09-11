// tests/app/build-markers.test.ts — BUILD §14, and the marker baseline
//
// `scripts/drift-audit.mjs` reports, per BUILD section, how many source
// files carry its `// BUILD §x.y` marker. That report is only as honest as
// the markers: a module with none is invisible to it, and a section whose
// modules are all unmarked reads as unbuilt.
//
// Issue #3 is the pass that made the baseline honest. This suite is what
// keeps it so — a path glob over the trees it covered, so a module added
// later is in scope the day its file lands rather than the day somebody
// remembers.
//
// **Two rules, and they are different.**
//
//  1. Every module under the covered trees carries a marker. A file that
//     does not is not a rule violation in itself — it is a file the audit
//     cannot see, which is how a section's count drifts away from what it
//     actually has.
//  2. BUILD §14's seven guardrails each have a module that says so. §14 is
//     "build as features": it names no module of its own, and every one of
//     its items is implemented under §7, §8 or §9. Before #3 the audit read
//     that as a GAP — "unbuilt, or built unmarked" — and it was the second.
//
// **A bare `§14` does not mark anything**, and that is the trap this suite
// exists to hold shut. The audit's regex is `BUILD(?:\.md)? §<n>`; two
// files cited `BUILD §8 · §14`, which marks §8 and not §14, so the
// guardrails looked unbuilt while their code sat right there. Each of the
// rows below asserts the *marker the audit reads*, not the prose beside it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** The audit's own regex, transcribed. If it changes there, these rows
 *  measure something the audit does not, and that is what makes copying it
 *  worth stating rather than hiding behind a looser pattern. */
const MARKER = /BUILD(?:\.md)? §(\d+(?:\.\d+)?[a-z]?)/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  const visit = (abs: string): void => {
    for (const entry of readdirSync(abs)) {
      const full = path.join(abs, entry);
      if (statSync(full).isDirectory()) visit(full);
      else if (/\.tsx?$/.test(entry) && !/\.(generated|d)\.ts$/.test(entry)) out.push(full);
    }
  };
  visit(path.join(ROOT, dir));
  return out;
}

function markersOf(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(MARKER)].map((m) => m[1] ?? "");
}

/** The trees issue #3 covered. Not every tree in the repo: the rest were
 *  marked as they were built, and a rule claiming more than it checked
 *  would be a rule nobody could trust. */
const COVERED = [
  "src/lib/costs",
  "src/lib/egress",
  "src/lib/measure",
  "src/lib/presentation",
  "src/ui",
];

describe("every module under the trees #3 covered carries a marker the audit can read", () => {
  it.each(COVERED)("%s", (tree) => {
    const unmarked = walk(tree)
      .filter((file) => markersOf(file).length === 0)
      .map((file) => path.relative(ROOT, file).split(path.sep).join("/"));
    expect(unmarked).toEqual([]);
  });

  it("the trees are actually walked — a rule over nothing is not a rule", () => {
    for (const tree of COVERED) expect(walk(tree).length, tree).toBeGreaterThan(1);
  });

  it("a bare `§x` does not count as a marker, which is the trap this rule holds shut", () => {
    // The two files that cited `BUILD §8 · §14` marked §8 and not §14. The
    // rule above would have passed on either spelling; this row is what
    // says which one the audit reads.
    expect([..."// BUILD §8 · §14 — a rule".matchAll(MARKER)].map((m) => m[1])).toEqual(["8"]);
    expect([..."// BUILD §8 · BUILD §14 — a rule".matchAll(MARKER)].map((m) => m[1])).toEqual([
      "8",
      "14",
    ]);
  });
});
