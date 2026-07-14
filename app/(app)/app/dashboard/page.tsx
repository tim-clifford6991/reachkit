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
import { pillarRollupFromRegistry, type ScoreBreakdown } from "@/lib/scan/pillar-scores";
import { headlineScore, discoverabilityScore } from "@/lib/scan/registry-score";
import type { Pillar } from "@/lib/scan/signals";
import { actionBoard } from "@/lib/scan/action-board";
import { DashboardHero } from "@/components/app/intel/dashboard-hero";
import { DashboardIntelBlocks } from "@/components/app/intel/dashboard-view";
import { WeekPlanPreviewLazy as WeekPlanPreview } from "@/components/app/week-plan-preview-lazy";
import { ScanCurrentButton } from "@/components/app/scan-current-button";
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
      .select("id, score_total, score_breakdown, report_payload")
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
    // Is a scan already running (e.g. just triggered from here)? If so, invite
    // the user to watch it; otherwise offer the one-click on-demand scan.
    const { data: inflight } = await serverDb()
      .from("scans")
      .select("id")
      .eq("app_id", ctx.appId)
      .not("status", "in", "(done,failed,degraded)")
      .order("started_at", { ascending: false, nullsFirst: true })
      .limit(1)
      .maybeSingle();
    const CTA_STYLE = { marginTop: 6, background: "var(--c-action)", color: "var(--c-on-dark)", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, padding: "8px 14px", borderRadius: "var(--radius-lg)", textDecoration: "none", border: "none" } as const;
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "48px 24px", textAlign: "center", border: "1px dashed var(--c-line)", borderRadius: "var(--radius-xl)", background: "var(--c-surface)" }}>
          {inflight ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", margin: 0 }}>Scanning your product…</p>
              <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: 0, maxWidth: 360 }}>Your score, competitors, and plan appear here the moment it finishes.</p>
              <Link href={`/scan/${inflight.id}`} style={CTA_STYLE}>Watch progress →</Link>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)", margin: 0 }}>Your Discoverability Score appears here after your first scan.</p>
              <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: 0, maxWidth: 360 }}>One scan reads your live page — score, pillar breakdown, competitors, and your biggest lever.</p>
              <ScanCurrentButton style={CTA_STYLE} />
            </>
          )}
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

  // Pillar rollup + gauge from the FIXED on-site basis (headlineScore) — the 8 HTML
  // signals measured identically free↔paid. The gauge shows the SAME on-site total
  // the pillars decompose (gauge == pillar average), and it does NOT move when the
  // paid deep pass measures off-site signals — those are the separate Market
  // Position grade below. Outreach has no on-site signal, so it reads "measured
  // off-site" (see Market position); Content + SEO carry the on-site headline.
  const { data: sigRows } = await serverDb()
    .from("scan_signals")
    .select("signal_key, pillar, weight, normalised, state")
    .eq("scan_id", scan.id);
  const reg =
    sigRows && sigRows.length
      ? headlineScore(
          sigRows.map((r) => ({
            signalKey: (r.signal_key as string | null) ?? undefined,
            pillar: r.pillar as Pillar,
            weight: (r.weight as number | null) ?? 0,
            normalised: r.normalised as number | null,
            state: (r.state as string | null) ?? "unmeasured",
          })),
        )
      : null;
  const rollup = pillarRollupFromRegistry(reg, scan.score_breakdown as unknown as ScoreBreakdown | null);
  // The gauge is the UNIFIED Discoverability Score (v5) — the SAME number the free
  // report + persisted `score_total`/trend show, so the score never jumps between
  // surfaces. reg.total is the on-page *driver* (the pillars decompose it); we fold
  // in the persisted search-presence half via the geomean. Falls back to the
  // persisted score_total when no live signals exist.
  const searchPresence =
    (scan.report_payload as { searchVisibility?: { score?: number } | null } | null)?.searchVisibility?.score ?? null;
  const headline = reg
    ? searchPresence != null
      ? discoverabilityScore(reg.total, searchPresence)
      : reg.total
    : scan.score_total;
  // F2 — the paid off-site "Market position" grade, if the deep pass computed one.
  const marketPosition = (scan.report_payload as { marketPosition?: { total?: number } | null } | null)?.marketPosition?.total ?? null;

  return (
    <>
      <DashboardHero
        score={headline}
        rollup={rollup}
        history={engagement.history}
        markers={markers}
        isPaid={entitlements?.active ?? false}
        marketPosition={marketPosition}
        onPageReadiness={reg ? reg.total : null}
        searchPresence={searchPresence}
        events={events}
      />
      {/* The plan is what a founder acts on — it reads second, right after the score story. */}
      <div style={{ marginTop: 20 }}>
        <WeekPlanPreview board={board} />
      </div>
      <DashboardIntelBlocks />
      {isOwner(viewer?.user.email) && (
        <p style={{ marginTop: 18, textAlign: "center", fontSize: 11.5, color: "var(--c-faint)" }}>
          <Link href="/app/diagnostics" style={{ color: "var(--c-faint)", textDecoration: "none" }}>Scan diagnostics →</Link>
        </p>
      )}
    </>
  );
}
