// SPEC §4 — the screen the customer lands on states that ReachKit stopped
// its own work.
//
// It lives in the shell's main column, is rendered from the model's own
// `stopped` arm, and has no dismissal flag, no cached banner and no "seen"
// state to clear: with `stopped` null there is nothing here to render, which
// is the whole of "it stops stating it once the work resumes".
//
// The three sentences are `stoppedWorkStatement`'s and none is conditional.
// The tone is `neutral`, not `bad`: a stop is a fact about ReachKit, not an
// alarm about the customer's market. It is not one of Overview's at-most-two
// alerts — those are items that cannot proceed without the customer.
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
    <div className="min-w-0" data-testid="shell-stopped">
      <Alert
        tone="neutral"
        message={
          <span className="flex flex-col gap-(--s-1)">
            <span data-testid="shell-stopped-line">{statement.line}</span>
            <span data-testid="shell-stopped-needs">{statement.needsLine}</span>
            <span data-testid="shell-stopped-resumes">{statement.resumesLine}</span>
          </span>
        }
      />
    </div>
  );
}
