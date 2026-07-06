/**
 * Kind styling — the single source of truth for how the three plan-entry kinds
 * read across EVERY surface (calendar chips, entry cards, lifecycle rows):
 *
 *   content      violet — the weekly long-form piece for their own site
 *   distribution green  — targeted venue actions (§11-spaced)
 *   post         blue   — the daily X post habit
 *
 * One edit here recolors all surfaces; never restyle a kind locally.
 */
import type { PlanEntry } from "@/lib/scan/plan-schedule";
import { DAILY_POST_PREFIX } from "@/lib/scan/plan-schedule";

export const KIND_STYLE: Record<PlanEntry["kind"], { bg: string; fg: string; label: string }> = {
  content: { bg: "var(--c-soft)", fg: "var(--c-action)", label: "content" },
  distribution: { bg: "var(--c-tint-green)", fg: "var(--c-band-findable)", label: "distribution" },
  post: { bg: "var(--c-tint-blue)", fg: "#3b6fe0", label: "daily post" },
};

/** Map a persisted action (category + title) back onto a plan-entry kind, so
 *  lifecycle rows color-match the calendar. */
export function kindOfAction(a: { category: string; title: string }): PlanEntry["kind"] {
  if (a.title.startsWith(DAILY_POST_PREFIX)) return "post";
  return a.category === "content" ? "content" : "distribution";
}
