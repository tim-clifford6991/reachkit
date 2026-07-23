import { describe, it, expect } from "vitest";
import { redactReportForTier, isSubscriptionActive } from "./entitlements";

// Payment-failed grace + no-trial semantics (launch P2). Grace defaults to 3
// days (env.billingGraceDays) in the test env.
describe("isSubscriptionActive", () => {
  const periodEnd = "2026-07-01T00:00:00Z";
  const end = Date.parse(periodEnd);
  const DAY = 24 * 60 * 60 * 1000;
  const GRACE = 3;

  it("active → true", () => {
    expect(isSubscriptionActive("active", null, GRACE, end + 999 * DAY)).toBe(true);
  });
  it("trialing → false (no trial exists; never grants access)", () => {
    expect(isSubscriptionActive("trialing", periodEnd, GRACE, end - DAY)).toBe(false);
  });
  it("past_due within the grace window → true", () => {
    expect(isSubscriptionActive("past_due", periodEnd, GRACE, end + 2 * DAY)).toBe(true); // 2 < 3 days
  });
  it("past_due past the grace window → false", () => {
    expect(isSubscriptionActive("past_due", periodEnd, GRACE, end + 4 * DAY)).toBe(false); // 4 > 3 days
  });
  it("past_due with no period end → false", () => {
    expect(isSubscriptionActive("past_due", null, GRACE, end)).toBe(false);
  });
  it("canceled / unpaid / null → false", () => {
    for (const s of ["canceled", "unpaid", null]) {
      expect(isSubscriptionActive(s, periodEnd, GRACE, end)).toBe(false);
    }
  });
});
import type { ReportPayload } from "@/lib/scan/report";
import type { ActionCard } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// Fixtures — small but type-complete literals.
// ---------------------------------------------------------------------------

function makeAction(title: string, effortMin: number): ActionCard {
  return {
    category: "content",
    title,
    why: `why ${title}`,
    evidenceIds: [],
    evidence: [],
    effortMin,
    suggestedDeadline: "2026-07-01",
    expectedOutcome: { scoreComponent: "content", delta: 5 },
    draft: `draft for ${title}`,
    draftRequiresEdit: true,
    verification: { method: "url", state: "pending" },
    basis: "evidence_based",
    confidence: 0.8,
    target: null,
  };
}

function makeReport(): ReportPayload {
  return {
    mode: "ios",
    generatedAt: "2026-06-11T00:00:00.000Z",
    whatYouOffer: {
      positioningMirror: {
        listingSays: "fast notes",
        reviewsValue: "people love the sync",
        gap: "listing undersells sync",
      },
    },
    whoItsFor: {
      summary: "Buyers who value speed.",
      signals: ["speed", "sync", "offline"],
    },
    whereTheyAre: {
      surfaces: [{ source: "app_store", title: "Listing", url: "https://x" }],
      competitorGap: [
        { competitor: "Acme", dimension: "reviews", them: 9, you: 4, positioning: "all-in-one productivity suite", gap: "ranks for 40 category keywords you don't" },
      ],
    },
    whatToDoThisWeek: {
      quickWins: [makeAction("qw1", 10), makeAction("qw2", 20)],
      medium: [makeAction("md1", 60), makeAction("md2", 90)],
      longPlay: [makeAction("lp1", 180), makeAction("lp2", 240)],
    },
    score: {
      total: 42,
      basis: "verified",
      radar: [{ axis: "content", value: 30, active: true }],
    } as unknown as ReportPayload["score"],
  };
}

function totalActions(r: ReportPayload): number {
  const w = r.whatToDoThisWeek;
  return w.quickWins.length + w.medium.length + w.longPlay.length;
}

