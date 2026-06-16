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
import type { LossFrame } from "@/lib/scan/competitive-framing";

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
  /**
   * Named, loss-framed competitive hook (from community-mention gaps). When
   * present, it leads above the ring; when null (cold-start, no credible gap)
   * the block falls back to the neutral caption only.
   */
  lossFrame?: LossFrame | null;
}

export function ScoreBlock({ score, lossFrame }: ScoreBlockProps) {
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

      {lossFrame ? (
        <div className="mb-6 max-w-sm px-6 text-center">
          <p className="text-sm font-semibold leading-snug" style={{ color: "var(--color-fg)" }}>
            You&apos;re behind{" "}
            <span style={{ color: "var(--color-danger)" }}>{lossFrame.leaderName}</span>
            {lossFrame.behindCount > 1
              ? ` and ${lossFrame.behindCount - 1} other rival${
                  lossFrame.behindCount - 1 === 1 ? "" : "s"
                }`
              : ""}{" "}
            where your buyers actually talk.
          </p>
          <p
            className="mt-1.5 font-mono text-[11px] tabular-nums"
            style={{ color: "var(--color-muted)" }}
          >
            {lossFrame.leaderName}: {lossFrame.leaderThem} mentions · you: {lossFrame.you}
          </p>
        </div>
      ) : null}

      <DiscoverabilityScore score={score} size="lg" />

      <p
        className="mt-6 max-w-xs text-center text-xs leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        Discoverability we could verify in ~90 seconds. Content, outreach, ads,
        PR &amp; partnerships aren&apos;t measured in the free scan — fix the actions
        below to move what we can see.
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
