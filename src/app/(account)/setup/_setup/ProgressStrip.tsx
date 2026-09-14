// SPEC §5 — where the founder is, in three phases: Paid, Setup, First page.
//
// The same strip heads `/setup` (Setup current) and `/setup/waiting` (First
// page current), so the two screens cannot disagree about the order or the
// words. daisyUI `steps` in the route (DESIGN.md rule 1); a finished phase
// carries a lucide check. No phase carries a duration.
import type React from "react";
import { Check } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";

/** The three phases, in order. */
export const SETUP_PHASES = ["paid", "setup", "first-page"] as const;
export type SetupPhase = (typeof SETUP_PHASES)[number];

const PHASE_COPY: Readonly<Record<SetupPhase, CopyKey>> = Object.freeze({
  paid: "setup.progress.paid",
  setup: "setup.progress.setup",
  "first-page": "setup.progress.first-page",
});

export function ProgressStrip(p: { current: SetupPhase }): React.JSX.Element {
  const at = SETUP_PHASES.indexOf(p.current);

  return (
    <ul className="steps w-full" data-testid="setup-progress" data-current={p.current}>
      {SETUP_PHASES.map((phase, index) => {
        const state = index < at ? "done" : index === at ? "active" : "pending";
        return (
          <li
            key={phase}
            className={state === "pending" ? "step text-sm" : "step step-primary text-sm"}
            data-state={state}
            aria-current={state === "active" ? "step" : undefined}
          >
            {state === "done" ? (
              <span className="step-icon">
                <Check aria-hidden size={16} strokeWidth={1.75} />
              </span>
            ) : null}
            {copy(PHASE_COPY[phase])}
          </li>
        );
      })}
    </ul>
  );
}
