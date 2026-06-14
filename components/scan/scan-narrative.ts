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
  | "positioning" | "compare" | "score" | "draft" | "critique" | "finalize";

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
  { id: "draft",       optimistic: false, confirmBy: ["Drafting your action plan"], label: () => "Drafting your action plan" },
  { id: "critique",    optimistic: false, confirmBy: ["Pressure-testing each recommendation"], label: () => "Pressure-testing each move" },
  { id: "finalize",    optimistic: false, confirmBy: ["Finalising your report", "__findings__"], label: () => "Finalising your report" },
];

export function labelFor(id: StepId, ctx: NarrativeCtx): string {
  const step = STEP_SCRIPT.find((s) => s.id === id);
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

export function computeStepStates(input: {
  confirmedLabels: Set<string>;
  tick: number; // increments on a timer to advance optimistic steps
  ctx: NarrativeCtx;
}): ComputedStep[] {
  const { confirmedLabels, tick, ctx } = input;

  // Furthest real progress: index of the last step whose milestone has confirmed.
  let confirmedThrough = -1;
  STEP_SCRIPT.forEach((s, i) => {
    if (isConfirmed(s, confirmedLabels)) confirmedThrough = Math.max(confirmedThrough, i);
  });

  // Optimistic steps may tick ahead of their event, but never past the first
  // non-optimistic step (we will not fake an LLM result).
  let optimisticCeiling = -1;
  for (let i = 0; i < STEP_SCRIPT.length; i++) {
    if (STEP_SCRIPT[i]!.optimistic) optimisticCeiling = i;
    else break;
  }
  // tick starts at 1 (nothing done yet → step 0 active); each timer fire advances one.
  const optimisticDone = Math.min(optimisticCeiling, tick - 2);

  const doneThrough = Math.max(confirmedThrough, optimisticDone);
  const activeIndex = doneThrough + 1;

  return STEP_SCRIPT.map((s, i) => ({
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
  return computeStepStates({ confirmedLabels, tick, ctx });
}
