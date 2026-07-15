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

type CompGap = ReportPayload["whereTheyAre"]["competitorGap"][number];

function sv(over: Partial<SearchVisibility> = {}): SearchVisibility {
  return {
    score: 20,
    onPageReadiness: 80,
    keywordsRanked: 12,
    estMonthlyVisits: 400,
    brandPct: 30,
    categoryPct: 20,
    offTopicPct: 50,
    categoryGap: [],
    offTopicExamples: [],
    categoryWins: 1,
    categoryDemand: 8000,
    categoryCaptureRate: 8,
    categoryOpportunities: [
      { keyword: "photo gallery website", volume: 4400 },
      { keyword: "portfolio builder", volume: 900 },
    ],
    categoryCapturedSearches: 100,
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
      searchVisibility: sv({ keywordsRanked: 40, categoryDemand: 12000, categoryCaptureRate: 9 }),
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
    expect(html).toContain("capture just 9%"); // honest, coherent hero (not "you're winning")
    expect(html).toContain("Ahrefs"); // discovered competitor names render
  });

  it("0-ranking new product: invisible in search → zero-state hero, no broken artifacts", () => {
    const r = report({
      score: { total: 18, breakdown: { content: 20, outreach: 10, seo: 15 }, radar: [], basis: "verified" },
      searchVisibility: sv({
        score: 1,
        keywordsRanked: 0,
        estMonthlyVisits: 0,
        brandPct: 0,
        categoryPct: 0,
        offTopicPct: 0,
        categoryWins: 0,
        categoryDemand: 5400,
        categoryCaptureRate: 0,
        categoryOpportunities: [{ keyword: "habit tracker app", volume: 3200 }],
        categoryCapturedSearches: 0,
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
  });

  it("directory: tidy page but visibility is other brands' names → honest 'brand names' hero, not a false 88 win", () => {
    const r = report({
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
      searchVisibility: sv({ score: 12, keywordsRanked: 250, offTopicPct: 72, categoryDemand: 0, categoryCaptureRate: 3 }),
      whereTheyAre: { surfaces: [], competitorGap: [comp("G2")] },
    });
    const html = renderToStaticMarkup(<ResultsScreen {...toResultsProps(r, "somedir.com", 3, 8)} />);

    assertNoGarbage(html, "directory");
    expect(html).toContain("somedir.com");
    expect(html).toContain(">88<");
    // The tidy 88 must read as the honest gap, not a "you're winning" headline —
    // the high band label and the honest search-gap hero coexist coherently.
    expect(html).toContain("72% of your search visibility");
    expect(html).toContain("other companies"); // the honest "not your traffic" framing
  });
});
