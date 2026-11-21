// A held page waits without hiding another page's outcome (production: one unpaid page read every tick "degraded").
import { describe, expect, it } from "vitest";
import { settle, type FanOutResult } from "../../src/jobs/fan-out";
type R = FanOutResult<{ readonly done: true } | { readonly degraded: string }>;
const held: R = { ok: true, value: { degraded: "held:unpaid" } };

describe("settle", () => {
  it("decides the tick by the pages that were not held", () => {
    expect(settle([held, { ok: true, value: { done: true } }], null).outcome).toBe("ran");
    expect(settle([held, { ok: true, value: { degraded: "publish:destination_unavailable" } }], null)).toMatchObject({ outcome: "degraded", step: "publish:destination_unavailable" });
  });
  it("rethrows a page's error over a hold", () => {
    expect(() => settle([held, { ok: false, error: new Error("boom") }], null)).toThrow("boom");
  });
});
