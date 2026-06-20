/**
 * Dashboard page — §21.3 / §22.3 four-question overview.
 *
 * Composes:
 *   - DiscoverabilityScore (size="lg") — View Transition morph from /scan/[id]/results
 *   - Four §5.6 sections via E2 components (reuse, not rebuild)
 *   - This week's plays preview (top 2–3 from assembleWeeklyPlan)
 *   - Engagement strip (streak + score-history sparkline — inline SVG, not recharts)
 *
 * Data: primary app's latest scan report_payload.
 * Auth: layout guarantees the viewer is signed in. Data-fetching wrapped in
 * Suspense per Next.js 16 cacheComponents requirement.
 */

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor, redactReportForTier } from "@/lib/billing/entitlements";
import { isPaid } from "@/lib/billing/tiers";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import { buildExecutiveSummary } from "@/lib/scan/report";
import { ExecutiveSummary } from "@/components/report/executive-summary";
import { SectionNav, buildSectionNavItems } from "@/components/report/section-nav";
import { assembleWeeklyPlan } from "@/lib/scan/weekly-plan";
import { engagementSummary } from "@/lib/scan/engagement";
import { latestRefreshDigest } from "@/lib/scan/digest";
import { marketTrendSeries } from "@/lib/scan/market-trends";
import { WhatYouOfferSection } from "@/components/report/what-you-offer-section";
import { WhoItsForSection } from "@/components/report/who-its-for-section";
import { WhereTheyAreSection } from "@/components/report/where-they-are-section";
import { ActionPlanSection } from "@/components/report/action-plan-section";
import { CompetitiveLandscapeSection } from "@/components/report/competitive-landscape-section";
import { ChannelOpportunitiesSection } from "@/components/report/channel-opportunities-section";
import { CreatorsToReachSection } from "@/components/report/creators-to-reach-section";
import { StrengthsWeaknessesSection } from "@/components/report/strengths-weaknesses-section";
import { MarketAnalysisSections } from "@/components/report/market-analysis-sections";
import { ScoreBlockDashboard } from "@/components/app/score-block-dashboard";
import { PlaysPreview } from "@/components/app/plays-preview";
import { EngagementStrip } from "@/components/app/engagement-strip";
import { ExportButton } from "@/components/app/export-button";
import { WhatsChanged } from "@/components/app/whats-changed";
import { MarketTrends } from "@/components/app/market-trends";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Dashboard", path: "/app" });

// ---------------------------------------------------------------------------
// Dashboard content — async data-fetcher, wrapped in Suspense by the page
// ---------------------------------------------------------------------------

