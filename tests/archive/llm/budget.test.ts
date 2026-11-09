// tests/llm/budget.test.ts — issue #452, the arithmetic that says a free
// pass's inference fits in the invocation the platform gives it.
//
// The defect this file exists to keep from returning: `INFERENCE_TIMEOUT_MS`
// pinned a number, the vendor SDK's own `maxRetries` default silently
// multiplied it by three, and nothing anywhere added the result up against
// the bound the pass actually runs under. The M3 live run of 2026-09-10
// (production at 57b3c29) is what a missing sum looks like from outside —
// every `profile` call cut off at 3 s × 3 attempts, so no production free
// scan ever produced a market profile, and without one the report carries no
// rivals, no AI-answer cells and an unmeasured score.
//
// Three pins and one literal are all it takes to add up, and the literal is
// read out of the route's own source rather than retyped: `maxDuration`
// cannot be imported (Next reads route segment config out of the source at
// build time, so it has to be spelled there as a literal — see the comment
// on it), and a test that retyped 60 would keep passing after someone moved
// it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FREE_PASS_INFERENCE_CALLS,
  INFERENCE_MAX_RETRIES,
  INFERENCE_TIMEOUT_MS,
} from "../../src/lib/config/constants.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** The platform's ceiling on the invocation the free pass runs inside, in
 *  seconds, read from the one place it is spelled (#443). */
function routeMaxDurationS(): number {
  const source = readFileSync(path.join(ROOT, "src/app/api/scan/route.ts"), "utf8");
  const match = /^export const maxDuration = (\d+);$/m.exec(source);
  if (match === null) {
    throw new Error("src/app/api/scan/route.ts no longer declares `export const maxDuration = <n>;`");
  }
  return Number(match[1]);
}

/** What one `llm()` call can spend, worst case, from the pins alone: the
 *  tier's budget times the attempts the vendor client is allowed to make
 *  inside one request. `llm()`'s own parse retry does **not** appear as a
 *  second factor — it shares the one budget rather than starting a fresh
 *  one (`runAttempts`'s deadline, `src/lib/llm/index.ts`), which is the
 *  half of this arithmetic `tests/llm/seam.test.ts` asserts behaviourally. */
function worstCaseMsPerCall(tier: "nano" | "haiku"): number {
  return INFERENCE_TIMEOUT_MS[tier] * (INFERENCE_MAX_RETRIES + 1);
}

describe("the free pass's inference budget fits the platform's bound on the invocation (#452)", () => {
  it("the route still declares the platform bound this arithmetic is against", () => {
    expect(routeMaxDurationS()).toBe(60);
  });

  it("the whole of a free pass's inference — every nano call, every attempt inside each — is inside that bound", () => {
    const inferenceMs = worstCaseMsPerCall("nano") * FREE_PASS_INFERENCE_CALLS;
    expect(inferenceMs).toBeLessThanOrEqual(routeMaxDurationS() * 1000);
  });

  it(
    "and leaves at least half of it to the rest of the pass — the two own fetches, robots.txt, " +
      "`keyword_suggestions`, `ranked_keywords` and the twelve live SERPs, none of which this seam bounds",
    () => {
      const inferenceMs = worstCaseMsPerCall("nano") * FREE_PASS_INFERENCE_CALLS;
      const boundMs = routeMaxDurationS() * 1000;
      expect(boundMs - inferenceMs).toBeGreaterThanOrEqual(boundMs / 2);
    }
  );

  it("the vendor SDK's own retry layer cannot multiply the budget behind the pin's back — that multiplication is the defect", () => {
    expect(INFERENCE_MAX_RETRIES).toBe(0);
    expect(worstCaseMsPerCall("nano")).toBe(INFERENCE_TIMEOUT_MS.nano);
    // The shape the live run actually ran under — 3 s pinned, the SDK's
    // default of two retries taken, ~9 s of attempts and nothing measured.
    // One call now gets more wall clock than all three of those together,
    // and gets it as one attempt that can actually finish.
    const theOldBurnMs = 3000 * (2 + 1);
    expect(worstCaseMsPerCall("nano")).toBeGreaterThan(theOldBurnMs);
  });

  it(
    "one nano call is long enough for a real structured call from a cold function — 3 s never was, " +
      "and 15 s is the working assumption #452 states, to be confirmed by the next live run (#317)",
    () => {
      expect(INFERENCE_TIMEOUT_MS.nano).toBeGreaterThanOrEqual(15_000);
    }
  );

  it("haiku is not on the free path, and its own budget is still inside the same bound should it ever be", () => {
    expect(worstCaseMsPerCall("haiku")).toBeLessThanOrEqual(routeMaxDurationS() * 1000);
  });
});
