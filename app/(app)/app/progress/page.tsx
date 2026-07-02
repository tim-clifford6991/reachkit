import { Suspense } from "react";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { serverDb } from "@/lib/db/client";
import { engagementSummary, type ScoreHistoryPoint } from "@/lib/scan/engagement";
import { scoreHistoryMarkers, type HistoryMarker } from "@/lib/scan/score-history-markers";
import { computeMarketAlerts } from "@/lib/scan/market";
import { ProgressView, type ProgressEvent } from "@/components/app/intel/progress-view";
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

/** Score delta at a history index vs. the prior point, or null at index 0. */
function deltaAt(history: ScoreHistoryPoint[], idx: number): number | null {
  if (idx <= 0 || idx >= history.length) return null;
  return history[idx]!.total - history[idx - 1]!.total;
}

/** Verified-fix markers → changelog events, each carrying the score delta the fix produced. */
function eventsFromMarkers(history: ScoreHistoryPoint[], markers: HistoryMarker[]): ProgressEvent[] {
  return markers.map((m) => {
    const idx = history.findIndex((p) => p.takenAt === m.takenAt);
    const delta = idx >= 0 ? deltaAt(history, idx) : null;
    return {
      label: m.label,
      date: m.takenAt,
      ...(delta !== null ? { delta } : {}),
    };
  });
}

async function ProgressContent() {
  const ctx = await resolveIntelContext("/app/progress");

  const [engagement, markers, snapshots] = await Promise.all([
    engagementSummary(ctx.appId),
    scoreHistoryMarkers(ctx.appId),
    serverDb()
      .from("market_snapshots")
      .select("taken_at, summary")
      .eq("app_id", ctx.appId)
      .order("taken_at", { ascending: false })
      .limit(2),
  ]);

  const events: ProgressEvent[] = eventsFromMarkers(engagement.history, markers);

  // Week-over-week competitive alerts, when two consecutive snapshots exist.
  const rows = snapshots.data ?? [];
  if (rows.length === 2) {
    const [latest, prior] = rows as [{ taken_at: string; summary: unknown }, { taken_at: string; summary: unknown }];
    const alerts = computeMarketAlerts(
      prior.summary as unknown as Parameters<typeof computeMarketAlerts>[0],
      latest.summary as unknown as Parameters<typeof computeMarketAlerts>[1],
    );
    for (const alert of alerts) {
      events.push({ label: alert.message, date: latest.taken_at });
    }
  }

  // Newest first, matching the template's "What changed" ordering.
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return <ProgressView history={engagement.history} markers={markers} events={events} />;
}
