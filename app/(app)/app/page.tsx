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
import { DashboardMain } from "@/components/app/captured/dashboard-main";
import { DashboardSkeleton } from "@/components/app/captured/skeletons";
import { MilestoneBanner } from "@/components/app/milestone-banner";
import { OnboardingChecklist } from "@/components/app/onboarding-checklist";
import { onboardingChecklist } from "@/lib/scan/onboarding-checklist";
import { activeAppId } from "@/lib/app/active-app";
import { PlaysPreview } from "@/components/app/plays-preview";
import { ExportButton } from "@/components/app/export-button";
import { WhatsChanged } from "@/components/app/whats-changed";
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

  // ── Map live data onto the captured DashboardMain ──
  const CAT: Record<string, string> = { content: "Content", outreach: "Outreach", seo_aso: "SEO" };
  const effLabel = (m: number) => (m < 30 ? "Quick" : m <= 120 ? "Medium" : "Deep");
  const b = report.score.breakdown;
  const dashActions = [
    ...report.whatToDoThisWeek.quickWins,
    ...report.whatToDoThisWeek.medium,
    ...report.whatToDoThisWeek.longPlay,
  ]
    .filter((a) => (a.expectedOutcome?.delta ?? 0) > 0)
    .sort((x, y) => (y.expectedOutcome?.delta ?? 0) - (x.expectedOutcome?.delta ?? 0));
  const dashHistory = engagement.history.map((h, i, arr) => ({
    label: i === arr.length - 1 ? "now" : `w${i + 1}`,
    score: h.total,
  }));
  const dashMarkers = markers
    .map((m) => ({
      index: engagement.history.findIndex((h) => h.takenAt === m.takenAt),
      label: m.label.split(" ").slice(0, 2).join(" "),
    }))
    .filter((m) => m.index >= 0);

  void breakdown; void kpiDeltas; void digest; void checklist; void weeklyPlan;
  void previewPlays; void dataAsOf; void hasMarket; void primaryAppId; void userIsPaid; void tier;

  return (
    <DashboardMain
      score={report.score.total}
      delta={scoreDelta}
      pillars={[
        { label: "Content", value: b.content },
        { label: "Outreach", value: b.outreach },
        { label: "SEO", value: b.seo },
      ]}
      nextAction={
        dashActions[0]
          ? {
              title: dashActions[0].title,
              meta: `${effLabel(dashActions[0].effortMin)} · ${CAT[dashActions[0].category] ?? dashActions[0].category} · predicted +${dashActions[0].expectedOutcome?.delta ?? 0}`,
            }
          : null
      }
      history={dashHistory}
      markers={dashMarkers}
      queue={dashActions.slice(0, 3).map((a, i) => ({
        rank: i + 1,
        title: a.title,
        effort: effLabel(a.effortMin),
        pillar: CAT[a.category] ?? a.category,
        pred: a.expectedOutcome?.delta ?? 0,
      }))}
    />
  );
}


// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AppDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
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
