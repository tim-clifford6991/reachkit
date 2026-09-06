// BUILD §6.5, §11 — REQ-092 c3: the screen the customer lands on states
// that ReachKit stopped its own work.
//
// "Given ReachKit has stopped its own work and today's page has not been
// produced, when the customer opens the app, then the screen they land on
// states it, **without their having to open a calendar day or a settings
// screen**, and **it stops stating it once the work resumes**." So it lives
// in the shell's main column, is rendered from the model's own `stopped`
// arm, and has no dismissal flag, no cached banner and no "seen" state to
// clear: with `stopped` null there is nothing here to render.
//
// The three sentences are `stoppedWorkStatement`'s and are not composed
// here — c1's line, c2's "whether anything is needed from you", c4's "when
// the work is expected back". None is conditional: a stop that stated only
// the first would satisfy neither c2 nor c4.
//
// **Tone is `neutral`, not `bad`.** §2.5: an intended-empty state takes
// `neutral` or `ok`. A stop is a fact about ReachKit, not an alarm about
// the customer's market — and c8 forbids any internal cause appearing in
// it, which `WorkStop` makes unrepresentable rather than filtered.
//
// It is **not** one of Overview's at-most-two alerts (REQ-041 c5): those
// are items that cannot proceed without the customer, and this one names
// what ReachKit did. It renders in the shell's main column, above the
// screen, and the alert count on Overview is unchanged by it.
import type React from "react";
import { Alert } from "@/ui/components";
import { stoppedWorkStatement, type WorkStop } from "@/lib/presentation/stopped";
import { formatDate } from "./format";

export function StoppedNotice(p: {
  stopped: WorkStop | null;
  timeZone: string;
}): React.JSX.Element | null {
  if (p.stopped === null) return null;

  const statement = stoppedWorkStatement(p.stopped, {
    formatDate: (on) => formatDate(on, p.timeZone),
  });

  return (
    <div className="rk-stopped" data-testid="shell-stopped">
      <Alert
        tone="neutral"
        message={
          <span className="flex flex-col gap-1">
            <span data-testid="shell-stopped-line">{statement.line}</span>
            <span data-testid="shell-stopped-needs">{statement.needsLine}</span>
            <span data-testid="shell-stopped-resumes">{statement.resumesLine}</span>
          </span>
        }
      />
    </div>
  );
}
