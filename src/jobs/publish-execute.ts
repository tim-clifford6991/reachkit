// src/jobs/publish-execute.ts — BUILD §11
//
// "`publish/execute` · on approve/expiry · State machine → destination."
// The event carries the draft, the destination and the moment it was sent
// for; this file calls the engine once and reports what it said. The
// at-most-once guarantee is the `publications` row plus the
// destination-side marker (ADR-080) and the `(draft_id, destination_id)`
// constraint behind them — none of which is re-implemented here.
//
// **Who sends it** (issue #790): `schedulePublish` in the engine, when a
// customer approves a page and when a page enters review with its window
// stamped, each stamped for the moment the page first becomes publishable
// and due. The event arrives at that moment, re-reads the page the way the
// hourly tick does — approving it if its window has run out — and attempts
// it. A page not due when the event arrives (vetoed, already out, a publish
// time moved later) is a recorded skip; `publish/retry` remains the
// backstop that picks up whatever an event did not.
//
// **The idempotency key includes `dueAt`.** Two sends for one page are two
// different moments — the window's end, then an earlier approval — and a
// key of `(draftId, destinationId)` alone would drop the second for a day.
// Two deliveries of one send share the moment and run once; a second
// attempt at a page already out finds the row delivered.
//
// In the kill switch's scope.
import { publishDue } from "@/jobs/engine";
import { requiredString } from "./payload";
import type { JobDefinition, Outcome } from "./types";

export const publishExecute: JobDefinition = {
  id: "publish/execute",
  trigger: { kind: "event", event: "publish/execute" },
  idempotencyKey: ["draftId", "destinationId", "dueAt"],
  async run(input): Promise<Outcome> {
    const draftId = requiredString(input, "draftId");
    const result = await publishDue({ draftId, now: input.now });
    if ("notDue" in result) return { outcome: "skipped", subjectId: draftId, reason: "not-due" };
    return "degraded" in result
      ? { outcome: "degraded", subjectId: draftId, step: result.degraded }
      : { outcome: "ran", subjectId: draftId };
  },
};
