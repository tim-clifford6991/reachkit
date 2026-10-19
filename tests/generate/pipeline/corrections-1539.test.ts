// Issue 1539, condition 2: the next page whose topic owns a fact an AI
// answer misstated is handed that fact, from the site's own source, to state
// plainly — and a page on another topic is not.
import "../env";
import { describe, expect, it } from "vitest";
import { buildPack, type PackInputs } from "../../../src/lib/generate/pipeline/pack";
import type { PromptKnowledge } from "../../../src/lib/generate/voice/profile-block";
import { statementsOf } from "../../../src/lib/market/prompts/misstated";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, opportunity, report } from "../fixtures";

const PRICING = "https://example.com/pricing";

const knowledge: PromptKnowledge = {
  offerings: [{ name: "Team plan", features: ["Unlimited boards"], prices: ["€49 per month"], uses: [], from: PRICING }],
  differentiators: [],
  byline: null,
  audience: [],
  problems: [],
  proof: [{ text: "Used by 300 schools", from: "https://example.com/" }],
  questions: [],
  integrations: [],
  places: [],
};

/** The stored report, its one tracked-prompt answer saying what `text` says. */
function withAnswer(text: string): StoredReport {
  const states = statementsOf({ text, siteName: "Zentablo", ownDomain: "example.com", rivals: [], language: "en" });
  return {
    ...report(),
    prompts: {
      siteName: "Zentablo",
      asked: [{ id: "p1", kind: "branded", text: "What does Zentablo cost?" }],
      asks: 1,
      answers: [{ promptId: "p1", engine: "ai_mode", run: 1, named: true, linked: false, ownUrls: [], rivals: [], states }],
    },
  };
}

function inputs(targetQuery: string, stored: StoredReport): PackInputs {
  return {
    type: "qa",
    opportunity: opportunity({ targetQuery, title: targetQuery }),
    site: { businessName: "Example", domain: "example.com", doNotClaim: [], rivals: [] },
    category: "school timetabling software",
    byline: null,
    voice: null,
    profile: { job: null, products: [], audience: [], promises: [], vocabulary: [], knowledge },
    facts: [],
    research: { facts: [], products: [] },
    report: stored,
    sitePages: [],
    links: [],
    now: AT,
  };
}

describe("a page whose topic owns a misstated fact states it from the site's own page (issue 1539)", () => {
  it("a page on what it costs is handed the site's price beside what the answer said", () => {
    const pack = buildPack(inputs("how much does zentablo cost", withAnswer("Zentablo plans from €29 a month.")));
    expect(pack.corrections).toEqual([{ says: "€29", site: "€49 per month", url: PRICING }]);
  });

  it("a page on the thing a count counts is handed the site's count", () => {
    const pack = buildPack(inputs("timetabling for schools", withAnswer("Zentablo is used by 3,000 schools.")));
    expect(pack.corrections).toEqual([{ says: "3,000 schools", site: "Used by 300 schools", url: "https://example.com/" }]);
  });

  it("a page on another topic, or an answer that matches the site, is handed none", () => {
    expect(buildPack(inputs("how to plan a school trip", withAnswer("Zentablo plans from €29 a month."))).corrections).toBeUndefined();
    expect(buildPack(inputs("how much does zentablo cost", withAnswer("Zentablo costs €49 a month."))).corrections).toBeUndefined();
  });
});
