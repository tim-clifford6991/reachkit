"use client";

/**
 * ScoreBlock for the public report page.
 *
 * "use client" is required here because next/dynamic with `ssr: false` must
 * live in a Client Component (Next.js 16 / Turbopack constraint).
 *
 * Mirrors the pattern from app/(funnel)/scan/[id]/results/score-block.tsx —
 * lazy-loads DiscoverabilityScore so that motion/react stays out of the
 * initial report page chunk.
 */

import dynamic from "next/dynamic";
import type { VerifiedScore } from "@/lib/scan/score-full";

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
  caption: string;
}

export function ScoreBlock({ score, caption }: ScoreBlockProps) {
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
        {caption}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ScoreBlockSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div
        className="h-[200px] w-[200px] animate-pulse rounded-full"
        style={{ background: "var(--fill-subtle)" }}
        aria-hidden="true"
      />
      <div
        className="h-[260px] w-[260px] animate-pulse rounded-xl"
        style={{ background: "var(--fill-subtle)" }}
        aria-hidden="true"
      />
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
