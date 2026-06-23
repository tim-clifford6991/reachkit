/**
 * Actions / "This week's plays" — the captured "Actions" tab (queue summary +
 * onboarding banner + Open list), wired to the live report's ranked actions.
 * Renders inside the captured AppShell. Paid surface (free → upgrade wall).
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { serverDb } from "@/lib/db/client";
import { assembleWeeklyPlan } from "@/lib/scan/weekly-plan";
import type { ReportPayload } from "@/lib/scan/report";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";
import { ActionsMain, type OpenAction } from "@/components/app/captured/actions-main";
import Link from "next/link";

export const metadata = buildMetadata({ title: "This week's plays", path: "/app/plays" });

const CAT: Record<string, string> = { content: "Content", outreach: "Outreach", seo_aso: "SEO" };
const effLabel = (m: number) => (m < 30 ? "Quick" : m <= 120 ? "Medium" : "Deep");

async function PlaysContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app/plays");
  const { user } = viewer;
  const entitlements = await entitlementsFor(user.id);
  if (!entitlements.active) return <PlaysUpgradeWall />;

  const primaryAppId = await activeAppId(user);
  if (!primaryAppId) return <PlaysEmpty label="Run your first scan to build your action queue." />;

  const db = serverDb();
  const { data: scanRow } = await db
    .from("scans")
    .select("report_payload")
    .eq("app_id", primaryAppId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!scanRow?.report_payload) return <PlaysEmpty label="No report yet — your queue arrives with your first scan." />;

  const report = scanRow.report_payload as unknown as ReportPayload;
  // Predicted-delta lookup (the weekly plan carries no delta; the report does).
  const deltaByTitle = new Map<string, number>();
  [...report.whatToDoThisWeek.quickWins, ...report.whatToDoThisWeek.medium, ...report.whatToDoThisWeek.longPlay].forEach(
    (a) => deltaByTitle.set(a.title, a.expectedOutcome?.delta ?? 0),
  );

  // Open queue from the weekly plan — these carry the real action `id` for the
  // Mark-done → /api/action/[id]/complete flow.
  const plan = await assembleWeeklyPlan(primaryAppId);
  const planActions = [...plan.queue.quickWins, ...plan.queue.medium, ...plan.queue.longPlay];
  const open: OpenAction[] = planActions
    .map((a) => ({ a, pred: deltaByTitle.get(a.title) ?? 0 }))
    .sort((x, y) => y.pred - x.pred)
    .map(({ a, pred }, i) => ({
      id: a.id,
      rank: i + 1,
      title: a.title,
      why: a.why ?? "",
      effort: effLabel(a.effortMin ?? 30),
      pillar: CAT[a.category] ?? a.category,
      pred,
    }));
  const totalWorth = open.reduce((s, a) => s + a.pred, 0);
  const refreshDays = ((8 - new Date().getUTCDay()) % 7) || 7;

  return (
    <ActionsMain
      doneSummary={`0 of ${open.length} verified · est. +${totalWorth} score still in your queue`}
      refreshLabel={`Refreshes in ${refreshDays} days`}
      showOnboarding={open.length > 0}
      open={open}
    />
  );
}

function PlaysEmpty({ label }: { label: string }) {
  return (
    <div style={{ background: "#fff", border: "1px dashed #ECEAF3", borderRadius: 16, padding: "48px 24px", textAlign: "center", fontSize: 14, color: "#9A97A5" }}>
      {label}
    </div>
  );
}

function PlaysUpgradeWall() {
  return (
    <div style={{ maxWidth: 560, margin: "40px auto 0", background: "#fff", border: "1px solid #ECEAF3", borderRadius: 18, padding: "36px 32px", textAlign: "center" }}>
      <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 20, color: "#14131A" }}>Your weekly action queue is a paid surface</div>
      <p style={{ fontSize: 14.5, color: "#56535F", margin: "10px auto 20px", maxWidth: 420 }}>
        Upgrade to get a ranked, drafted queue every week — and verification that each fix actually shipped.
      </p>
      <Link href="/app/billing" style={{ display: "inline-block", fontFamily: "Plus Jakarta Sans", fontWeight: 700, fontSize: 15, color: "#fff", background: "#6E56F7", borderRadius: 10, padding: "12px 22px", textDecoration: "none" }}>
        Upgrade →
      </Link>
    </div>
  );
}

export default function PlaysPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-2xl" />}>
      <PlaysContent />
    </Suspense>
  );
}
