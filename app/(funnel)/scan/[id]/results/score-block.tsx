"use client";

/**
 * ScoreBlock — lazy-loaded client wrapper for DiscoverabilityScore on the results page.
 *
 * Keeps motion/react out of the initial server chunk for the results route by
 * lazy-loading DiscoverabilityScore with next/dynamic. The shell renders
 * immediately (SSR-safe); the score visual hydrates client-side.
 *
 * This is the results page's primary "signature moment" — the verified score
 * with full radar + sweep animation (size="lg").
 */

import dynamic from "next/dynamic";
import type { VerifiedScore } from "@/lib/scan/score-full";

// Lazy-load DiscoverabilityScore — contains motion/react (SVG + springs)
const DiscoverabilityScore = dynamic(
  () =>
    import("@/components/report/discoverability-score").then(
      (m) => m.DiscoverabilityScore
    ),
  {
    ssr: false,
    loading: () => <ScoreBlockSkeleton />,
  }
);

interface ScoreBlockProps {
  score: VerifiedScore;
}

export function ScoreBlock({ score }: ScoreBlockProps) {
  return (
    <div
      className="flex flex-col items-center rounded-xl border py-10"
      style={{
        borderColor: "var(--color-accent-900)",
        background:
          "linear-gradient(135deg, var(--color-surface) 0%, var(--color-elevated) 100%)",
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
        Fix the actions below to move it.
      </p>
    </div>
  );
}

// Skeleton shown while the lazy component hydrates
function ScoreBlockSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Ring placeholder */}
      <div
        className="h-[200px] w-[200px] animate-pulse rounded-full"
        style={{ background: "var(--fill-subtle)" }}
        aria-hidden="true"
      />
      {/* Radar placeholder */}
      <div
        className="h-[260px] w-[260px] animate-pulse rounded-xl"
        style={{ background: "var(--fill-subtle)" }}
        aria-hidden="true"
      />
      {/* Subscore bars */}
      <div className="w-full max-w-[220px] space-y-2">
        {[100, 70, 55].map((w) => (
          <div
            key={w}
            className="h-3 animate-pulse rounded-full"
            style={{
              width: `${w}%`,
              background: "var(--fill-subtle)",
            }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
