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

  /** Issue 877: how long each ask took, so the tail is visible in the log
   *  without a query — and so the next abort value is chosen from what
   *  these calls take rather than from a guess (issue 875's was wrong). */
  const tookMs: number[] = [];

  /** One question's live SERP, with the vendor's own failure kind where
   *  there was one (issue 865). The cell is what this returns; nothing
   *  here writes to `sections`. */
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
        // The pass's clock, not the stage's (issue 1352): a queued read is
        // paid for when it is posted, and the pass waits for it.
        untilMs: untilCeiling(pass, parameters),
        onFailure: (failure) => {
          heard.failure = failure;
        },
      })
    );
    tookMs.push(Date.now() - startedMs);
    return { serp, failure: heard.failure };
  };

  /** The cell, carrying the vendor's own kind where the call failed (issue
   *  865): `undeterminable` says a cell could not be measured, `because`
   *  says what the pass was told — a vendor that timed out and a request it
   *  refused are not the same fact, and the second is not worth re-asking. */
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
  /** Issue 869: how the battery's two engines are answering this pass, so
   *  one that is refusing stops being bought. One watch per pass, shared by
   *  every worker. */
  const engines = newEngineWatch();
  /** Issue 865: the questions whose first ask failed in a way that is worth
   *  one more, asked again only once every question has been asked once. */
  const worthOneMore: { readonly index: number; readonly keyword: string; readonly because: string }[] = [];
  const buyOne = async (): Promise<void> => {
    for (;;) {
      const i = next;
      next += 1;
      const question = asked[i];
      if (question === undefined) return;
      if (bounds.stopNow() !== null) continue;
      // The SERP and the battery at once (#1160): neither reads the other,
      // and on the standard queue each is minutes of waiting. Asked one
      // after the other, a weekly question cost a SERP's wait and then the
      // engines' — longer than the whole ceiling.
      const [got, battery] = await Promise.all([
        askOne(question.search.keyword),
        parameters.batteryOnTheTwelve
          ? askTheBattery(a, question.search.keyword, questions.at, engines)
          : noBattery(questions.at),
      ]);
      // **A late answer is kept, and a sealed report is never written to**
      // (#539 review, re-cut by issue 875). The budget stops the pass
      // *waiting* for this stage; it cannot cancel a call already in
      // flight. The old guard read the stage's abandonment and dropped
      // whatever arrived after it — money spent, and an answer thrown away
      // (two of them on the free scans of 2026-09-17). What #539 was
      // actually protecting against is a write into a report that has
      // already been composed, and `sections.sealed` is exactly that line:
      // before it, an answer that arrives is still worth having and
      // `rescore` below counts it; after it, there is no report left to put
      // it in. Both writes happen together after the last await, so a
      // question's SERP and its battery are never half a pair.
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

  // **One more ask, and only one, and only after every question has had
  // its first** (issue 865).
  //
  // Production 2026-09-17: about an eighth of live SERP calls came back
  // `timeout` — our own request abort inside the vendor's latency tail,
  // which DataForSEO bills either way — and the cell was dropped and never
  // asked again. That is where "a fifth of the battery is unmeasured" came
  // from; the `not_attempted` tail on the same passes is the same call,
  // seen from the stage's clock, since a request that runs to the abort
  // holds one of `serpFanout` workers for all of it.
  //
  // **After the sweep, never inside it**: a question that has never been
  // asked outranks one that is being asked twice, so the retries take
  // whatever time and money the first sweep left and nothing that was owed
  // to a question still waiting.
  //
  // **It spends nothing the pass had not already set aside**: the retry is
  // an ordinary purchase through the same `CostContext`, so the cap is
  // checked against it exactly as it was against the first ask, and a
  // purse with no room refuses it rather than raising anything. A question
  // reserves the async-AI-Overview surcharge and a failed call settles the
  // base price, which is the room this ask is made in.
  //
  // **It is bounded by the pass, not by the stage** (D63, issue 1298). On
  // the free path a read that met its 10 s bound left three of the stage's
  // thirteen seconds, so the second ask was made and its answer dropped, or
  // never made. It is asked while the report is not composed, the purse
  // still holds it, and the pass's own ceiling leaves room for one whole
  // bound; `runStages` waits for it. A paid pass has no stage clock, and
  // this is the rule it always had.
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

/** The middle of what the asks took, the lower of the two in an even set —
 *  a figure, not a statistic: the p50 the next abort value is chosen from
 *  is the owner's, over a week of the rows these calls now carry (issue
 *  877). */
function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/** One line per pass over the twelve (issue 877): how many were asked, how
 *  many came back, and what the asking took. No query, no customer, no
 *  query text — the tail of a pass, readable from the deployment log. */
function logSerpLatency(fields: {
  asked: number;
  measured: number;
  slowestMs: number;
  medianMs: number;
  abortMs: number;
}): void {
  console.log(JSON.stringify({ event: "serp_latency", ...fields }));
}

/** One line per re-asked question (issue 865), carrying the failure that
 *  bought the second ask and what it came back as — never the query. */
function logSerpRetry(fields: { because: string; outcome: "measured" | "unmeasured" }): void {
  console.log(JSON.stringify({ event: "serp_retry", ...fields }));
}
