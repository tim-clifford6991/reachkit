/**
 * Score history page — promotes the dashboard's score-history card into a
 * dedicated view (per ReachKit.dc.html's History tab): the full trend chart
 * plus a scan-by-scan timeline. Honest + data-backed — every row is a real
 * score_snapshot; verified-fix markers come from action-linked snapshots.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { engagementSummary, type ScoreHistoryPoint } from "@/lib/scan/engagement";
import { scoreHistoryMarkers } from "@/lib/scan/score-history-markers";
import { bandFor } from "@/lib/scan/score-bands";
import { ScoreHistoryCard } from "@/components/app/score-history-card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Score history", path: "/app/history" });

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function ScanTimeline({ points }: { points: ScoreHistoryPoint[] }) {
  // points oldest-first; render newest-first with the delta vs the prior scan.
  const rows = points
    .map((p, i) => ({ ...p, delta: i > 0 ? p.total - points[i - 1]!.total : null }))
    .reverse();

  return (
    <section
      className="rounded-2xl border p-6 shadow-[var(--elevation-md),var(--edge-highlight)]"
      style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
      aria-label="Scan timeline"
    >
      <p className="mb-4 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
        Scan timeline
      </p>
      <ol className="space-y-0">
        {rows.map((r, i) => {
          const band = bandFor(r.total);
          return (
            <li key={`${r.takenAt}-${i}`} className="flex items-center gap-4 py-3" style={{ borderTop: i === 0 ? "none" : "1px solid var(--hairline)" }}>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: band.color }} aria-hidden />
              <span className="w-28 shrink-0 text-sm" style={{ color: "var(--color-muted)" }}>
                {fmtDate(r.takenAt)}
              </span>
              <span className="font-mono text-lg tabular-nums" style={{ color: band.color }}>
                {r.total}
              </span>
              <span className="flex-1 text-sm" style={{ color: "var(--color-fg)" }}>
                {band.label}
              </span>
              {r.delta !== null && r.delta !== 0 && (
                <span
                  className="font-mono text-xs tabular-nums"
                  style={{ color: r.delta > 0 ? "var(--color-success)" : "var(--color-danger)" }}
                >
                  {r.delta > 0 ? `▲ +${r.delta}` : `▼ −${Math.abs(r.delta)}`}
                </span>
              )}
              {r.delta === null && (
                <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
                  Baseline
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

async function HistoryContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app/history");
  const { user } = viewer;
  if (!user.onboarded_at) redirect("/app/onboarding");

  const primaryAppId = await activeAppId(user);
  if (!primaryAppId) {
    return (
      <div
        className="rounded-2xl border border-dashed px-8 py-12 text-center text-sm"
        style={{ borderColor: "var(--hairline)", color: "var(--color-muted)" }}
      >
        Run your first scan to start building a score history.
      </div>
    );
  }

  const [engagement, markers] = await Promise.all([
    engagementSummary(primaryAppId),
    scoreHistoryMarkers(primaryAppId),
  ]);
  const history = engagement.history; // oldest-first

  return (
    <div className="space-y-6">
      <ScoreHistoryCard history={history} markers={markers} />
      {history.length > 0 && <ScanTimeline points={history} />}
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[300px] w-full rounded-2xl" />
      <Skeleton className="h-[240px] w-full rounded-2xl" />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-8 py-6">
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryContent />
      </Suspense>
    </div>
  );
}
