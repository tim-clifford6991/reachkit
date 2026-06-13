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
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { ActionCard } from "@/lib/llm/types";

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

/** A short category noun for the ICP / keyword (category → top theme → "product"). */
function categoryNoun(facts: PreliminaryFacts): string {
  const cat = cleanStr(facts.listing.category);
  if (cat.length > 0) return cat.toLowerCase();
  const theme = topTheme(facts);
  if (theme.length > 0) return theme.toLowerCase();
  return "product";
}

function deriveSeed(facts: PreliminaryFacts): ColdStartSeed {
  const productName = cleanStr(facts.listing.name) || "your product";

  const theme = topTheme(facts);
  const noun = categoryNoun(facts);

  // Top intent keyword: prefer "<theme> app" (e.g. "habit tracker app"); else "<category> app".
  const base = theme.length > 0 ? theme.toLowerCase() : noun;
  const topKeyword = `${base} app`;
  const secondKeyword = theme.length > 0 ? `best ${base}` : `${noun} tools`;

  // ICP: "people looking for a <category/theme> tool".
  const icp = `people looking for a ${base} tool`;

  // Top competitor from the SERP-discovered set; fall back to a generic phrase.
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
  _ctx: ScanContext,
  facts: PreliminaryFacts,
): Promise<ActionCard[]> {
  // Fixture path — deterministic, no derivation, no I/O.
  if (fixturesEnabled()) {
    return fixtureColdStartActions();
  }

  // Live path — template-driven from facts. Degrade-safe: never throw.
  try {
    const seed = deriveSeed(facts);
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
