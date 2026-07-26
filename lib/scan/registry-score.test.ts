import { describe, it, expect } from "vitest";
import {
  registryScore,
  applyRegistryScore,
  headlineFromRows,
  headlineScore,
  marketPositionScore,
  unifiedHeadline,
  discoverabilityScore,
  findabilityFloor,
  FIXED_BASIS_SIGNAL_KEYS,
  HEADLINE_SCORE_VERSION,
  DISCOVERABILITY_SCORE_VERSION,
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

  it("scores web over the fixed on-site basis (version 4) and equals headlineScore", () => {
    const h = headlineFromRows("web", v1, FIXED_ROWS);
    expect(h.version).toBe(HEADLINE_SCORE_VERSION);
    expect(h.total).toBe(headlineScore(FIXED_ROWS).total);
  });

  it("is stable free→paid: deep signals never move the headline", () => {
    const free = headlineFromRows("web", v1, FIXED_ROWS);
    const paid = headlineFromRows("web", v1, [...FIXED_ROWS, ...DEEP_ROWS]);
    expect(paid.total).toBe(free.total);
    expect(paid.breakdown).toEqual(free.breakdown);
  });

  it("keeps v1 (version 1) for app platforms", () => {
    expect(headlineFromRows("ios", v1, FIXED_ROWS)).toEqual({ ...v1, version: 1 });
  });

  it("keeps v1 for web when nothing measured", () => {
    const h = headlineFromRows("web", v1, [sig("title_tag", "seo", 0.1, null)]);
    expect(h).toEqual({ ...v1, version: 1 });
  });
});

describe("unifiedHeadline (v6 — the Discoverability Score shown to the user)", () => {
  const v1 = { total: 18, breakdown: { content: 0, outreach: 0, seo: 40 } };

  it("combines the on-page headline with search presence into the geomean (version 5)", () => {
    const onPage = headlineFromRows("web", v1, FIXED_ROWS); // v4 on-page driver
    const unified = unifiedHeadline(onPage, 4);
    expect(unified.version).toBe(DISCOVERABILITY_SCORE_VERSION);
    expect(unified.total).toBe(discoverabilityScore(onPage.total, 4));
    // the on-page breakdown bars are preserved (drivers, not folded away).
    expect(unified.breakdown).toEqual(onPage.breakdown);
  });

  it("is stable free↔paid: same on-page + same search presence → same unified score", () => {
    // BOTH inputs compute identically on free and paid, so the number never moves on
    // upgrade (unlike the retired v3 that folded off-site signals into the headline).
    const freeOnPage = headlineFromRows("web", v1, FIXED_ROWS);
    const paidOnPage = headlineFromRows("web", v1, [...FIXED_ROWS, ...DEEP_ROWS]);
    expect(unifiedHeadline(paidOnPage, 12).total).toBe(unifiedHeadline(freeOnPage, 12).total);
  });

  it("leaves app-platform (v1) and null-search-presence headlines unchanged", () => {
    const app = { ...v1, version: 1 };
    expect(unifiedHeadline(app, 30)).toEqual(app); // v1 never unified
    const web = headlineFromRows("web", v1, FIXED_ROWS);
    expect(unifiedHeadline(web, null)).toEqual(web); // no persisted search presence → on-page only
  });

  // v6 (2026-07-26): the findability blend. keywordsRanked floors search presence
  // so a broadly-ranking site can't read "Invisible" on a classifier miss.
  it("v6: floors search presence by the raw ranked-keyword footprint (x.com class)", () => {
    const onPage = headlineFromRows("web", v1, FIXED_ROWS);
    // With a 0 search presence but a huge footprint, the blended score is much
    // higher than the un-blended (searchPresence-only) score.
    const blended = unifiedHeadline(onPage, 0, 15_060_115).total;
    const unblended = unifiedHeadline(onPage, 0).total;
    expect(blended).toBeGreaterThan(unblended);
    expect(blended).toBe(discoverabilityScore(onPage.total, 0, 15_060_115));
  });

  it("v6: a footprint-less site (0 ranked) is unchanged by the blend — stays low", () => {
    const onPage = headlineFromRows("web", v1, FIXED_ROWS);
    expect(unifiedHeadline(onPage, 0, 0).total).toBe(unifiedHeadline(onPage, 0).total);
  });

  it("v6 stays stable free↔paid: same footprint → same blended score (invariant #1)", () => {
    // keywordsRanked is the SAME free-computed footprint on both tiers (the deepen
    // reuses the persisted free searchVisibility), so the blend can't move the
    // number on upgrade — the whole point of the v6 boundary.
    const freeOnPage = headlineFromRows("web", v1, FIXED_ROWS);
    const paidOnPage = headlineFromRows("web", v1, [...FIXED_ROWS, ...DEEP_ROWS]);
    expect(unifiedHeadline(paidOnPage, 0, 32_324).total).toBe(unifiedHeadline(freeOnPage, 0, 32_324).total);
  });
});

