// tests/scan/ceilings-pins.test.ts — issue #456
//
// **The two ceilings, in the only order that works.** The free pass runs
// inside the `POST /api/scan` invocation. It bounds itself by
// `TIMING.reportCeilingS` and, on losing that race, stores the *partial
// report* ADR-021 promises the reader. The platform bounds the invocation
// itself by `export const maxDuration` on that route, and where the two
// disagree the platform wins: it freezes the process, no ending is
// emitted, no report is stored, and the row is swept to `failed`.
//
// So a design ceiling at or above the platform's can never fire, and the
// promise it exists to keep can never be kept. This file is the check that
// the numbers stay ordered — design ceiling under the platform's, with
// margin to write the report; the free pass's own inference arithmetic
// inside the design ceiling; the sweep's threshold above the platform's.
//
// It reads the route's source rather than importing it, for the reason the
// route's own comment gives: `maxDuration` must be a literal Next can
// extract at build time, so it cannot be reached from `constants.ts` the
// way every other pin is. Two spellings of one fact are safe only while
// something fails when they part. This is that something — the pattern
// `tests/app/scan-address/api-scan.test.ts` already uses on the same file.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as pins from "@/lib/config/constants";

const { INFERENCE_TIMEOUT_MS, TIMING } = pins;

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const ROUTE_SOURCE = read("src/app/api/scan/route.ts");

/** The free path's inference calls, one per module that makes one: BUILD
 *  §6.7 step 1 (`profile`) and step 4 (`phrase`), which
 *  `src/lib/market/questions/phrase.ts` records as settled at two nano
 *  calls. Counted from the sources below rather than asserted as a number,
 *  so a third call added to the free path fails this arithmetic instead of
 *  quietly eating the ceiling. */
const FREE_PASS_NANO_CALL_SITES = [
  "src/lib/market/questions/profile.ts",
  "src/lib/market/questions/phrase.ts",
] as const;

function nanoCallsIn(rel: string): number {
  return (read(rel).match(/tier:\s*"nano"/g) ?? []).length;
}

/** Retries the SDK is allowed per call. #452/#455 pins this as
 *  `INFERENCE_MAX_RETRIES`; until that lands the arithmetic reads the
 *  no-retry floor, which is the only value that makes a per-call timeout a
 *  per-call bound at all. Read through the pins module so the pin takes
 *  over the moment it exists, with no second edit here. */
const maxRetries = (pins as unknown as { INFERENCE_MAX_RETRIES?: number }).INFERENCE_MAX_RETRIES ?? 0;

describe("the free pass's two ceilings — issue #456", () => {
  it("the design ceiling is 50 s, and it is below the platform's, not above it", () => {
    expect(TIMING.reportCeilingS).toBe(50);
    expect(TIMING.platformCeilingS).toBe(60);
    expect(TIMING.reportCeilingS).toBeLessThan(TIMING.platformCeilingS);
  });

  it("the gap between them is the room the pass has to decide an ending and store the partial report", () => {
    // Not a second pin: the assertion is that the gap is real and not a
    // rounding, which is what ADR-021's promise actually rests on.
    expect(TIMING.platformCeilingS - TIMING.reportCeilingS).toBeGreaterThanOrEqual(10);
  });

  it("the target the pass aims at is below the ceiling that stops it", () => {
    expect(TIMING.reportTargetS).toBe(40);
    expect(TIMING.reportTargetS).toBeLessThan(TIMING.reportCeilingS);
  });

  it("`platformCeilingS` is the same number the route declares to the platform, and the route still spells it once", () => {
    const matches = [...ROUTE_SOURCE.matchAll(/^export const maxDuration = (\d+);$/gm)];
    expect(matches).toHaveLength(1);
    expect(Number(matches[0]![1])).toBe(TIMING.platformCeilingS);
  });

  it("the free path's inference arithmetic fits inside the design ceiling", () => {
    const calls = FREE_PASS_NANO_CALL_SITES.reduce((total, rel) => total + nanoCallsIn(rel), 0);
    expect(calls).toBe(2);
    const worstCaseMs = INFERENCE_TIMEOUT_MS.nano * (maxRetries + 1) * calls;
    expect(worstCaseMs).toBeLessThanOrEqual(TIMING.reportCeilingS * 1000);
  });

  it("the sweep's threshold is past the platform's ceiling, so it never races a pass storing its report", () => {
    const staleAfterS = TIMING.platformCeilingS + TIMING.sweepMarginS;
    expect(TIMING.sweepMarginS).toBe(30);
    expect(staleAfterS).toBeGreaterThan(TIMING.platformCeilingS);
    expect(staleAfterS).toBeGreaterThan(TIMING.reportCeilingS);
  });

  it("the sweep reads both pins and never the design ceiling", () => {
    const sweep = read("src/lib/scan/stuck.ts");
    const arithmetic = sweep.match(/const staleAfterMs = .+;/);
    expect(arithmetic?.[0]).toContain("TIMING.platformCeilingS");
    expect(arithmetic?.[0]).toContain("TIMING.sweepMarginS");
    expect(arithmetic?.[0]).not.toContain("reportCeilingS");
    expect(sweep).not.toMatch(/TIMING\.reportCeilingS\s*\*/);
  });
});
