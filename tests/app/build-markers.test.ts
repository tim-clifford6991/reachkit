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

// ── BUILD §14, guardrail by guardrail ───────────────────────────────────

/** §14's seven, each with the module that implements it. The list is the
 *  spec's own order, and the titles are quoted from it — so a guardrail
 *  renamed in BUILD.md fails here rather than drifting into a row nobody
 *  reads. */
const GUARDRAILS: readonly { readonly n: number; readonly quoted: string; readonly file: string }[] =
  [
    { n: 1, quoted: "Volume follows supply", file: "src/lib/opportunities/supply/depth.ts" },
    { n: 2, quoted: "No invented authors", file: "src/lib/generate/rules/people.ts" },
    {
      n: 3,
      quoted: "Near-duplicate gate before queueing",
      file: "src/lib/generate/rules/nearduplicate.ts",
    },
    { n: 4, quoted: "No doorway pages", file: "src/lib/generate/rules/brandgap.ts" },
    { n: 5, quoted: "Grounding", file: "src/lib/generate/rules/grounding.ts" },
    {
      n: 6,
      quoted: "Customer is publisher of record",
      file: "src/app/(hosted)/policies.ts",
    },
    {
      n: 7,
      quoted: "Autopilot rate limits independent of the monthly cap",
      file: "src/lib/publish/ceilings/index.ts",
    },
  ];

describe("BUILD §14 — every guardrail is built, and says which one it is", () => {
  const build = readFileSync(path.join(ROOT, "BUILD.md"), "utf8");
  const section = build.slice(build.indexOf("## 14."), build.indexOf("## 15."));
  /** The spec wraps its prose, so a quoted sentence is compared with its
   *  line breaks collapsed — never with a shortened quote, which is how a
   *  row comes to pass on text that no longer says what it did. */
  const flat = section.replace(/\s+/g, " ");

  it("the section still names seven, and no eighth has appeared unnoticed", () => {
    const numbered = [...section.matchAll(/^\d+\. /gm)];
    expect(numbered).toHaveLength(GUARDRAILS.length);
  });

  it.each(GUARDRAILS)("guardrail $n — $quoted", ({ quoted, file }) => {
    // The spec still says it…
    expect(flat).toContain(quoted);
    // …and a module carries the marker that says it is built.
    expect(markersOf(path.join(ROOT, file))).toContain("14");
  });

  it("§14's standing line has a module too", () => {
    // "no prompt-shaped tricks, no hidden instructions, in any generated
    // page" — two rules, two modules, and both now cite §14 in a form the
    // audit reads.
    expect(flat).toContain("no prompt-shaped tricks, no hidden instructions, in any generated page");
    for (const file of ["src/lib/generate/rules/machine.ts", "src/lib/generate/rules/hidden.ts"]) {
      expect(markersOf(path.join(ROOT, file)), file).toContain("14");
    }
  });

  it("§14 is built under §7, §8 and §9 — every guardrail module carries its own section too", () => {
    // "Build as features" is the section's own instruction: §14 owns no
    // module, and a module that carried *only* `§14` would be one built to
    // satisfy an audit rather than a customer.
    for (const { file } of GUARDRAILS) {
      const marks = markersOf(path.join(ROOT, file)).filter((mark) => mark !== "14");
      expect(marks.length, file).toBeGreaterThan(0);
    }
  });
});
