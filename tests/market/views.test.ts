// tests/market/views.test.ts — BUILD §6.6
//
// The market leaves read SERPs through narrow structural views rather than
// through the vendor client's own type, so that "this module buys nothing"
// stays provable by the absence of the import. That trick is only sound
// while the vendor's real value still satisfies the views — which is what
// this file asserts, from the test side, where importing the vendor type
// costs nothing.
import { describe, expect, it } from "vitest";
import type { SerpResult } from "../../src/lib/vendors/dataforseo/types.ts";
import type {
  MarketSerp,
  MarketSerpOrganic,
  QuestionView,
  SelectedSearchView,
} from "../../src/lib/market/views.ts";
import { checkCoherence } from "../../src/lib/market/coherence/check.ts";
import { deriveRivals } from "../../src/lib/market/rivals/derive.ts";
import { buildAiAnswersCard } from "../../src/lib/market/questions/matrix.ts";
import type { SelectedSearch } from "../../src/lib/market/questions/select.ts";
import type { Question } from "../../src/lib/market/questions/phrase.ts";
import { measured } from "../../src/lib/measure/measured.ts";

const VENDOR_SERP: SerpResult = {
  organic: [{ position: 1, domain: "rival.com", url: "https://rival.com/x", title: "Rival" }],
  aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: ["rival.com"] },
};

describe("A vendor SerpResult satisfies every view the market leaves read", () => {
  it("assigns to MarketSerp, MarketSerpOrganic and the two card readers, with no conversion", () => {
    const asMarketSerp: MarketSerp = VENDOR_SERP;
    const asOrganicOnly: MarketSerpOrganic = VENDOR_SERP;
    expect(asMarketSerp.aiOverview.referenceDomains).toEqual(["rival.com"]);
    expect(asOrganicOnly.organic).toHaveLength(1);

    // The real values reach the real functions untouched.
    expect(checkCoherence({ serps: [VENDOR_SERP], measuredCount: 0 })).toEqual({
      verdict: "unjudgeable",
      measuredCount: 0,
    });
    expect(deriveRivals({ serps: [VENDOR_SERP, VENDOR_SERP], ownDomain: "customer.com" }).rivals[0]).toMatchObject({
      domain: "rival.com",
      top10Appearances: 2,
      aiCitations: 2,
    });
  });

  it("the vendor's zero-result SERP is a MarketSerp too — it needs no special arm", () => {
    // The shape `serpOrganic` returns for a SERP with no organic rows and no
    // AI Overview. Declared here rather than imported: the vendor module
    // reaches the environment at load, and only its *type* is under test.
    const vendorEmpty: SerpResult = {
      organic: [],
      aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
    };
    const empty: MarketSerp = vendorEmpty;
    expect(empty.organic).toEqual([]);
    expect(empty.aiOverview.present).toBe(false);
  });
});

describe("The two shapes the questions leaf owns satisfy the views the cards read them through", () => {
  it("a real SelectedSearch is a SelectedSearchView, and a real Question is a QuestionView", () => {
    const selected: SelectedSearch = {
      keyword: "best onboarding software",
      volume: 1900,
      intent: "decision",
      score: 9.9,
      rank: 1,
    };
    const question: Question = {
      id: "q1",
      text: "What's the best onboarding software?",
      search: selected,
      phrasing: "template",
    };

    const asSearchView: SelectedSearchView = selected;
    const asQuestionView: QuestionView = question;
    expect(asSearchView.volume).toBe(1900);
    expect(asQuestionView.search.keyword).toBe("best onboarding software");

    // And the card reads a real question with no conversion at the call site.
    const built = buildAiAnswersCard({
      questions: [question],
      serps: [measured(VENDOR_SERP, new Date("2026-09-05T10:00:00.000Z"))],
      ownDomain: "customer.com",
      coverage: "async_included",
    });
    expect(built.rows[0]).toMatchObject({ questionId: "q1", keyword: "best onboarding software" });
    expect(Object.keys(built.rows[0] ?? {})).not.toContain("volume");
  });
});
