import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Scan narrative — a curated, granular "thinking" script that stays ALIVE while
// the scan runs, synced to the real `scan_events` milestones. Fast collect
// sub-actions tick optimistically on a timer (they definitely happen); the heavy
// LLM steps only complete when their real event lands (honesty bar — we never
// claim work that didn't happen). Pure functions here are unit-tested; the hook
// just drives the optimistic timer.
// ---------------------------------------------------------------------------

export type StepId =
  | "homepage" | "hero" | "ctas" | "reviews" | "competitors"
  | "positioning" | "compare" | "score" | "snapshot"
  // Deep-pass steps — only present for a full (paid) scan watched live end-to-end.
  | "actions" | "critic" | "report";

export type StepState = "pending" | "active" | "done";

export interface NarrativeCtx {
  reviewCount?: number;
  competitorCount?: number;
  ctaCount?: number;
}

export interface Step {
  id: StepId;
  /** Real artifact labels / event markers (prefix-matched) that confirm completion. */
  confirmBy: string[];
  /** Fast, definitely-happening collect sub-actions auto-tick before their event lands. */
  optimistic: boolean;
  label: (c: NarrativeCtx) => string;
}

export const STEP_SCRIPT: Step[] = [
  { id: "homepage",    optimistic: true,  confirmBy: ["Read your product page"], label: () => "Loading your homepage" },
  { id: "hero",        optimistic: true,  confirmBy: ["Read your product page"], label: () => "Reading your hero & value prop" },
  { id: "ctas",        optimistic: true,  confirmBy: ["Read your product page"], label: (c) => (c.ctaCount != null ? `Counting your CTAs — found ${c.ctaCount}` : "Counting your CTAs") },
  { id: "reviews",     optimistic: false, confirmBy: ["Analysed ", "Checked for public reviews"], label: (c) => (c.reviewCount && c.reviewCount > 0 ? `Reading ${c.reviewCount} reviews` : "Checking for public reviews") },
  { id: "competitors", optimistic: false, confirmBy: ["Found ", "Mapping your competitive landscape"], label: (c) => (c.competitorCount && c.competitorCount > 0 ? `Sizing up ${c.competitorCount} rivals` : "Finding your competitors") },
  { id: "positioning", optimistic: false, confirmBy: ["Reading your reviews & positioning"], label: () => "Mapping your positioning" },
  { id: "compare",     optimistic: false, confirmBy: ["Comparing you to your competitors"], label: () => "Comparing how you stack up" },
  { id: "score",       optimistic: false, confirmBy: ["Scoring your discoverability"], label: () => "Scoring your discoverability" },
  // Closer: the reveal fires on the findings event, so this stays the active
  // "finishing" step until the page swaps to the result. Action drafting / critic
  // run in the background (full-scan) and are NOT part of the watched free scan.
  { id: "snapshot",    optimistic: false, confirmBy: ["__findings__"], label: () => "Building your snapshot" },
];

// Deep-pass continuation (full/paid scans only). A full scan keeps the user on
// the live narrative through the ~80s deep pass (actions → critic → report)
// instead of handing off at findings — otherwise /results shows a second
// "Finalising your action plan…" screen for the whole pass. Each step confirms
// on the real artifact label full-scan.ts emits (see lib/scan/full-scan.ts), so
// the checklist advances honestly; the closer confirms on the `report` event.
export const DEEP_STEPS: Step[] = [
  { id: "actions", optimistic: false, confirmBy: ["Drafting your action plan"], label: () => "Drafting your action plan" },
  { id: "critic",  optimistic: false, confirmBy: ["Pressure-testing each recommendation"], label: () => "Pressure-testing every recommendation" },
  { id: "report",  optimistic: false, confirmBy: ["Finalising your report", "__report__"], label: () => "Finalising your report" },
];

export function labelFor(id: StepId, ctx: NarrativeCtx): string {
  const step = STEP_SCRIPT.find((s) => s.id === id) ?? DEEP_STEPS.find((s) => s.id === id);
  return step ? step.label(ctx) : id;
}

/** A step is confirmed when any seen label starts with one of its confirmBy tokens. */
function isConfirmed(step: Step, confirmed: Set<string>): boolean {
  for (const seen of confirmed) {
    for (const tok of step.confirmBy) {
      if (seen.startsWith(tok)) return true;
    }
  }
  return false;
}

export interface ComputedStep { id: StepId; label: string; state: StepState }

// ---------------------------------------------------------------------------
// Progress percentage — TIME-based, with the step checklist as a ratchet.
//
// This used to be `done / steps.length` and nothing else, which produced the two
// worst things a progress bar can do:
//   - FREEZE. One `runSynth` call is 22.4s of a 40.2s free scan (measured, prod
//     2026-07-17) and the deep pass sits 47.1s between "Finalising your report"
//     (t+89.3s) and `done` (t+136.4s). Across both, the bar did not move at all
//     for over half the scan, because nothing discrete happened.
//   - LIE. The last checklist item is confirmed by an artifact emitted BEFORE the
//     work it names, so the ring read 100% with ~35% of the scan still to run.
//
// Fix: drive the number from ELAPSED TIME against a measured budget, and let
// confirmed steps ratchet it FORWARD only. The bar always moves; a fast scan is
// pulled ahead by its events; a slow one keeps creeping instead of stalling.
//
// 100 is RESERVED for actually-finished. Everything in flight is capped below it,
// so the ring can never again claim done before done.
// ---------------------------------------------------------------------------

