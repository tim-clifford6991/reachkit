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
import type { Horizon } from "@/lib/scan/plan-horizon";

export const KIND_STYLE: Record<PlanEntry["kind"], { bg: string; fg: string; label: string }> = {
  content: { bg: "var(--c-soft)", fg: "var(--c-action)", label: "content" },
  distribution: { bg: "var(--c-tint-green)", fg: "var(--c-band-findable)", label: "distribution" },
  post: { bg: "var(--c-tint-blue)", fg: "#3b6fe0", label: "daily post" },
};

/**
 * Horizon badge colors — short (Quick win) reuses the same blue pairing as the
 * "daily post" kind chip above (there is no dedicated `--c-*` blue-foreground
 * token yet; this reuses the existing constant rather than adding a new hex
 * literal), medium (This week) is the violet action tint, long (Compounding)
 * reuses the green "distribution" pairing (compounding work IS distribution).
 * Tokens only — no new raw hex introduced here.
 */
export const HORIZON_STYLE: Record<Horizon, { bg: string; fg: string }> = {
  short: { bg: "var(--c-tint-blue)", fg: KIND_STYLE.post.fg },
  medium: { bg: "var(--c-tint-violet)", fg: "var(--c-action)" },
  long: { bg: "var(--c-tint-green)", fg: "var(--c-band-findable)" },
};

/** Map a persisted action (category + title) back onto a plan-entry kind, so
 *  lifecycle rows color-match the calendar. */
export function kindOfAction(a: { category: string; title: string }): PlanEntry["kind"] {
  if (a.title.startsWith(DAILY_POST_PREFIX)) return "post";
  return a.category === "content" ? "content" : "distribution";
}
