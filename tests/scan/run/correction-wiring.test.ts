// tests/scan/run/correction-wiring.test.ts — issue #25.
//
// The one seam between the market correction and the pipeline. The
// correction route refuses with `scanning_unavailable` when no runner is
// registered — a true refusal only while no pipeline is reachable. Nothing
// in `correction.ts` reaches into `run.ts` (that would be a cycle), so the
// registration is a module-load side effect, and a side effect nobody
// triggers is a refusal that lies. This suite is the check that it is
// triggered: on the pipeline's own module, and on the route that reads it.
import { describe, expect, it, vi } from "vitest";
import "./harness";

vi.mock("@/lib/db", () => ({ dbAdmin: () => ({}), db: () => ({}) }));

describe("the pipeline registers itself as the correction runner", () => {
  it("is registered by loading `run.ts`", async () => {
    const { correctionRunner } = await import("../../../src/lib/scan/correction");
    expect(correctionRunner()).toBeNull();

    await import("../../../src/lib/scan/run");
    expect(typeof correctionRunner()).toBe("function");
  });

  it("the correction route's own module graph loads it", async () => {
    vi.resetModules();
    const { correctionRunner } = await import("../../../src/lib/scan/correction");
    expect(correctionRunner()).toBeNull();

    await import("../../../src/app/api/report/[domain]/correct/route");
    expect(typeof correctionRunner()).toBe("function");
  });
});
