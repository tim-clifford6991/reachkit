// SPEC §4 (2026-09-20, #908), issue 912 — "The first day after setup is
// this state, with the pass's current step named."
//
// The five rows the pass runs, each marked **done**, **now** or **next**.
// It is drawn in the shell's panel (`OnboardingPanel`) and in Overview's
// hero (`_overview/FirstDayCard`), and it is one component because those
// two must never name different steps for one pass.
//
// **It replaces a spinner.** The panel used to draw `loading loading-spinner`
// beside the current step's words. A spinner is the one thing every rule
// about this product's waiting states forbids — SPEC §4's own line for
// `/app`, REQ-003 c1's "no unlabelled spinner", `_fallback/Waiting.tsx`'s
// header — and it was the more wrong for being avoidable: this pass has
// named steps, so it can say which one it is on. Where this product has
// stages to name, it names them.
//
// **The rows are the setup screen's own** (`_setup/stages.ts`): the same
// five, the same order, the same five sentences. A second table here would
// be a second answer to "what is ReachKit doing right now" on two screens
// a founder sees within a minute of each other.
//
// **No time is stated.** `drawnStages` can carry the seconds a finished row
// took, and this draws none of them: a founder waiting for their first page
// is owed the step, not a stopwatch, and the numbers belong to the setup
// screen that already prints them.
import type React from "react";
import { Check, Circle, Dot } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import {
  ROW_COPY_KEY,
  drawnStages,
  type DrawnStage,
} from "@/app/(account)/setup/_setup/stages";
import type { OnboardingStage } from "@/lib/scan/deep/progress";

/**
 * The five rows for a pass on `stage`.
 *
 * `enteredAt` is deliberately empty: this view states no durations, and
 * `drawnStages` decides `done` / `current` / `pending` from the row's index
 * against the running one, which needs no instants at all. Passing the
 * empty record is what makes that explicit rather than passing times
 * nothing reads.
 */
export function stepsFor(stage: OnboardingStage): readonly DrawnStage[] {
  return drawnStages({ stage, enteredAt: {} });
}

/** One row's mark. A tick for what is done, a ring for what is running, a
 *  dot for what is still to come — three shapes, so the state is not
 *  colour alone (§2.5), and each carries its own word for a screen
 *  reader. */
const MARK = {
  done: { Icon: Check, tone: "text-success", key: "shell.pass-step.done" },
  current: { Icon: Circle, tone: "text-primary", key: "shell.pass-step.now" },
  pending: { Icon: Dot, tone: "text-base-content/70", key: "shell.pass-step.next" },
} as const satisfies Readonly<
  Record<DrawnStage["state"], { Icon: typeof Check; tone: string; key: Parameters<typeof copy>[0] }>
>;

export function PassSteps(p: { steps: readonly DrawnStage[] }): React.JSX.Element {
  return (
    <ul className="flex min-w-0 flex-col gap-1" data-testid="pass-steps">
      {p.steps.map((step) => {
        const { Icon, tone, key } = MARK[step.state];
        return (
          <li
            key={step.row}
            className="flex min-w-0 items-center gap-2 text-sm"
            data-testid={`pass-step-${step.row}`}
            data-state={step.state}
          >
            <Icon size={16} strokeWidth={1.75} className={`${tone} shrink-0`} aria-hidden />
            <span
              className={`min-w-0 wrap-anywhere ${step.state === "pending" ? "text-base-content/70" : ""}`}
            >
              {copy(ROW_COPY_KEY[step.row])}
            </span>
            {/* The state in words, for a reader who cannot see the mark.
                `sr-only` rather than a visible chip: five chips down a
                72px-wide panel is a column of labels, not a list of steps. */}
            <span className="sr-only">{copy(key)}</span>
          </li>
        );
      })}
    </ul>
  );
}
