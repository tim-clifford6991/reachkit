/**
 * Cold Start action queue (§4.3) — Cycle 5 Task 5.
 *
 * For subjects with little/no footprint (facts.coldStart === true), the full scan
 * validates THROUGH distribution: instead of "go do customer interviews", it
 * front-loads action cards whose execution itself generates validation signals
 * (waitlist conversion, community engagement, ad CTR), and surfaces kill/pivot
 * criteria as a pivot-suggestion card in the SAME queue — never a lecture.
 *
 * Every card is `probability_based` with confidence capped ≤ 0.6.
 *
 * Paths:
 *   fixturesEnabled() → deterministic fixtureColdStartActions() (keyless dev/test).
 *   live             → template-driven from facts via coldStartActionsFrom().
 *                      Cheap (no LLM call) and degrade-safe: derivation is wrapped
 *                      so a malformed facts object can never throw — it falls back
 *                      to a sane templated seed. The cards then flow through the
 *                      same Critic → algorithmSafety gate as any other plan.
 */

import { fixturesEnabled, fixtureColdStartActions, coldStartActionsFrom } from "@/lib/dev/fixtures";
import type { ColdStartSeed } from "@/lib/dev/fixtures";
import { getFreshFactSheet, factSheetSubjectType } from "@/lib/scan/fact-sheets";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { ActionCard, PositioningSheet } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// Seed derivation — pull the ICP, top intent keyword, top competitor and a
// couple of seed communities out of the preliminary facts. Every field has a
// fallback so the result is always well-formed.
// ---------------------------------------------------------------------------

const DEFAULT_COMMUNITY_A = "a relevant subreddit";
const DEFAULT_COMMUNITY_B = "Indie Hackers";

function cleanStr(s: string | null | undefined): string {
  return typeof s === "string" ? s.trim() : "";
}

/** First non-empty theme term, else "". */
function topTheme(facts: PreliminaryFacts): string {
  for (const t of facts.themes) {
    const term = cleanStr(t.term);
    if (term.length > 0) return term;
  }
  return "";
}

/** Strip a trailing tagline/site suffix so "Nudgi — Walk Into Every Meeting…" → "Nudgi". */
function cleanProductName(name: string): string {
  const first = name.split(/\s+[|–—-]\s+|:\s+/)[0]?.trim();
  return first || name.trim();
}

/**
 * A real category phrase for the ICP / keyword. Prefers the LLM-extracted
 * positioning category (e.g. "meeting preparation software"), then the listing
 * category, then a top theme — so Cold Start cards are app-specific, not "product".
 */
function deriveCategory(facts: PreliminaryFacts, positioning?: PositioningSheet): string {
  // Prefer the LLM positioning category (richest, most specific), then a review
  // theme (specific), then the broad listing category, then a generic fallback.
  return (
    cleanStr(positioning?.category) ||
    topTheme(facts) ||
    cleanStr(facts.listing.category) ||
    "product"
  ).toLowerCase();
}

function deriveSeed(facts: PreliminaryFacts, positioning?: PositioningSheet): ColdStartSeed {
  const productName = cleanProductName(cleanStr(facts.listing.name) || "your product");
  const base = deriveCategory(facts, positioning);

  // Don't append "tool" when the category already implies a product noun.
  const hasNoun = /\b(app|tool|software|platform|service|crm|saas)\b/.test(base);
  const topKeyword = hasNoun ? base : `${base} tool`;
  const secondKeyword = `best ${base}`;
  const icp = `people looking for ${base}`;

  // Top competitor from the discovered set; fall back to a generic phrase.
  const firstCompetitor = facts.competitors.find((c) => cleanStr(c.name).length > 0);
  const topCompetitor = firstCompetitor ? cleanStr(firstCompetitor.name) : "the leading alternative";

  return {
    productName,
    icp,
    topKeyword,
    secondKeyword,
    topCompetitor,
    communityA: DEFAULT_COMMUNITY_A,
    communityB: DEFAULT_COMMUNITY_B,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function generateColdStartActions(
  ctx: ScanContext,
  facts: PreliminaryFacts,
): Promise<ActionCard[]> {
  // Fixture path — deterministic, no derivation, no I/O.
  if (fixturesEnabled()) {
    return fixtureColdStartActions();
  }

  // Live path — template-driven from facts + the real positioning sheet (for an
  // app-specific category/keyword). Degrade-safe: never throw.
  try {
    let positioning: PositioningSheet | undefined;
    try {
      const row = await getFreshFactSheet(factSheetSubjectType(ctx.mode), ctx.storeUrl, "positioning");
      if (row) positioning = row.body as PositioningSheet;
    } catch {
      /* positioning is optional — fall through to facts-only derivation */
    }
    const seed = deriveSeed(facts, positioning);
    return coldStartActionsFrom(seed);
  } catch {
    // Last-resort fallback: a sane generic Cold Start set so the scan never breaks.
    return coldStartActionsFrom({
      productName: "your product",
      icp: "your target users",
      topKeyword: "your category app",
      secondKeyword: "your category tools",
      topCompetitor: "the leading alternative",
      communityA: DEFAULT_COMMUNITY_A,
      communityB: DEFAULT_COMMUNITY_B,
    });
  }
}
