import { Suspense } from "react";
import { buildMetadata } from "@/lib/seo";
import { serverDb } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/server";
import { type Tier, TIER_LIMITS } from "@/lib/billing/tiers";
import { entitlementsFor, redactReportForTier } from "@/lib/billing/entitlements";
import type { ReportPayload } from "@/lib/scan/report";
import { buildExecutiveSummary } from "@/lib/scan/report";
import { buildLossFrame } from "@/lib/scan/competitive-framing";
import { ExecutiveSummary } from "@/components/report/executive-summary";
import { SectionNav, buildSectionNavItems } from "@/components/report/section-nav";
import { WhatYouOfferSection } from "@/components/report/what-you-offer-section";
import { WhoItsForSection } from "@/components/report/who-its-for-section";
import { WhereTheyAreSection } from "@/components/report/where-they-are-section";
import { ActionPlanSection } from "@/components/report/action-plan-section";
import { SignalBreakdownSection } from "@/components/report/signal-breakdown-section";
import { EvidenceFooter } from "@/components/report/evidence-footer";
import { TopFixesPreview } from "@/components/report/top-fixes-preview";
import { ShareScoreButton } from "@/components/report/share-score-button";
import { ResultsScreen } from "@/components/report/captured/results-screen";
import { toResultsProps } from "@/components/report/captured/to-results-props";
import { readSignalBreakdown } from "@/lib/scan/signal-breakdown";
import { CompetitiveLandscapeSection } from "@/components/report/competitive-landscape-section";
import { ChannelOpportunitiesSection } from "@/components/report/channel-opportunities-section";
import { CreatorsToReachSection } from "@/components/report/creators-to-reach-section";
import { StrengthsWeaknessesSection } from "@/components/report/strengths-weaknesses-section";
import { SnapshotStrip } from "@/components/report/snapshot-strip";
import { MarketAnalysisSections } from "@/components/report/market-analysis-sections";
import { UpgradeCta } from "@/components/report/upgrade-cta";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBlock } from "./score-block";
import { ReportReveal } from "./report-reveal";
import { ReportPending } from "./report-pending";
import { FindingsReveal, type FindingsPayload } from "../findings-reveal";
import type { PreliminaryFacts } from "@/lib/scan/types";

/** Human-readable age of a snapshot timestamp (server-rendered; no hydration drift). */
function relativeAge(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "a week ago" : `${weeks} weeks ago`;
}