/** In-flight ceiling. 100 means DONE — never "nearly done". */
export const PROGRESS_CEILING = 95;
/** Never show a dead 0 — the scan is real from the first paint. */
export const PROGRESS_FLOOR = 2;
/**
 * Exponential time constant, seconds. Set to ~expected_wall_clock / 2.7, so the
 * curve reads ~88% at the typical finish and keeps crawling (never reaching the
 * ceiling) past it. Measured on prod 2026-07-17: free p50 40.2s, deep 137.8s.
 */
export const PROGRESS_TAU_S = { free: 15, deep: 50 } as const;
/**
 * How much of the ceiling the CHECKLIST alone may claim.
 *
 * Deliberately conservative, because checklist position is NOT time position:
 * the deep script's last step ("Finalising your report") covers the market pass,
 * ~35% of the scan's wall clock on its own, and the free script's `score` step
 * covers a 22.4s synth call — 56% of a free scan. Weighting steps 1:1 with time
 * lets the ratchet overtake the time curve near the end and pin the bar: at 11/12
 * a raw ratchet reads 91.7%, above the time curve's 79%→89% across the entire
 * dead zone, so `max()` freezes at 92 and we have merely MOVED the freeze.
 * (Caught by scan-narrative.test.ts before this shipped.)
 *
 * At 0.75 the ratchet still pulls a fast scan forward, but time always wins in
 * the long tail — which is exactly where the freezes were.
 */
export const PROGRESS_STAGE_WEIGHT = 0.75;

export function scanProgressPct(input: {
  stepsDone: number;
  stepsTotal: number;
  elapsedS: number;
  deep: boolean;
  /** The terminal event landed. The ONLY route to 100. */
  complete: boolean;
}): number {
  if (input.complete) return 100;
  const { stepsDone, stepsTotal, elapsedS, deep } = input;
  // Forward-only ratchet: "at least this much is genuinely done".
  const stageFloor =
    stepsTotal > 0 ? (stepsDone / stepsTotal) * PROGRESS_CEILING * PROGRESS_STAGE_WEIGHT : 0;
  const tau = deep ? PROGRESS_TAU_S.deep : PROGRESS_TAU_S.free;
  const timePct = PROGRESS_CEILING * (1 - Math.exp(-Math.max(0, elapsedS) / tau));
  const pct = Math.max(stageFloor, timePct);
  return Math.round(Math.max(PROGRESS_FLOOR, Math.min(PROGRESS_CEILING, pct)));
}

/**
 * Seconds since `startedAtMs`, ticking every second while `running`.
 *
 * Pass null when the real start is unknown (the funnel, where the user just
 * submitted) and it anchors on mount instead. The mount anchor lives in lazy
 * state, NOT a bare `Date.now()` in render — calling an impure function during
 * render is a React rules violation (unstable across re-renders under concurrent
 * rendering), and `react-hooks/purity` rightly rejects it.
 */
export function useElapsedSeconds(startedAtMs: number | null, running: boolean): number {
  const [mountMs] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, (now - (startedAtMs ?? mountMs)) / 1000);
}

export function computeStepStates(input: {
  confirmedLabels: Set<string>;
  tick: number; // increments on a timer to advance optimistic steps
  ctx: NarrativeCtx;
  deep?: boolean; // full scan watched live → append the deep-pass steps
}): ComputedStep[] {
  const { confirmedLabels, tick, ctx, deep } = input;
  const script = deep ? [...STEP_SCRIPT, ...DEEP_STEPS] : STEP_SCRIPT;

  // Furthest real progress: index of the last step whose milestone has confirmed.
  let confirmedThrough = -1;
  script.forEach((s, i) => {
    if (isConfirmed(s, confirmedLabels)) confirmedThrough = Math.max(confirmedThrough, i);
  });

  // Optimistic steps may tick ahead of their event, but never past the first
  // non-optimistic step (we will not fake an LLM result).
  let optimisticCeiling = -1;
  for (let i = 0; i < script.length; i++) {
    if (script[i]!.optimistic) optimisticCeiling = i;
    else break;
  }
  // tick starts at 1 (nothing done yet → step 0 active); each timer fire advances one.
  const optimisticDone = Math.min(optimisticCeiling, tick - 2);

  const doneThrough = Math.max(confirmedThrough, optimisticDone);
  const activeIndex = doneThrough + 1;

  return script.map((s, i) => ({
    id: s.id,
    label: s.label(ctx),
    state: i <= doneThrough ? "done" : i === activeIndex ? "active" : "pending",
  }));
}

/** Drives a ~1.4s tick so optimistic steps advance; recomputes on confirmations. */
export function useScanNarrative(
  confirmedLabels: Set<string>,
  ctx: NarrativeCtx,
  running: boolean,
  deep?: boolean,
): ComputedStep[] {
  const [tick, setTick] = useState(1);
  const tickRef = useRef(1);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 1400);
    return () => clearInterval(t);
  }, [running]);
  return computeStepStates({ confirmedLabels, tick, ctx, deep });
}
