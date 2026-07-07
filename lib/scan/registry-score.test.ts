import { describe, it, expect } from "vitest";
import {
  registryScore,
  applyRegistryScore,
  headlineFromRows,
  headlineScore,
  FIXED_BASIS_SIGNAL_KEYS,
  type RegistryScoreRow,
} from "./registry-score";
import type { VerifiedScore } from "./score-full";
import type { ScanSignalRow } from "./compute-signals";

const row = (pillar: RegistryScoreRow["pillar"], weight: number, normalised: number | null, state = normalised == null ? "unmeasured" : "pass"): RegistryScoreRow => ({ pillar, weight, normalised, state });

describe("registryScore", () => {
  it("returns 100 when every measured signal is perfect", () => {
    const rows = [row("seo", 0.5, 100), row("seo", 0.5, 100), row("content", 1, 100), row("outreach", 1, 100)];
    expect(registryScore(rows).total).toBe(100);
  });

  it("scores a pillar over its measured signals (weighted)", () => {
    const rows = [row("seo", 0.5, 100), row("seo", 0.5, 0)];
    expect(registryScore(rows).breakdown.seo).toBe(50);
  });

  it("excludes a pillar with no measured signals from the total (anti-vanity)", () => {
    // Only SEO measured → total equals the SEO pillar, not dragged down by content/outreach.
    const rows = [
      row("seo", 1, 80),
      row("content", 1, null),
      row("outreach", 1, null),
    ];
    const s = registryScore(rows);
    expect(s.assessed).toEqual(["seo"]);
    expect(s.total).toBe(80);
  });

  it("weights assessed pillars by PILLAR_WEIGHTS, renormalised", () => {
    // SEO=100 (w .45), Content=0 (w .30) assessed; Outreach unmeasured.
    // total = (.45*100 + .30*0) / (.45+.30) = 45/0.75 = 60
    const rows = [row("seo", 1, 100), row("content", 1, 0), row("outreach", 1, null)];
    expect(registryScore(rows).total).toBe(60);
  });

  it("returns 0 when nothing is measured", () => {
    const rows = [row("seo", 1, null), row("content", 1, null)];
    expect(registryScore(rows).total).toBe(0);
    expect(registryScore(rows).assessed).toEqual([]);
  });
});

const v1Score = {
  total: 18,
  breakdown: { content: 0, outreach: 0, seo: 40 },
  basis: "verified",
  radar: [
    { axis: "Content", value: 0, active: true, assessed: false },
    { axis: "Outreach", value: 0, active: true, assessed: false },
    { axis: "SEO/ASO", value: 40, active: true, assessed: true },
    { axis: "Ads", value: 0, active: false, assessed: false },
  ],
} as unknown as VerifiedScore;

describe("applyRegistryScore", () => {
  it("overrides total + breakdown + active radar axes from v2", () => {
    const v2 = registryScore([
      row("seo", 1, 80),
      row("content", 1, 60),
      row("outreach", 1, 40),
    ]);
    const patched = applyRegistryScore(v1Score, v2);
    expect(patched.total).toBe(v2.total);
    expect(patched.breakdown).toEqual(v2.breakdown);
    const seoAxis = patched.radar.find((a) => a.axis === "SEO/ASO");
    expect(seoAxis?.value).toBe(v2.breakdown.seo);
    expect(seoAxis?.assessed).toBe(true);
    // locked axis untouched
    expect(patched.radar.find((a) => a.axis === "Ads")?.value).toBe(0);
  });
});

describe("headlineFromRows", () => {
  const v1 = { total: 18, breakdown: { content: 0, outreach: 0, seo: 40 } };
  const measured = [row("seo", 1, 80), row("content", 1, 60)];

  it("uses the v2 registry score (version 2) for web with measured signals", () => {
    const h = headlineFromRows("web", v1, measured);
    expect(h.version).toBe(2);
    expect(h.total).toBe(registryScore(measured).total);
  });

  it("keeps v1 (version 1) for app platforms", () => {
    expect(headlineFromRows("ios", v1, measured)).toEqual({ ...v1, version: 1 });
  });

  it("keeps v1 for web when nothing measured", () => {
    const h = headlineFromRows("web", v1, [row("seo", 1, null)]);
    expect(h).toEqual({ ...v1, version: 1 });
  });
});

// Minimal ScanSignalRow factory (only fields headlineScore reads matter).
function sig(signalKey: string, pillar: "content" | "outreach" | "seo", weight: number, normalised: number | null): ScanSignalRow {
  return {
    signalKey, pillar, weight, normalised,
    rawValue: null,
    contribution: null,
    state: normalised == null ? "unmeasured" : normalised >= 70 ? "pass" : normalised >= 40 ? "warn" : "fail",
    platform: "web",
  };
}

// The 8 fixed HTML signals, all measured (a typical web scan).
const FIXED_ROWS: ScanSignalRow[] = [
  sig("title_tag", "seo", 0.1, 80),
  sig("meta_description", "seo", 0.1, 60),
  sig("schema_jsonld", "seo", 0.12, 0),
  sig("canonical_url", "seo", 0.08, 100),
  sig("heading_structure", "seo", 0.1, 50),
  sig("content_depth", "content", 0.25, 70),
  sig("social_share_tags", "content", 0.15, 40),
  sig("media_richness", "content", 0.15, 90),
];

// Deep (paid-only) rows that must NOT affect the headline.
const DEEP_ROWS: ScanSignalRow[] = [
  sig("organic_keywords", "seo", 0.25, 20),
  sig("keyword_rankings", "seo", 0.15, 10),
  sig("community_presence", "outreach", 0.25, 30),
  sig("marketplace_presence", "outreach", 0.25, 40),
];

describe("headlineScore (fixed basis)", () => {
  it("is identical whether or not deep signals are present (free == paid)", () => {
    const free = headlineScore(FIXED_ROWS);
    const paid = headlineScore([...FIXED_ROWS, ...DEEP_ROWS]);
    expect(paid.total).toBe(free.total);
    expect(paid.breakdown).toEqual(free.breakdown);
  });

  it("assesses only SEO + Content (outreach has no fixed signal)", () => {
    const h = headlineScore([...FIXED_ROWS, ...DEEP_ROWS]);
    expect(h.assessed.sort()).toEqual(["content", "seo"]);
    expect(h.breakdown.outreach).toBe(0);
  });

  it("FIXED_BASIS_SIGNAL_KEYS is exactly the 8 HTML-derived signals", () => {
    expect([...FIXED_BASIS_SIGNAL_KEYS].sort()).toEqual(
      ["canonical_url","content_depth","heading_structure","media_richness","meta_description","schema_jsonld","social_share_tags","title_tag"],
    );
  });
});
