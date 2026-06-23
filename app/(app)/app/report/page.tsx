/**
 * Report page — the "deep dive on you" view (Glassy Bento P3). The four-question
 * prose (offer / audience / where / strengths / action plan) plus market trends
 * and engagement, relocated off the dashboard so the dashboard stays a lean
 * above-the-fold overview. Reached via the dashboard's "Your report →" card.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { entitlementsFor, redactReportForTier } from "@/lib/billing/entitlements";
import { isPaid } from "@/lib/billing/tiers";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import { engagementSummary } from "@/lib/scan/engagement";
import { marketTrendSeries } from "@/lib/scan/market-trends";
import { WhatYouOfferSection } from "@/components/report/what-you-offer-section";
import { WhoItsForSection } from "@/components/report/who-its-for-section";
import { WhereTheyAreSection } from "@/components/report/where-they-are-section";
import { StrengthsWeaknessesSection } from "@/components/report/strengths-weaknesses-section";
import { ActionPlanSection } from "@/components/report/action-plan-section";
import { MarketTrends } from "@/components/app/market-trends";
import { EngagementStrip } from "@/components/app/engagement-strip";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";
import { ResultsScreen } from "@/components/report/captured/results-screen";
import { toResultsProps } from "@/components/report/captured/to-results-props";

export const metadata = buildMetadata({ title: "Report", path: "/app/report" });

async function ReportContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app/report");

  const { user } = viewer;
  const entitlements = await entitlementsFor(user.id);
  const tier = entitlements.active ? entitlements.tier : "free";
  const userIsPaid = isPaid(tier);
  const primaryAppId = await activeAppId(user);
  if (!primaryAppId) redirect("/app");

  const { data: scanRow } = await serverDb()
    .from("scans")
    .select("report_payload")
    .eq("app_id", primaryAppId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!scanRow?.report_payload) redirect("/app");

  const fullReport = scanRow.report_payload as unknown as ReportPayload;
  const report = redactReportForTier(fullReport, tier);
  const { data: appRow } = await serverDb().from("apps").select("name, store_url").eq("id", primaryAppId).maybeSingle();
  const siteLabel = appRow?.name ?? appRow?.store_url ?? "your site";
  const fullActions =
    fullReport.whatToDoThisWeek.quickWins.length +
    fullReport.whatToDoThisWeek.medium.length +
    fullReport.whatToDoThisWeek.longPlay.length;

  void WhatYouOfferSection; void WhoItsForSection; void WhereTheyAreSection;
  void StrengthsWeaknessesSection; void ActionPlanSection; void MarketTrends;
  void EngagementStrip; void engagementSummary; void marketTrendSeries; void userIsPaid;

  // Paid viewers get the fully-unlocked report; free/trial users upgrade (no
  // second trial — they're already customers).
  return (
    <ResultsScreen
      {...toResultsProps(report, siteLabel, fullActions)}
      hideUnlock={userIsPaid}
      unlockTitle="Upgrade to unlock the full report"
      unlockSub="See the full 18-signal breakdown, weekly tracking, and verification — upgrade your plan to continue."
      unlockButton={
        userIsPaid ? undefined : (
          <a href="/app/billing" style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 15, color: "#14131A", background: "#fff", borderRadius: 10, padding: "13px 24px", whiteSpace: "nowrap", textDecoration: "none" }}>
            Upgrade plan →
          </a>
        )
      }
    />
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border p-7" style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}>
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="mb-2 h-5 w-44" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default function ReportPage() {
  return (
    <div style={{ margin: "-26px -28px -60px" }}>
      <Suspense fallback={<ReportSkeleton />}>
        <ReportContent />
      </Suspense>
    </div>
  );
}
