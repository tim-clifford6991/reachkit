import { Suspense } from "react";
import Link from "next/link";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { currentUser } from "@/lib/auth/server";
import { isOwner } from "@/lib/auth/owner";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { serverDb } from "@/lib/db/client";
import { engagementSummary } from "@/lib/scan/engagement";
import { scoreHistoryMarkers } from "@/lib/scan/score-history-markers";
import { buildProgressEvents } from "@/lib/scan/progress-events";
import { type ScoreBreakdown } from "@/lib/scan/pillar-scores";
import { buildDashboardHeroProps } from "@/lib/app/dashboard-hero-props";
import { buildRankTargets } from "@/lib/app/rank-targets-props";
import { WhatToRankFor } from "@/components/app/intel/rank-targets";
import type { ReportPayload } from "@/lib/scan/report";
import type { Pillar } from "@/lib/scan/signals";
import { actionBoard } from "@/lib/scan/action-board";
import { hostname } from "@/lib/scan/url";
import { DashboardHero } from "@/components/app/intel/dashboard-hero";
import { DashboardIntelBlocks } from "@/components/app/intel/dashboard-view";
import { WeekPlanPreviewLazy as WeekPlanPreview } from "@/components/app/week-plan-preview-lazy";
import { ScanCurrentButton } from "@/components/app/scan-current-button";
import { DashboardScanProgressLazy as DashboardScanProgress } from "@/components/app/dashboard-scan-progress-lazy";
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

/**
 * Id of the most recent terminal (`done`/`error`) event for a scan, or 0.
 *
 * The progress stream's resume cursor. `scan_events` is append-only PER SCAN ID
 * and a scan can run more than once against that id (the free pass, then the
 * paid deepen), so the log holds a `done` from the earlier run. Everything after
 * that id is exactly the current run.
 */
async function lastTerminalEventId(scanId: string): Promise<number> {
  const { data } = await serverDb()
    .from("scan_events")
    .select("id")
    .eq("scan_id", scanId)
    .in("type", ["done", "error"])
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as number | undefined) ?? 0;
}

