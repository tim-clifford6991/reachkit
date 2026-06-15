"use client";

import { useScanNarrative } from "./scan-narrative";
import { ScanChecklist } from "./scan-checklist";
import { ScanAnimation } from "./scan-animation";

function PulseDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 motion-reduce:animate-none" style={{ background: "var(--color-accent)" }} />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--color-accent)" }} />
    </span>
  );
}

/**
 * The live "thinking" view: a page-scan animation beside an accumulating ✓/active/
 * pending checklist that stays in motion until the report is ready. Decoupled from
 * the route's payload types — the caller derives these primitives from facts/events.
 */
export function ScanProgress({
  artifacts,
  productName,
  host,
  reviewCount,
  competitorCount,
  ctaCount,
  finished,
}: {
  artifacts: string[];
  productName?: string | null;
  host?: string | null;
  reviewCount?: number;
  competitorCount?: number;
  ctaCount?: number;
  finished: boolean;
}) {
  const confirmed = new Set<string>(artifacts);
  if (finished) confirmed.add("__findings__");
  const steps = useScanNarrative(
    confirmed,
    { reviewCount, competitorCount, ctaCount },
    !finished,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      {/* Full-width status header — shows first on mobile (above the animation card). */}
      <div className="flex items-center gap-3">
        <PulseDot />
        <p className="font-mono text-sm font-medium tracking-wide" style={{ color: "var(--color-fg)" }}>
          Scanning your product…
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-2 md:items-start">
        <ScanAnimation productName={productName} host={host} />
        <ScanChecklist steps={steps} />
      </div>
    </div>
  );
}
