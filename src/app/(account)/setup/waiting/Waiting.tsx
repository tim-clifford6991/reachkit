// SPEC §5 — the waiting screen's named stages: which step is running, a
// finished step's elapsed time, never a percentage or a promised duration.
//
// daisyUI `steps steps-vertical` in the route (DESIGN.md rule 1). A finished
// row carries a lucide check, the running row is the primary step, a row
// not begun is plain. `_setup/stages.ts` computes each row's state and
// seconds from the pass's own recorded instants and the server writes the
// words; this component composes nothing and reads no clock.
//
// It polls `GET /api/setup/progress` at the pinned heartbeat, so the
// founder is shown at least that often that the pass is still running, and
// navigates to the app the moment the pass ends — degraded or not.
"use client";

import type React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { TIMING } from "@/lib/config/constants";
import type { PassProgress } from "../_setup/progress";
import type { DrawnRow } from "../_setup/stages";
import { APP_PATH, destinationFor } from "./release";

const PROGRESS_PATH = "/api/setup/progress";

const STEP_CLASS = {
  done: "step step-primary",
  current: "step step-primary font-medium",
  pending: "step text-base-content/60",
} as const satisfies Record<WaitingRow["state"], string>;

/** One row, already written by the server: its words, its state and its
 *  time. This component resolves no registry key. */
export interface WaitingRow {
  readonly id: DrawnRow;
  readonly label: string;
  readonly state: "done" | "current" | "pending";
  /** The written elapsed time, or `null` where the row has none to state. */
  readonly time: string | null;
}

export function Waiting(p: { rows: readonly WaitingRow[] }): React.JSX.Element {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function poll(): Promise<void> {
      const response = await fetch(PROGRESS_PATH);
      const progress = (await response.json()) as PassProgress;
      if (cancelled) return;
      if (destinationFor(progress) !== null) router.push(APP_PATH);
    }

    // `TIMING.progressHeartbeatS` is the pinned interval a running pass
    // reports itself at, so "at least once every 30 seconds" is one number.
    const timer = setInterval(() => {
      void poll();
    }, TIMING.progressHeartbeatS * 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router]);

  const current = p.rows.find((row) => row.state === "current");

  return (
    <ul
      className="steps steps-vertical w-full"
      data-testid="setup-waiting"
      data-stage={current === undefined ? undefined : current.id}
    >
      {p.rows.map((row) => (
        <li
          key={row.id}
          className={STEP_CLASS[row.state]}
          data-state={row.state}
          data-testid={`setup-stage-${row.id}`}
          aria-current={row.state === "current" ? "step" : undefined}
        >
          {row.state === "done" ? (
            <span className="step-icon">
              <Check aria-hidden size={16} strokeWidth={1.75} />
            </span>
          ) : null}
          <span className="flex w-full items-center justify-between gap-3 text-left">
            <span>{row.label}</span>
            {row.time === null ? null : (
              // The running row's dash is a reading not yet taken, marked
              // as such (`data-unmeasured`, REQ-004's convention) so the
              // placeholder sweep tells it from a blank.
              <span
                className="num text-sm text-base-content/60"
                data-testid="setup-stage-time"
                data-unmeasured={row.state === "current" ? "" : undefined}
              >
                {row.time}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
