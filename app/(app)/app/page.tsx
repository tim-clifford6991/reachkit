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
import { isPaid, TIER_LIMITS } from "@/lib/billing/tiers";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import { readSignalBreakdown } from "@/lib/scan/signal-breakdown";
import { scoreHistoryMarkers } from "@/lib/scan/score-history-markers";
import { assembleWeeklyPlan } from "@/lib/scan/weekly-plan";
import { engagementSummary } from "@/lib/scan/engagement";
import { latestRefreshDigest } from "@/lib/scan/digest";
import { marketTrendSeries } from "@/lib/scan/market-trends";
import { DashboardAnalytics } from "@/components/app/dashboard-analytics";
import { MilestoneBanner } from "@/components/app/milestone-banner";
import { OnboardingChecklist } from "@/components/app/onboarding-checklist";
import { onboardingChecklist } from "@/lib/scan/onboarding-checklist";
import { activeAppId } from "@/lib/app/active-app";
import { PlaysPreview } from "@/components/app/plays-preview";
import { ExportButton } from "@/components/app/export-button";
import { WhatsChanged } from "@/components/app/whats-changed";
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

  const primaryAppId = await activeAppId(user);

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
    .select("id, report_payload, rank_data_fetched_at, completed_at")
    .eq("app_id", primaryAppId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!scanRow?.report_payload) {
    return <NoReportEmptyState />;
  }

  const fullReport = scanRow.report_payload as unknown as ReportPayload;
  const report = redactReportForTier(fullReport, tier);
  // 18-signal breakdown for the KPI scorecards + optimization-ideas card.
  const breakdown = await readSignalBreakdown(scanRow.id as string);
  // Action-completion markers for the score-history chart.
  const markers = await scoreHistoryMarkers(primaryAppId);
  // Keyword-data freshness (falls back to scan date for pre-stamp scans).
  const dataAsOf =
    (scanRow.rank_data_fetched_at as string | null) ?? (scanRow.completed_at as string | null) ?? undefined;
  // Activation checklist (self-hides once every step is done).
  const checklist = await onboardingChecklist(primaryAppId);

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

  // Δ vs previous scan from the score history (oldest-first); null = baseline.
  const lastPoint = engagement.history.at(-1);
  const prevPoint = engagement.history.at(-2);
  const scoreDelta = lastPoint && prevPoint ? lastPoint.total - prevPoint.total : null;
  // Week-over-week KPI deltas from the market-trend series (when ≥2 snapshots).
  const trendDelta = (k: string): number | null => {
    const m = trend.metrics.find((x) => x.key === k);
    return m && m.current != null && m.previous != null ? m.current - m.previous : null;
  };
  const sovD = trendDelta("sov");
  const kpiDeltas = {
    organicKeywords: trendDelta("self_keywords"),
    keywordGaps: trendDelta("keyword_gap"),
    shareOfVoice: sovD != null ? Math.round(sovD * 100) : null,
  };
  const hasMarket = !!report.market || (report.competitiveLandscape?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Top bar — paid CSV export of the latest report. */}
      <div className="flex justify-end">
        <ExportButton appId={primaryAppId} unlocked={userIsPaid} />
      </div>

      {/* Activation checklist for new users — self-hides when complete. */}
      <OnboardingChecklist steps={checklist} />

      {/* Milestone moment — restrained celebration on a material score jump. */}
      <MilestoneBanner delta={scoreDelta} />

      {/* Weekly retention hook — alerts + change digest (paid). */}
      <WhatsChanged digest={digest} />

      {/* ── ANALYTICS ── KPI scorecards → hero trend + right rail → keyword table. */}
      <DashboardAnalytics
        score={report.score}
        scoreDelta={scoreDelta}
        breakdown={breakdown}
        market={report.market ?? null}
        history={engagement.history}
        markers={markers}
        kpiDeltas={kpiDeltas}
        rankDepth={TIER_LIMITS[tier].rankDepth}
        dataAsOf={dataAsOf}
      />

      {/* Deep market intel lives on its own page now — link, don't duplicate. */}
      {hasMarket && (
        <div className="flex justify-end">
          <Link
            href="/app/channels"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: "var(--color-accent-400)" }}
          >
            View full market report
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      )}

      {/* ── ACTION ── this week's plays. */}
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

      {/* ── DETAIL ── the full prose report (offer/audience/where/strengths/plan)
          + trends + engagement now live on their own /app/report page. */}
      <Link
        href="/app/report"
        className="flex items-center justify-between gap-3 rounded-2xl border p-5 shadow-[var(--elevation-sm),var(--edge-highlight)] transition-colors hover:bg-[var(--fill-subtle)]"
        style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}
      >
        <span>
          <span className="block text-sm font-semibold" style={{ color: "var(--color-fg)" }}>Your full report</span>
          <span className="mt-0.5 block text-xs" style={{ color: "var(--color-muted)" }}>
            What you offer, who it&apos;s for, where to reach them, strengths &amp; weaknesses, and your action plan.
          </span>
        </span>
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden style={{ color: "var(--color-accent-400)" }}>
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
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
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-8 py-6">
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
