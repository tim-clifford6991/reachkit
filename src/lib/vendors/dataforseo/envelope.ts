// BUILD §6.3 — the closed list's shared plumbing (issue #23)
//
// Three things every one of the six endpoint functions does the same way,
// written once so `labs.ts`, `serp.ts` and `ai.ts` hold only what differs:
//
// 1. **The vendor envelope.** Every DataForSEO response is
//    `{ tasks: [{ id, status_code, result: [...] }] }`; a task-level
//    `status_code` of 20000 is a completed task, 20100 a task the standard
//    queue has accepted, 40601/40602 a task still in flight. `firstResult`
//    reads the one result the product asked for or says why it cannot.
//
// 2. **The standard queue** (`mode: "std"` — BUILD §6.4: "everything
//    scheduled = standard queue"). `task_post`, then poll `task_get` every
//    `VENDOR.stdQueuePollIntervalS` until the task completes or
//    `VENDOR.stdQueueDeadlineMin` passes. Live mode is one `POST`.
//
// 3. **The seam mapping.** Every call runs inside `CostContext.recordFetch`
//    (BUILD §6.5) with `run()` returning `T[] | null` and *never throwing*:
//    `null` is a vendor failure (transport, non-20000 task, unparseable
//    payload), `[]` is the vendor's own zero-result — both are the seam's
//    "empty payload", so neither is ever served back from cache (BUILD §6.4:
//    "an empty payload is always a miss; no negative cache") and both are
//    ledgered at the reservation (§6.5: "money already spent is always
//    ledgered"). The arm the caller sees: cap-skipped → `unmeasured /
//    not_attempted`; `null` → `unmeasured / undeterminable`; `[]` →
//    `zero`; rows → `measured`. Zero rows is a legal, billed result and
//    never `unmeasured` — the cold-start law (§6.6).
import type { CostContext } from "@/lib/costs";
import { VENDOR } from "@/lib/config/constants";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import { sendGet, sendRequest, type DataForSeoMode } from "./transport";

/** Task-level status codes the queue flow reads, vendor-documented. */
const TASK_OK = 20000;
const TASK_CREATED = 20100;
const TASK_IN_FLIGHT = new Set([40601, 40602]); // Task Handed · Task In Queue

const MS_PER_S = 1000;
const MS_PER_MIN = 60 * MS_PER_S;

interface VendorTask {
  id?: unknown;
  status_code?: unknown;
  status_message?: unknown;
  result?: unknown;
}

