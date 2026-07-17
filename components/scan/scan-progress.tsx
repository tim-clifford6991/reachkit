"use client";

import { useMemo } from "react";
import { useScanNarrative, scanProgressPct, useElapsedSeconds } from "./scan-narrative";
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
  embedded = false,
  refreshing = false,
  startedAt = null,
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
  /** Render in place inside a host layout (e.g. the app shell) instead of a full-page takeover. */
  embedded?: boolean;
  /** The app already shows a score — this is a re-scan/deepen, not a first run. */
  refreshing?: boolean;
  /**
   * `scans.started_at` (ISO). The progress curve is time-based, so it needs the
   * REAL start — not mount time. They differ whenever the view renders mid-scan
   * (the dashboard re-rendering into a deepen that began ~80s ago); anchoring on
   * mount would restart the bar at 0 and read as though nothing had happened.
   * Falls back to mount for the funnel, where the user just submitted.
   */
  startedAt?: string | null;
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

  // Pure: parse only. null → useElapsedSeconds anchors on mount.
  const startedAtMs = useMemo(() => {
    const t = startedAt ? Date.parse(startedAt) : NaN;
    return Number.isFinite(t) ? t : null;
  }, [startedAt]);
  const elapsedS = useElapsedSeconds(startedAtMs, running);
  const pct = scanProgressPct({
    stepsDone: steps.filter((s) => s.state === "done").length,
    stepsTotal: steps.length,
    elapsedS,
    deep,
    complete: !running,
  });

  void productName;
  return (
    <ScanningScreen
      host={host ?? null}
      steps={steps.map((s) => ({ state: s.state, label: s.label }))}
      embedded={embedded}
      pct={pct}
      refreshing={refreshing}
    />
  );
}
