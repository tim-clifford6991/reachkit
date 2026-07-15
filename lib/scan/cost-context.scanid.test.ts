import { describe, it, expect } from "vitest";
import { newCostSink, runInCostContext, currentScanId } from "./cost-context";

/**
 * Invariant #2 — LLM spend must attribute to a scan (and thus to a user).
 *
 * External (DataForSEO/Tavily) spend reaches the scan row via the cost sink, but
 * LLM spend reaches it a DIFFERENT way: `callModel` writes a `pipeline_runs` row
 * keyed by scanId. Callers that pass `scanId: null` (the content/distribution
 * draft generators and the whole synthesis gather) therefore used to record real
 * Anthropic money against `scan_id = NULL` — money spent, attributable to
 * nothing. `currentScanId()` is what closes that: it exposes the ambient costed
 * step's scanId so `callModel` can fall back to it.
 *
 * These pin the contract `lib/llm/anthropic.ts` depends on.
 */
describe("currentScanId — the ambient scan for LLM cost attribution (invariant #2)", () => {
  it("is null outside any costed step (no context to bill)", () => {
    expect(currentScanId()).toBeNull();
  });

  it("returns the active costed step's scanId inside the context", async () => {
    const sink = newCostSink(undefined, "scan-abc");
    const seen = await runInCostContext(sink, async () => currentScanId());
    expect(seen).toBe("scan-abc");
  });

  it("survives async boundaries (the generators await deep inside)", async () => {
    const sink = newCostSink(undefined, "scan-deep");
    const seen = await runInCostContext(sink, async () => {
      await new Promise((r) => setTimeout(r, 1));
      const nested = async () => {
        await new Promise((r) => setTimeout(r, 1));
        return currentScanId();
      };
      return nested();
    });
    expect(seen).toBe("scan-deep");
  });

  it("does not leak the scanId outside the context", async () => {
    await runInCostContext(newCostSink(undefined, "scan-inner"), async () => currentScanId());
    expect(currentScanId()).toBeNull();
  });

  it("keeps concurrent scans isolated (two scans billing in parallel)", async () => {
    const [a, b] = await Promise.all([
      runInCostContext(newCostSink(undefined, "scan-a"), async () => {
        await new Promise((r) => setTimeout(r, 5));
        return currentScanId();
      }),
      runInCostContext(newCostSink(undefined, "scan-b"), async () => currentScanId()),
    ]);
    expect(a).toBe("scan-a");
    expect(b).toBe("scan-b");
  });

  it("defaults to null when a sink is created without a scanId (back-compat)", async () => {
    const seen = await runInCostContext(newCostSink(), async () => currentScanId());
    expect(seen).toBeNull();
  });
});
