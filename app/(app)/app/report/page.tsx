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
import { buildMetadata } from "@/lib/seo";
import { ResultsScreen } from "@/components/report/captured/results-screen";
import { toResultsProps } from "@/components/report/captured/to-results-props";
import { readSignalBreakdown } from "@/lib/scan/signal-breakdown";
import { CapturedSignalBreakdown } from "@/components/app/captured/signal-breakdown";
import { ReportSkeleton } from "@/components/app/captured/skeletons";

const PILLAR_LABEL: Record<string, string> = { seo: "SEO", content: "Content", outreach: "Outreach" };

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
    .select("id, report_payload")
    .eq("app_id", primaryAppId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!scanRow?.report_payload) redirect("/app");

  // Deep 18-signal breakdown (paid only — the full "how your score is calculated").
  const breakdownGroups = userIsPaid
    ? (await readSignalBreakdown(scanRow.id as string))
        .map((g) => ({ pillar: g.pillar, label: PILLAR_LABEL[g.pillar] ?? g.pillar, signals: g.signals.map((s) => ({ key: s.key, label: s.label, why: s.why, state: s.state, contribution: s.contribution, weight: s.weight })) }))
        .filter((g) => g.signals.length > 0)
    : [];

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

  // Paid viewers get the fully-unlocked report + the deep 18-signal breakdown;
  // free/trial users upgrade (no second trial — they're already customers).
  return (
    <>
      <ResultsScreen
        {...toResultsProps(report, siteLabel, fullActions)}
        embedded
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
      {breakdownGroups.length > 0 && <CapturedSignalBreakdown groups={breakdownGroups} />}
    </>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportContent />
    </Suspense>
  );
}
