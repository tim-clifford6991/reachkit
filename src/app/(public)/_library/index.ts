// Issue 1458 — the articles, read by the routes, the sitemap, the RSS feed
// and llms.txt. Each address is looked up here, so a slug the data does not
// hold is a 404 rather than an empty page.
import type { CopyKey } from "@/lib/presentation/copy";
import { CHECKERS } from "./compare/checkers";
import { OTHERS } from "./compare/others";
import { SUITES } from "./compare/suites";
import { ANSWERS } from "./answers";
import { TEARDOWNS } from "./teardowns";
import type { Answer, Comparison, ComparisonGroup, Job, Teardown } from "./types";

export type { Answer, Cell, Comparison, ComparisonGroup, Job, Section, SketchMark, Source, Teardown } from "./types";
export { ANSWERS, TEARDOWNS };

export const COMPARISONS: readonly Comparison[] = [...SUITES, ...CHECKERS, ...OTHERS];

/** The five jobs of getting found, as the index's chart heads them. */
export const MATRIX_JOBS = ["research", "choose", "write", "live", "results"] as const;
export type MatrixJob = (typeof MATRIX_JOBS)[number];

/** The day the chart's reading of each kind of tool was last checked (E14). */
export const MATRIX_CHECKED = "2026-10-19";

/** The index's sections, in the order it draws them: each one's name, its
 *  line, and the jobs no major tool of that kind helps with. */
export const COMPARISON_GROUPS: readonly {
  group: ComparisonGroup;
  name: CopyKey;
  line: CopyKey;
  leaves: readonly MatrixJob[];
}[] = [
  { group: "ai", name: "compare.group.ai", line: "compare.group.ai.line", leaves: [] },
  { group: "suite", name: "compare.group.suite", line: "compare.group.suite.line", leaves: [] },
  { group: "checker", name: "compare.group.checker", line: "compare.group.checker.line", leaves: [] },
  { group: "competitors", name: "compare.group.competitors", line: "compare.group.competitors.line", leaves: ["write", "live"] },
  { group: "audience", name: "compare.group.audience", line: "compare.group.audience.line", leaves: ["write", "live"] },
  { group: "data", name: "compare.group.data", line: "compare.group.data.line", leaves: ["write", "live"] },
];

/** The five jobs a page takes, in the order a tool page lists them. */
export const JOBS: readonly Job[] = ["choose", "facts", "write", "live", "results"];

/** A card's two lines: what the other tool is, then what ReachKit does. */
export function cardLines(summary: string): { them: string; us: string } {
  const at = summary.indexOf(". ReachKit ");
  return at === -1 ? { them: summary, us: "" } : { them: summary.slice(0, at + 1), us: summary.slice(at + 2) };
}

export function comparisonOf(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}

export function teardownOf(slug: string): Teardown | undefined {
  return TEARDOWNS.find((t) => t.slug === slug);
}

export function answerOf(slug: string): Answer | undefined {
  return ANSWERS.find((a) => a.slug === slug);
}

/** `2026-10-15` → `15 October 2026`, in the reader's English, on any clock. */
export function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
