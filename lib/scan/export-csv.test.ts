import { describe, it, expect } from "vitest";
import { reportToCsv } from "./export-csv";
import type { ReportPayload } from "@/lib/scan/report";

const base = { mode: "web", generatedAt: "2026-06-19T00:00:00Z" } as unknown as ReportPayload;

describe("reportToCsv", () => {
  it("emits the four labelled sections with headers", () => {
    const csv = reportToCsv(base);
    expect(csv).toContain("# Competitors");
    expect(csv).toContain("# Keyword gap (rivals rank, you don't)");
    expect(csv).toContain("# Demand pockets");
    expect(csv).toContain("# Distribution playbook (ranked)");
  });

  it("serializes market rows and escapes commas/quotes", () => {
    const market = {
      cohort: {
        self: { domain: "me.com", channels: [], communities: [], seo: { organicKeywords: 100, etv: 5, authority: 40, referringDomains: 12 }, crawledAt: "" },
        competitors: [{ domain: "a.com", channels: [], communities: [], seo: { organicKeywords: 999, etv: 50, authority: 70, referringDomains: 200 }, crawledAt: "" }],
        competitorDomains: ["a.com"],
        product: { name: "Me" },
      },
      demand: { painQueries: [], pockets: [], totalHits: 0, buyerPainHits: 0 },
      gap: {
        channelMatrix: [], channelGaps: [], communityGaps: [], seo: null, shareOfVoice: null,
        keywordGap: [{ keyword: 'best, app "x"', volume: 500, rivalsRanking: 2, bestRivalPosition: 3 }],
        demandPockets: [{ surface: "r/SaaS", subreddit: "r/SaaS", count: 4, intentSum: 2, score: 6, topThreads: [] }],
      },
      plan: { items: [{ kind: "channel", title: "Start a blog", why: "rivals do", priority: 20, ease: 0.5, impact: 0.8, competition: 0.3, score: 0.28 }] },
    } as unknown as ReportPayload["market"];

    const csv = reportToCsv({ ...base, market });
    expect(csv).toContain("me.com,100,5,12,40");
    expect(csv).toContain("a.com,999,50,200,70");
    // comma + quote escaping in the keyword
    expect(csv).toContain('"best, app ""x""",500,2,3');
    expect(csv).toContain("r/SaaS,4,6");
    // playbook row: rank, kind, title, impact, ease, competition, score, why
    expect(csv).toContain("1,channel,Start a blog,80,50,30,28,rivals do");
  });
});
