import { Suspense } from "react";
import Link from "next/link";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { serverDb } from "@/lib/db/client";
import { engagementSummary } from "@/lib/scan/engagement";
import { scoreHistoryMarkers } from "@/lib/scan/score-history-markers";
import { pillarRollup, type ScoreBreakdown } from "@/lib/scan/pillar-scores";
import { actionBoard } from "@/lib/scan/action-board";
import { DashboardHero } from "@/components/app/intel/dashboard-hero";
import { DashboardIntelBlocks } from "@/components/app/intel/dashboard-view";
import { WeekPlanPreview } from "@/components/app/intel/week-plan-preview";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Dashboard", path: "/app/dashboard" });

/**
 * Dashboard home — the templated Analytics Dashboard, wired to live data. The
 * scan-side hero (score + pillars + weakest lever + trend) renders server-side
 * and instantly; the intel-side blocks (competitors, traffic, keyword gap) stream
 * in below via the shared `supply` layer. Auth/onboarding/app gating is handled by
 * resolveIntelContext, the same as the four detail tabs.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const ctx = await resolveIntelContext("/app/dashboard");

  // The scan (score hero) and the plan board ("what to do this week") are
  // independent reads — fetch them together.
  const [{ data: scan }, board] = await Promise.all([
    serverDb()
      .from("scans")
      .select("score_total, score_breakdown")
      .eq("app_id", ctx.appId)
      .not("completed_at", "is", null)
      .not("score_total", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    actionBoard(ctx.appId),
  ]);

  // No completed scan yet — the score story has nothing to show, but the plan
  // card (actions can arrive via "Add to plan" chips before a scan) and the
  // intel blocks (which don't depend on a scan) still render below the notice.
  if (!scan || scan.score_total == null) {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "48px 24px", textAlign: "center", border: "1px dashed var(--c-line)", borderRadius: "var(--radius-xl)", background: "var(--c-surface)" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", margin: 0 }}>Your Discoverability Score appears here after your first scan.</p>
          <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: 0, maxWidth: 360 }}>Run a scan to see your score, pillar breakdown, and biggest lever.</p>
          <Link href="/" style={{ marginTop: 6, background: "var(--c-action)", color: "var(--c-on-dark)", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, padding: "8px 14px", borderRadius: "var(--radius-lg)", textDecoration: "none" }}>Run a scan</Link>
        </div>
        <div style={{ marginTop: 20 }}>
          <WeekPlanPreview board={board} />
        </div>
        <DashboardIntelBlocks />
      </>
    );
  }

  // Tier gate for the hero CTA: paid → plan link; free → one-click Solo
  // checkout (W6). resolveIntelContext already redirected unauthenticated users.
  const viewer = await currentUser();
  const [engagement, markers, entitlements] = await Promise.all([
    engagementSummary(ctx.appId),
    scoreHistoryMarkers(ctx.appId),
    viewer ? entitlementsFor(viewer.user.id) : Promise.resolve(null),
  ]);

  const rollup = pillarRollup(scan.score_breakdown as unknown as ScoreBreakdown | null);

  return (
    <>
      <DashboardHero
        score={scan.score_total}
        rollup={rollup}
        history={engagement.history}
        markers={markers}
        isPaid={entitlements?.active ?? false}
      />
      {/* The plan is what a founder acts on — it reads second, right after the score story. */}
      <div style={{ marginTop: 20 }}>
        <WeekPlanPreview board={board} />
      </div>
      <DashboardIntelBlocks />
    </>
  );
}
