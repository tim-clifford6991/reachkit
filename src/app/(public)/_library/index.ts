// Issue 1458 — the articles, read by the routes, the sitemap, the RSS feed
// and llms.txt. Each address is looked up here, so a slug the data does not
// hold is a 404 rather than an empty page.
import type { CopyKey } from "@/lib/presentation/copy";
import { CHECKERS } from "./compare/checkers";
import { OTHERS } from "./compare/others";
import { SUITES } from "./compare/suites";
import { ANSWERS } from "./answers";
import { TEARDOWNS } from "./teardowns";
import type { Answer, Comparison, ComparisonGroup, Teardown } from "./types";

export type { Answer, Cell, Comparison, ComparisonGroup, Section, Source, Teardown } from "./types";
export { ANSWERS, TEARDOWNS };

export const COMPARISONS: readonly Comparison[] = [...SUITES, ...CHECKERS, ...OTHERS];

/** The index's sections, in the order it draws them, and each one's name. */
export const COMPARISON_GROUPS: readonly { group: ComparisonGroup; name: CopyKey }[] = [
  { group: "suite", name: "compare.group.suite" },
  { group: "checker", name: "compare.group.checker" },
  { group: "competitors", name: "compare.group.competitors" },
  { group: "audience", name: "compare.group.audience" },
  { group: "ai", name: "compare.group.ai" },
  { group: "data", name: "compare.group.data" },
];

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