async function DashboardContent() {
  const ctx = await resolveIntelContext("/app/dashboard");

  // The scan (score hero), the plan board, and "is a scan running RIGHT NOW" are
  // independent reads — fetch them together.
  //
  // The in-flight read is deliberately INDEPENDENT of the completed scan. It used
  // to live inside the `score_total == null` branch, which asks "was this app EVER
  // scanned?" — not "is a scan running?". Those diverge for every RE-scan and every
  // deepen of an already-scored app: the row already has a score, so the branch was
  // structurally unreachable and the progress UI could never render. That shipped:
  // adding a product with an existing free scan (resolveProductScan → `deepen`) ran
  // an ~80s deep pass with ZERO feedback while the stale free report sat on screen —
  // reported as "it did not process" when in fact it processed perfectly.
  const [{ data: scan }, board, { data: inflight }] = await Promise.all([
    serverDb()
      .from("scans")
      .select("id, score_total, score_breakdown, report_payload")
      .eq("app_id", ctx.appId)
      .not("completed_at", "is", null)
      .not("score_total", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    actionBoard(ctx.appId),
    serverDb()
      .from("scans")
      .select("id, tier, started_at")
      .eq("app_id", ctx.appId)
      .not("status", "in", "(done,failed,degraded)")
      .order("started_at", { ascending: false, nullsFirst: true })
      .limit(1)
      .maybeSingle(),
  ]);

  // Resume cursor for the progress stream. `scan_events` accumulates ACROSS runs
  // for one scan id (a deepen appends to the free scan's event log), so tailing
  // from 0 replays the PREVIOUS run's terminal `done` — the client would settle
  // instantly, refresh, find the scan still in flight, re-render progress, and
  // replay that same `done` again: an infinite refresh loop. Resume from the last
  // terminal event instead, so the client sees exactly this run's events.
  const sinceId = inflight ? await lastTerminalEventId(inflight.id) : 0;

  // No completed scan yet — the score story has nothing to show, but the plan
  // card (actions can arrive via "Add to plan" chips before a scan) and the
  // intel blocks (which don't depend on a scan) still render below the notice.
  if (!scan || scan.score_total == null) {
    // A scan is already running (e.g. just triggered from here, or from
    // /app/add) — render its live progress IN SHELL, never eject to the
    // entitlement-blind public /scan/<id> page (see docs/superpowers/specs/
    // 2026-07-15-add-product-onboarding-design.md §4). Otherwise offer the
    // one-click on-demand scan.
    if (inflight) {
      return (
        <>
          <DashboardScanProgress
            scanId={inflight.id}
            tier={inflight.tier === "full" ? "full" : "free"}
            host={ctx.domain ? hostname(ctx.domain) : null}
            sinceId={sinceId}
            startedAt={inflight.started_at}
          />
          <div style={{ marginTop: 20 }}>
            <WeekPlanPreview board={board} />
          </div>
          <DashboardIntelBlocks />
        </>
      );
    }

    const CTA_STYLE = { marginTop: 6, background: "var(--c-action)", color: "var(--c-on-dark)", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, padding: "8px 14px", borderRadius: "var(--radius-lg)", textDecoration: "none", border: "none" } as const;
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "48px 24px", textAlign: "center", border: "1px dashed var(--c-line)", borderRadius: "var(--radius-xl)", background: "var(--c-surface)" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", margin: 0 }}>Your Discoverability Score appears here after your first scan.</p>
          <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: 0, maxWidth: 360 }}>One scan reads your live page — score, pillar breakdown, competitors, and your biggest lever.</p>
          <ScanCurrentButton style={CTA_STYLE} />
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
  const [engagement, markers, entitlements, marketSnapshots] = await Promise.all([
    engagementSummary(ctx.appId),
    scoreHistoryMarkers(ctx.appId),
    viewer ? entitlementsFor(viewer.user.id) : Promise.resolve(null),
    serverDb()
      .from("market_snapshots")
      .select("taken_at, summary")
      .eq("app_id", ctx.appId)
      .order("taken_at", { ascending: false })
      .limit(2),
  ]);
  const events = buildProgressEvents({
    history: engagement.history,
    markers,
    marketSnapshots: marketSnapshots.data ?? [],
  });

  // The GAUGE's on-page driver is the FIXED on-site basis (headlineScore) — the 8
  // HTML signals measured identically free↔paid, so the gauge never jumps on
  // upgrade (invariant #1). The PILLAR BARS are a separate, honest decomposition of
  // ALL measured signals (registryScore over the full set): Content/SEO measured
  // values are identical to the fixed basis (unmeasured signals are excluded either
  // way), and Outreach now shows its measured signal (e.g. comparison_pages) instead
  // of dead-ending on "measured off-site" (R1, 2026-07-17). A pillar with ZERO
  // measured signals is omitted, never rendered as "not measured yet".
  const { data: sigRows } = await serverDb()
    .from("scan_signals")
    .select("signal_key, pillar, weight, normalised, state")
    .eq("scan_id", scan.id);
  const rows = (sigRows ?? []).map((r) => ({
    signalKey: (r.signal_key as string | null) ?? undefined,
    pillar: r.pillar as Pillar,
    weight: (r.weight as number | null) ?? 0,
    normalised: r.normalised as number | null,
    state: (r.state as string | null) ?? "unmeasured",
  }));
  // ONE pure builder (extracted so the paid-surface acceptance rubric drives
  // this exact production computation — see lib/app/dashboard-hero-props.ts).
  // The gauge stays the UNIFIED Discoverability Score v5 (invariant #1).
  const heroScore = buildDashboardHeroProps({
    signalRows: rows,
    scoreTotal: scan.score_total,
    scoreBreakdown: scan.score_breakdown as unknown as ScoreBreakdown | null,
    reportPayload: scan.report_payload as ReportPayload | null,
  });

  return (
    <>
      {/* A scan is running over an app that ALREADY has a score — a re-scan or a
          paid deepen. Show it. The hero below stays readable (it's real, just
          about to be superseded) rather than being replaced by a spinner, but the
          user is never again left staring at stale numbers with no indication
          that work is happening. */}
      {inflight && (
        <div style={{ marginBottom: 20 }}>
          <DashboardScanProgress
            scanId={inflight.id}
            tier={inflight.tier === "full" ? "full" : "free"}
            host={ctx.domain ? hostname(ctx.domain) : null}
            sinceId={sinceId}
            startedAt={inflight.started_at}
            refreshing
          />
        </div>
      )}
      <DashboardHero
        {...heroScore}
        history={engagement.history}
        markers={markers}
        isPaid={entitlements?.active ?? false}
        events={events}
      />
      {/* "You vs. top competitors" reads directly under the score (owner 2026-07-27,
          all viewports): the founder's standing against rivals is the first context
          after their own number. It streams in (client intel fetch), so it skeletons
          below the hero rather than blocking it. */}
      <div style={{ marginTop: 20 }}>
        <DashboardIntelBlocks />
      </div>
      {/* The growth engine: score → WHAT to rank for (the target searches) → the
          PLAN to win them. "What to rank for" reads after the standing so the
          founder sees the specific moves before the calendar that schedules them. */}
      <div style={{ marginTop: 20 }}>
        <WhatToRankFor {...buildRankTargets(scan.report_payload as ReportPayload | null)} />
      </div>
      {/* The plan is what a founder acts on — it reads second, right after the score story. */}
      <div style={{ marginTop: 20 }}>
        <WeekPlanPreview board={board} />
      </div>
      {isOwner(viewer?.user.email) && (
        <p style={{ marginTop: 18, textAlign: "center", fontSize: 11.5, color: "var(--c-faint)" }}>
          <Link href="/app/diagnostics" style={{ color: "var(--c-faint)", textDecoration: "none" }}>Scan diagnostics →</Link>
        </p>
      )}
    </>
  );
}
