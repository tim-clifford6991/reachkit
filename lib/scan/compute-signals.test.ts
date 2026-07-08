import { describe, it, expect } from "vitest";
import { computeScanSignals, type MarketSignalInputs } from "./compute-signals";
import { extractHtmlSignals } from "./extract-html";
import { signalsForPlatform } from "./signals";
import type { ScoreComponents } from "./score-full";

const components: ScoreComponents = {
  keywordsRanking: 50,
  directoriesLive: 40,
  comparisonPagesLive: 60,
  asoCoverage: 0,
  contentSurfaces: 10,
  outreachSurfaces: 5,
};

const goodHtml = extractHtmlSignals(`<html><head>
  <title>${"x".repeat(45)}</title>
  <meta name="description" content="${"d".repeat(140)}" />
  <link rel="canonical" href="https://a.com/" />
  <meta property="og:title" content="A"><meta property="og:image" content="https://a.com/x.png">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">{"@type":"Product"}</script>
</head><body><h1>One</h1><h2>Two</h2>
  <p>${"word ".repeat(400)}</p>
  <img src="a" alt="x"><img src="b" alt="y">
</body></html>`);

const fullMarket: MarketSignalInputs = {
  organicKeywords: 340,
  rankedKeywordCount: 28,
  referringDomains: 85,
  marketplaceCount: 3,
  communityMentions: 12,
  shareOfVoicePct: 0.3,
  ownedChannelCount: 3,
  contentPostsPerMonth: 4,
  recentBuzzCount: 2,
};

describe("computeScanSignals", () => {
  it("emits one row per platform-applicable signal", () => {
    const rows = computeScanSignals("web", goodHtml, components, fullMarket);
    expect(rows).toHaveLength(signalsForPlatform("web").length);
    const appRows = computeScanSignals("ios", null, components, null);
    expect(appRows).toHaveLength(signalsForPlatform("ios").length);
    for (const r of appRows) expect(["pass", "warn", "fail", "unmeasured"]).toContain(r.state);
  });

  it("scores Wave A HTML hygiene signals from the parsed HTML", () => {
    const rows = computeScanSignals("web", goodHtml, components, fullMarket);
    const byKey = Object.fromEntries(rows.map((r) => [r.signalKey, r]));
    expect(byKey.title_tag?.state).toBe("pass"); // 45 chars in 30–60
    expect(byKey.schema_jsonld?.state).toBe("pass"); // present
    expect(byKey.canonical_url?.state).toBe("pass");
    expect(byKey.social_share_tags?.state).toBe("pass"); // og+image+twitter
    expect(byKey.content_depth?.state).toBe("pass"); // ~400 words
  });

  it("marks layer-3 signals 'unmeasured' when market inputs are absent", () => {
    const rows = computeScanSignals("web", goodHtml, components, null);
    const byKey = Object.fromEntries(rows.map((r) => [r.signalKey, r]));
    expect(byKey.organic_keywords?.state).toBe("unmeasured");
    expect(byKey.community_presence?.state).toBe("unmeasured");
    expect(byKey.referring_domains?.state).toBe("unmeasured");
    // ...but a signal backed by the existing components is still measured
    expect(byKey.comparison_pages?.state).not.toBe("unmeasured");
  });

  it("marks Wave A signals 'unmeasured' when no HTML is available (e.g. app mode)", () => {
    const rows = computeScanSignals("web", null, components, fullMarket);
    const schema = rows.find((r) => r.signalKey === "schema_jsonld");
    expect(schema?.state).toBe("unmeasured");
    expect(schema?.normalised).toBeNull();
  });

  it("carries the registry weight + pillar and a contribution for measured signals", () => {
    const rows = computeScanSignals("web", goodHtml, components, fullMarket);
    const title = rows.find((r) => r.signalKey === "title_tag");
    expect(title?.pillar).toBe("seo");
    expect(title?.weight).toBe(0.1);
    expect(title?.contribution).not.toBeNull();
    expect(title?.platform).toBe("web");
  });

  it("never emits a contribution for an unmeasured signal", () => {
    const rows = computeScanSignals("web", null, components, null);
    for (const r of rows) {
      if (r.state === "unmeasured") expect(r.contribution).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// C3 (docs/plans/2026-07-07-launch-readiness.md, A6): a bare landing page must
// not trivially hit content_depth/media_richness = 100 — that read as
// fake-perfect on the live trustmrr.com scan. These lock in the tightened
// curve; scripts/score-calibration.mjs is the live-data companion that
// validates the resulting Content pillar total against real sites.
// ---------------------------------------------------------------------------
describe("content_depth / media_richness — C3 tightened thresholds", () => {
  it("a thin landing page (~150 words) warns on content_depth, not passes", () => {
    const thin = extractHtmlSignals(`<html><head><title>${"x".repeat(45)}</title></head>
      <body><h1>One</h1><p>${"word ".repeat(150)}</p></body></html>`);
    const rows = computeScanSignals("web", thin, components, null);
    const contentDepth = rows.find((r) => r.signalKey === "content_depth")!;
    expect(contentDepth.state).toBe("warn");
    expect(contentDepth.normalised).not.toBeNull();
    expect(contentDepth.normalised!).toBeLessThan(80); // below the new pass bar
    expect(contentDepth.normalised!).toBeGreaterThanOrEqual(50); // above the new warn bar — not a fail either
  });

  it("a genuinely substantive page (900+ words) still maxes content_depth", () => {
    const deep = extractHtmlSignals(`<html><head><title>${"x".repeat(45)}</title></head>
      <body><h1>One</h1><p>${"word ".repeat(900)}</p></body></html>`);
    const rows = computeScanSignals("web", deep, components, null);
    const contentDepth = rows.find((r) => r.signalKey === "content_depth")!;
    expect(contentDepth.state).toBe("pass");
    expect(contentDepth.normalised).toBe(100);
  });

  it("a single alt-tagged hero image warns on media_richness, not passes (was a trivial 100 before C3)", () => {
    const oneImage = extractHtmlSignals(`<html><body><img src="hero.png" alt="Product hero shot"></body></html>`);
    const rows = computeScanSignals("web", oneImage, components, null);
    const media = rows.find((r) => r.signalKey === "media_richness")!;
    expect(media.state).toBe("warn");
    expect(media.normalised).toBeLessThan(80);
  });

  it("zero images fails media_richness (tightened from the old warn-level floor)", () => {
    const noImages = extractHtmlSignals(`<html><body><p>${"word ".repeat(50)}</p></body></html>`);
    const rows = computeScanSignals("web", noImages, components, null);
    const media = rows.find((r) => r.signalKey === "media_richness")!;
    expect(media.state).toBe("fail");
  });

  it("a genuinely media-rich page (5+ fully alt-tagged images) still maxes media_richness", () => {
    const imgs = Array.from({ length: 5 }, (_, i) => `<img src="${i}.png" alt="Feature ${i}">`).join("");
    const rich = extractHtmlSignals(`<html><body>${imgs}</body></html>`);
    const rows = computeScanSignals("web", rich, components, null);
    const media = rows.find((r) => r.signalKey === "media_richness")!;
    expect(media.state).toBe("pass");
    expect(media.normalised).toBe(100);
  });
});
