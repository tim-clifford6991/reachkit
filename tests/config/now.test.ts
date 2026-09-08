// tests/config/now.test.ts — BUILD §15, issue #305
//
// The one clock the render path reads, and the binding a real deployment is
// not allowed to carry.
//
// The claims worth having are the last two: that a frozen clock is refused
// where it would serve a customer a date that is not the date, and that the
// refusal is what happens when the question "is this deployment real" cannot
// be answered — an absent or unparsable app URL counts as real, so a
// half-configured process fails closed rather than freezing time.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FIXED_NOW_BINDING,
  FixedClockRefused,
  assertClockBinding,
  fixedNow,
  isRealDeployment,
  now,
} from "@/lib/config/now";

const FROZEN = "2026-09-08T12:00:00.000Z";

/** The three bindings this module reads, restored around every case: it
 *  reads `process.env` on each call by design, so a case that left one set
 *  would decide the next one. */
const READS = [FIXED_NOW_BINDING, "VERCEL", "NEXT_PUBLIC_APP_URL"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(READS.map((key) => [key, process.env[key]]));
  for (const key of READS) delete process.env[key];
  // The ordinary local shape: a loopback app URL, no platform binding.
  process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
});

afterEach(() => {
  for (const key of READS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("the wall clock, where nothing is bound", () => {
  it("answers the real instant and freezes nothing", () => {
    const before = Date.now();
    const answered = now().getTime();
    expect(fixedNow()).toBeNull();
    expect(answered).toBeGreaterThanOrEqual(before);
    expect(answered).toBeLessThanOrEqual(Date.now());
  });

  it("treats an empty binding as no binding — never as an unparsable one", () => {
    process.env[FIXED_NOW_BINDING] = "";
    expect(fixedNow()).toBeNull();
    expect(() => assertClockBinding()).not.toThrow();
  });
});

describe("the frozen clock, where the deployment is not real", () => {
  it("answers the bound instant, every time it is asked", () => {
    process.env[FIXED_NOW_BINDING] = FROZEN;
    expect(now().toISOString()).toBe(FROZEN);
    expect(now().toISOString()).toBe(FROZEN);
    expect(fixedNow()?.toISOString()).toBe(FROZEN);
  });

  it("boots", () => {
    process.env[FIXED_NOW_BINDING] = FROZEN;
    expect(() => assertClockBinding()).not.toThrow();
  });

  it("refuses the boot on a value that is not an instant, rather than falling back", () => {
    // The fallback is the dangerous arm: a typo would leave the sweep taking
    // pictures against the wall clock and calling them frozen, which is the
    // bug this issue is about wearing a green tick.
    process.env[FIXED_NOW_BINDING] = "last Tuesday";
    expect(() => assertClockBinding()).toThrow(FixedClockRefused);
  });
});

describe("a real deployment refuses it", () => {
  it("is real on the platform, whatever the app URL says", () => {
    process.env.VERCEL = "1";
    expect(isRealDeployment()).toBe(true);
  });

  it("is real when it tells customers to reach it somewhere that is not this machine", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://dev.reachkit.app";
    expect(isRealDeployment()).toBe(true);
  });

  it("fails closed: an absent or unparsable app URL is real", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(isRealDeployment()).toBe(true);
    process.env.NEXT_PUBLIC_APP_URL = "not a url";
    expect(isRealDeployment()).toBe(true);
  });

  it("throws out of the boot when one carries the binding", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://dev.reachkit.app";
    process.env[FIXED_NOW_BINDING] = FROZEN;
    expect(() => assertClockBinding()).toThrow(FixedClockRefused);
  });

  it("reads the wall clock even before the boot has refused it", () => {
    // The reader does not depend on the boot having run: an instance that
    // somehow served a request first still answers the real instant, so the
    // worst case is a refused deployment rather than a wrong date.
    process.env.VERCEL = "1";
    process.env[FIXED_NOW_BINDING] = "2019-01-01T00:00:00.000Z";
    expect(fixedNow()).toBeNull();
    expect(now().getTime()).toBeGreaterThan(Date.parse("2026-01-01T00:00:00.000Z"));
  });
});
