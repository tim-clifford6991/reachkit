import { describe, it, expect } from "vitest";
import { buildLossFrame, lossHeadline } from "./competitive-framing";
import type { ReportPayload } from "@/lib/scan/report";

type Gap = ReportPayload["whereTheyAre"]["competitorGap"];

function gap(competitor: string, them: number, you: number): Gap[number] {
  return { competitor, dimension: "reviews", them, you };
}

describe("buildLossFrame", () => {
  it("returns null for empty / undefined input", () => {
    expect(buildLossFrame(undefined)).toBeNull();
    expect(buildLossFrame([])).toBeNull();
  });

  it("returns null when no competitor out-mentions the subject (cold start)", () => {
    expect(buildLossFrame([gap("Acme", 0, 0), gap("Bolt", 2, 5)])).toBeNull();
  });

  it("picks the widest-deficit rival as the leader", () => {
    const frame = buildLossFrame([
      gap("Acme", 9, 4), // deficit 5
      gap("Bolt", 20, 3), // deficit 17 ← widest
      gap("Cog", 6, 6), // not behind
    ]);
    expect(frame).not.toBeNull();
    expect(frame!.leaderName).toBe("Bolt");
    expect(frame!.leaderThem).toBe(20);
    expect(frame!.you).toBe(3);
    expect(frame!.deficit).toBe(17);
    // Only Acme + Bolt out-mention the subject.
    expect(frame!.behindCount).toBe(2);
    expect(frame!.totalCount).toBe(3);
  });

  it("counts a single trailing rival correctly", () => {
    const frame = buildLossFrame([gap("Acme", 9, 4), gap("Bolt", 1, 8)]);
    expect(frame!.behindCount).toBe(1);
    expect(frame!.leaderName).toBe("Acme");
  });
});

describe("lossHeadline", () => {
  it("names just the leader when only one rival is ahead", () => {
    const frame = buildLossFrame([gap("Acme", 9, 4), gap("Bolt", 1, 8)])!;
    expect(lossHeadline(frame)).toBe(
      "You're behind Acme where your buyers actually talk.",
    );
  });

  it("adds the other-rivals count when more than one is ahead", () => {
    const frame = buildLossFrame([gap("Acme", 9, 4), gap("Bolt", 20, 3)])!;
    expect(lossHeadline(frame)).toBe(
      "You're behind Bolt and 1 other rival where your buyers actually talk.",
    );
  });

  it("pluralizes the other-rivals count", () => {
    const frame = buildLossFrame([
      gap("Acme", 9, 4),
      gap("Bolt", 20, 3),
      gap("Cog", 7, 2),
    ])!;
    expect(lossHeadline(frame)).toBe(
      "You're behind Bolt and 2 other rivals where your buyers actually talk.",
    );
  });
});
