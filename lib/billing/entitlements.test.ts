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