async function DashboardContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app");

  const { user } = viewer;

  // Onboarding gate (payment-first funnel): new users complete the backfill once
  // before reaching the dashboard. `onboarded_at` null → incomplete.
  if (!user.onboarded_at) redirect("/app/onboarding");

  const primaryAppId = user.app_ids[0] ?? null;

  if (!primaryAppId) {
    return <NoAppEmptyState />;
  }

  const db = serverDb();

  // Resolve tier
  const entitlements = await entitlementsFor(user.id);
  const tier = entitlements.active ? entitlements.tier : "free";
  const userIsPaid = isPaid(tier);

  // Latest scan
  const { data: scanRow } = await db
    .from("scans")
    .select("report_payload")
    .eq("app_id", primaryAppId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!scanRow?.report_payload) {
    return <NoReportEmptyState />;
  }

  const fullReport = scanRow.report_payload as unknown as ReportPayload;
  const report = redactReportForTier(fullReport, tier);

  // Parallel fetches. The refresh digest + market trends are paid-retention
  // surfaces — skip the reads for free viewers.
  const [weeklyPlan, engagement, digest, trend] = await Promise.all([
    assembleWeeklyPlan(primaryAppId),
    engagementSummary(primaryAppId),
    userIsPaid ? latestRefreshDigest(primaryAppId) : Promise.resolve(null),
    userIsPaid ? marketTrendSeries(primaryAppId) : Promise.resolve({ weeks: 0, metrics: [] }),
  ]);

  // Top 2–3 plays from the queue (quickWins first, then medium, then longPlay)
  const previewPlays = [
    ...weeklyPlan.queue.quickWins,
    ...weeklyPlan.queue.medium,
    ...weeklyPlan.queue.longPlay,
  ].slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Export action — paid CSV of the latest report (competitors, keyword
          gap, demand pockets, ranked playbook). */}
      <div className="flex justify-end">
        <ExportButton appId={primaryAppId} unlocked={userIsPaid} />
      </div>

      {/* What changed this week — the weekly retention hook (alerts + digest). */}
      <WhatsChanged digest={digest} />

      {/* Score — the signature visual; morphs from /scan/[id]/results */}
      <ScoreBlockDashboard score={report.score} />

      {/* Executive summary ("page 1") + jump nav */}
      <ExecutiveSummary summary={buildExecutiveSummary(report)} />
      <SectionNav items={buildSectionNavItems(report, { unlocked: userIsPaid })} />

      {/* Engagement strip */}
      {(engagement.streak > 0 || engagement.history.length > 0) && (
        <EngagementStrip
          streak={engagement.streak}
          history={engagement.history}
          honestyNote={engagement.honestyNote}
        />
      )}

      {/* Market trends — weekly snapshot sparklines (SOV, keywords, gaps). */}
      <MarketTrends trend={trend} />

      {/* This week's plays preview */}
      {previewPlays.length > 0 && (
        <PlaysPreview
          plays={previewPlays}
          weekOf={weeklyPlan.weekOf}
          scoreDelta={weeklyPlan.scoreDeltaLastWeek}
          carryoverCount={weeklyPlan.carryover.length}
          honestyNote={weeklyPlan.honestyNote}
          userIsPaid={userIsPaid}
        />
      )}

      {/* Four-question report sections */}
      <div className="space-y-4">
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Full report
        </p>
        <WhatYouOfferSection whatYouOffer={report.whatYouOffer} unlocked={userIsPaid} />
        <WhoItsForSection whoItsFor={report.whoItsFor} unlocked={userIsPaid} />
        <WhereTheyAreSection whereTheyAre={report.whereTheyAre} unlocked={userIsPaid} />
        {report.market ? (
          <MarketAnalysisSections market={report.market} />
        ) : (
          <>
            <CompetitiveLandscapeSection rows={report.competitiveLandscape} unlocked={userIsPaid} />
            <ChannelOpportunitiesSection data={report.channelOpportunities} unlocked={userIsPaid} />
            <CreatorsToReachSection creators={report.creatorsToReach} unlocked={userIsPaid} />
          </>
        )}
        <StrengthsWeaknessesSection data={report.strengthsAndWeaknesses} unlocked={userIsPaid} />
        <ActionPlanSection whatToDoThisWeek={report.whatToDoThisWeek} unlocked={userIsPaid} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton shown while the content loads
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Score skeleton */}
      <div
        className="flex flex-col items-center rounded-2xl border py-10"
        style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
      >
        <Skeleton className="mb-6 h-3 w-28" />
        <Skeleton className="size-[140px] rounded-full" />
        <Skeleton className="mt-6 h-3 w-48" />
      </div>
      {/* Section skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-2xl border p-7"
          style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
        >
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="mb-2 h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AppDashboardPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-8">
      {/* Page header */}
      <div>
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Dashboard
        </p>
        <h1 className="mt-0.5 text-xl font-semibold" style={{ color: "var(--color-fg)" }}>
          Four questions
        </h1>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function NoAppEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div
        className="max-w-sm rounded-xl border p-8 text-center"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          No app yet
        </p>
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-fg)" }}>
          Run a scan to get started
        </p>
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
          Submit your app or website URL to generate your first Discoverability Report.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: "var(--color-accent-600)",
            color: "var(--color-accent-fg)",
          }}
        >
          Run a scan
        </Link>
      </div>
    </div>
  );
}

function NoReportEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div
        className="max-w-sm rounded-xl border p-8 text-center"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Report pending
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Your scan is still processing. Check back in a few seconds.
        </p>
      </div>
    </div>
  );
}
