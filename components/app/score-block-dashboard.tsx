"use client";

/**
 * ScoreBlockDashboard — lazy-loaded DiscoverabilityScore for the dashboard.
 *
 * Mirrors the scan/results ScoreBlock pattern: lazy-loads the motion-heavy
 * DiscoverabilityScore component so motion/react stays out of the initial
 * /(app) chunk (bundle budget: 220KB). Shows a skeleton while loading.
 *
 * The outer ring SVG carries view-transition-name="score-circle" (set inside
 * DiscoverabilityScore) so the Score MORPHS from /scan/[id]/results → /app.
 */

import dynamic from "next/dynamic";
import type { VerifiedScore } from "@/lib/scan/score-full";
import { Skeleton } from "@/components/ui/skeleton";

const DiscoverabilityScore = dynamic(
  () =>
    import("@/components/report/discoverability-score").then(
      (m) => m.DiscoverabilityScore,
    ),
  {
    ssr: false,
    loading: () => <ScoreSkeleton />,
  },
);

interface ScoreBlockDashboardProps {
  score: VerifiedScore;
}

export function ScoreBlockDashboard({ score }: ScoreBlockDashboardProps) {
  return (
    <div
      className="flex flex-col items-center rounded-xl border py-10"
      style={{
        borderColor: "var(--color-accent-900)",
        background:
          "linear-gradient(135deg, var(--color-surface) 0%, oklch(0.145 0.018 255) 100%)",
      }}
    >
      <p
        className="mb-6 font-mono text-xs uppercase tracking-widest"
        style={{ color: "var(--color-muted)" }}
      >
        Discoverability score
      </p>

      <DiscoverabilityScore score={score} size="lg" />

      <p
        className="mt-6 max-w-xs text-center text-xs leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        Score based on verified content, outreach, and SEO signals.
        Work through the plays below to move it.
      </p>
    </div>
  );
}

// Skeleton shown while the lazy component hydrates
function ScoreSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Skeleton className="size-[200px] rounded-full" />
      <Skeleton className="h-[260px] w-[260px] rounded-xl" />
      <div className="w-full max-w-[220px] space-y-2">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-2 w-[70%]" />
        <Skeleton className="h-2 w-[55%]" />
      </div>
    </div>
  );
}
