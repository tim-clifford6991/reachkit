// src/jobs/scan-rescore.ts — issue 1433
//
// Every stored scan and site rival set scored again by the deployed code,
// where the data is (owner ruling 2026-10-14, SPEC §2). The master session
// asks with a `rescore_runs` row, inserted through the Supabase connector:
// the box holds no key that sends an event, so the request is a row and this
// tick is what reads it. A tick with nothing asked does nothing.
//
// The claim and the answer are steps of their own, so a retried answer is
// the same request and a second tick cannot claim it again. The answer is
// idempotent: a second apply changes nothing.
//
// Not in the kill switch's scope: it buys nothing and asks no model, and the
// network is refused while a scan is scored.
import { answerRescore, claimRescore } from "@/jobs/engine";
import type { JobDefinition, Outcome } from "./types";

export const RESCORE_TICK_CRON = "*/15 * * * *";

export const scanRescore: JobDefinition = {
  id: "scan/rescore",
  trigger: { kind: "cron", cron: RESCORE_TICK_CRON },
  idempotencyKey: [],
  async run(input): Promise<Outcome> {
    const step = input.step;
    const request = step === undefined ? await claimRescore(input.now) : await step("claim", () => claimRescore(input.now));
    if (request === null) return { outcome: "skipped", subjectId: null, reason: "no-subject" };
    const answer = () => answerRescore({ request, now: input.now });
    const result = step === undefined ? await answer() : await step(`answer-${request.id}`, answer);
    return "degraded" in result
      ? { outcome: "degraded", subjectId: request.id, step: result.degraded }
      : { outcome: "ran", subjectId: request.id };
  },
};
