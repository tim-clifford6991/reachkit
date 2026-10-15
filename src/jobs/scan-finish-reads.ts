// src/jobs/scan-finish-reads.ts — SPEC §2 (owner, 2026-10-15, issue 1440)
//
// A free pass that stored a report with searches it chose and did not read
// sends this event, keyed by its scan. The job reads only those searches,
// once, inside the free cap the pass already spent from, and rewrites the
// report through the re-score's guarded write. The rule is
// `src/lib/scan/finish-reads.ts`'s; this file is the send, the trigger and
// the outcome.
//
// In the kill switch's scope: it buys SERPs.
import { finishReads } from "@/jobs/engine";
import { requiredString } from "./payload";
import type { JobDefinition, Outcome } from "./types";

/** The event for one stored report. `scanId` is the idempotency key, so a
 *  second send for the same scan is dropped by the queue. */
export async function sendFinishReads(scanId: string): Promise<void> {
  const { sendJobEvent } = await import("./client");
  await sendJobEvent("scan/finish-reads", { scanId });
}

export const scanFinishReads: JobDefinition = {
  id: "scan/finish-reads",
  trigger: { kind: "event", event: "scan/finish-reads" },
  idempotencyKey: ["scanId"],
  async run(input): Promise<Outcome> {
    const scanId = requiredString(input, "scanId");
    const finish = () => finishReads({ scanId, now: input.now });
    const result = input.step === undefined ? await finish() : await input.step("finish", finish);
    if (!result.finished) return { outcome: "skipped", subjectId: scanId, reason: "no-subject" };
    // A search that failed again stays unmeasured, and the run says so.
    return result.read < result.asked
      ? { outcome: "degraded", subjectId: scanId, step: "finish-reads" }
      : { outcome: "ran", subjectId: scanId };
  },
};
