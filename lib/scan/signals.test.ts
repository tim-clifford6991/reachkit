import { describe, it, expect } from "vitest";
import {
  SIGNAL_REGISTRY,
  PILLAR_WEIGHTS,
  signalsForPlatform,
  scoreComponentToSignalKeys,
  type Pillar,
} from "./signals";

const PILLARS: Pillar[] = ["content", "outreach", "seo"];

describe("SIGNAL_REGISTRY", () => {
  it("defines exactly 18 signals with unique keys", () => {
    expect(SIGNAL_REGISTRY).toHaveLength(18);
    const keys = SIGNAL_REGISTRY.map((s) => s.key);
    expect(new Set(keys).size).toBe(18);
  });

  it("distributes 8 SEO / 5 Content / 5 Outreach", () => {
    expect(SIGNAL_REGISTRY.filter((s) => s.pillar === "seo")).toHaveLength(8);
    expect(SIGNAL_REGISTRY.filter((s) => s.pillar === "content")).toHaveLength(5);
    expect(SIGNAL_REGISTRY.filter((s) => s.pillar === "outreach")).toHaveLength(5);
  });

  it("gives every signal a non-empty why + howToFix + label", () => {
    for (const s of SIGNAL_REGISTRY) {
      expect(s.why.length).toBeGreaterThan(0);
      expect(s.howToFix.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});

describe("PILLAR_WEIGHTS", () => {
  it("sums to 1.0 (Content .30 / Outreach .25 / SEO .45)", () => {
    expect(PILLAR_WEIGHTS.content + PILLAR_WEIGHTS.outreach + PILLAR_WEIGHTS.seo).toBeCloseTo(1, 5);
    expect(PILLAR_WEIGHTS.seo).toBeCloseTo(0.45, 5);
  });
});

describe("within-pillar weights normalise per platform", () => {
  it("each pillar's web-applicable signal weights sum to 1.0", () => {
    const web = signalsForPlatform("web");
    for (const p of PILLARS) {
      const sum = web.filter((s) => s.pillar === p).reduce((a, s) => a + s.weight, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });
});

describe("signalsForPlatform", () => {
  it("returns only signals applicable to the platform", () => {
    const app = signalsForPlatform("ios");
    for (const s of app) expect(s.platforms).toContain("ios");
  });
});

describe("scoreComponentToSignalKeys", () => {
  it("maps an action's score component to that pillar's signal keys", () => {
    const seoKeys = scoreComponentToSignalKeys("seo");
    expect(seoKeys.length).toBeGreaterThan(0);
    for (const k of seoKeys) {
      expect(SIGNAL_REGISTRY.find((s) => s.key === k)?.pillar).toBe("seo");
    }
    expect(scoreComponentToSignalKeys("seo_aso")).toEqual(seoKeys);
    for (const k of scoreComponentToSignalKeys("content")) {
      expect(SIGNAL_REGISTRY.find((s) => s.key === k)?.pillar).toBe("content");
    }
  });

  it("returns [] for an unknown component", () => {
    expect(scoreComponentToSignalKeys("nonsense")).toEqual([]);
  });
});
