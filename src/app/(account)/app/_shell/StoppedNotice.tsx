// SPEC §4 — "If ReachKit stopped its own work, the screen says so and gives a
// resume date or none — no vendor/cap detail." REQ-092 c3.
//
// It lives in the shell's main column, so the screen the customer lands on
// states it without their opening a calendar day or settings, and it is
// rendered from the model's own `stopped` arm: no dismissal flag, no cached
// banner, no "seen" state. With `stopped` null there is nothing to render.
//
// The three sentences are `stoppedWorkStatement`'s and are not composed here —
// that ReachKit stopped, whether anything is needed from the customer, and
// when the work is expected back. None is conditional.
//
// A plain daisyUI `alert` with no tone colour: a stop is a fact about
// ReachKit, not an alarm about the customer's market. It is not one of
// Overview's at-most-two "needs you" items (REQ-041 c5).
import type React from "react";
import { CirclePause } from "lucide-react";
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
    <div role="status" className="alert items-start" data-testid="shell-stopped">
      <CirclePause size={20} strokeWidth={1.75} aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold" data-testid="shell-stopped-line">
          {statement.line}
        </span>
        <span data-testid="shell-stopped-needs">{statement.needsLine}</span>
        <span data-testid="shell-stopped-resumes">{statement.resumesLine}</span>
      </div>
    </div>
  );
}
