/**
 * Score history page — the captured "History" tab (score-over-time chart + scan
 * timeline + predicted-vs-actual), wired to live engagement data. Renders inside
 * the captured AppShell (layout).
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { engagementSummary } from "@/lib/scan/engagement";
import { scoreHistoryMarkers } from "@/lib/scan/score-history-markers";
import { HistoryMain, type TimelineRow } from "@/components/app/captured/history-main";
import { HistorySkeleton } from "@/components/app/captured/skeletons";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Score history", path: "/app/history" });

async function HistoryContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app/history");
  const { user } = viewer;
  if (!user.onboarded_at) redirect("/app/onboarding");

  const primaryAppId = await activeAppId(user);
  if (!primaryAppId) {
    return (
      <div style={{ background: "#fff", border: "1px dashed #ECEAF3", borderRadius: 16, padding: "48px 24px", textAlign: "center", fontSize: 14, color: "#9A97A5" }}>
        Run your first scan to start building a score history.
      </div>
    );
  }

  const [engagement, markers] = await Promise.all([
    engagementSummary(primaryAppId),
    scoreHistoryMarkers(primaryAppId),
  ]);
  const points = engagement.history; // oldest-first

  const chartHistory = points.map((h, i, arr) => ({ label: i === arr.length - 1 ? "now" : `w${i + 1}`, score: h.total }));
  const chartMarkers = markers
    .map((m) => ({ index: points.findIndex((h) => h.takenAt === m.takenAt), label: m.label.split(" ").slice(0, 2).join(" ") }))
    .filter((m) => m.index >= 0);

  // Scan timeline — newest first, with deltas + notes.
  const markerByTaken = new Map(markers.map((m) => [m.takenAt, m.label]));
  const newest = [...points].reverse();
  const timeline: TimelineRow[] = newest.map((h, i) => {
    const older = newest[i + 1];
    const delta = older ? h.total - older.total : null;
    const when = i === 0 ? "This week" : i === 1 ? "Last week" : `${i} weeks ago`;
    const fix = markerByTaken.get(h.takenAt);
    const note = delta === null ? "First scan" : fix ? `Verified: ${fix}` : delta > 0 ? "Fixes shipped" : "No fixes shipped";
    return { when, score: h.total, delta, note };
  });

  return (
    <HistoryMain
      history={chartHistory}
      markers={chartMarkers}
      timeline={timeline}
      accuracy={[]}
      modelAccuracy={null}
    />
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <HistoryContent />
    </Suspense>
  );
}
