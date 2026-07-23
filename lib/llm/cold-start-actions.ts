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

import { fixtures } from "@/lib/scan/fixture-seam";
import { getFreshFactSheet, factSheetSubjectType } from "@/lib/scan/fact-sheets";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { ActionCard, ActionCardEvidence, PositioningSheet } from "@/lib/llm/types";
import { EMPTY_GROUNDING } from "@/lib/llm/grounding";
import type { ActionGrounding } from "@/lib/llm/grounding";

// ---------------------------------------------------------------------------
// Shared Cold Start builder — pure + template-driven from a small set of derived
// strings. Used by BOTH the live (degrade-safe) path below and the deterministic
// fixtureColdStartActions() (lib/dev/fixtures.ts), so the two never drift.
// ---------------------------------------------------------------------------
export interface ColdStartSeed {
  productName: string;
  icp: string;
  topKeyword: string;
  secondKeyword: string;
  topCompetitor: string;
  communityA: string;
  communityB: string;
  communityAUrl?: string;
  communityBUrl?: string;
  creator?: { name: string; url: string; coveredCompetitor: string };
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

export function coldStartActionsFrom(seed: ColdStartSeed): ActionCard[] {
  const { productName, icp, topKeyword, secondKeyword, topCompetitor, communityA, communityB, communityAUrl, communityBUrl, creator } = seed;

  // Non-URL provenance labels keep these off the §11 per-surface cadence cap.
  const evPositioning = (excerpt: string): ActionCardEvidence => ({ excerpt, source: "positioning", sourceType: "positioning" });
  const evKeyword = (excerpt: string): ActionCardEvidence => ({ excerpt, source: "keyword_data", sourceType: "dataforseo_keywords" });
  const evSerp = (excerpt: string): ActionCardEvidence => ({ excerpt, source: "competitor_serp", sourceType: "dataforseo_serp" });
  const evCommunity = (excerpt: string): ActionCardEvidence => ({ excerpt, source: "community_scan", sourceType: "communities" });
  const evCreator = (excerpt: string): ActionCardEvidence => ({ excerpt, source: "creator_scan", sourceType: "youtube" });

  const cards: ActionCard[] = [
    // 1. Ship a waitlist / free-tool page targeting the hypothesised ICP.
    {
      category: "content",
      title: `Ship a waitlist page for ${productName} targeting ${icp}`,
      why: `${productName} has little public footprint yet, so the fastest way to validate demand is to put a focused waitlist page in front of ${icp} and measure sign-up conversion. The page doubles as the first real demand signal.`,
      evidenceIds: [],
      evidence: [
        evPositioning(`Hypothesised ICP: ${icp}`),
        evPositioning(`Core promise to test: helps ${icp} stay consistent`),
        evKeyword(`Intent keyword to headline: ${topKeyword}`),
      ],
      effortMin: 90,
      suggestedDeadline: isoPlusDays(7),
      expectedOutcome: { scoreComponent: "content", delta: 6, secondary: "Waitlist sign-up conversion becomes the first demand signal" },
      draft: `${productName} — for ${icp}.\n\nWe're building the simplest way for ${icp} to stay consistent. Drop your email to get early access and help shape it.\n\nWhat you get: first access, a say in the roadmap, and a founder who actually reads replies. No spam, just one short note when it's ready.`,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.55,
      target: null,
    },
    // 2. Post it in a scored community (demand test #1).
    {
      category: "outreach",
      title: `Share the waitlist in ${communityA} as a genuine ask, not a pitch`,
      why: `${communityA} is where ${icp} already gather, so a sincere "here's what I'm building, would this help you?" post tests whether the problem resonates. Replies and click-throughs are the demand signal — low engagement is itself useful data.`,
      evidenceIds: [],
      evidence: [
        evCommunity(`${icp} actively discuss this problem in ${communityA}`),
        evCommunity(`Comparison threads recur in communities like ${communityA}`),
        evPositioning(`Angle to test: helps ${icp} stay consistent`),
      ],
      effortMin: 30,
      suggestedDeadline: isoPlusDays(8),
      expectedOutcome: { scoreComponent: "outreach", delta: 4, secondary: "Community reply rate and click-through gauge problem resonance" },
      draft: `I'm building ${productName}, a simple tool for ${icp}. Before I go further I wanted to ask the people it's actually for: when you've tried to stay consistent, what got in the way? If a tool like this would help, the waitlist is in the comments — but honestly I'm here for the answers more than the sign-ups.`,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.5,
      target: { channel: "community", label: communityA, ...(communityAUrl ? { url: communityAUrl } : {}) },
    },
    // 2b. Post it in a second scored community (demand test #2).
    {
      category: "content",
      title: `Write a short build-in-public post for ${communityB}`,
      why: `${communityB} rewards transparent early-stage stories. A post on why you're building ${productName} for ${icp} tests whether the narrative lands and seeds the first followers — engagement here is an early demand read before any spend.`,
      evidenceIds: [],
      evidence: [
        evCommunity(`${communityB} engages with early-stage build-in-public posts`),
        evCommunity(`${icp} surface in community discussions around this problem`),
        evSerp(`Established alternatives such as ${topCompetitor} appear in SERP results`),
      ],
      effortMin: 45,
      suggestedDeadline: isoPlusDays(9),
      expectedOutcome: { scoreComponent: "content", delta: 4, secondary: "Post engagement is an early demand read pre-spend" },
      draft: `Day 1 of building ${productName}: a no-frills tool for ${icp}. The big apps (${topCompetitor} and friends) feel heavy for what I actually need, so I'm starting from the smallest thing that helps me stay consistent. I'll share what works and what flops. If you're one of ${icp}, I'd love your take on what's missing.`,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.5,
      target: { channel: "community", label: communityB, ...(communityBUrl ? { url: communityBUrl } : {}) },
    },
    // 3. Stand up one comparison / landing page on the top intent keyword.
    {
      category: "seo_aso",
      title: `Stand up a "${productName} vs ${topCompetitor}" comparison page on "${topKeyword}"`,
      why: `People searching "${topKeyword}" and "${topCompetitor} alternative" are pre-qualified. A single honest comparison page lets you measure search-driven conversion before committing to a content programme — the conversion rate tells you if the positioning holds.`,
      evidenceIds: [],
      evidence: [
        evSerp(`${topCompetitor} ranks for the intent term and owns the comparison space`),
        evSerp(`Alternative-seeking queries cluster around ${topCompetitor}`),
        evKeyword(`Top intent keyword: ${topKeyword}`),
      ],
      effortMin: 90,
      suggestedDeadline: isoPlusDays(12),
      expectedOutcome: { scoreComponent: "seo", delta: 5, secondary: "Search-to-waitlist conversion validates the positioning" },
      draft: null,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.5,
      target: null,
    },
    // 4. Optional fast-signal: a small ad test on the top intent keyword.
    {
      category: "seo_aso",
      title: `Run a $50 search-ad test on "${topKeyword}" pointing at the waitlist`,
      why: `A $50 ad test buys a fast, quantified read on intent for "${topKeyword}" without waiting for organic ranking. Click-through and waitlist conversion give you a kill/keep number within days — cheaper than guessing.`,
      evidenceIds: [],
      evidence: [
        evKeyword(`Top intent keyword to bid on: ${topKeyword}`),
        evKeyword(`Secondary keyword for ad groups: ${secondKeyword}`),
        evSerp(`Paid competition is visible against ${topCompetitor} on the term`),
      ],
      effortMin: 60,
      suggestedDeadline: isoPlusDays(10),
      expectedOutcome: { scoreComponent: "seo", delta: 3, secondary: "Ad CTR + waitlist conversion give a fast kill/keep number" },
      draft: null,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.45,
      target: null,
    },
    // 5. Optional (never mandatory) discovery-conversation script.
    {
      category: "outreach",
      title: `Optional: a 5-question discovery script for 5 chats with ${icp}`,
      why: `If the waitlist and ad signals are ambiguous, five short conversations with ${icp} explain the why behind the numbers. This is optional and runs in parallel — never a blocker to shipping the distribution tests above.`,
      evidenceIds: [],
      evidence: [
        evPositioning(`Audience to talk to: ${icp}`),
        evPositioning(`Hypothesis to probe: staying consistent is the core pain`),
        evCommunity(`Recruit participants from ${communityA} respondents`),
      ],
      effortMin: 40,
      suggestedDeadline: isoPlusDays(11),
      expectedOutcome: { scoreComponent: "outreach", delta: 2, secondary: "Qualitative why behind the waitlist/ad numbers" },
      draft: `Quick discovery script (keep it to 15 minutes):\n1. Last time you tried to stay consistent, what did you use?\n2. What made you stop or switch?\n3. What would have to be true for you to switch tools?\n4. If this existed tomorrow, what's the one thing it must do?\n5. Who else do you know who has this problem?\nListen more than you pitch — the goal is to understand ${icp}, not to sell.`,
      draftRequiresEdit: true,
      verification: { method: "self_report", state: "pending" },
      basis: "probability_based",
      confidence: 0.5,
      target: null,
    },
    // 6. Pivot-suggestion card — kill/pivot criteria from OBSERVED signals, framed
    //    as the next action (not a lecture). Highest confidence so it always survives.
    {
      category: "content",
      title: `Decide: keep, sharpen, or pivot ${productName} from the first signals`,
      why: `Set the kill/pivot line before you read the results so it stays honest: if waitlist conversion is under ~10%, ad CTR under ~1%, and community posts get little engagement after two weeks, treat that as a signal to sharpen the ICP or pivot the angle — then re-run this same queue on the new hypothesis.`,
      evidenceIds: [],
      evidence: [
        evKeyword(`Measure ad CTR + waitlist conversion on ${topKeyword}`),
        evCommunity(`Weigh reply/engagement rate from ${communityA} and ${communityB}`),
        evPositioning(`Re-test the ICP (${icp}) if signals stay weak`),
      ],
      effortMin: 30,
      suggestedDeadline: isoPlusDays(14),
      expectedOutcome: { scoreComponent: "content", delta: 3, secondary: "A pre-committed kill/pivot line keeps the read honest" },
      draft: `Pivot checkpoint (fill in after two weeks):\n- Waitlist conversion: ____%  (weak if < ~10%)\n- Ad CTR on "${topKeyword}": ____%  (weak if < ~1%)\n- Community engagement in ${communityA} / ${communityB}: ____\n\nIf two or more are weak, don't push harder on the same plan — change the ICP or the angle and re-run this queue. If they're strong, double down and start the standard plan.`,
      draftRequiresEdit: true,
      verification: { method: "self_report", state: "pending" },
      basis: "probability_based",
      confidence: 0.6,
      target: null,
    },
  ];

  // 7. Optional: a named creator who already covers the top competitor —
  //    added only when grounding surfaced a real creator (never a mass pitch).
  if (creator) {
    cards.push({
      category: "outreach",
      title: `Reach out to ${creator.name}, who has covered ${topCompetitor}`,
      why: `${creator.name} already makes content about ${topCompetitor} — a genuine, specific note (not a mass pitch) puts ${productName} in front of an audience that has shown it cares about this exact category.`,
      evidenceIds: [],
      evidence: [
        evCreator(`${creator.name} covered ${creator.coveredCompetitor || topCompetitor}`),
        evPositioning(`Angle to lead with: how ${productName} differs for ${icp}`),
      ],
      effortMin: 30,
      suggestedDeadline: isoPlusDays(10),
      expectedOutcome: { scoreComponent: "outreach", delta: 3, secondary: "Creator coverage reaches a pre-qualified audience" },
      draft: `Hi ${creator.name} — I saw your work on ${creator.coveredCompetitor || topCompetitor}. I'm building ${productName} for ${icp}; the difference is [one concrete thing]. Not asking for a review — just wondered if it'd be useful to your audience. Happy to give you early access.`,
      draftRequiresEdit: true,
      verification: { method: "self_report", state: "pending" },
      basis: "probability_based",
      confidence: 0.45,
      target: { channel: "creator", label: creator.name, url: creator.url },
    });
  }

  return cards;
}

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

function deriveSeed(facts: PreliminaryFacts, grounding: ActionGrounding, positioning?: PositioningSheet): ColdStartSeed {
  const productName = cleanProductName(cleanStr(facts.listing.name) || "your product");
  const base = deriveCategory(facts, positioning);

  // Don't append "tool" when the category already implies a product noun.
  const hasNoun = /\b(app|tool|software|platform|service|crm|saas)\b/.test(base);
  const topKeyword = hasNoun ? base : `${base} tool`;
  const secondKeyword = `best ${base}`;
  const icp = `people looking for ${base}`;

  // Top competitor: prefer the real, brand-validated grounding set, then the
  // discovered facts set, else a generic phrase.
  const firstCompetitor = grounding.competitors.find((c) => c.name.length > 0)?.name
    ?? facts.competitors.find((c) => cleanStr(c.name).length > 0)?.name;
  const topCompetitor = firstCompetitor ? cleanStr(firstCompetitor) : "the leading alternative";

  // Real engaged communities/creators when grounding has them; otherwise the
  // hardcoded defaults so behaviour is unchanged when grounding is empty.
  const comms = grounding.communities;
  const communityA = comms[0]?.title ?? DEFAULT_COMMUNITY_A;
  const communityAUrl = comms[0]?.url;
  const communityB = comms[1]?.title ?? DEFAULT_COMMUNITY_B;
  const communityBUrl = comms[1]?.url;
  // Creators were retired M3b (2026-07-23, O-8, write-only) — ActionGrounding
  // no longer carries them, so `seed.creator` (and the optional card-7 outreach
  // card in coldStartActionsFrom) is simply never populated now.

  return {
    productName,
    icp,
    topKeyword,
    secondKeyword,
    topCompetitor,
    communityA,
    communityAUrl,
    communityB,
    communityBUrl,
  };
}

/** Test-only seam mirroring `coerceCardForTest` — exposes seed derivation so
 *  tests can assert on grounded seeds without duplicating the derivation logic. */
export function deriveSeedForTest(facts: PreliminaryFacts, grounding: ActionGrounding, positioning?: PositioningSheet): ColdStartSeed {
  return deriveSeed(facts, grounding, positioning);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function generateColdStartActions(
  ctx: ScanContext,
  facts: PreliminaryFacts,
  grounding: ActionGrounding = EMPTY_GROUNDING,
): Promise<ActionCard[]> {
  // Fixture path — deterministic, no derivation, no I/O.
  const _f = fixtures();
  if (_f) {
    return _f.coldStartActions();
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
    const seed = deriveSeed(facts, grounding, positioning);
    return coldStartActionsFrom(seed);
  } catch {
    // Last-resort fallback: a sane generic Cold Start set so the scan never breaks.
    // Still grounded where possible — defaults preserved when grounding is empty.
    const firstCompetitor = grounding.competitors.find((c) => c.name.length > 0)?.name;
    const comms = grounding.communities;
    return coldStartActionsFrom({
      productName: "your product",
      icp: "your target users",
      topKeyword: "your category app",
      secondKeyword: "your category tools",
      topCompetitor: firstCompetitor ? cleanStr(firstCompetitor) : "the leading alternative",
      communityA: comms[0]?.title ?? DEFAULT_COMMUNITY_A,
      communityAUrl: comms[0]?.url,
      communityB: comms[1]?.title ?? DEFAULT_COMMUNITY_B,
      communityBUrl: comms[1]?.url,
    });
  }
}
