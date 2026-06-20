/**
 * buildExecutiveSummary — the report "page 1" scorecard (ChannelIntel UX).
 */

import { describe, it, expect } from "vitest";
import { assembleReport, buildExecutiveSummary } from "./report";
import type { ReportPayload } from "./report";
import type { VerifiedScore } from "@/lib/scan/score-full";

const SCORE: VerifiedScore = {
  total: 64,
  breakdown: { content: 50, outreach: 40, seo: 70 },
  radar: [],
  basis: "verified",
} as unknown as VerifiedScore;

function baseReport(): ReportPayload {
  return assembleReport({
    mode: "web",
    generatedAt: "2026-06-19T00:00:00Z",
    positioningMirror: { listingSays: "a", reviewsValue: "b", gap: "c" },
    findings: [],
    icpSignals: [],
    surfaces: [],
    competitorGap: [
      { competitor: "rival-a.com", dimension: "mentions", them: 9, you: 2 },
      { competitor: "rival-b.com", dimension: "mentions", them: 1, you: 5 },
    ],
    actions: [
      { category: "content", title: "Write a launch post", why: "", effortMin: 20, draft: null } as never,
      { category: "outreach", title: "DM 5 creators", why: "", effortMin: 25, draft: null } as never,
      { category: "seo", title: "Fix titles", why: "", effortMin: 200, draft: null } as never,
    ],
    score: SCORE,
  });
}

describe("buildExecutiveSummary", () => {
  it("derives score + verdict + quick wins, falling back to competitor gap when no market", () => {
    const ex = buildExecutiveSummary(baseReport());
    expect(ex.score.total).toBe(64);
    expect(ex.score.verdict).toMatch(/snapshot/i);
    expect(ex.score.breakdown).toEqual({ content: 50, outreach: 40, seo: 70 });
    // No market → competitor gap fallback (top-3) with null traffic numbers.
    expect(ex.topCompetitors.map((c) => c.domain)).toEqual(["rival-a.com", "rival-b.com"]);
    expect(ex.topCompetitors[0]!.organicKeywords).toBeNull();
    expect(ex.traffic).toBeNull();
    // Quick wins = the two effortMin<30 actions (capped at 2).
    expect(ex.quickWins).toEqual(["Write a launch post", "DM 5 creators"]);
    // Biggest gap falls back to the rival we're losing to (them>you).
    expect(ex.biggestGap).toBe("Close the gap with rival-a.com");
  });

  it("prefers the market cohort + ranked plan when market analysis is present", () => {
    const prof = (domain: string, kw: number) => ({
      domain,
      channels: [],
      communities: [],
      seo: { organicKeywords: kw, etv: kw / 10, authority: null, referringDomains: null },
      crawledAt: "",
    });
    const market = {
      cohort: {
        self: prof("me.com", 100),
        competitors: [prof("a.com", 400), prof("b.com", 800), prof("c.com", 1200), prof("d.com", 50)],
        competitorDomains: ["a.com", "b.com", "c.com", "d.com"],
        product: { name: "Me" },
      },
      demand: { painQueries: [], pockets: [], totalHits: 0, buyerPainHits: 0 },
      gap: { channelMatrix: [], channelGaps: [], communityGaps: [], seo: null, shareOfVoice: null, keywordGap: [], demandPockets: [] },
      plan: { items: [{ kind: "channel", title: "Start a YouTube channel", why: "", priority: 30, ease: 0.3, impact: 0.9, competition: 0.5, score: 0.3 }] },
    } as unknown as ReportPayload["market"];

    const ex = buildExecutiveSummary({ ...baseReport(), market });
    // Top-3 competitors come from the cohort, with real keyword counts.
    expect(ex.topCompetitors.map((c) => c.domain)).toEqual(["a.com", "b.com", "c.com"]);
    expect(ex.topCompetitors[0]!.organicKeywords).toBe(400);
    // Traffic: you vs rival median (median of 400,800,1200,50 = 600).
    expect(ex.traffic).toEqual({ youKeywords: 100, rivalMedianKeywords: 600 });
    // Biggest move comes from the ranked plan's #1.
    expect(ex.biggestGap).toBe("Start a YouTube channel");
  });
});