function allActions(r: ReportPayload): ActionCard[] {
  const w = r.whatToDoThisWeek;
  return [...w.quickWins, ...w.medium, ...w.longPlay];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("redactReportForTier", () => {
  it("paid tier (solo) returns the payload untouched — same reference, drafts, counts", () => {
    const report = makeReport();
    const out = redactReportForTier(report, "solo");

    expect(out).toBe(report); // same reference
    expect(totalActions(out)).toBe(6);
    // drafts preserved
    for (const a of allActions(out)) {
      expect(a.draft).not.toBeNull();
    }
  });

  it("paid tier (growth) also returns the payload untouched", () => {
    const report = makeReport();
    const out = redactReportForTier(report, "growth");
    expect(out).toBe(report);
    expect(totalActions(out)).toBe(6);
  });

  it("free tier caps to exactly 3 actions total with every draft null", () => {
    const report = makeReport();
    const out = redactReportForTier(report, "free");

    expect(totalActions(out)).toBe(3);
    for (const a of allActions(out)) {
      expect(a.draft).toBeNull();
    }
  });

  it("free tier fills the preview in bucket order (quickWins → medium → longPlay)", () => {
    const report = makeReport();
    const out = redactReportForTier(report, "free");

    // 2 quickWins exist → both taken, then 1 from medium, none from longPlay.
    expect(out.whatToDoThisWeek.quickWins.map((a) => a.title)).toEqual([
      "qw1",
      "qw2",
    ]);
    expect(out.whatToDoThisWeek.medium.map((a) => a.title)).toEqual(["md1"]);
    expect(out.whatToDoThisWeek.longPlay).toEqual([]);
  });

  it("free tier leaves whatYouOffer / whoItsFor / whereTheyAre / score intact", () => {
    const report = makeReport();
    const out = redactReportForTier(report, "free");

    expect(out.whatYouOffer).toEqual(report.whatYouOffer);
    expect(out.whoItsFor).toEqual(report.whoItsFor);
    expect(out.whereTheyAre).toEqual(report.whereTheyAre);
    // the new competitor positioning/gap strings survive free redaction
    expect(out.whereTheyAre.competitorGap[0]?.positioning).toBe("all-in-one productivity suite");
    expect(out.whereTheyAre.competitorGap[0]?.gap).toBe("ranks for 40 category keywords you don't");
    expect(out.score).toEqual(report.score);
    expect(out.mode).toBe(report.mode);
    expect(out.generatedAt).toBe(report.generatedAt);
  });

  it("does not mutate the input payload", () => {
    const report = makeReport();
    const before = structuredClone(report);

    redactReportForTier(report, "free");

    // Original drafts and counts are untouched.
    expect(report).toEqual(before);
    expect(totalActions(report)).toBe(6);
    for (const a of allActions(report)) {
      expect(a.draft).not.toBeNull();
    }
  });

  it("free preview is opportunity-aware — leads with 2 keyword growth moves (by volume) + 1 other fix, across buckets (2026-07-22)", () => {
    const opp = (title: string, volume: number): ActionCard => ({
      ...makeAction(title, 120),
      category: "seo_aso",
      opportunity: { keyword: title, volume },
    });
    const report = makeReport();
    // Signal fixes land in quickWins (they'd win the old first-3-by-bucket rule);
    // the data-driven keyword opportunities are in medium. Selection must still
    // lead with the 2 highest-volume opportunities, not the hygiene fixes.
    report.whatToDoThisWeek = {
      quickWins: [makeAction("add title", 20), makeAction("add schema", 20)],
      medium: [opp("space launch system", 110000), opp("rocket launch", 74000), opp("space launch", 22000)],
      longPlay: [],
    };
    const out = redactReportForTier(report, "free");
    expect(totalActions(out)).toBe(3);
    const kept = allActions(out);
    const oppKept = kept.filter((a) => a.opportunity);
    // Exactly 2 opportunities (the two highest-volume), plus 1 other fix.
    expect(oppKept.map((a) => a.opportunity!.volume).sort((a, b) => b - a)).toEqual([110000, 74000]);
    expect(kept.filter((a) => !a.opportunity)).toHaveLength(1);
  });

  it("free tier caps even when one bucket already has fewer than 3", () => {
    const report = makeReport();
    report.whatToDoThisWeek = {
      quickWins: [makeAction("only", 10)],
      medium: [],
      longPlay: [makeAction("lpA", 200), makeAction("lpB", 210)],
    };

    const out = redactReportForTier(report, "free");
    expect(totalActions(out)).toBe(3);
    expect(out.whatToDoThisWeek.quickWins.map((a) => a.title)).toEqual(["only"]);
    expect(out.whatToDoThisWeek.medium).toEqual([]);
    expect(out.whatToDoThisWeek.longPlay.map((a) => a.title)).toEqual([
      "lpA",
      "lpB",
    ]);
    for (const a of allActions(out)) {
      expect(a.draft).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Deep sections — teaser gating
//
// competitiveLandscape/creatorsToReach/strengthsAndWeaknesses were retired M3b
// (2026-07-23, O-7/O-8, write-only: zero render consumers) — channelOpportunities
// is the one deep section that survives the cut.
// ---------------------------------------------------------------------------

function withDeepSections(report: ReportPayload): ReportPayload {
  return {
    ...report,
    channelOpportunities: {
      keywordClusters: [
        { theme: "notes", keywords: [{ keyword: "fast notes", volume: 1000, cpc: 1.5, competition: 0.4 }] },
        { theme: "sync", keywords: [{ keyword: "note sync", volume: 800, cpc: 2.0, competition: 0.5 }] },
      ],
      communitiesByEngagement: [
        { source: "hn", title: "a", url: "https://h/1", engagement: 300 },
        { source: "hn", title: "b", url: "https://h/2", engagement: 200 },
        { source: "hn", title: "c", url: "https://h/3", engagement: 50 },
      ],
    },
  };
}

describe("redactReportForTier — deep sections", () => {
  it("paid keeps all deep sections in full (same reference)", () => {
    const report = withDeepSections(makeReport());
    const out = redactReportForTier(report, "solo");
    expect(out).toBe(report);
    expect(out.channelOpportunities?.keywordClusters[0]?.keywords[0]?.cpc).toBe(1.5);
  });

  it("free truncates channels: 1 cluster, cpc/competition zeroed, 2 communities", () => {
    const report = withDeepSections(makeReport());
    const out = redactReportForTier(report, "free");
    const ch = out.channelOpportunities!;
    expect(ch.keywordClusters).toHaveLength(1);
    expect(ch.keywordClusters[0]?.keywords[0]?.cpc).toBe(0);
    expect(ch.keywordClusters[0]?.keywords[0]?.competition).toBe(0);
    // volume (the teaser hook) survives
    expect(ch.keywordClusters[0]?.keywords[0]?.volume).toBe(1000);
    expect(ch.communitiesByEngagement).toHaveLength(2);
  });

  it("does not mutate the input deep sections", () => {
    const report = withDeepSections(makeReport());
    const before = structuredClone(report);
    redactReportForTier(report, "free");
    expect(report).toEqual(before);
  });

  it("keeps the full M4 market analysis for paid", () => {
    const market = { cohort: {}, demand: {}, gap: {}, plan: {} } as unknown as ReportPayload["market"];
    const report = { ...makeReport(), market };
    expect(redactReportForTier(report, "growth").market).toBe(market);
  });

  it("teases the M4 market analysis for free: top-3 competitors, no plan, no thread excerpts", () => {
    const prof = (domain: string) => ({
      domain,
      channels: [],
      communities: [],
      seo: { organicKeywords: 100, etv: 5, authority: 50, referringDomains: 200 },
      crawledAt: "2026-06-01T00:00:00Z",
    });
    const pocket = (surface: string) => ({
      surface,
      subreddit: surface,
      count: 3,
      intentSum: 2,
      score: 4,
      topThreads: [{ title: "t", url: "u", intent: 1, publishedAt: null }],
    });
    const market = {
      cohort: {
        self: prof("me.com"),
        competitors: [prof("a.com"), prof("b.com"), prof("c.com"), prof("d.com")],
        competitorDomains: ["a.com", "b.com", "c.com", "d.com"],
        product: { name: "Me" },
      },
      demand: { painQueries: [], pockets: [pocket("r/1"), pocket("r/2"), pocket("r/3"), pocket("r/4"), pocket("r/5"), pocket("r/6")], totalHits: 0, buyerPainHits: 0 },
      gap: { channelMatrix: [], channelGaps: [{ kind: "blog" }], communityGaps: [], seo: null, shareOfVoice: { selfPct: 0.2, rivals: [], selfMentions: 1, totalMentions: 5 }, demandPockets: [pocket("r/1")] },
      plan: { items: [{ kind: "channel", title: "x", why: "y", priority: 1 }] },
    } as unknown as ReportPayload["market"];

    const out = redactReportForTier({ ...makeReport(), market }, "free").market!;
    // Top-3 competitors only, backlink detail stripped, traffic kept.
    expect(out.cohort.competitors).toHaveLength(3);
    expect(out.cohort.competitors[0]!.seo!.referringDomains).toBeNull();
    expect(out.cohort.competitors[0]!.seo!.organicKeywords).toBe(100);
    // Pockets capped + thread excerpts stripped.
    expect(out.demand.pockets).toHaveLength(5);
    expect(out.demand.pockets[0]!.topThreads).toEqual([]);
    // The ranked plan + channel gaps (the paid payoff) are gated; SOV proof stays.
    expect(out.plan.items).toEqual([]);
    expect(out.gap.channelGaps).toEqual([]);
    expect(out.gap.shareOfVoice).not.toBeNull();
  });

  it("strips the paid SEO deep signals (rankedKeywords, topPages, keywordGap) for free", () => {
    const seo = {
      organicKeywords: 100,
      etv: 5,
      authority: 50,
      referringDomains: 200,
      rankedKeywords: [{ keyword: "k", position: 3, volume: 500, etv: 40 }],
      topPages: [{ url: "https://me.com/blog", keywordCount: 80, etv: 600 }],
    };
    const self = { domain: "me.com", channels: [], communities: [], seo, crawledAt: "" };
    const market = {
      cohort: { self, competitors: [self], competitorDomains: ["me.com"], product: { name: "Me" } },
      demand: { painQueries: [], pockets: [], totalHits: 0, buyerPainHits: 0 },
      gap: {
        channelMatrix: [], channelGaps: [], communityGaps: [], seo: null, shareOfVoice: null,
        keywordGap: [{ keyword: "k", volume: 500, rivalsRanking: 1, bestRivalPosition: 3 }],
        demandPockets: [],
      },
      plan: { items: [] },
    } as unknown as ReportPayload["market"];

    const out = redactReportForTier({ ...makeReport(), market }, "free").market!;
    // SEO deep signals (rankedKeywords + topPages) dropped on self + competitors.
    expect(out.cohort.self.seo!.topPages).toBeUndefined();
    expect(out.cohort.self.seo!.rankedKeywords).toBeUndefined();
    expect(out.cohort.competitors[0]!.seo!.topPages).toBeUndefined();
    // keyword gap (the paid payoff) is emptied.
    expect(out.gap.keywordGap).toEqual([]);
  });
});
