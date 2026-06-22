/**
 * Market Report — the dedicated competitive-intelligence page (ChannelIntel UX).
 *
 * Promoted from the legacy "Where they are" (Q3) view. This is the focused home
 * for the market deep-dive (competitor profiles, benchmark + share-of-voice,
 * channel matrix, keyword gap, top pages, demand pockets, the Ease×Impact
 * playbook, recent buzz) so the dashboard can stay an overview. Route kept at
 * /app/channels for back-compat; the sidebar labels it "Market Report".
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { entitlementsFor, redactReportForTier } from "@/lib/billing/entitlements";
import { isPaid, TIER_LIMITS } from "@/lib/billing/tiers";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import { buildExecutiveSummary } from "@/lib/scan/report";
import { ExecutiveSummary } from "@/components/report/executive-summary";
import { SectionNav, buildSectionNavItems } from "@/components/report/section-nav";
import { MarketAnalysisSections } from "@/components/report/market-analysis-sections";
import { CompetitiveLandscapeSection } from "@/components/report/competitive-landscape-section";
import { ChannelOpportunitiesSection } from "@/components/report/channel-opportunities-section";
import { CreatorsToReachSection } from "@/components/report/creators-to-reach-section";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Market Report", path: "/app/channels" });

async function MarketReportContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app/channels");

  const { user } = viewer;
  const primaryAppId = await activeAppId(user);
  if (!primaryAppId) redirect("/app");

  const db = serverDb();
  const entitlements = await entitlementsFor(user.id);
  const tier = entitlements.active ? entitlements.tier : "free";
  const userIsPaid = isPaid(tier);

  const { data: scanRow } = await db
    .from("scans")
    .select("report_payload, rank_data_fetched_at, completed_at")
    .eq("app_id", primaryAppId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!scanRow?.report_payload) redirect("/app");

  const report = redactReportForTier(scanRow.report_payload as unknown as ReportPayload, tier);
  const dataAsOf =
    (scanRow.rank_data_fetched_at as string | null) ?? (scanRow.completed_at as string | null) ?? undefined;
  const navItems = buildSectionNavItems(report, { unlocked: userIsPaid });

  return (
    <div className="space-y-4">
      <ExecutiveSummary
        summary={buildExecutiveSummary(report)}
        availableAnchors={navItems.map((i) => i.id)}
      />
      <SectionNav items={navItems} />
      {report.market ? (
        <MarketAnalysisSections market={report.market} unlocked={userIsPaid} rankDepth={TIER_LIMITS[tier].rankDepth} dataAsOf={dataAsOf} />
      ) : (
        <>
          <CompetitiveLandscapeSection rows={report.competitiveLandscape} unlocked={userIsPaid} />
          <ChannelOpportunitiesSection data={report.channelOpportunities} unlocked={userIsPaid} />
          <CreatorsToReachSection creators={report.creatorsToReach} unlocked={userIsPaid} />
        </>
      )}
    </div>
  );
}

export default function MarketReportPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--color-fg)" }}>
          Who you&apos;re up against
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Your competitive position — benchmarks, channels, demand, and the ranked plays to close the gap.
        </p>
      </div>
      <Suspense fallback={<MarketReportSkeleton />}>
        <MarketReportContent />
      </Suspense>
    </div>
  );
}

function MarketReportSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border p-7" style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}>
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="mb-4 h-5 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
