/**
 * Per-scan external-API cost accounting.
 *
 * DataForSEO and Tavily are the dominant per-user cost — far above the Anthropic
 * LLM spend already tracked in `pipeline_runs.cost_cents`. This module captures
 * that spend at the source and attributes it to the running scan.
 *
 * How it works:
 *  - `runInCostContext(sink, fn)` establishes an AsyncLocalStorage sink for the
 *    duration of `fn`. Every adapter call underneath — however deep — lands its
 *    cost in that sink WITHOUT threading a scanId through ~15 function signatures.
 *  - `recordExternalCost(vendor, usd)` adds to the current sink (a no-op when
 *    there's no context, e.g. a unit test or an out-of-scan call).
 *  - The Inngest step wrapping the work reads the sink afterwards and flushes the
 *    delta onto the `scans` row (see `flushExternalCost` in scan-telemetry.ts).
 *
 * The AsyncLocalStorage context lives ONLY within a single Inngest `step.run`
 * callback — it does not (and must not) cross step boundaries, so each cost-
 * bearing step establishes its own sink and flushes its own delta additively.
 *
 * Cache-safe by construction: cost is recorded at the adapter's post-`res.json()`
 * point, which only executes on a real network call. A `cachedJson` cache hit
 * never reaches the adapter, so it records nothing — exactly right.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type ExternalVendor = "dataforseo" | "tavily";

/** Mutable running total, in USD, per vendor. */
export interface CostSink {
  dataforseo: number;
  tavily: number;
  /**
   * External soft cap, USD (invariant #2). When the DFS+Tavily running total
   * crosses it, `breached` flips true — recording NEVER throws (a mid-adapter
   * throw risks corrupt partials; #9 handles them but clean degradation is
   * better). Callers poll `externalCapBreached()` BEFORE each expensive step
   * group and skip remaining external enrichment on breach.
   */
  capUsd?: number;
  breached: boolean;
}

export function newCostSink(capUsd?: number): CostSink {
  return { dataforseo: 0, tavily: 0, capUsd, breached: false };
}

const storage = new AsyncLocalStorage<CostSink>();

/** Run `fn` with `sink` as the active cost context; adapter costs accrue into it. */
export function runInCostContext<T>(sink: CostSink, fn: () => Promise<T>): Promise<T> {
  return storage.run(sink, fn);
}

/**
 * Add an external-API cost (USD) to the active sink. No-op outside a scan
 * context. Negative/NaN amounts are ignored defensively — a malformed
 * `body.cost` must never corrupt the tally or throw into the adapter.
 */
export function recordExternalCost(vendor: ExternalVendor, usd: number): void {
  if (!Number.isFinite(usd) || usd <= 0) return;
  const sink = storage.getStore();
  if (!sink) return;
  sink[vendor] += usd;
  if (sink.capUsd !== undefined && !sink.breached && sink.dataforseo + sink.tavily >= sink.capUsd) {
    sink.breached = true;
    console.warn(
      `[cost-context] external soft cap breached: $${(sink.dataforseo + sink.tavily).toFixed(4)} >= $${sink.capUsd.toFixed(2)} — remaining external enrichment will degrade`,
    );
  }
}

/**
 * True when the active sink's external soft cap has been crossed. Checked
 * BEFORE expensive step groups (market analysis, synthesis sub-gathers) so a
 * runaway scan degrades to the existing zero-state/partial paths instead of
 * spending without bound. Always false outside a cost context.
 */
export function externalCapBreached(): boolean {
  return storage.getStore()?.breached ?? false;
}

/**
 * Record the cost of a DataForSEO response. Every v3 endpoint returns the exact
 * USD charged at the top level of the envelope (`cost`), so we read it rather
 * than estimate. A cache-served response reports `cost: 0`.
 */
export function recordDataForSeoCost(body: unknown): void {
  const cost = (body as { cost?: unknown } | null)?.cost;
  recordExternalCost("dataforseo", typeof cost === "number" ? cost : Number(cost) || 0);
}

// ---------------------------------------------------------------------------
// Tavily — no cost is returned; it bills in credits on fixed rules.
// ---------------------------------------------------------------------------

/** Tavily endpoints we call, for credit accounting. */
export type TavilyEndpoint = "search" | "extract";

/**
 * Credits a Tavily call consumes, per Tavily's published rules:
 *   - search:  basic = 1 credit, advanced = 2 credits
 *   - extract: 1 credit per 5 URLs (basic), 2 credits per 5 URLs (advanced)
 * Deterministic from the request shape — no response field needed.
 */
export function tavilyCredits(
  endpoint: TavilyEndpoint,
  opts: { depth?: "basic" | "advanced"; urlCount?: number } = {},
): number {
  const advanced = opts.depth === "advanced";
  if (endpoint === "search") return advanced ? 2 : 1;
  // extract: charged per started group of 5 URLs.
  const groups = Math.max(1, Math.ceil((opts.urlCount ?? 1) / 5));
  return groups * (advanced ? 2 : 1);
}

/** Record a Tavily call's cost = credits × the configured $/credit rate. */
export function recordTavilyCost(
  endpoint: TavilyEndpoint,
  usdPerCredit: number,
  opts: { depth?: "basic" | "advanced"; urlCount?: number } = {},
): void {
  recordExternalCost("tavily", tavilyCredits(endpoint, opts) * usdPerCredit);
}