export type VendorOutcome = { ok: true; result: unknown } | { ok: false; reason: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstTask(payload: unknown): VendorTask | undefined {
  if (!isRecord(payload)) return undefined;
  const task = asArray(payload.tasks)[0];
  return isRecord(task) ? (task as VendorTask) : undefined;
}

/** The first `result` element of the first task, or the vendor's own
 *  status message as the reason it is not there. */
function firstResult(payload: unknown): VendorOutcome {
  const task = firstTask(payload);
  if (!task) return { ok: false, reason: "dataforseo: response carries no task" };
  if (task.status_code !== TASK_OK) {
    return { ok: false, reason: `dataforseo: task ${String(task.status_code)} ${asString(task.status_message) ?? ""}`.trim() };
  }
  const result = asArray(task.result)[0];
  if (result === undefined) return { ok: false, reason: "dataforseo: task completed with no result" };
  return { ok: true, result };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One vendor endpoint, both surfaces: `live` is the vendor's
 *  `…/live/advanced` path in one POST; `std` is `…/task_post` and then
 *  `…/task_get/advanced/{id}` polled until the task completes or the pinned
 *  deadline passes. `taskGet` receives the vendor-issued id only. Labs is
 *  live-only and the LLM scraper standard-only; a mode the endpoint has no
 *  surface for is a failure outcome, never a different endpoint. */
export interface EndpointPaths {
  live?: string;
  std?: { taskPost: string; taskGet: (id: string) => string };
}

export async function callEndpoint(
  paths: EndpointPaths,
  mode: DataForSeoMode,
  fields: Record<string, unknown>
): Promise<VendorOutcome> {
  if (mode === "live") {
    if (!paths.live) return { ok: false, reason: "dataforseo: endpoint has no live surface" };
    const out = await sendRequest<unknown>({ path: paths.live, mode, fields });
    return out.ok ? firstResult(out.payload) : out;
  }

  if (!paths.std) return { ok: false, reason: "dataforseo: endpoint has no standard-queue surface" };
  const std = paths.std;
  const posted = await sendRequest<unknown>({ path: std.taskPost, mode, fields });
  if (!posted.ok) return posted;
  const task = firstTask(posted.payload);
  const id = task ? asString(task.id) : undefined;
  if (!task || task.status_code !== TASK_CREATED || !id) {
    return { ok: false, reason: `dataforseo: task_post ${String(task?.status_code)} ${asString(task?.status_message) ?? ""}`.trim() };
  }

  const deadline = Date.now() + VENDOR.stdQueueDeadlineMin * MS_PER_MIN;
  for (;;) {
    await sleep(VENDOR.stdQueuePollIntervalS * MS_PER_S);
    const got = await sendGet<unknown>(std.taskGet(id));
    if (!got.ok) return got;
    const polled = firstTask(got.payload);
    if (polled && typeof polled.status_code === "number" && TASK_IN_FLIGHT.has(polled.status_code)) {
      if (Date.now() >= deadline) return { ok: false, reason: "dataforseo: standard-queue task not ready by the pinned deadline" };
      continue;
    }
    return firstResult(got.payload);
  }
}

/** The seam mapping described in the header. `parse` turns one vendor
 *  `result` into the product rows (an empty array for the vendor's own
 *  zero-result) or `undefined` when the shape is not one it recognises.
 *  `settleCents`, where given, sees the same `T[] | null` `run()` returns. */
export async function ledgered<T>(
  c: CostContext,
  call: {
    source: string;
    cacheKey: string;
    freshnessDays: number;
    costCents: number;
    settleCents?: (rows: readonly T[] | null) => number;
    fetch: () => Promise<VendorOutcome>;
    parse: (result: unknown) => T[] | undefined;
  }
): Promise<Measured<T[]>> {
  const at = new Date();
  const startedMs = Date.now();
  let failure: string | undefined;

  const result = await c.recordFetch<T[] | null>({
    source: call.source,
    cacheKey: call.cacheKey,
    freshnessDays: call.freshnessDays,
    costCents: call.costCents,
    ...(call.settleCents ? { settleCents: call.settleCents } : {}),
    run: async () => {
      const out = await call.fetch();
      if (!out.ok) {
        failure = out.reason;
        return null;
      }
      const rows = call.parse(out.result);
      if (rows === undefined) {
        failure = "dataforseo: unparseable result";
        return null;
      }
      return rows;
    },
  });

  if ("skipped" in result) {
    logVendorCall({ source: call.source, outcome: "cap", rows: 0, costCents: 0, fresh: false, durationMs: Date.now() - startedMs });
    return unmeasured("not_attempted", at);
  }

  const rows = result.payload;
  logVendorCall({
    source: call.source,
    outcome: rows === null ? "failed" : "ok",
    rows: rows?.length ?? 0,
    costCents: result.costCents,
    fresh: result.fresh,
    durationMs: Date.now() - startedMs,
    ...(failure ? { reason: failure } : {}),
  });

  if (rows === null) return unmeasured("undeterminable", at);
  if (rows.length === 0) return measuredZero<T[]>([], at);
  return measured(rows, at);
}

/**
 * `ledgered`, for a call whose answer is more than its rows (#117).
 *
 * The only endpoint that needs this today is `ranked_keywords`, whose
 * `total_count` is the size of the domain rather than of the page of rows
 * bought — a fact `Measured<T[]>` has nowhere to put and, more to the
 * point, nowhere to *cache*. A total read off the response and dropped
 * before `recordFetch` would be missing on every cache hit, and a 30-day
 * rival window means almost every read is one.
 *
 * **The zero-result shape is normalised here, at the call site, exactly as
 * `src/lib/costs/cache.ts`'s header requires.** That seam recognises
 * `null`/`undefined`/`[]` and nothing else, and it must keep recognising
 * this call's zero: a vendor answer with no rows is cached as `[]`, so it
 * stays a miss and is re-bought and re-ledgered, which is BP-007 decision
 * 3 and the cold-start law. Only a non-empty answer travels as
 * `{ rows, total }`.
 */
export async function ledgeredWithTotal<T>(
  c: CostContext,
  call: {
    source: string;
    cacheKey: string;
    freshnessDays: number;
    costCents: number;
    fetch: () => Promise<VendorOutcome>;
    parse: (result: unknown) => { rows: T[]; total: number | null } | undefined;
  }
): Promise<Measured<{ rows: readonly T[]; total: number | null }>> {
  const at = new Date();
  const startedMs = Date.now();
  let failure: string | undefined;

  type Payload = { rows: T[]; total: number | null } | [] | null;

  const result = await c.recordFetch<Payload>({
    source: call.source,
    cacheKey: call.cacheKey,
    freshnessDays: call.freshnessDays,
    costCents: call.costCents,
    run: async (): Promise<Payload> => {
      const out = await call.fetch();
      if (!out.ok) {
        failure = out.reason;
        return null;
      }
      const parsed = call.parse(out.result);
      if (parsed === undefined) {
        failure = "dataforseo: unparseable result";
        return null;
      }
      // The vendor's own zero-result, in the shape the cache reads as one.
      return parsed.rows.length === 0 ? [] : parsed;
    },
  });

  if ("skipped" in result) {
    logVendorCall({ source: call.source, outcome: "cap", rows: 0, costCents: 0, fresh: false, durationMs: Date.now() - startedMs });
    return unmeasured("not_attempted", at);
  }

  const payload = result.payload;
  const rows = payload === null || Array.isArray(payload) ? [] : payload.rows;
  logVendorCall({
    source: call.source,
    outcome: payload === null ? "failed" : "ok",
    rows: rows.length,
    costCents: result.costCents,
    fresh: result.fresh,
    durationMs: Date.now() - startedMs,
    ...(failure ? { reason: failure } : {}),
  });

  if (payload === null) return unmeasured("undeterminable", at);
  // A domain that ranks for nothing: zero rows and a total of zero, which
  // is a measurement and not an absence.
  if (Array.isArray(payload)) return measuredZero<{ rows: readonly T[]; total: number | null }>({ rows: [], total: 0 }, at);
  return measured({ rows: payload.rows, total: payload.total }, at);
}

/** BP-008's observability line — endpoint, rows returned, cost, cache hit
 *  or miss, duration. Field set is closed; nothing from the request (so
 *  never the credential, never a query) reaches it. */
function logVendorCall(record: {
  source: string;
  outcome: "ok" | "failed" | "cap";
  rows: number;
  costCents: number;
  fresh: boolean;
  durationMs: number;
  reason?: string;
}): void {
  console.log(JSON.stringify({ event: "vendor_call", ...record }));
}

/** A vendor reference's domain: the documented `domain` field, else the
 *  host of its `url`. Lower-cased and trimmed only — canonicalisation is
 *  the consumer's (`src/lib/market/rivals/domains.ts`, ADR-020). */
export function referenceDomain(ref: unknown): string | undefined {
  if (!isRecord(ref)) return undefined;
  const direct = asString(ref.domain);
  if (direct) return direct.trim().toLowerCase();
  const url = asString(ref.url);
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Domains from a list of references, de-duplicated in vendor order. */
export function referenceDomains(refs: unknown): string[] {
  const seen = new Set<string>();
  for (const ref of asArray(refs)) {
    const domain = referenceDomain(ref);
    if (domain) seen.add(domain);
  }
  return [...seen];
}
