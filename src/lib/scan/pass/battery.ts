// src/lib/scan/pass/battery.ts — the AI battery: two engines per search, each dropped after repeated failures.
import type { VendorFailure } from "@/lib/costs";
import type { BatteryAnswers } from "@/lib/market/questions/matrix";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import { aiMode, llmScraper } from "@/lib/vendors/dataforseo";
import type { AiAnswer } from "@/lib/vendors/dataforseo/types";
import { attempt, cacheScope, failed, localeOfPass, noBattery, serpAbortFor, type StageArgs, untilCeiling } from "./sections";

/** §6.2's paid battery for one question: ChatGPT (LLM Scraper) and Google AI Mode; the AI Overview came with the SERP at 0¢ extra.
 *  The ceilings are re-checked before each call (§6.5); an engine the ceiling arrives before is `not_attempted`.
 *  A failed engine degrades to `undeterminable` (not `no_answer`, the engine's own zero) and never throws or stops the other.
 *  AI Mode follows the pass's SERP mode (live only where a human waits, §6.4); the LLM Scraper admits `"std"` alone. */
export async function askTheBattery(
  a: StageArgs,
  query: string,
  at: Date,
  watch: EngineWatch
): Promise<BatteryAnswers> {
  const { bounds, cost, parameters } = a;
  if (!parameters.battery) return noBattery(at);

  // Both engines at once: one engine's queue wait never delays the other's answer.
  const [chatgpt, mode] = await Promise.all([
    bounds.stopNow() !== null
      ? unmeasured<AiAnswer>("not_attempted", at)
      : engineAnswer(at, "chatgpt", watch, (onFailure) =>
          llmScraper(cost, { query, mode: "std", scope: cacheScope(a), locale: localeOfPass(a), onFailure, untilMs: untilCeiling(bounds, parameters) })
        ),
    bounds.stopNow() !== null
      ? unmeasured<AiAnswer>("not_attempted", at)
      : engineAnswer(at, "ai_mode", watch, (onFailure) =>
          aiMode(cost, {
            query,
            mode: parameters.serpMode,
            scope: cacheScope(a),
            locale: localeOfPass(a),
            onFailure,
            untilMs: untilCeiling(bounds, parameters),
            // AI Mode waits as the pass's other SERP reads do.
            abortMs: serpAbortFor(bounds, parameters),
          })
        ),
  ]);

  return { chatgpt, aiMode: mode };
}

/** The two engines the battery buys, as this pass watches them. */
type BatteryEngine = "chatgpt" | "ai_mode";

/** An engine refusing twice running is not bought for the rest of the pass; its cells are `unmeasured` with what it last said, not "no answer".
 *  A zero is not a failure and never counts here. It bites on asks after a refusal is known (page questions, retries): the twelve go at once,
 *  so an outage costs at most one ask per question, inside the `WEEKLY` cap. */
interface EngineWatch {
  readonly failures: Map<BatteryEngine, number>;
  readonly because: Map<BatteryEngine, string>;
}

/** Two in a row, counted per pass. */
const ENGINE_GIVE_UP_AFTER = 2;

export function newEngineWatch(): EngineWatch {
  return { failures: new Map(), because: new Map() };
}

/** One engine's answer, with a raise turned into the arm that is true of it; the vendor's own refusals come back as `Measured` arms untouched.
 *  The failure kind is heard here, so a refusing engine stops being bought and the cell says what it was told. */
async function engineAnswer(
  at: Date,
  engine: BatteryEngine,
  watch: EngineWatch,
  work: (onFailure: (failure: VendorFailure) => void) => Promise<Measured<AiAnswer>>
): Promise<Measured<AiAnswer>> {
  const alreadyFailed = watch.failures.get(engine) ?? 0;
  if (alreadyFailed >= ENGINE_GIVE_UP_AFTER) {
    return unmeasured<AiAnswer>("not_attempted", at, watch.because.get(engine));
  }

  const heard: { failure: VendorFailure | null } = { failure: null };
  const answer = await attempt("asking_the_twelve", () =>
    work((failure) => {
      heard.failure = failure;
    })
  );

  if (heard.failure !== null) {
    const failures = (watch.failures.get(engine) ?? 0) + 1;
    watch.failures.set(engine, failures);
    watch.because.set(engine, heard.failure.vendorFailure);
    if (failures === ENGINE_GIVE_UP_AFTER) {
      logEngineDropped({ engine, because: heard.failure.vendorFailure, after: failures });
    }
  } else if (!failed(answer) && answer.kind !== "unmeasured") {
    // An answer of any kind, a zero included: the engine is answering, so
    // the count clears.
    watch.failures.set(engine, 0);
  }

  if (failed(answer)) return unmeasured<AiAnswer>("undeterminable", at);
  if (answer.kind === "unmeasured" && heard.failure !== null) {
    return unmeasured<AiAnswer>(answer.reason, answer.at, heard.failure.vendorFailure);
  }
  return answer;
}

/** One line the first time a pass gives up on an engine, with the engine and what it last said, never the query. */
function logEngineDropped(fields: { engine: BatteryEngine; because: string; after: number }): void {
  console.log(JSON.stringify({ event: "battery_engine_dropped", ...fields }));
}
