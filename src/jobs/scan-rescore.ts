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
//
// The same tick re-commits each paying site's week once per planner deploy
// (SPEC §7, `src/lib/scan/replan.ts`), after a dry run it logs; a held week is `replan-held`, a week with no day `replan-empty`. After it, once per
// standard deploy, it sets aside each waiting draft below the standard, so the draft tick writes its date again.
import { activeSites, answerRescore, claimRescore, rescoreDue } from "@/jobs/engine";
import type { JobDefinition, JobInput, Outcome } from "./types";

// Hourly at :07, off :00–:02 and every other job's minute; a re-score after a deploy starts within the hour.
export const RESCORE_TICK_CRON = "7 * * * *";

export const scanRescore: JobDefinition = {
  id: "scan/rescore",
  trigger: { kind: "cron", cron: RESCORE_TICK_CRON },
  idempotencyKey: [],
  // One tick at a time, so two cannot re-commit one site's week together.
  concurrency: [{ limit: 1 }],
  async run(input): Promise<Outcome> {
    const replanned = await replanWeeks(input);
    await restandard(input);
    const rescored = await rescore(input);
    if (replanned.outcome !== "degraded") return rescored.outcome === "skipped" ? replanned : rescored;
    return rescored.outcome === "degraded" ? { ...rescored, step: `${rescored.step},${replanned.step}` } : replanned;
  },
};

async function rescore(input: JobInput): Promise<Outcome> {
  const step = input.step;
  // A step, so a replay after the claim keeps the first answer and records `ran`.
  if (!(await (step === undefined ? rescoreDue() : step("due", rescoreDue)))) return { outcome: "skipped", subjectId: null, reason: "no-subject" };
  const request = step === undefined ? await claimRescore(input.now) : await step("claim", () => claimRescore(input.now));
  if (request === null) return { outcome: "skipped", subjectId: null, reason: "no-subject" };
  if ("held" in request) return { outcome: "degraded", subjectId: null, step: "rescore-held" };
  const answer = () => answerRescore({ request, now: input.now });
  const result = step === undefined ? await answer() : await step(`answer-${request.id}`, answer);
  return "degraded" in result
    ? { outcome: "degraded", subjectId: request.id, step: result.degraded }
    : { outcome: "ran", subjectId: request.id };
}

/** SPEC §7: each paying site's week re-committed once per planner deploy, after its dry run; 0¢. */
async function replanWeeks(input: JobInput): Promise<Outcome> {
  const { replanSites } = await import("@/lib/scan/replan");
  let result: Awaited<ReturnType<typeof replanSites>>;
  try {
    result = await replanSites(async () => (await activeSites()).sites, { now: input.now, ...(input.step === undefined ? {} : { step: input.step }) });
  } catch (error) {
    // A failed re-plan never stops the hour's re-score.
    console.warn(JSON.stringify({ event: "week_replan_failed", errorClass: error instanceof Error ? error.name : "unknown" }));
    return { outcome: "degraded", subjectId: null, step: "replan-failed" };
  }
  if (result === null) return { outcome: "skipped", subjectId: null, reason: "no-subject" };
  const stood = [result.held.length > 0 ? "replan-held" : "", result.empty.length > 0 ? "replan-empty" : ""].filter(Boolean).join(",");
  return stood === "" ? { outcome: "ran", subjectId: null } : { outcome: "degraded", subjectId: null, step: stood };
}

/** SPEC §7: each paying site's waiting drafts read once per standard deploy, at 0¢; after the re-plan, so a freed date keeps its topic. */
async function restandard(input: JobInput): Promise<void> {
  const { restandardSites } = await import("@/lib/generate/recheck");
  // A failed reading never stops the hour's re-plan or re-score; the next tick reads again.
  await restandardSites(async () => (await activeSites()).sites, { now: input.now, ...(input.step === undefined ? {} : { step: input.step }) }).catch((error: unknown) =>
    console.warn(JSON.stringify({ event: "draft_standard_failed", errorClass: error instanceof Error ? error.name : "unknown" }))
  );
}
