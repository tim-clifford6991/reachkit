import { describe, it, expect } from "vitest";
import { redactReportForTier } from "./entitlements";
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
// ---------------------------------------------------------------------------

function withDeepSections(report: ReportPayload): ReportPayload {
  return {
    ...report,
    competitiveLandscape: [
      { competitor: "Acme", positioning: "all-in-one", gap: "no offline", communityMentions: 9, creators: [{ name: "Chan", url: "https://yt/1" }] },
      { competitor: "Bolt", positioning: "fast", gap: "no team plan", communityMentions: 3, creators: [] },
    ],
    channelOpportunities: {
      keywordClusters: [
        { theme: "notes", keywords: [{ keyword: "fast notes", volume: 1000, cpc: 1.5, competition: 0.4 }] },
        { theme: "sync", keywords: [{ keyword: "note sync", volume: 800, cpc: 2.0, competition: 0.5 }] },
      ],
      communitiesByEngagement: [
        { source: "hn", title: "a", url: "https://h/1", engagement: 300 },
        { source: "hn", title: "b", url: "https://h/2", engagement: 200 },
        { source: "bluesky", title: "c", url: "https://b/3", engagement: 50 },
      ],
    },
    creatorsToReach: [
      { name: "C1", url: "https://yt/1", coveredCompetitor: "Acme", audienceProxy: 0 },
      { name: "C2", url: "https://yt/2", coveredCompetitor: "Bolt", audienceProxy: 0 },
      { name: "C3", url: "https://yt/3", coveredCompetitor: "Acme", audienceProxy: 0 },
    ],
    strengthsAndWeaknesses: {
      strengths: [{ theme: "speed", quote: "so fast" }, { theme: "ui", quote: "clean" }],
      weaknesses: [{ theme: "crashes", quote: "crashes daily" }],
      mixed: [{ theme: "price", quote: "bit pricey" }],
      diagnostics: [{ category: "content", claim: "listing buries sync", confidence: 0.8 }],
    },
  };
}

describe("redactReportForTier — deep sections", () => {
  it("paid keeps all deep sections in full (same reference)", () => {
    const report = withDeepSections(makeReport());
    const out = redactReportForTier(report, "solo");
    expect(out).toBe(report);
    expect(out.creatorsToReach).toHaveLength(3);
    expect(out.channelOpportunities?.keywordClusters[0]?.keywords[0]?.cpc).toBe(1.5);
  });

  it("free teases the landscape: keeps name/positioning/mentions, gates gap + creators", () => {
    const report = withDeepSections(makeReport());
    const out = redactReportForTier(report, "free");
    const land = out.competitiveLandscape!;
    // All rows survive (the proof), in order.
    expect(land).toHaveLength(2);
    expect(land.map((r) => r.competitor)).toEqual(["Acme", "Bolt"]);
    // Provocation kept: positioning + mention count.
    expect(land[0]?.positioning).toBe("all-in-one");
    expect(land[0]?.communityMentions).toBe(9);
    // Answer gated: opening text nulled, creators emptied, count preserved.
    expect(land[0]?.gap).toBeNull();
    expect(land[0]?.creators).toEqual([]);
    expect(land[0]?.lockedCreatorCount).toBe(1);
    // A competitor with no creators reports a 0 locked count.
    expect(land[1]?.lockedCreatorCount).toBe(0);
  });

  it("paid keeps the landscape untouched (gap text + creators intact)", () => {
    const report = withDeepSections(makeReport());
    const out = redactReportForTier(report, "solo");
    expect(out.competitiveLandscape).toEqual(report.competitiveLandscape);
    expect(out.competitiveLandscape?.[0]?.gap).toBe("no offline");
    expect(out.competitiveLandscape?.[0]?.creators).toHaveLength(1);
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

  it("free truncates creators to 2 and strips strengths/weaknesses quotes + diagnostics", () => {
    const report = withDeepSections(makeReport());
    const out = redactReportForTier(report, "free");
    expect(out.creatorsToReach).toHaveLength(2);
    const sw = out.strengthsAndWeaknesses!;
    expect(sw.strengths).toHaveLength(1);
    expect(sw.strengths[0]?.quote).toBe("");
    expect(sw.weaknesses).toHaveLength(1);
    expect(sw.weaknesses[0]?.quote).toBe("");
    expect(sw.mixed).toEqual([]);
    expect(sw.diagnostics).toEqual([]);
  });

  it("does not mutate the input deep sections", () => {
    const report = withDeepSections(makeReport());
    const before = structuredClone(report);
    redactReportForTier(report, "free");
    expect(report).toEqual(before);
  });
});
