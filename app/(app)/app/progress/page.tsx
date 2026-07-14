import { Suspense } from "react";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { serverDb } from "@/lib/db/client";
import { engagementSummary } from "@/lib/scan/engagement";
import { scoreHistoryMarkers } from "@/lib/scan/score-history-markers";
import { buildProgressEvents } from "@/lib/scan/progress-events";
import { signalChanges } from "@/lib/scan/signal-diff";
import { ProgressView } from "@/components/app/intel/progress-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Progress", path: "/app/progress" });

/**
 * Progress — the Discoverability Score history: a large annotated trend chart
 * plus a "What changed" changelog built from verified-fix markers and (when
 * two consecutive weekly market snapshots exist) week-over-week competitive
 * alerts. Mirrors the dashboard page's server-read pattern (resolveIntelContext
 * gating, then a Promise.all of cheap Supabase reads — no live gather here).
 */
export default function ProgressPage() {
  return (
    <Suspense fallback={null}>
      <ProgressContent />
    </Suspense>
  );
}

async function ProgressContent() {
  const ctx = await resolveIntelContext("/app/progress");

  const [engagement, markers, snapshots, signalDiff] = await Promise.all([
    engagementSummary(ctx.appId),
    scoreHistoryMarkers(ctx.appId),
    serverDb()
      .from("market_snapshots")
      .select("taken_at, summary")
      .eq("app_id", ctx.appId)
      .order("taken_at", { ascending: false })
      .limit(2),
    signalChanges(ctx.appId),
  ]);

  const rows = snapshots.data ?? [];
  const events = buildProgressEvents({ history: engagement.history, markers, marketSnapshots: rows });

  return <ProgressView history={engagement.history} markers={markers} events={events} signalChanges={signalDiff} />;
}
