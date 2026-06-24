"use client";

import { useScanNarrative } from "./scan-narrative";
import { ScanChecklist } from "./scan-checklist";
import { ScanAnimation } from "./scan-animation";
import { ScanningScreen } from "./captured-scanning";

void ScanChecklist;
void ScanAnimation;

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

  void productName;
  return <ScanningScreen host={host ?? null} steps={steps.map((s) => ({ state: s.state, label: s.label }))} />;
}
