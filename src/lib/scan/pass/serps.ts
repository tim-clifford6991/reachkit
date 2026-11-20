// src/lib/scan/pass/serps.ts — asking Google the twelve.
import type { VendorFailure } from "@/lib/costs";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import { serpOrganic } from "@/lib/vendors/dataforseo";
import { worthAskingAgain } from "@/lib/vendors/dataforseo/envelope";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import type { Bounds } from "../ceilings";
import { attempt, cacheScope, failed, localeOfPass, noBattery, queueOf, roomForOneRead, serpAbortFor, serpWindowOf, type StageArgs, type StageFailure, untilCeiling } from "./sections";
import { askTheBattery, newEngineWatch } from "./battery";
import { rescore } from "./compose";

/**
 * `pass` is the pass's own bounds where `a.bounds` is one stage's: the one
 * more ask (below) is bounded by the pass's clock, not the stage's.
 */
export async function askTheTwelve(a: StageArgs, abandoned: () => boolean, pass: Bounds = a.bounds): Promise<void> {
  const { bounds, cost, parameters, sections } = a;
  const questions = sections.questions;
  const asked = questions.kind === "unmeasured" ? [] : questions.value;
  // Entered while the deadline fired: the slots below would be pushed into
  // the very array the composed report already holds.
  if (abandoned()) return;

  // Every question's slot, on the arm that says we did not get to it.
  // Written by index below; a question nobody reached keeps this.
  for (let i = 0; i < asked.length; i += 1) {
    sections.serps.push(unmeasured("not_attempted", questions.at));
    sections.battery.push(noBattery(questions.at));
  }

  /** How long each ask took, so the tail shows in the log and the next abort value is chosen from data, not a guess. */
  const tookMs: number[] = [];

  /** One question's SERP, with the vendor's own failure kind where there was one. Returns the cell; writes nothing to `sections`. */
  const askOne = async (
    keyword: string
  ): Promise<{ serp: Measured<SerpResult> | StageFailure; failure: VendorFailure | null }> => {
    const heard: { failure: VendorFailure | null } = { failure: null };
    const startedMs = Date.now();
    const serp = await attempt("asking_the_twelve", () =>
      serpOrganic(cost, {
        query: keyword,
        locale: localeOfPass(a),
        mode: "std",
        ...queueOf(parameters),
        loadAsyncAiOverview: parameters.asyncAiOverview && !a.correction,
        scope: cacheScope(a),
        freshnessDays: serpWindowOf(a),
        abortMs: serpAbortFor(pass, parameters),
        // The pass's clock, not the stage's: a queued read is paid for when posted, and the pass waits for it.
        untilMs: untilCeiling(pass, parameters),
        onFailure: (failure) => {
          heard.failure = failure;
        },
      })
    );
    tookMs.push(Date.now() - startedMs);
    return { serp, failure: heard.failure };
  };

  /** The cell, with the vendor's failure kind as `because`: a timeout and a refused request are different facts, and only the first is worth re-asking. */
  const cellFor = (
    got: { serp: Measured<SerpResult> | StageFailure; failure: VendorFailure | null },
    at: Date
  ): Measured<SerpResult> => {
    if (failed(got.serp)) return unmeasured("undeterminable", at);
    if (got.serp.kind === "unmeasured" && got.failure !== null) {
      return unmeasured<SerpResult>(got.serp.reason, got.serp.at, got.failure.vendorFailure);
    }
    return got.serp;
  };

  // One shared cursor over the twelve, taken by `serpFanout` workers. A
  // worker re-reads the ceilings before taking a question, so the stage
  // stops asking on the first refusal rather than asking eleven more times
  // and being refused eleven more times.
  let next = 0;
  /** How the battery's two engines are answering this pass, so one that is refusing stops being bought. One watch per pass. */
  const engines = newEngineWatch();
  /** Questions whose first ask failed in a way worth one more, re-asked only once every question has been asked once. */
  const worthOneMore: { readonly index: number; readonly keyword: string; readonly because: string }[] = [];
  const buyOne = async (): Promise<void> => {
    for (;;) {
      const i = next;
      next += 1;
      const question = asked[i];
      if (question === undefined) return;
      if (bounds.stopNow() !== null) continue;
      // The SERP and the battery at once: neither reads the other, and on the standard queue each is minutes of waiting.
      const [got, battery] = await Promise.all([
        askOne(question.search.keyword),
        parameters.batteryOnTheTwelve
          ? askTheBattery(a, question.search.keyword, questions.at, engines)
          : noBattery(questions.at),
      ]);
      // A late answer is kept and a sealed report is never written to: the budget stops the waiting but cannot cancel the call, and a paid answer
      // before the seal is still counted by `rescore`. Both writes happen together after the last await, so a SERP and its battery are never half a pair.
      if (sections.sealed) return;
      sections.serps[i] = cellFor(got, questions.at);
      sections.battery[i] = battery;
      if (abandoned()) rescore(a);
      if (got.failure !== null && worthAskingAgain(got.failure.vendorFailure)) {
        worthOneMore.push({ index: i, keyword: question.search.keyword, because: got.failure.vendorFailure });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(parameters.serpFanout, asked.length) }, () => buyOne()));

  // One more ask, only one, and only after every question has had its first: a never-asked question outranks a second ask.
  // Timeouts are billed either way, so a timed-out cell is worth one retry. It is an ordinary purchase through the same `CostContext`, so the cap holds it.
  // It is bounded by the pass, not the stage: asked while the report is not composed, the purse holds it and the pass's ceiling leaves one whole bound.
  const mayAskAgain = (): boolean =>
    !sections.sealed && !pass.abandoned() && !bounds.capHit() && roomForOneRead(pass, parameters);
  let nextRetry = 0;
  const askAgain = async (): Promise<void> => {
    for (;;) {
      const owed = worthOneMore[nextRetry];
      nextRetry += 1;
      if (owed === undefined) return;
      if (!mayAskAgain()) return;
      const got = await askOne(owed.keyword);
      // The seal the first asks are written under: a late answer is kept.
      if (sections.sealed) return;
      const cell = cellFor(got, questions.at);
      logSerpRetry({ because: owed.because, outcome: cell.kind === "unmeasured" ? "unmeasured" : "measured" });
      sections.serps[owed.index] = cell;
      if (abandoned()) rescore(a);
    }
  };

  if (worthOneMore.length > 0 && mayAskAgain()) {
    await Promise.all(
      Array.from({ length: Math.min(parameters.serpFanout, worthOneMore.length) }, () => askAgain())
    );
  }

  logSerpLatency({
    asked: tookMs.length,
    measured: sections.serps.filter((serp) => serp.kind !== "unmeasured").length,
    slowestMs: tookMs.length === 0 ? 0 : Math.max(...tookMs),
    medianMs: medianOf(tookMs),
    abortMs: parameters.serpAbortMs,
  });
}

/** The middle of what the asks took (the lower of two in an even set): a figure for the log, not a statistic. */
function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/** One line per pass over the twelve: how many asked, how many came back and what it took. No query or customer. */
function logSerpLatency(fields: {
  asked: number;
  measured: number;
  slowestMs: number;
  medianMs: number;
  abortMs: number;
}): void {
  console.log(JSON.stringify({ event: "serp_latency", ...fields }));
}

/** One line per re-asked question: the failure that bought it and what it came back as, never the query. */
function logSerpRetry(fields: { because: string; outcome: "measured" | "unmeasured" }): void {
  console.log(JSON.stringify({ event: "serp_retry", ...fields }));
}
