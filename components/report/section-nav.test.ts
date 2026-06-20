import { describe, it, expect } from "vitest";
import { buildSectionNavItems } from "./section-nav";
import type { ReportPayload } from "@/lib/scan/report";

const reportWith = (market: unknown): ReportPayload =>
  ({ market, whereTheyAre: { competitorGap: [] } } as unknown as ReportPayload);

describe("buildSectionNavItems", () => {
  it("returns just the summary anchor when there's no market analysis", () => {
    expect(buildSectionNavItems(reportWith(undefined), { unlocked: true })).toEqual([
      { id: "summary", label: "Summary" },
    ]);
  });

  it("lists present sections and gates paid-only anchors for free", () => {
    const market = {
      cohort: { self: { seo: { organicKeywords: 100, topPages: [{ url: "u", keywordCount: 1, etv: 1 }] } }, competitors: [{ seo: { organicKeywords: 200 } }] },
      gap: {
        channelMatrix: [{ kind: "blog", self: { present: true, active: true }, competitorsActive: 1, total: 2 }],
        shareOfVoice: { selfPct: 0.3 },
        keywordGap: [{ keyword: "k", volume: 1, rivalsRanking: 1, bestRivalPosition: 1 }],
        demandPockets: [{ surface: "r/x" }],
      },
      recentBuzz: [{ title: "t", url: "u", publishedDate: null }],
      plan: { items: [{ kind: "channel", title: "x" }] },
    } as unknown as ReportPayload["market"];

    const paid = buildSectionNavItems(reportWith(market), { unlocked: true }).map((i) => i.id);
    expect(paid).toEqual(["summary", "competitors", "benchmark", "channels", "keyword-gap", "top-pages", "demand", "buzz", "playbook"]);

    const free = buildSectionNavItems(reportWith(market), { unlocked: false }).map((i) => i.id);
    // keyword-gap, top-pages, buzz are paid-only → absent for free.
    expect(free).toEqual(["summary", "competitors", "benchmark", "channels", "demand", "playbook"]);
  });
});
