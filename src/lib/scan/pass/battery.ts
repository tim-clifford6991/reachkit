// src/lib/scan/pass/battery.ts — the AI battery: two engines per search, each dropped after repeated failures.
import type { VendorFailure } from "@/lib/costs";
import type { BatteryAnswers } from "@/lib/market/questions/matrix";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import { aiMode, llmScraper } from "@/lib/vendors/dataforseo";
import type { AiAnswer } from "@/lib/vendors/dataforseo/types";
import { attempt, cacheScope, failed, localeOfPass, noBattery, serpAbortFor, type StageArgs, untilCeiling } from "./sections";

/**
 * §6.2's paid battery for one question: engine 1 (ChatGPT, LLM Scraper)
 * and engine 2 (Google AI Mode). The third column, the AI Overview, was
 * already bought by the SERP above at "0¢ extra" and is not asked for
 * again.
 *
 * **Two calls, and the ceilings are re-checked before each** — §6.5:
 * "`capHit()` is re-checked between calls in any multi-call step", and
 * `bounds.stopNow()` is that check plus the report deadline, exactly as
 * the SERP loop above uses it. An engine the ceiling arrives before is
 * `not_attempted`; the pass keeps going and stores what it has.
 *
 * **An engine that did not answer degrades rather than throwing** (§6.5:
 * "Caps degrade … never throw"). A vendor that raised is `undeterminable`
 * — we asked and could not determine it — which is a different claim from
 * `no_answer`, the engine's own zero, and from `not_attempted`. Nothing
 * here can take the pass down: `attempt` catches, and the ChatGPT engine
 * failing does not stop AI Mode being asked.
 *
 * **AI Mode follows the pass's own SERP mode.** It is a SERP endpoint
 * priced at the SERP rows, and §6.4 rules "Live mode only where a human is
 * waiting" — so the onboarding deep pass buys it live and the scheduled
 * weekly pass buys it standard, which is §6.2's "AI Mode std" for the
 * weekly battery. The LLM Scraper has no live variant to choose: its own
 * type admits `"std"` alone.
 */
export async function askTheBattery(
  a: StageArgs,
  query: string,
  at: Date,
  watch: EngineWatch
): Promise<BatteryAnswers> {
  const { bounds, cost, parameters } = a;
  if (!parameters.battery) return noBattery(at);

  // Both engines at once (#1160): one engine's queue wait never delays
  // the other's answer, and a slow ChatGPT cannot cost AI Mode's column.
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
            // D63 (issue 1314): AI Mode waits as the pass's other SERP reads do.
            abortMs: serpAbortFor(bounds, parameters),
          })
        ),
  ]);

  return { chatgpt, aiMode: mode };
}

/** The two engines the battery buys, as this pass watches them. */
type BatteryEngine = "chatgpt" | "ai_mode";

/**
 * **An engine that is refusing is not bought for the rest of the pass**
 * (issue 869).
 *
 * One engine failing says nothing; the same engine failing twice running
 * is a vendor that is not going to answer this pass, and every further
 * question would buy the same refusal. The cells it would have filled are
 * `unmeasured`, carrying what the engine last said — which is a different
 * claim from "there was no answer", and the readers keep them apart.
 *
 * A zero is not a failure and never counts here: a question Google serves
 * no AI Mode block for is measured (`TASK_NO_RESULTS`, issue 869), and an
 * engine answering "nothing here" for every question is answering.
 *
 * It bites on the asks that start after a refusal is known: the page
 * questions' and #865's retries. The twelve are asked at once, so the first
 * wave is bought before any refusal is known. Issue 869 also made an
 * engine that had not answered yet take one question at a time. On the
 * standard queue that cost a whole queue wait, one to three minutes, before
 * the other eleven were asked, and a weekly pass could not fit it in its
 * ceiling (#1160). That turn-taking is gone. An outage now costs at most
 * one ask per question, 1.44¢ for ChatGPT across the twelve, inside the
 * `WEEKLY` cap.
 */
interface EngineWatch {
  readonly failures: Map<BatteryEngine, number>;
  readonly because: Map<BatteryEngine, string>;
}

/** Two in a row, counted per pass. */
const ENGINE_GIVE_UP_AFTER = 2;

export function newEngineWatch(): EngineWatch {
  return { failures: new Map(), because: new Map() };
}

/** One engine's answer, with a raise turned into the arm that is true of
 *  it. The vendor's own refusals — a `FREE` context, a cap already hit —
 *  come back as `Measured` arms and pass through untouched.
 *
 *  Issue 869: the vendor's own failure kind is heard here, so a refusing
 *  engine stops being bought and the cell says what it was told. */
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

/** One line the first time a pass gives up on an engine (issue 869),
 *  carrying the engine and what it last said — never the query. */
function logEngineDropped(fields: { engine: BatteryEngine; because: string; after: number }): void {
  console.log(JSON.stringify({ event: "battery_engine_dropped", ...fields }));
}