describe("findabilityFloor (v6 — raw footprint → search-presence floor)", () => {
  it("is 0 for a footprint-less site and monotonic in keywordsRanked", () => {
    expect(findabilityFloor(0)).toBe(0);
    expect(findabilityFloor(null)).toBe(0);
    expect(findabilityFloor(undefined)).toBe(0);
    // log-scale, monotonic non-decreasing.
    expect(findabilityFloor(346)).toBeLessThan(findabilityFloor(32_324));
    expect(findabilityFloor(32_324)).toBeLessThan(findabilityFloor(15_060_115));
  });
  it("saturates at 100 for a mega-footprint and never exceeds it", () => {
    expect(findabilityFloor(15_060_115)).toBe(100);
    expect(findabilityFloor(Number.MAX_SAFE_INTEGER)).toBe(100);
  });
  it("hits the owner-approved calibration anchors (2026-07-26)", () => {
    // These are the corpus targets the blend was calibrated to.
    expect(findabilityFloor(32_324)).toBeGreaterThanOrEqual(60); // savvycal → Fair
    expect(findabilityFloor(120_578)).toBeGreaterThanOrEqual(68); // getapp → Fair
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

  it("ignores deep-signal quality → paid basis equals free basis", () => {
    // Same 8 fixed rows; paid additionally measured weak deep signals. Task 5:
    // proves the paid full-scan path's chosen basis matches the free path's.
    const free = headlineScore(FIXED_ROWS);
    const paidRows = [...FIXED_ROWS, sig("organic_keywords", "seo", 0.25, 5), sig("community_presence", "outreach", 0.25, 5)];
    const paid = headlineScore(paidRows);
    expect(paid.total).toBe(free.total);
  });
});

describe("marketPositionScore (F2)", () => {
  const row = (signalKey: string, pillar: "content"|"outreach"|"seo", normalised: number|null, state: "pass"|"warn"|"fail"|"unmeasured") =>
    ({ signalKey, pillar, weight: 0.2, normalised, state, rawValue: null, contribution: null, platform: "web" as const });
  it("scores ONLY off-site signals (excludes the fixed on-site basis)", () => {
    const rows = [
      row("title_tag", "seo", 100, "pass"), row("schema_jsonld", "seo", 100, "pass"), // on-site → excluded
      row("organic_keywords", "seo", 13, "fail"), row("referring_domains", "seo", 10, "fail"), // off-site → counted
      row("owned_channels", "content", 0, "fail"),
    ];
    const mp = marketPositionScore(rows);
    expect(mp.assessed.length).toBeGreaterThan(0);
    expect(mp.total).toBeLessThan(30); // off-site is weak → low grade, despite on-site 100s
  });
  it("returns assessed:[] when only on-site signals are measured (free scan)", () => {
    const mp = marketPositionScore([row("title_tag","seo",100,"pass"), row("organic_keywords","seo",null,"unmeasured")]);
    expect(mp.assessed).toEqual([]);
  });
})