export function generateStaticParams() {
  return [{ id: "_placeholder" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return buildMetadata({
    title: `Discoverability Report`,
    path: `/scan/${id}/results`,
  });
}

// ---------------------------------------------------------------------------
// Page — static shell; the uncached data fetch lives in a Suspense child
// (Next 16 cacheComponents: blocking data must be inside <Suspense>).
// ---------------------------------------------------------------------------

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "_placeholder") {
    return null;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 pt-8">
      <Suspense fallback={<ResultsSkeleton />}>
        <ResultsContent id={id} />
      </Suspense>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Async content — all data fetching happens here, inside Suspense
// ---------------------------------------------------------------------------

async function ResultsContent({ id }: { id: string }) {
  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload, findings_payload, preliminary_facts, tier, completed_at, started_at, rank_data_fetched_at")
    .eq("id", id)
    .maybeSingle();

  if (!data?.report_payload) {
    // Two-track split: a free scan stops after findings and never gets a report
    // until the user pays (which triggers the deep `scan/deepen` pass). Render the
    // cheap teaser (the speed-to-wow FindingsReveal) instead of polling forever.
    const findings = data?.findings_payload as unknown as FindingsPayload | null;
    if (data?.tier === "free" && findings) {
      const facts = data.preliminary_facts as unknown as PreliminaryFacts | null;
      const competitorCount = facts?.competitors?.length ?? 0;
      return <FindingsReveal scanId={id} data={findings} competitorCount={competitorCount} />;
    }
    // Paid scan still generating (or findings not yet ready) — auto-refresh.
    return <ReportPending />;
  }

  const fullReport = data.report_payload as unknown as ReportPayload;

  // Resolve the viewer's EFFECTIVE tier and blur-lock the report accordingly.
  // Drafts unlock only for an ACTIVE subscription.
  const viewer = await currentUser();
  let tier: Tier = "free";
  if (viewer) {
    const ent = await entitlementsFor(viewer.user.id);
    tier = ent.active ? ent.tier : "free";
  }
  const report = redactReportForTier(fullReport, tier);
  const isPaid = tier !== "free";
  // M4: when the deep market analysis is present (paid, web), it supersedes the
  // lighter competitive-landscape / channels / creators sections.
  const hasMarket = !!report.market;

  // Named, loss-framed competitive hook from community-mention gaps (null on
  // cold-start scans with no credible gap → score block falls back to neutral).
  const lossFrame = buildLossFrame(report.whereTheyAre.competitorGap);

  // "Show the total, render a fraction": locked counts are read from the FULL
  // (pre-redaction) payload so each gated section can name what it withholds.
  const lockCounts = computeLockCounts(fullReport);

  // Snapshot timestamp — prefer completed_at, fall back to started_at
  const generatedAt = data.completed_at ?? data.started_at ?? report.generatedAt;
  const snapshotAge = relativeAge(generatedAt);

  // 18-signal explainability (empty for pre-migration scans → panel degrades).
  const signalBreakdown = await readSignalBreakdown(id);
  const productName = (data.preliminary_facts as unknown as PreliminaryFacts | null)?.listing?.name ?? null;

  // Captured "results" screen (ReachKit.dc.html) wired to live report data.
  // Supersedes the prior section stack for the free results view.
  const siteLabel = productName ?? "your site";
  const fullActions =
    fullReport.whatToDoThisWeek.quickWins.length +
    fullReport.whatToDoThisWeek.medium.length +
    fullReport.whatToDoThisWeek.longPlay.length;
  void signalBreakdown;
  void lossFrame;
  void snapshotAge;
  void generatedAt;
  void lockCounts;
  void hasMarket;

  return <ResultsScreen {...toResultsProps(report, siteLabel, fullActions)} />;
}

// ---------------------------------------------------------------------------
// Locked-count labels — "show the total, render a fraction". Pure, derived from
// the full (pre-redaction) payload so each gated section names what it withholds.
// ---------------------------------------------------------------------------

function computeLockCounts(full: ReportPayload): {
  channelsLabel?: string;
  creatorsLabel?: string;
  strengthsLabel?: string;
  actionsLabel?: string;
} {
  const ch = full.channelOpportunities;
  const clusters = ch?.keywordClusters.length ?? 0;
  const communities = ch?.communitiesByEngagement.length ?? 0;
  const creators = full.creatorsToReach?.length ?? 0;
  const sw = full.strengthsAndWeaknesses;
  const themes =
    (sw?.strengths.length ?? 0) + (sw?.weaknesses.length ?? 0) + (sw?.mixed.length ?? 0);
  const diagnostics = sw?.diagnostics.length ?? 0;
  const w = full.whatToDoThisWeek;
  const actions = w.quickWins.length + w.medium.length + w.longPlay.length;

  return {
    channelsLabel:
      clusters > 0 || communities > 0
        ? `Unlock all ${clusters} keyword cluster${clusters === 1 ? "" : "s"} (CPC & competition) + ${communities} communit${communities === 1 ? "y" : "ies"}`
        : undefined,
    creatorsLabel:
      creators > 0
        ? `See all ${creators} creator${creators === 1 ? "" : "s"} who reach your rivals' audiences`
        : undefined,
    strengthsLabel:
      themes > 0 || diagnostics > 0
        ? `Unlock ${themes} review theme${themes === 1 ? "" : "s"} with quotes + ${diagnostics} diagnostic${diagnostics === 1 ? "" : "s"}`
        : undefined,
    actionsLabel:
      actions > 0
        ? `Unlock all ${actions} action${actions === 1 ? "" : "s"} with ready-to-send draft copy`
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Loading skeleton (shown while the report fetch resolves)
// ---------------------------------------------------------------------------

function ResultsSkeleton() {
  return (
    <>
      <div
        className="flex flex-col items-center rounded-xl border py-10"
        style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
      >
        <Skeleton className="mb-6 h-3 w-28" />
        <Skeleton className="size-[160px] rounded-full" />
        <Skeleton className="mt-6 h-3 w-48" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border p-7"
          style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
        >
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="mb-2 h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-3/4" />
        </div>
      ))}
    </>
  );
}
