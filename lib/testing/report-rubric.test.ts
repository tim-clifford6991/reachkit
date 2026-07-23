/**
 * Engine-honesty self-tests for the rendered-report rubric (`report-rubric.ts`)
 * — the `tripwire.test.ts` discipline applied to a new guard family: every
 * rule is proven to FIRE on a crafted violating payload+HTML pair, so no rule
 * can be vacuous-by-construction. The corpus test
 * (`components/report/captured/report-corpus.rubric.test.tsx`) then proves the
 * rules bite on REAL captured payloads rendered through the real public path.
 */

import { describe, it, expect } from "vitest";
import type { ReportPayload } from "@/lib/scan/report";
import type { SearchVisibility } from "@/lib/scan/search-visibility";
import {
  runReportRubric,
  renderedNumbers,
  derivableNumbers,
  visibleText,
  RUBRIC_RULES,
} from "./report-rubric";

// ---------------------------------------------------------------------------
// Minimal builders (same defaults as results-screen.render.test.tsx's helpers)
// ---------------------------------------------------------------------------

function sv(over: Partial<SearchVisibility> = {}): SearchVisibility {
  return {
    score: 46,
    onPageReadiness: 80,
    keywordsRanked: 12,
    footprintComplete: true,
    estMonthlyVisits: 400,
    brandPct: 30,
    categoryPct: 20,
    aggregatedPct: 0,
    offTopicPct: 50,
    categoryGap: [],
    offTopicExamples: [],
    aggregatedExamples: [],
    categoryWins: 1,
    categoryDemand: 8000,
    categoryOpportunities: [{ keyword: "photo gallery website", volume: 4400 }],
    categoryPhrases: [{ keyword: "photo gallery website", volume: 4400 }],
    categoryRanked: [],
    categoryWonKeywords: [],
    ...over,
  };
}

function payload(over: Partial<ReportPayload> = {}): ReportPayload {
  return {
    mode: "web",
    generatedAt: "2026-07-19T00:00:00.000Z",
    whatYouOffer: {
      positioningMirror: { listingSays: "Photo tools for creators", reviewsValue: "", gap: "" },
    },
    whoItsFor: { summary: "creators", signals: [] },
    whereTheyAre: { surfaces: [], competitorGap: [] },
    whatToDoThisWeek: { quickWins: [], medium: [], longPlay: [] },
    score: { total: 61, breakdown: { content: 70, outreach: 40, seo: 65 }, radar: [], basis: "verified" },
    searchVisibility: sv(),
    ...over,
  };
}

/** HTML that satisfies every rule for the default payload() above — the clean
 *  baseline each firing test perturbs.
 *
 *  Review fix (2026-07-20): dropped the two legacy sentences this baseline
 *  used to include ("You rank in the top 3 for N of your category's
 *  searches." and "Winning this lifts Search presence — your weaker half.")
 *  — both are now BANNED_PROSE (R8) and their SECTION_RULES/R5 entries were
 *  removed, so a "clean" baseline that still rendered them would fail R8
 *  outright. The terse chip form (`top 3 × N` / `not ranking`, `+N more`)
 *  that replaces them in results-screen.tsx carries no sentence to assert
 *  here — R8's own corpus test covers that render directly. */
function cleanHtml(p: ReportPayload = payload()): string {
  const s = p.searchVisibility!;
  const onPage = s.onPageReadiness ?? p.score.total;
  const weaker = onPage < s.score ? "On-page readiness" : "Search presence";
  return `<main>
    <p>site.com is in decent on-page shape. The plan below focuses on where you can still gain ground.</p>
    <p><strong>${weaker} is your gap.</strong></p>
    <span>${s.categoryDemand.toLocaleString()}</span><span>searches/mo across your category</span>
    <div>See who's winning these searches</div>
  </main>`;
}

const only = (rule: string) => ({ suppress: RUBRIC_RULES.map((r) => r.id).filter((id) => id !== rule) });

// ---------------------------------------------------------------------------

