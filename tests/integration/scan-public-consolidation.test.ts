/**
 * Task 8 — scan public-surface consolidation integration test.
 *
 * Proves three things about the consolidated public scan surface (Plan 2):
 *
 *  1. Always-free public render: a FULL/deep scan (populated deep sections +
 *     non-null action drafts + a full M4 market analysis) persisted to real
 *     Supabase and read back still renders LOCKED via `publicReportProps` —
 *     i.e. even a paid-depth report never leaks its deep drafts/detail on the
 *     public `/scan/<slug>` surface. This complements (does not duplicate)
 *     the pure-fixture unit tests in `public-report.test.tsx`: this file
 *     exercises the real JSON round-trip through Postgres jsonb with a
 *     genuinely deep payload, not a hand-held literal.
 *  2. No viewer-tier leak by construction: `public-report.tsx` never imports
 *     `currentUser`/`entitlementsFor`, so there is no code path that could
 *     thread a paid viewer's entitlement into this route.
 *  3. Redirect consolidation: `next.config.ts` still declares the three
 *     permanent redirects that collapse `/scan/:id/results` and the legacy
 *     `/report/:slug[...]` routes onto the single `/scan/:slug` surface.
 *
 * LOCAL ONLY (needs local Supabase). Run with:
 *   pnpm test:int tests/integration/scan-public-consolidation.test.ts
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { installFixtures, resetFixtures } from "@/lib/scan/fixture-seam";
import { makeFixtureProvider } from "@/lib/dev/fixtures";
import type { Json } from "@/lib/db/types";
import type {
  ReportPayload,
  ChannelOpportunities,
} from "@/lib/scan/report";
import type { ActionCard } from "@/lib/llm/types";
import type { VerifiedScore } from "@/lib/scan/score-full";
import type { MarketAnalysis } from "@/lib/scan/gap";
import type { DistributionProfile, SeoPosture } from "@/lib/scan/profile";
import type { DemandPocket } from "@/lib/scan/demand";

installFixtures(makeFixtureProvider());

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => resetFixtures());

const STORE_URL = `https://scan-consolidation-fixture-${Date.now()}.example.com`;

// ---------------------------------------------------------------------------
// Fixture builders — a genuinely DEEP report: every paid/deep section is
// populated well past its free-preview cap, and every action draft is
// non-null, so redaction has real work to do (not a vacuous no-op).
// ---------------------------------------------------------------------------

function makeAction(title: string, effortMin: number, delta: number): ActionCard {
  return {
    category: "content",
    title,
    why: `why ${title}`,
    evidenceIds: [],
    evidence: [],
    effortMin,
    suggestedDeadline: "2026-07-20",
    expectedOutcome: { scoreComponent: "content", delta },
    draft: `a real paid draft for "${title}" that must never reach the public surface`,
    draftRequiresEdit: true,
    verification: { method: "url", state: "pending" },
    basis: "evidence_based",
    confidence: 0.85,
    target: null,
  };
}

function makeSeo(seed: number, deep: boolean): SeoPosture {
  return {
    organicKeywords: seed,
    etv: seed / 10,
    authority: deep ? 50 + seed : null,
    referringDomains: deep ? 200 + seed : null,
    paidKeywords: deep ? 12 : undefined,
    paidEtv: deep ? 34.5 : undefined,
    rankedKeywords: deep ? [{ keyword: `kw-${seed}`, position: 3, volume: seed * 10, etv: seed }] : undefined,
    topPages: deep ? [{ url: `https://rival-${seed}.com/blog`, keywordCount: seed, etv: seed }] : undefined,
  };
}

function makeProfile(domain: string, seed: number): DistributionProfile {
  return {
    domain,
    channels: [],
    communities: [],
    seo: makeSeo(seed, true),
    marketplace: [{ source: "product_hunt", present: true, url: `https://producthunt.com/${domain}` }],
    crawledAt: "2026-07-01T00:00:00.000Z",
  };
}

function makePocket(surface: string): DemandPocket {
  return {
    surface,
    platform: "Reddit",
    subreddit: surface,
    count: 4,
    intentSum: 2.5,
    score: 3.1,
    topThreads: [{ title: `Someone asking in ${surface}`, url: `https://reddit.com/${surface}/1`, intent: 0.8, publishedAt: "2026-06-01", theme: "pain" }],
  };
}

function makeDeepReport(): ReportPayload {
  const channelOpportunities: ChannelOpportunities = {
    keywordClusters: [
      { theme: "notes", keywords: [{ keyword: "fast notes app", volume: 4400, cpc: 1.8, competition: 0.42 }] },
      { theme: "sync", keywords: [{ keyword: "note sync tool", volume: 900, cpc: 2.1, competition: 0.55 }] },
    ],
    communitiesByEngagement: [
      { source: "hn", title: "a", url: "https://h/1", engagement: 400 },
      { source: "hn", title: "b", url: "https://h/2", engagement: 250 },
      { source: "reddit", title: "c", url: "https://r/3", engagement: 90 },
    ],
  };

  const keywordGap = [
    { keyword: "team habit tracker", volume: 8100, rivalsRanking: 3, bestRivalPosition: 2 },
    { keyword: "daily habit app", volume: 5400, rivalsRanking: 2, bestRivalPosition: 4 },
    { keyword: "shared streak app", volume: 2200, rivalsRanking: 1, bestRivalPosition: 6 },
    { keyword: "manager digest app", volume: 900, rivalsRanking: 1, bestRivalPosition: 8 },
  ];

  const pockets = ["r/1", "r/2", "r/3", "r/4", "r/5", "r/6"].map(makePocket);

  const market: MarketAnalysis = {
    cohort: {
      self: makeProfile(STORE_URL.replace("https://", ""), 100),
      competitors: [makeProfile("a.com", 400), makeProfile("b.com", 800), makeProfile("c.com", 1200), makeProfile("d.com", 50)],
      competitorDomains: ["a.com", "b.com", "c.com", "d.com"],
      product: { name: "Fixture Co", description: "team habit tracking" },
    },
    demand: { painQueries: ["how do teams track habits together"], pockets, totalHits: 40, buyerPainHits: 18 },
    gap: {
      channelMatrix: [{ kind: "blog", self: { present: true, active: true, postsPerMonth: 2 }, competitorsPresent: 3, competitorsActive: 2, total: 4 }],
      channelGaps: [{ kind: "youtube", competitorsActive: 3, total: 4, state: "absent", prevalence: 0.75 }],
      communityGaps: [{ source: "reddit", competitorsActive: 2, total: 4, selfActive: false }],
      seo: { selfKeywords: 100, medianCompetitorKeywords: 600, ratio: 100 / 600 },
      shareOfVoice: { selfPct: 0.12, rivals: [{ domain: "a.com", pct: 0.4, mentions: 40 }], selfMentions: 12, totalMentions: 100 },
      keywordGap,
      demandPockets: pockets,
    },
    plan: {
      items: [
        { kind: "channel", title: "Start a YouTube channel", why: "3 of 4 rivals active there", priority: 30, ease: 0.3, impact: 0.9, competition: 0.5, score: 0.3 },
        { kind: "seo", title: "Rank for 'team habit tracker'", why: "8,100/mo, no dominant rival", priority: 25, ease: 0.5, impact: 0.8, competition: 0.4, score: 0.28 },
      ],
    },
    recentBuzz: [{ title: "Fixture Co launches manager digest", url: "https://news.example.com/1", publishedDate: "2026-06-15" }],
  };

  const score: VerifiedScore = {
    total: 71,
    breakdown: { content: 65, outreach: 55, seo: 80 },
    radar: [
      { axis: "Content", value: 65, active: true, assessed: true },
      { axis: "Outreach", value: 55, active: true, assessed: true },
      { axis: "SEO/ASO", value: 80, active: true, assessed: true },
      { axis: "Ads", value: 0, active: false, assessed: false },
      { axis: "Partnerships", value: 0, active: false, assessed: false },
      { axis: "PR", value: 0, active: false, assessed: false },
      { axis: "Positioning", value: 0, active: false, assessed: false },
    ],
    basis: "verified",
  };

  return {
    mode: "web",
    generatedAt: "2026-07-05T00:00:00.000Z",
    whatYouOffer: {
      positioningMirror: {
        listingSays: "Build habits, together — for small teams",
        reviewsValue: "Users love the shared streak and manager digest",
        gap: "Listing undersells the manager digest feature",
      },
    },
    whoItsFor: { summary: "Buyers who value team accountability.", signals: ["accountability", "streaks", "managers"] },
    whereTheyAre: {
      surfaces: [{ source: "site_fetch", title: "Homepage", url: STORE_URL }],
      competitorGap: [{ competitor: "Acme", dimension: "mentions", them: 12, you: 3, positioning: "all-in-one suite", gap: "no offline sync" }],
    },
    whatToDoThisWeek: {
      quickWins: [makeAction("qw1", 10, 12), makeAction("qw2", 20, 10)],
      medium: [makeAction("md1", 60, 8), makeAction("md2", 90, 6)],
      longPlay: [makeAction("lp1", 180, 4), makeAction("lp2", 240, 2)],
    },
    score,
    channelOpportunities,
    market,
  };
}

// ---------------------------------------------------------------------------
// 1. Always-free public render — real DB round-trip of a deep payload.
// ---------------------------------------------------------------------------

describe("scan-public-consolidation", () => {
  test(
    "publicReportProps free-redacts a persisted DEEP report end-to-end (real Supabase round-trip)",
    async () => {
      const { serverDb } = await import("@/lib/db/client");
      const { publicReportProps } = await import("../../app/(funnel)/scan/[id]/public-report");
      const { redactReportForTier } = await import("@/lib/billing/entitlements");
      const { slugForScan } = await import("@/lib/scan/scan-slug");
      const { SITE } = await import("@/lib/seo");
      const db = serverDb();

      const deepReport = makeDeepReport();

      // 1. Seed a web app + a "full" scan carrying the deep payload — status
      //    "done" mirrors what the funnel page requires to render PublicReport
      //    directly (see resolveScanParam / ScanHydrator).
      const { data: appRow, error: appErr } = await db
        .from("apps")
        .insert({ store_url: STORE_URL, platform: "web", name: "Fixture Co" })
        .select("id")
        .single();
      expect(appErr).toBeNull();
      if (!appRow) throw new Error("No app row returned");
      const appId = appRow.id as string;

      const { data: scanRow, error: scanErr } = await db
        .from("scans")
        .insert({
          app_id: appId,
          tier: "full",
          status: "done",
          report_payload: deepReport as unknown as Json,
          score_total: deepReport.score.total,
        })
        .select("id")
        .single();
      expect(scanErr).toBeNull();
      if (!scanRow) throw new Error("No scan row returned");
      const scanId = scanRow.id as string;

      // 2. Read the payload back exactly as the funnel page would.
      const { data: persisted, error: readErr } = await db
        .from("scans")
        .select("report_payload")
        .eq("id", scanId)
        .single();
      expect(readErr).toBeNull();
      if (!persisted?.report_payload) throw new Error("No report_payload after insert");
      const payload = persisted.report_payload as unknown as ReportPayload;

      // Sanity: the round-tripped payload really is deep (drafts non-null,
      // deep sections above their free-preview caps) — otherwise the
      // redaction assertions below would be checking a no-op.
      const preRedactionActions = [
        ...payload.whatToDoThisWeek.quickWins,
        ...payload.whatToDoThisWeek.medium,
        ...payload.whatToDoThisWeek.longPlay,
      ];
      expect(preRedactionActions.length).toBe(6);
      expect(preRedactionActions.every((a) => a.draft !== null)).toBe(true);
      expect(payload.market?.gap.keywordGap.length).toBe(4);

      const slug = slugForScan({ storeUrl: STORE_URL, platform: "web", scanId });

      // 3. Call the pure public-render wiring — no viewer/tier is passed in.
      const { report, resultsProps, badgeTotal, jsonLd } = publicReportProps(payload, slug, STORE_URL);

      // --- Invariant: whatever comes out equals redactReportForTier(payload, "free")
      // exactly. This is the strongest "no viewer-tier leak" guarantee available
      // from the outside: publicReportProps has no viewer/tier parameter to leak
      // through in the first place, so it can only ever produce the free redaction.
      expect(report).toEqual(redactReportForTier(payload, "free"));
      expect(report).not.toEqual(payload); // proves redaction actually changed something

      // --- Action plan: capped to 3 total, every draft nulled, bucket-order preview.
      const postActions = [...report.whatToDoThisWeek.quickWins, ...report.whatToDoThisWeek.medium, ...report.whatToDoThisWeek.longPlay];
      expect(postActions.length).toBe(3);
      expect(postActions.every((a) => a.draft === null)).toBe(true);
      expect(report.whatToDoThisWeek.quickWins.map((a) => a.title)).toEqual(["qw1", "qw2"]);
      expect(report.whatToDoThisWeek.medium.map((a) => a.title)).toEqual(["md1"]);
      expect(report.whatToDoThisWeek.longPlay).toEqual([]);

      // --- Channel opportunities: truncated to 1 cluster (cpc/competition zeroed), 2 communities.
      expect(report.channelOpportunities?.keywordClusters.length).toBe(1);
      expect(report.channelOpportunities?.keywordClusters[0]?.keywords[0]?.cpc).toBe(0);
      expect(report.channelOpportunities?.keywordClusters[0]?.keywords[0]?.competition).toBe(0);
      expect(report.channelOpportunities?.keywordClusters[0]?.keywords[0]?.volume).toBe(4400); // teaser hook survives
      expect(report.channelOpportunities?.communitiesByEngagement.length).toBe(2);

      // --- Market: the paid payoff (plan, channel/keyword gaps, buzz, backlink
      // detail, thread excerpts) is gated; the teaser proof (SOV, channel matrix,
      // top-3 competitors' organic keywords/etv, demand-pocket headlines) survives.
      expect(report.market?.plan.items).toEqual([]);
      expect(report.market?.gap.channelGaps).toEqual([]);
      expect(report.market?.gap.keywordGap).toEqual([]);
      expect(report.market?.recentBuzz).toEqual([]);
      expect(report.market?.cohort.competitors.length).toBe(3); // top-3 of 4 seeded
      expect(report.market?.cohort.competitors[0]?.seo?.organicKeywords).toBe(400); // proof kept
      expect(report.market?.cohort.competitors[0]?.seo?.authority).toBeNull(); // backlink detail gated
      expect(report.market?.cohort.competitors[0]?.seo?.referringDomains).toBeNull();
      expect(report.market?.cohort.competitors[0]?.seo?.rankedKeywords).toBeUndefined();
      expect(report.market?.cohort.competitors[0]?.seo?.topPages).toBeUndefined();
      expect(report.market?.cohort.competitors[0]?.marketplace).toBeUndefined(); // launch presence gated
      expect(report.market?.demand.pockets.length).toBe(5); // FREE_PREVIEW_POCKETS
      expect(report.market?.demand.pockets[0]?.topThreads).toEqual([]); // sample threads gated
      expect(report.market?.gap.shareOfVoice).toEqual(payload.market?.gap.shareOfVoice); // proof kept, untouched

      // --- Score is untouched by redaction (all tiers see the real headline number).
      expect(report.score).toEqual(payload.score);
      expect(badgeTotal).toBe(payload.score.total);

      // --- resultsProps: pre-redaction locked-count totals are exposed even
      // though the underlying report data is gated.
      expect(resultsProps.lockedCount).toBe(3); // 6 full actions − 3 shown (Phase C free floor: FREE_PREVIEW_ACTIONS=3, R-3.17)
      expect(resultsProps.gapRows).toEqual([]); // redacted keyword-gap rows are empty
      expect(resultsProps.gapTotal).toBe(4); // but the FULL pre-redaction count is exposed

      // --- Unlock CTA is wired: hideUnlock is never set on the public surface,
      // so ResultsScreen always renders the "Unlock full report" band.
      expect(resultsProps.hideUnlock).toBeFalsy();

      // --- JSON-LD headline/url reflect the free-redacted (unchanged) score + slug.
      expect(jsonLd.headline).toBe(`Discoverability Score: ${payload.score.total}/100`);
      expect(jsonLd.url).toBe(`${SITE.url}/scan/${slug}`);
      expect(jsonLd.datePublished).toBe(payload.generatedAt);

      // Sanity on the derived slug itself: web mode → bare hostname, not the UUID.
      expect(slug).toBe(STORE_URL.replace("https://", ""));
    },
    60_000,
  );

  // ---------------------------------------------------------------------------
  // 2. No viewer-tier leak by construction.
  // ---------------------------------------------------------------------------

  test("public-report.tsx never imports currentUser/entitlementsFor — no code path can leak a paid viewer's drafts", async () => {
    const fs = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const src = await fs.readFile(
      resolve(process.cwd(), "app/(funnel)/scan/[id]/public-report.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/import[^;]*\bcurrentUser\b/);
    expect(src).not.toMatch(/import[^;]*\bentitlementsFor\b/);
    // The unlock CTA is wired unconditionally (not behind any tier/viewer check).
    expect(src).toMatch(/unlockButton=\{<CapturedUnlockButton/);
  });

  // ---------------------------------------------------------------------------
  // 3. Redirect consolidation — the retired routes collapse onto /scan/:slug.
  // ---------------------------------------------------------------------------

  test("next.config redirects collapse /scan/:id/results and /report/:slug[...] onto /scan/:slug (permanent)", async () => {
    const { default: nextConfig } = await import("../../next.config");
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toBeDefined();
    if (!redirects) throw new Error("next.config redirects() returned nothing");

    expect(redirects).toContainEqual({
      source: "/scan/:id/results",
      destination: "/scan/:id",
      permanent: true,
    });
    expect(redirects).toContainEqual({
      source: "/report/:slug",
      destination: "/scan/:slug",
      permanent: true,
    });
    expect(redirects).toContainEqual({
      source: "/report/:slug/opengraph-image",
      destination: "/scan/:slug/opengraph-image",
      permanent: true,
    });

    // All are permanent (301) redirects, not temporary — the old
    // routes are retired for good, not just re-pointed for a migration window.
    for (const r of redirects) {
      expect(r.permanent).toBe(true);
    }
    // 3 scan-URL consolidations + /teardowns → /gallery.
    expect(redirects.length).toBe(4);
  });
});
