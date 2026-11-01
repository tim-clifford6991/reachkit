// src/jobs/scan-rescore.ts — issue 1433
//
// Every stored scan and site rival set scored again by the deployed code,
// where the data is (owner ruling 2026-10-14, SPEC §2). The request is a
// `rescore_runs` row and this tick is what reads it. Since issue 1481 the
// tick asks for it itself after a deploy that changed how a scan is read: one
// apply, its guard decided in memory before any write, so every stored scan is
// downloaded once (`src/lib/scan/derivation.ts`). The master session may still
// insert one through the Supabase connector. A tick with nothing to do does nothing.
//
// A held re-score — the guard stopped the apply, a scan written since the read
// still moves, or a run failed — is `degraded` on every tick until a deploy or
// the master session moves it on: the check that fails while stored scans lag the code.
//
// The claim and the answer are steps of their own, so a retried answer is
// the same request and a second tick cannot claim it again. The answer is
// idempotent: a second apply changes nothing.
//
// Not in the kill switch's scope: it buys nothing and asks no model, and the
// network is refused while a scan is scored.
import { answerRescore, claimRescore } from "@/jobs/engine";
import type { JobDefinition, Outcome } from "./types";

export const RESCORE_TICK_CRON = "7,22,37,52 * * * *";

export const scanRescore: JobDefinition = {
  id: "scan/rescore",
  trigger: { kind: "cron", cron: RESCORE_TICK_CRON },
  idempotencyKey: [],
  async run(input): Promise<Outcome> {
    const step = input.step;
    const request = step === undefined ? await claimRescore(input.now) : await step("claim", () => claimRescore(input.now));
    if (request === null) return { outcome: "skipped", subjectId: null, reason: "no-subject" };
    if ("held" in request) return { outcome: "degraded", subjectId: null, step: "rescore-held" };
    const answer = () => answerRescore({ request, now: input.now });
    const result = step === undefined ? await answer() : await step(`answer-${request.id}`, answer);
    return "degraded" in result
      ? { outcome: "degraded", subjectId: request.id, step: result.degraded }
      : { outcome: "ran", subjectId: request.id };
  },
};
