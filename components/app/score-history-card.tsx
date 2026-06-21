"use client";

/**
 * ScoreHistoryCard — dashboard card wrapping the (lazy-loaded) Recharts
 * ScoreHistoryChart so recharts stays out of the initial /app chunk.
 */

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScoreHistoryPoint } from "@/lib/scan/engagement";

const ScoreHistoryChart = dynamic(
  () => import("@/components/charts/score-history-chart").then((m) => m.ScoreHistoryChart),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full rounded-lg" /> },
);

export function ScoreHistoryCard({ history }: { history: ScoreHistoryPoint[] }) {
  return (
    <section
      className="rounded-2xl border p-5 shadow-[var(--elevation-sm),var(--edge-highlight)]"
      style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}
      aria-label="Score history"
    >
      <p
        className="mb-3 font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-muted)" }}
      >
        Score history
      </p>
      <ScoreHistoryChart history={history} />
    </section>
  );
}
