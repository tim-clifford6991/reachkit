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
  deep = false,
  findingsReady,
  reportReady,
}: {
  artifacts: string[];
  productName?: string | null;
  host?: string | null;
  reviewCount?: number;
  competitorCount?: number;
  ctaCount?: number;
  /** Full (paid) scan watched live end-to-end → run the deep-pass narrative. */
  deep?: boolean;
  /** Findings milestone landed (closes the `snapshot` step). */
  findingsReady: boolean;
  /** Report persisted (closes the deep `report` step; free scans never reach it). */
  reportReady: boolean;
}) {
  const confirmed = new Set<string>(artifacts);
  if (findingsReady) confirmed.add("__findings__");
  if (reportReady) confirmed.add("__report__");
  // Free scans finish at findings; full scans keep running through the deep pass.
  const running = deep ? !reportReady : !findingsReady;
  const steps = useScanNarrative(
    confirmed,
    { reviewCount, competitorCount, ctaCount },
    running,
    deep,
  );

  void productName;
  return <ScanningScreen host={host ?? null} steps={steps.map((s) => ({ state: s.state, label: s.label }))} />;
}