describe("report-rubric engine honesty — every rule FIRES on a violating input", () => {
  it("baseline: the clean pair passes every rule", () => {
    expect(runReportRubric(payload(), cleanHtml())).toEqual([]);
  });

  it("R1 fires on a garbage token", () => {
    const v = runReportRubric(payload(), cleanHtml() + "<div>undefined</div>", only("R1"));
    expect(v.length).toBe(1);
    expect(v[0]!.message).toContain('"undefined"');
  });

  it("R2 fires on a rendered number with no payload basis (the SpaceX/resend class)", () => {
    const v = runReportRubric(payload(), cleanHtml() + "<div>8,171 searches a month</div>", only("R2"));
    expect(v.some((x) => x.message.includes("8171"))).toBe(true);
  });

  it("R2 passes payload-grounded numbers in every rendered form (commas, #rank, %)", () => {
    const p = payload({ searchVisibility: sv({ categoryDemand: 550000, offTopicPct: 72 }) });
    const html = cleanHtml(p).replace("searches/mo", "searches/mo</span><span>#12 and 72% and 550,000 searches/mo");
    // 12 is below the significance threshold; 72 and 550000 are payload values.
    expect(runReportRubric(p, html, only("R2"))).toEqual([]);
  });

  it("R2 ignores numbers inside <style>/<script> and attributes (text nodes only)", () => {
    const html = cleanHtml() + `<style>@media(min-width:76800px){}</style><div style="width:99999px"></div>`;
    expect(runReportRubric(payload(), html, only("R2"))).toEqual([]);
  });

  it("R2 skips a number truncated by the identityLine ellipsis", () => {
    const html = cleanHtml() + "<div>trusted by 500,0…</div>";
    expect(runReportRubric(payload(), html, only("R2"))).toEqual([]);
  });

  it("R3 fires when a section renders from an empty input (fabricated-reviews class)", () => {
    // competitorGap is EMPTY but the rivalry names line rendered anyway.
    const html = cleanHtml().replace("See who's winning these searches", "Compared to <strong>MadeUp Inc</strong>");
    const v = runReportRubric(payload(), html, only("R3"));
    expect(v.some((x) => x.message.includes("rivalry-names") && x.message.includes("ungrounded"))).toBe(true);
  });

  it("R3 fires on the converse — a grounded input whose section silently dropped", () => {
    const p = payload({ whereTheyAre: { surfaces: [], competitorGap: [{ competitor: "Calendly", dimension: "organic", them: 90, you: 10 }] } });
    // cleanHtml still shows the no-rivals tease and no names → both directions fire.
    const v = runReportRubric(p, cleanHtml(), only("R3"));
    expect(v.some((x) => x.message.includes("rivalry-names") && x.message.includes("did not render"))).toBe(true);
    expect(v.some((x) => x.message.includes("rivalry-degrade-tease") && x.message.includes("ungrounded"))).toBe(true);
  });

  it("R4 fires on 'all 0 opportunities' and on a count that isn't the rendered collection's length", () => {
    const zero = runReportRubric(payload(), cleanHtml() + "<div>win all 0 opportunities</div>", only("R4"));
    expect(zero.some((x) => x.message.includes("count of 0"))).toBe(true);
    // payload has 1 categoryOpportunity → a teaser claiming 7 is a sibling-metric count.
    const wrong = runReportRubric(payload(), cleanHtml() + "<div>win all 7 opportunities</div>", only("R4"));
    expect(wrong.some((x) => x.message.includes("≠ 1"))).toBe(true);
  });

  it("R4 fires on a locked-fixes teaser that doesn't equal fullActions − preview", () => {
    const v = runReportRubric(payload(), cleanHtml() + "<div>🔒 5 more ranked fixes</div>", only("R4"));
    expect(v.some((x) => x.message.includes("locked-fixes teaser 5"))).toBe(true);
  });

  it("R5 fires when the driver summary names the STRONGER driver (comparative contradiction)", () => {
    // on-page 80 > search 46 → "Search presence is your gap." is correct; claim the converse.
    const html = cleanHtml().replace("Search presence is your gap.", "On-page readiness is your gap.");
    const v = runReportRubric(payload(), html, only("R5"));
    expect(v.some((x) => x.message.includes("contradicts the driver bars"))).toBe(true);
  });

  it("R5 fires when the intro's on-page claim contradicts the on-page driver", () => {
    const html = cleanHtml().replace(
      "is in decent on-page shape. The plan below focuses on where you can still gain ground.",
      "has real on-page gaps holding it back.",
    );
    const v = runReportRubric(payload(), html, only("R5"));
    expect(v.some((x) => x.message.includes("has real on-page gaps"))).toBe(true);
  });

  it("R5 fires on a false 'ranks you for nothing yet' headline (keywordsRanked > 0)", () => {
    const v = runReportRubric(payload(), cleanHtml() + "<div>Google ranks you for nothing yet</div>", only("R5"));
    expect(v.some((x) => x.message.includes("nothing yet"))).toBe(true);
  });

  it("R6 fires on an inverted BROAD rung (rendered bridge line with no broad tier bigger than the hero)", () => {
    // Default payload has no valid broad tier → the bridge line is ungrounded.
    const html = cleanHtml() + "<div>Your category, where the plan below starts:</div>";
    const v = runReportRubric(payload(), html, only("R6"));
    expect(v.some((x) => x.message.includes("inverted ladder"))).toBe(true);
  });

  it("R6 fires on the converse — a valid broad tier whose rung silently dropped", () => {
    const p = payload({
      searchVisibility: sv({
        marketTiers: [{ tier: "broad", phrases: [{ keyword: "software", volume: 90000 }], demand: 90000, bestPosition: null }],
      }),
    });
    const v = runReportRubric(p, cleanHtml(p), only("R6"));
    expect(v.some((x) => x.message.includes("silent drop"))).toBe(true);
  });

  // E3 — the trustmrr "180,000 monthly visitors" class: an LLM-authored field
  // (identity line / mirror gap / mirror audience tags) must never render an
  // unmeasured quantitative claim (a 3+ digit run).
  it("R7 fires when identityLine's digit-laden sentence rendered verbatim", () => {
    const p = payload({
      whatYouOffer: { positioningMirror: { listingSays: "Trusted by 180,000 monthly visitors.", reviewsValue: "", gap: "" } },
    });
    const html = cleanHtml() + "<div>Trusted by 180,000 monthly visitors.</div>";
    const v = runReportRubric(p, html, only("R7"));
    expect(v.some((x) => x.message.includes("180,000"))).toBe(true);
  });

  it("R7 fires when the mirror gap's digit-laden sentence rendered verbatim", () => {
    const p = payload({
      whatYouOffer: { positioningMirror: { listingSays: "x", reviewsValue: "y", gap: "Reviews say it grew to 500,000 users overnight." } },
    });
    const html = cleanHtml() + "<div>Reviews say it grew to 500,000 users overnight.</div>";
    const v = runReportRubric(p, html, only("R7"));
    expect(v.some((x) => x.message.includes("500,000"))).toBe(true);
  });

  it("R7 fires when a digit-laden audience tag rendered verbatim", () => {
    const p = payload({
      whatYouOffer: {
        positioningMirror: { listingSays: "x", reviewsValue: "y", gap: "z", actualAudience: ["500,000 happy users"] },
      },
    });
    const html = cleanHtml() + "<div>500,000 happy users</div>";
    const v = runReportRubric(p, html, only("R7"));
    expect(v.length).toBeGreaterThan(0);
  });

  it("R7 passes when the digit-laden sentence was correctly scrubbed (not rendered)", () => {
    const p = payload({
      whatYouOffer: { positioningMirror: { listingSays: "Trusted by 180,000 monthly visitors.", reviewsValue: "", gap: "" } },
    });
    // cleanHtml() never renders the identity line at all → the scrub held.
    expect(runReportRubric(p, cleanHtml(), only("R7"))).toEqual([]);
  });

  it("R7 does not fire on small/measured numbers (ranks, counts under 100)", () => {
    const p = payload({
      whatYouOffer: { positioningMirror: { listingSays: "One of the top 5 tools for photographers.", reviewsValue: "", gap: "" } },
    });
    const html = cleanHtml() + "<div>One of the top 5 tools for photographers.</div>";
    expect(runReportRubric(p, html, only("R7"))).toEqual([]);
  });

  it("R3 off-topic grounding mirrors the explicit-terms curation (all-explicit examples ground nothing)", () => {
    const p = payload({
      searchVisibility: sv({ keywordsRanked: 100, offTopicPct: 60, offTopicExamples: ["porn hub"] }),
    });
    // No example copy rendered AND none required — the curated set is empty.
    expect(runReportRubric(p, cleanHtml(p), only("R3"))).toEqual([]);
  });

  // P4 (2026-07-20) — R8 terseness self-tests, same discipline as R1–R7:
  // proven to FIRE on a crafted violating input before the corpus test relies
  // on it biting real payloads.
  it("R8 fires when 'Positioning Mirror' renders verbatim", () => {
    const html = cleanHtml() + "<h2>Positioning Mirror</h2>";
    const v = runReportRubric(payload(), html, only("R8"));
    expect(v.some((x) => x.message.includes("Positioning Mirror"))).toBe(true);
  });

  it("R8 fires when a section-subtitle sentence renders verbatim", () => {
    const html = cleanHtml() + "<p>What buyers search, what you capture, who takes the rest.</p>";
    const v = runReportRubric(payload(), html, only("R8"));
    expect(v.some((x) => x.message.includes("what you capture"))).toBe(true);
  });

  it("R8 fires when a fix card's why-sentence renders verbatim", () => {
    const withActions = payload({
      whatToDoThisWeek: {
        quickWins: [
          {
            category: "content",
            title: "Add schema",
            why: "Structured data wins rich results for high-intent queries.",
            evidenceIds: [],
            evidence: [],
            effortMin: 20,
            suggestedDeadline: "2026-07-20",
            expectedOutcome: { scoreComponent: "content", delta: 4 },
            draft: null,
            draftRequiresEdit: true,
            verification: { method: "self_report", state: "pending" },
            basis: "probability_based",
            confidence: 0.5,
            target: null,
          },
        ],
        medium: [],
        longPlay: [],
      },
    });
    const html = cleanHtml(withActions) + "<div>Structured data wins rich results for high-intent queries.</div>";
    const v = runReportRubric(withActions, html, only("R8"));
    expect(v.some((x) => x.message.includes("Structured data wins rich results"))).toBe(true);
  });

  it("R8 passes clean HTML with no banned prose and no why-sentences rendered", () => {
    expect(runReportRubric(payload(), cleanHtml(), only("R8"))).toEqual([]);
  });

  // Review fix (2026-07-20): P4 stripped prose from the NEW six-section board
  // branch but left the LEGACY market-tier fallback branch (categoryCard
  // absent) rendering full sentences unchanged — verified to be 100% of the
  // real corpus fixtures. Each legacy sentence gets its own firing self-test,
  // same discipline as the Positioning Mirror / why-sentence cases above.
  it("R8 fires when the legacy 'weaker half' opportunity explainer renders verbatim", () => {
    const html = cleanHtml() + "<div>Winning this lifts Search presence — your weaker half.</div>";
    const v = runReportRubric(payload(), html, only("R8"));
    expect(v.some((x) => x.message.includes("Winning this lifts"))).toBe(true);
    expect(v.some((x) => x.message.includes("weaker half"))).toBe(true);
  });

  it("R8 fires when the legacy 'N more like it in your category' sentence renders verbatim", () => {
    const html = cleanHtml() + "<div>There are 3 more like it in your category.</div>";
    const v = runReportRubric(payload(), html, only("R8"));
    expect(v.some((x) => x.message.includes("more like it in your category"))).toBe(true);
  });

  it("R8 fires when the legacy 'YOUR CATEGORY' wins sentence renders verbatim", () => {
    const html = cleanHtml() + "<div>You rank in the top 3 for 4 of your category's searches.</div>";
    const v = runReportRubric(payload(), html, only("R8"));
    expect(v.some((x) => x.message.includes("You rank in the top 3 for"))).toBe(true);
  });

  it("R8 fires when the legacy 'Someone is winning these searches today' sentence renders verbatim", () => {
    const html = cleanHtml() + "<div>Someone is winning these searches today. <a>The full scan discovers who's winning these searches and what they do to rank →</a></div>";
    const v = runReportRubric(payload(), html, only("R8"));
    expect(v.some((x) => x.message.includes("Someone is winning these searches today"))).toBe(true);
  });

  // R9 (2026-07-21) — magnitude / credibility, same discipline as R1–R8.
  const readyCard = (demand: number, phraseKeywords: string[]) => ({
    label: "X",
    demand,
    phrases: phraseKeywords.map((keyword) => ({ keyword, volume: demand })),
    gaps: phraseKeywords.map((keyword) => ({ keyword, volume: demand })),
    rankedTop3: [],
  });

  it("R9 fires on a tiny niche hero below the credibility floor (the trustmrr 10/mo class)", () => {
    const p = payload({ searchVisibility: sv({ nicheCard: readyCard(10, ["startup acquisition marketplace"]) }) });
    const html = cleanHtml(p) + "<div>YOUR NICHE 10 searches / mo</div>";
    const v = runReportRubric(p, html, only("R9"));
    expect(v.some((x) => x.message.includes("credibility floor"))).toBe(true);
  });

  it("R9 passes a credible card over the floor — even a single-phrase niche (240/mo, savvycal class)", () => {
    const p = payload({ searchVisibility: sv({ nicheCard: readyCard(240, ["team scheduling software"]) }) });
    const html = cleanHtml(p) + "<div>YOUR NICHE 240 searches / mo</div>";
    expect(runReportRubric(p, html, only("R9"))).toEqual([]);
  });

  it("R9 does NOT police label credibility — a big but mislabeled category passes (that is the judge's job)", () => {
    const p = payload({ searchVisibility: sv({ categoryCard: readyCard(14800, ["business intelligence tools"]) }) });
    const html = cleanHtml(p) + "<div>YOUR CATEGORY 14,800 searches / mo</div>";
    expect(runReportRubric(p, html, only("R9"))).toEqual([]);
  });

  it("R9 ignores an unready card (it renders its zero-state, not a number)", () => {
    const p = payload({ searchVisibility: sv({ nicheCard: { label: "X", demand: 0, phrases: [], gaps: [], rankedTop3: [] } }) });
    expect(runReportRubric(p, cleanHtml(p), only("R9"))).toEqual([]);
  });

  it("suppressions skip exactly the named rule and nothing else", () => {
    const html = cleanHtml() + "<div>undefined</div>";
    expect(runReportRubric(payload(), html, { suppress: ["R1"] })).toEqual([]);
    expect(runReportRubric(payload(), html).some((x) => x.rule === "R1")).toBe(true);
  });
});

describe("extraction helpers", () => {
  it("visibleText decodes entities and drops style/script bodies", () => {
    const t = visibleText("<div>don&#x27;t</div><style>.x{width:768px}</style>");
    expect(t).toContain("don't");
    expect(t).not.toContain("768");
  });

  it("renderedNumbers normalizes separators and applies the ≥10 threshold", () => {
    const nums = renderedNumbers("<div>550,000 searches, top 3, #12</div>").map((n) => n.value);
    expect(nums).toContain(550000);
    expect(nums).toContain(12);
    expect(nums).not.toContain(3);
  });

  it("derivableNumbers refuses nothing it can name: every entry carries a source label", () => {
    const map = derivableNumbers(payload());
    for (const [, source] of map) expect(source.length).toBeGreaterThan(3);
    expect(map.get(8000)).toContain("searchVisibility.categoryDemand");
  });
});
