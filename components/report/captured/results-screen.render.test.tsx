/**
 * ResultsScreen RENDER test (launch P5) — the free report is the conversion
 * surface, and the CLAUDE.md hard rule warns that asserting the persisted
 * `report_payload` (as `free-report-e2e.test.ts` does) MASKS render bugs:
 * garbage positioning chips, a zero-state that never renders, a self-
 * contradicting hero. So this renders the actual `ResultsScreen` React tree to
 * HTML (via `renderToStaticMarkup`, the repo's component-render idiom — no
 * Playwright/jsdom, per the deliberate "no browser dep" choice in
 * scripts/render-smoke.mjs) for the three scenarios the hard rule names — a
 * directory, a 0-ranking new product, and a normal SaaS — and asserts the
 * rendered TEXT is clean and coherent.
 *
 * Exercises the full chain ReportPayload → toResultsProps → ResultsScreen, so
 * both the mapping (props) and the render (HTML) are covered.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsScreen } from "./results-screen";
import { toResultsProps } from "./to-results-props";
import type { ReportPayload } from "@/lib/scan/report";
import type { SearchVisibility } from "@/lib/scan/search-visibility";
import type { ActionCard } from "@/lib/llm/types";
import { tierByPlan, fmtPrice } from "@/lib/billing/pricing";

// The unlock band must state the price up front (Task 1.4 — visitors used to
// learn the price only inside Stripe Checkout). Built from the same pricing
// source the component reads, so a price change can't silently break this
// copy-vs-code parity check (never assert the raw number twice).
const PRICE_LINE_RE = new RegExp(`${fmtPrice(tierByPlan("solo").monthly)}/mo.*cancel anytime`);

type CompGap = ReportPayload["whereTheyAre"]["competitorGap"][number];

function sv(over: Partial<SearchVisibility> = {}): SearchVisibility {
  return {
    score: 46,
    onPageReadiness: 80,
    keywordsRanked: 12, footprintComplete: true,
    estMonthlyVisits: 400,
    brandPct: 30,
    categoryPct: 20,
    offTopicPct: 50,
    categoryGap: [],
    offTopicExamples: [],
    categoryWins: 1,
    categoryDemand: 8000,
    categoryOpportunities: [
      { keyword: "photo gallery website", volume: 4400 },
      { keyword: "portfolio builder", volume: 900 },
    ],
    categoryPhrases: [
      { keyword: "photo gallery website", volume: 4400 },
      { keyword: "portfolio builder", volume: 900 },
      { keyword: "photo hosting", volume: 2700 },
    ],
    categoryWonKeywords: [],
    ...over,
  };
}

function comp(name: string): CompGap {
  return { competitor: name, dimension: "organic", them: 100, you: 10 };
}

function action(title: string, delta: number): ActionCard {
  return {
    category: "content",
    title,
    why: `why ${title}`,
    evidenceIds: [],
    evidence: [],
    effortMin: 30,
    suggestedDeadline: "2026-07-20",
    expectedOutcome: { scoreComponent: "content", delta },
    draft: null,
    draftRequiresEdit: true,
    verification: { method: "self_report", state: "pending" },
    basis: "probability_based",
    confidence: 0.5,
    target: null,
  };
}

function report(over: Partial<ReportPayload> = {}): ReportPayload {
  return {
    mode: "web",
    generatedAt: "2026-07-03T00:00:00.000Z",
    whatYouOffer: {
      positioningMirror: { listingSays: "Photo tools for creators", reviewsValue: "fast galleries", gap: "gap" },
    },
    whoItsFor: { summary: "creators", signals: ["speed"] },
    whereTheyAre: { surfaces: [], competitorGap: [] },
    whatToDoThisWeek: { quickWins: [], medium: [], longPlay: [] },
    score: { total: 42, breakdown: { content: 40, outreach: 30, seo: 50 }, radar: [], basis: "verified" },
    ...over,
  };
}

// Tokens that only appear when a value threaded into JSX was undefined/NaN/an
// unstringified object — the signature of a garbage chip / broken interpolation.
const GARBAGE = ["undefined", "NaN", "[object Object]", "$undefined", "Infinity"];
function assertNoGarbage(html: string, label: string) {
  for (const g of GARBAGE) {
    expect(html.includes(g), `${label}: rendered HTML must not contain "${g}"`).toBe(false);
  }
}

describe("ResultsScreen render (P5) — the three named free-report scenarios render clean", () => {
  it("normal SaaS: mid score, real category demand, competitors → coherent low-capture hero", () => {
    const r = report({
      score: { total: 61, breakdown: { content: 70, outreach: 40, seo: 65 }, radar: [], basis: "verified" },
      searchVisibility: sv({ keywordsRanked: 40, footprintComplete: true, categoryDemand: 12000, }),
      whereTheyAre: { surfaces: [], competitorGap: [comp("Ahrefs"), comp("Semrush")] },
      whatToDoThisWeek: {
        quickWins: [action("Add meta descriptions", 6)],
        medium: [action("Publish comparison pages", 9)],
        longPlay: [],
      },
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "acme.com", 2, 12)} scanId="scan-saas" />);

    assertNoGarbage(html, "normal SaaS");
    expect(html).toContain("acme.com"); // site label rendered
    expect(html).toContain(">61<"); // the gauge score renders
    // The "you capture just X%" line is GONE — captureRate was the score under a
    // second label. The honest hero states the real category demand + the true
    // ranked count (footprintComplete), never a fabricated capture percentage.
    expect(html).not.toMatch(/capture just \d+%/i);
    expect(html).not.toMatch(/You capture \d+%/i);
    expect(html).toContain("searches/mo across your category");
    expect(html).toContain("Ahrefs"); // discovered competitor names render
    expect(html).toMatch(PRICE_LINE_RE); // unlock band states the price up front (Task 1.4)
    // onPageReadiness (80, from sv()'s default) >= 60 → the intro must say the
    // page is in decent on-page shape (never the unconditional, unverifiable
    // "is technically fine"), and make NO search claim — the headline above
    // owns the search story, so an intro search claim could directly
    // contradict it (e.g. an "on the board in search" headline over a "search
    // is your bigger gap" intro). Gated on onPageReadiness, NOT score.total
    // (61) — the unified geomean the two would otherwise be confused for
    // (Critical 1).
    expect(html).toContain("is in decent on-page shape. The plan below focuses on where you can still gain ground.");
    // Search (46) is the weaker driver here (< onPageReadiness 80) → MINOR 4.
    expect(html).toContain("Search presence is your gap.");
  });

  it("0-ranking new product: invisible in search → zero-state hero, no broken artifacts", () => {
    const r = report({
      // score.total (18) must be geomean-consistent with the two drivers below:
      // round(sqrt(onPageReadiness 54 × search 6)) = round(sqrt(324)) = 18. The
      // weak on-page driver (54 < 60) is what makes the "has real on-page gaps"
      // intro copy TRUE in this fixture (Critical 1 fix: the intro now gates on
      // onPageReadiness, not the unified score.total).
      score: { total: 18, breakdown: { content: 20, outreach: 10, seo: 15 }, radar: [], basis: "verified" },
      searchVisibility: sv({
        score: 6,
        onPageReadiness: 54,
        keywordsRanked: 0, footprintComplete: true,
        estMonthlyVisits: 0,
        brandPct: 0,
        categoryPct: 0,
        offTopicPct: 0,
        categoryWins: 0,
        categoryDemand: 5400,
        categoryOpportunities: [{ keyword: "habit tracker app", volume: 3200 }],
      }),
      whatToDoThisWeek: { quickWins: [], medium: [], longPlay: [] },
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "newproduct.io", 0, 0)} scanId="scan-zero" />);

    assertNoGarbage(html, "0-ranking");
    expect(html).toContain("newproduct.io");
    expect(html).toContain(">18<");
    expect(html).toContain("ranks you for nothing yet"); // the 0-ranking hero
    // A brand-new invisible product must NOT get the "on the board in search" hero.
    expect(html).not.toContain("on the board in search");
    // score.total 18 < 60 → a weak page must never be called "technically
    // fine" (the old copy was unconditional, false here, and its "absent from
    // comparison and directory surfaces" claim was evidence-free). The intro
    // also makes no search claim — the headline owns the search story.
    expect(html).not.toContain("is technically fine");
    expect(html).toContain("has real on-page gaps holding it back. The plan below starts with the fixes that matter most.");
  });

  it("directory: tidy page but visibility is other brands' names → honest 'brand names' hero, not a false 88 win", () => {
    const r = report({
      // score.total (88) is geomean-consistent: round(sqrt(onPageReadiness 98 ×
      // search 79)) = round(sqrt(7742)) = 88. Tidy on-page (98, matches the
      // content:95 breakdown) + a decent absolute category-keyword strength (79)
      // despite most of the raw ranked-keyword traffic (by volume) being other
      // companies' names (offTopicPct 72%) — those are independent measures.
      score: {
        total: 88,
        breakdown: { content: 95, outreach: 20, seo: 90 },
        radar: [
          { axis: "Content", value: 95, active: true, assessed: true },
          { axis: "Outreach", value: 0, active: true, assessed: false },
          { axis: "SEO/ASO", value: 90, active: true, assessed: true },
        ],
        basis: "verified",
      },
      searchVisibility: sv({ score: 79, onPageReadiness: 98, keywordsRanked: 250, footprintComplete: true, offTopicPct: 72, categoryDemand: 0, }),
      whereTheyAre: { surfaces: [], competitorGap: [comp("G2")] },
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "somedir.com", 3, 8)} />);

    assertNoGarbage(html, "directory");
    expect(html).toContain("somedir.com");
    expect(html).toContain(">88<");
    // The tidy 88 must read as the honest gap, not a "you're winning" headline —
    // the high band label and the honest search-gap hero coexist coherently.
    expect(html).toContain("72% of the searches you rank for");
    expect(html).toContain("other companies"); // the honest "not your traffic" framing
  });

  it("low on-page + off-topic search visibility: headline owns ONLY the search story, intro ONLY the on-page story — no contradiction", () => {
    // Previously-contradictory pairing: the off-topic headline branch gates only
    // on search-side fields (keywordsRanked > 0, offTopicPct >= 55,
    // categoryDemand <= 0), independent of score.total — so a weak page (< 60)
    // could get a headline opening "Your page is clean" directly above the
    // "has real on-page gaps" intro. The headline must make NO on-page claim.
    const r = report({
      // score.total (34) geomean-consistent: round(sqrt(onPageReadiness 45 ×
      // search 26)) = round(sqrt(1170)) = 34. onPageReadiness 45 < 60 → the
      // intro's "has real on-page gaps" claim is TRUE in this fixture.
      score: { total: 34, breakdown: { content: 30, outreach: 25, seo: 45 }, radar: [], basis: "verified" },
      searchVisibility: sv({ score: 26, onPageReadiness: 45, keywordsRanked: 120, footprintComplete: true, offTopicPct: 68, categoryDemand: 0, }),
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "weakpage.com", 0, 0)} scanId="scan-offtopic" />);

    assertNoGarbage(html, "low-score off-topic");
    expect(html).toContain("68% of the searches you rank for are other companies");
    expect(html).toContain("has real on-page gaps");
    expect(html).not.toContain("page is clean");
    // Search is the weaker driver here (26 < 45) → the driver-summary line
    // should name search, not on-page, as the gap (MINOR 4).
    expect(html).toContain("Search presence is your gap.");
  });

  it("trustmrr-shape: flawless on-page, near-invisible in search → unified total is low, but the intro must credit the strong on-page driver (Critical 1)", () => {
    // The flagship honesty case the whole branch exists for: a beautifully-built
    // page (onPageReadiness 98) that almost nobody finds (search 4) — unified
    // total = round(sqrt(98 * 4)) = round(sqrt(392)) = 20. Gating the intro on
    // `score.total` (20 < 60) would falsely claim "has real on-page gaps"
    // directly beside a 98/100 on-page driver bar. Gating on onPageReadiness
    // (98 >= 60) is the fix: the intro must credit the on-page driver and the
    // headline (search-only) owns the low-total story instead.
    const r = report({
      score: { total: 20, breakdown: { content: 98, outreach: 90, seo: 97 }, radar: [], basis: "verified" },
      searchVisibility: sv({
        score: 4,
        onPageReadiness: 98,
        keywordsRanked: 15, footprintComplete: true,
        estMonthlyVisits: 40,
        brandPct: 60,
        categoryPct: 10,
        offTopicPct: 30,
        categoryWins: 0,
        categoryDemand: 3000,
        categoryOpportunities: [{ keyword: "trust badge widget", volume: 2200 }],
      }),
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "trustmrr.com", 0, 0)} scanId="scan-trustmrr" />);

    assertNoGarbage(html, "trustmrr-shape");
    expect(html).toContain("trustmrr.com");
    expect(html).toContain(">20<"); // the unified gauge score still reads low
    expect(html).toContain(">98<"); // the on-page driver bar reads high
    expect(html).toContain("is in decent on-page shape. The plan below focuses on where you can still gain ground.");
    expect(html).not.toContain("has real on-page gaps");
    // On-page (98) dwarfs search (4) → search is unambiguously the weaker
    // driver (MINOR 4).
    expect(html).toContain("Search presence is your gap.");
  });

  it("LEGACY payload (predates a report_payload section) renders without crashing — the null-coalesce rule, machine-enforced", () => {
    // WHY THIS EXISTS (the process gap that shipped a live crash): report_payload is
    // ONE JSON blob and OLDER scans predate fields added later (WS1's footprintComplete,
    // WS2's categoryPhrases). Every other render test builds the CURRENT shape via sv(),
    // so a consumer that forgot `?? []` on a new field is invisible — true by
    // construction. A 2026-07-12 reflect.app scan re-rendered on the WS2 build crashed
    // `undefined.length` at the categoryPhrases chips. This renders a PRE-WS2 payload
    // (categoryDemand > 0 so that exact block renders) and asserts it does NOT throw.
    const legacySv = {
      score: 46, onPageReadiness: 80, keywordsRanked: 50, estMonthlyVisits: 400,
      brandPct: 30, categoryPct: 20, offTopicPct: 50,
      categoryGap: [], offTopicExamples: [], categoryWins: 0,
      categoryDemand: 8000, categoryOpportunities: [], categoryWonKeywords: [],
      // deliberately NO footprintComplete, NO categoryPhrases — they postdate this payload.
    } as unknown as SearchVisibility;
    const r = report({ searchVisibility: legacySv });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "reflect.app", 2, 8)} scanId="scan-legacy" />);
    expect(html).toContain("searches/mo across your category"); // the demand block rendered
    assertNoGarbage(html, "legacy payload");
  });

  it("locked band with zero worth: omits the 'worth an estimated +N' clause instead of rendering '+0'", () => {
    // Real scans have shipped cards carrying delta 0 (the positive-filter
    // fallback in toResultsProps exists because of them). With 4 zero-delta
    // actions: 3 render as fixes, 1 is locked → lockedCount 1, lockedWorth 0.
    // "worth an estimated +0" reads as broken; the clause must vanish while the
    // count + unlock CTA stay.
    const r = report({
      whatToDoThisWeek: {
        quickWins: [action("Fix titles", 0), action("Add schema", 0)],
        medium: [action("Write comparison page", 0), action("Pitch a directory", 0)],
        longPlay: [],
      },
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "zeroworth.dev", 4, 0)} scanId="scan-zeroworth" />);

    assertNoGarbage(html, "zero locked worth");
    expect(html).toContain("1 more ranked fixes"); // the locked band still renders
    expect(html).not.toContain("worth an estimated"); // …without the +0 clause
    expect(html).toContain("unlock the full plan");

    // And the clause still renders when the worth is real (guard the guard).
    const r2 = report({
      whatToDoThisWeek: {
        quickWins: [action("Fix titles", 6), action("Add schema", 5)],
        medium: [action("Write comparison page", 4), action("Pitch a directory", 3)],
        longPlay: [],
      },
    });
    const html2 = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r2, "worth.dev", 4, 0)} scanId="scan-worth" />);
    expect(html2).toContain("worth an estimated +3");
  });

  it("established brand, weak page: on-page IS the weaker driver → the summary names on-page, not search (MINOR 4 converse)", () => {
    // Mirrors the review's converse example: on-page 40, search 70 → unified
    // total = round(sqrt(40 * 70)) = round(sqrt(2800)) = 53. Search (70) beats
    // on-page (40) here, so the bolded driver-summary line must say "On-page
    // readiness is your gap." — asserting the unconditional "Search presence is
    // your gap." would be a direct contradiction of the bars shown above it.
    const r = report({
      score: { total: 53, breakdown: { content: 35, outreach: 45, seo: 40 }, radar: [], basis: "verified" },
      searchVisibility: sv({
        score: 70,
        onPageReadiness: 40,
        keywordsRanked: 300, footprintComplete: true,
        estMonthlyVisits: 9000,
        brandPct: 55,
        categoryPct: 35,
        offTopicPct: 10,
        categoryWins: 4,
        categoryDemand: 20000,
        categoryOpportunities: [{ keyword: "enterprise workflow tool", volume: 6000 }],
      }),
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "oldbrand.com", 0, 0)} scanId="scan-oldbrand" />);

    assertNoGarbage(html, "on-page-is-the-gap");
    expect(html).toContain("oldbrand.com");
    expect(html).toContain(">53<");
    expect(html).toContain("has real on-page gaps"); // onPageReadiness 40 < 60
    expect(html).toContain("On-page readiness is your gap.");
    expect(html).not.toContain("Search presence is your gap.");
  });

  // G5: "the weaker half" is CONDITIONAL. Search presence is the STRONGER half on
  // ~40% of prod scans; the claim must vanish then, or we tell those users to fix
  // their strongest driver.
  it("G5: omits 'the weaker half' when search presence is the STRONGER driver", () => {
    const r = report({
      score: { total: 70, breakdown: { content: 50, outreach: 40, seo: 55 }, radar: [], basis: "verified" },
      // search 92 > on-page 60 → search is the STRONGER half.
      searchVisibility: sv({ score: 92, onPageReadiness: 60, keywordsRanked: 300, footprintComplete: true, categoryDemand: 8000 }),
      whatToDoThisWeek: { quickWins: [action("Add meta descriptions", 6)], medium: [], longPlay: [] },
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "strong.com", 2, 8)} scanId="s" />);
    expect(html).toContain("lifts your <strong"); // the opportunity blurb still renders
    expect(html).not.toContain("the weaker half of your Discoverability Score");
  });

  it("G5: KEEPS 'the weaker half' when search presence IS the weaker driver", () => {
    const r = report({
      score: { total: 40, breakdown: { content: 70, outreach: 40, seo: 65 }, radar: [], basis: "verified" },
      searchVisibility: sv({ score: 20, onPageReadiness: 85, keywordsRanked: 40, footprintComplete: true, categoryDemand: 8000 }),
      whatToDoThisWeek: { quickWins: [action("Add meta descriptions", 6)], medium: [], longPlay: [] },
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "weak.com", 2, 8)} scanId="s" />);
    expect(html).toContain("the weaker half of your Discoverability Score");
  });

  // G4: the demand total is reconcilable — its named phrases render alongside it.
  it("G4: renders the category phrases behind the demand total", () => {
    const r = report({
      searchVisibility: sv({ keywordsRanked: 40, footprintComplete: true, categoryDemand: 8000 }),
      whatToDoThisWeek: { quickWins: [action("x", 5)], medium: [], longPlay: [] },
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "acme.com", 2, 8)} scanId="s" />);
    expect(html).toContain("searches/mo across your category");
    expect(html).toContain("photo hosting"); // a phrase from categoryPhrases renders
    expect(html).toContain("2,700"); // ...with its volume, so the total reconciles
  });
});
