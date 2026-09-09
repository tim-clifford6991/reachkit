// BUILD §4.3 · UI-SPEC S10 · S11 — where the founder is, in three phases.
//
// The set draws the same strip on both screens: `Paid` done, then `Setup`,
// then `First page`. On `/setup` the current phase is Setup; on
// `/setup/waiting` it is First page and Setup is done. One component, so
// the two screens cannot disagree about the order or the words.
//
// **The registered `Steps`, not a strip of its own.** BUILD §2.2's set of
// fifteen includes `steps` and this is exactly that: three labelled steps
// with a state each. So this file writes no class and mints no CSS — §2.2
// allows setup no stylesheet at all.
//
// **No phase carries a duration.** The amended REQ-025 c1 (see
// `keys/setup.ts`) restored one sentence per screen — the submit's and the
// waiting card's — and the set draws no clock on a step. `Steps` has a
// `note` slot and this file passes none.
import type React from "react";
import { Steps, type StepItem } from "@/ui/components/Steps";
import { copy, type CopyKey } from "@/lib/presentation/copy";

/** The three phases, in the set's order. */
export const SETUP_PHASES = ["paid", "setup", "first-page"] as const;
export type SetupPhase = (typeof SETUP_PHASES)[number];

const PHASE_COPY: Readonly<Record<SetupPhase, CopyKey>> = Object.freeze({
  paid: "setup.progress.paid",
  setup: "setup.progress.setup",
  "first-page": "setup.progress.first-page",
});

export function ProgressStrip(p: { current: SetupPhase }): React.JSX.Element {
  const at = SETUP_PHASES.indexOf(p.current);
  const steps: StepItem[] = SETUP_PHASES.map((phase, index) => ({
    id: phase,
    label: copy(PHASE_COPY[phase]),
    state: index < at ? "done" : index === at ? "active" : "pending",
  }));

  return (
    <div data-testid="setup-progress" data-current={p.current}>
      <Steps steps={steps} />
    </div>
  );
}
