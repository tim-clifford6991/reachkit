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
//    `VENDOR.stdQueuePollIntervalS` until the task completes or a deadline
//    passes — the earlier of `VENDOR.stdQueueDeadlineMin` and the
//    caller's own `untilMs`, because that wait is inside one call and a
//    caller that re-reads its ceiling between calls cannot reach it
//    (issue 902). Live mode is one `POST`.
//
// 3. **The seam mapping.** Every call runs inside `CostContext.recordFetch`
//    (BUILD §6.5) with `run()` returning `T[] | VendorFailure` and *never
//    throwing*. A failure — transport, non-20000 task, unparseable payload
//    — is a **row, never a `null`** (issue #504): `fetches.payload` is
//    `not null`, and a `null` handed to the ledger made the insert throw,
//    so the throw and not the vendor's failure became the stage's reason
//    (the same defect #479 fixed for a refused own-site fetch). `[]` is the
//    vendor's own zero-result. Both are the seam's "empty payload", so
//    neither is ever served back from cache (BUILD §6.4: "an empty payload
//    is always a miss; no negative cache"). The arm the caller sees:
//    cap-skipped → `unmeasured / not_attempted`; a failure → `unmeasured /
//    undeterminable`; `[]` → `zero`; rows → `measured`. Zero rows is a
//    legal, billed result and never `unmeasured` — the cold-start law
//    (§6.6).
//
// 4. **What a failed call costs** (issue #504; DATA-COSTS prices only the
//    completed task). DataForSEO charges for a task it accepted, and not
//    for a request it refused: an HTTP-level refusal (`http_<n>`) or a
//    task-level error code (`task_<code>`) on a live call, or on a
//    `task_post` the queue did not accept, is not billed, and is ledgered
//    at 0 cents. Everything else is ledgered at what was reserved, because
//    the money may be spent and §6.5 says "money already spent is always
//    ledgered": a timeout or a dropped connection (the vendor may have run
//    the task), a completed task whose result did not parse (it ran), and
//    any failure after the standard queue accepted a `task_post` (the
//    charge is taken at the post). The ledger over-counts a call that was
//    never charged rather than under-count one that was.
import type { CostContext, VendorFailure } from "@/lib/costs";
import { isVendorFailure } from "@/lib/costs";
import { VENDOR } from "@/lib/config/constants";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import { sendGet, sendRequest, type DataForSeoMode, type TransportFailure } from "./transport";

/** Task-level status codes the queue flow reads, vendor-documented. */
const TASK_OK = 20000;
const TASK_CREATED = 20100;
const TASK_IN_FLIGHT = new Set([40601, 40602]); // Task Handed · Task In Queue

/**
 * `40102` — **"no search results."**, and it is an answer, not a failure
 * (issue 869).
 *
 * DataForSEO's own appendix gives the message; their help centre gives the
 * meaning and the bill: "A `40102` response does not mean that the request
 * failed to reach the search engine… Because processing resources have
 * already been used, the request is billable even though no SERP items
 * were returned."
 * (https://docs.dataforseo.com/v3/appendix/errors/ ·
 * https://dataforseo.com/help-center/what-does-the-40102-error-mean)
 *
 * So the task ran and the engine returned nothing — which is the vendor's
 * own zero-result, the `[]` this seam already recognises, and never
 * "we could not measure it". On Google AI Mode it is the ordinary answer
 * for a query Google serves no AI Mode block for: on production
 * 2026-09-17, 9 of 14 AI Mode calls came back this way and every one of
 * them was stored `unmeasured/undeterminable`, which is what left the GEO
 * half of the measurement blank.
 *
 * Reading it as a zero settles it at what it reserved, too — the row used
 * to be ledgered at 0¢ against a vendor that charges for it.
 */
const TASK_NO_RESULTS = 40102;

/** `40103` — "task execution failed, please try to resubmit the task."
 *  The vendor asks for one more ask in so many words (issue 869). */
const TASK_EXECUTION_FAILED = 40103;

const MS_PER_S = 1000;
const MS_PER_MIN = 60 * MS_PER_S;

interface VendorTask {
  id?: unknown;
  status_code?: unknown;
  status_message?: unknown;
  result?: unknown;
}

/** Every way a DataForSEO call can fail, closed (issue #504) — the
 *  `vendorFailure` a failed call's ledger row carries. The transport's own
 *  four, plus: a task-level error code (`task_<code>`), a standard-queue
 *  task still not ready at the pinned deadline (`deadline`), and a mode the
 *  endpoint has no surface for (`no_surface`, never sent). A response with
 *  no task, a completed task with no result, and a result the parser does
 *  not recognise are all `unparseable`. */
export type VendorFailureKind = TransportFailure | `task_${number}` | "deadline" | "no_surface";

/**
 * Whether one more ask is worth making inside the same pass (issue 865).
 *
 * Production, 2026-09-17: 8 of 62 live SERP calls came back `timeout` — our
 * own `REQUEST_TIMEOUT_MS` abort, inside the latency tail of the live
 * endpoint — and DataForSEO bills those (the task may well have run). The
 * cell they were bought for was dropped and never asked again, which is
 * where "a fifth of the battery is unmeasured" came from.
 *
 * Closed, and deliberately narrow: a clock or a connection that went wrong
 * once may go right the second time, and a vendor under load answers a 429
 * or a 5xx it will not answer again. `task_40103` is here on the vendor's
 * own instruction — its message is "task execution failed, please try to
 * resubmit the task." (issue 869,
 * https://docs.dataforseo.com/v3/appendix/errors/). Everything else is the
 * same answer twice — a 4xx is this request, `unparseable` is this shape,
 * `no_surface` is this endpoint, and `deadline` is a standard-queue task
 * that already had every second its deadline allowed — the vendor's pin or
 * the caller's own ceiling, and neither is longer the second time — so
 * asking again would only spend. `task_40102` is not here because it is not a failure at all:
 * see `TASK_NO_RESULTS`.
 */
export function worthAskingAgain(kind: string): boolean {
  if (kind === "timeout" || kind === "transport") return true;
  if (kind === "http_429") return true;
  if (kind === `task_${TASK_EXECUTION_FAILED}`) return true;
  const status = /^http_(\d{3})$/.exec(kind);
  return status !== null && Number(status[1]) >= 500;
}

export type VendorOutcome =
  | {
      ok: true;
      result: unknown;
      /** The vendor processed the request and returned nothing (issue 869):
       *  `TASK_NO_RESULTS`. The seam reads it as the zero-result `[]`, so
       *  `parse` is never asked to make sense of a result that is not
       *  there. */
      noResults?: true;
    }
  | {
      ok: false;
      failure: VendorFailureKind;
      /** Whether the vendor charges for a call that failed this way — the
       *  header's point 4, decided where the failure is. */
      billed: boolean;
      /** The log line's words; never stored. */
      reason: string;
    };

type Failed = Extract<VendorOutcome, { ok: false }>;

function failure(kind: VendorFailureKind, billed: boolean, reason: string): Failed {
  return { ok: false, failure: kind, billed, reason };
}

/** A transport failure's bill: the vendor refused an `http_<n>` request
 *  before it ran; anything else may have run. */
function fromTransport(out: { failure: TransportFailure; reason: string }): Failed {
  return failure(out.failure, !out.failure.startsWith("http_"), out.reason);
}

/** A task-level status code the vendor answered, as a kind. */
function taskFailure(code: unknown): VendorFailureKind {
  return typeof code === "number" && Number.isInteger(code) ? `task_${code}` : "unparseable";
}

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
 *  status message as the reason it is not there. `accepted` is true where
 *  the vendor has already charged for the task (a standard-queue task
 *  whose `task_post` it accepted), so no failure read here is unbilled. */
function firstResult(payload: unknown, accepted: boolean): VendorOutcome {
  const task = firstTask(payload);
  if (!task) return failure("unparseable", true, "dataforseo: response carries no task");
  // The vendor's own zero-result, whatever it cost (issue 869).
  if (task.status_code === TASK_NO_RESULTS) return { ok: true, result: null, noResults: true };
  if (task.status_code !== TASK_OK) {
    const kind = taskFailure(task.status_code);
    return failure(
      kind,
      accepted || kind === "unparseable",
      `dataforseo: task ${String(task.status_code)} ${asString(task.status_message) ?? ""}`.trim()
    );
  }
  const result = asArray(task.result)[0];
  if (result === undefined) return failure("unparseable", true, "dataforseo: task completed with no result");
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
  fields: Record<string, unknown>,
  /** The wall clock each request of this call may hold (issue 875) — the
   *  caller's, where it has one. Both legs of the standard queue take it:
   *  a `task_get` is the same kind of request as the post that made it. */
  timeoutMs?: number,
  /** The instant the *caller's* own ceiling runs out, as epoch
   *  milliseconds — issue 902.
   *
   *  `timeoutMs` above bounds one request. It does not bound this call:
   *  the standard queue is `task_post` and then a poll that runs to
   *  `VENDOR.stdQueueDeadlineMin`, which is forty-five minutes — eleven
   *  times a whole paid pass's `TIMING.paidPassCeilingS` and nine times
   *  the `/api/jobs` invocation the pass runs in. A caller that re-reads
   *  its ceiling between calls, as every stage of a paid pass does, still
   *  cannot be held by one of these: the wait is inside the call, where
   *  no between-calls check can reach. So the caller hands its deadline
   *  in, and the poll below stops at whichever comes first.
   *
   *  Past it the task is left where it is: it was accepted and charged at
   *  `task_post`, and abandoning the *wait* is what the caller's ceiling
   *  buys. A deadline already gone when this is called posts nothing at
   *  all — an unbilled refusal, because a task nobody will collect is a
   *  purchase with no answer in it. */
  untilMs?: number
): Promise<VendorOutcome> {
  const abort = timeoutMs === undefined ? {} : { timeoutMs };
  if (mode === "live") {
    if (!paths.live) return failure("no_surface", false, "dataforseo: endpoint has no live surface");
    const out = await sendRequest<unknown>({ path: paths.live, mode, fields, ...abort });
    return out.ok ? firstResult(out.payload, false) : fromTransport(out);
  }

  if (!paths.std) return failure("no_surface", false, "dataforseo: endpoint has no standard-queue surface");
  // Nothing is posted against a ceiling that has already run out: the post
  // is what the vendor charges for, and its answer would arrive after the
  // only caller who wanted it had stopped (issue 902).
  if (untilMs !== undefined && Date.now() >= untilMs) {
    return failure("deadline", false, "dataforseo: the caller's ceiling ran out before the task was posted");
  }
  const std = paths.std;
  const posted = await sendRequest<unknown>({ path: std.taskPost, mode, fields, ...abort });
  if (!posted.ok) return fromTransport(posted);
  const task = firstTask(posted.payload);
  const id = task ? asString(task.id) : undefined;
  if (!task || task.status_code !== TASK_CREATED || !id) {
    // Not accepted, so not charged — unless the answer could not be read.
    const kind = task && task.status_code !== TASK_CREATED ? taskFailure(task.status_code) : "unparseable";
    return failure(
      kind,
      kind === "unparseable",
      `dataforseo: task_post ${String(task?.status_code)} ${asString(task?.status_message) ?? ""}`.trim()
    );
  }
  // From here the task is accepted and charged: every failure below is billed.

  // The earlier of the pinned queue deadline and the caller's own, so a
  // caller that must answer inside its ceiling is never held past it by a
  // task that is merely slow (issue 902).
  const deadline = Math.min(Date.now() + VENDOR.stdQueueDeadlineMin * MS_PER_MIN, untilMs ?? Number.POSITIVE_INFINITY);
  for (;;) {
    await sleep(VENDOR.stdQueuePollIntervalS * MS_PER_S);
    const got = await sendGet<unknown>(std.taskGet(id), timeoutMs);
    if (!got.ok) return failure(got.failure, true, got.reason);
    const polled = firstTask(got.payload);
    if (polled && typeof polled.status_code === "number" && TASK_IN_FLIGHT.has(polled.status_code)) {
      if (Date.now() >= deadline) return failure("deadline", true, "dataforseo: standard-queue task not ready by the pinned deadline");
      continue;
    }
    return firstResult(got.payload, true);
  }
}

/** A failure as the row the ledger stores (issue #504): the kind, the
 *  endpoint (the ledger `source`), and whether the vendor bills it. The
 *  seam settles an unbilled one at 0 cents; the cache never serves one. */
function failureRow(source: string, out: Failed): VendorFailure {
  return { vendorFailure: out.failure, endpoint: source, billed: out.billed };
}

/** Where the stage that made a call wants to hear why it failed (issue
 *  #504) — told once, after the row is ledgered, only for a failure this
 *  call bought (a cache hit is never a failure; a cap-skip is not one). */
export type OnVendorFailure = (failure: VendorFailure) => void;

/** The seam mapping described in the header. `parse` turns one vendor
 *  `result` into the product rows (an empty array for the vendor's own
 *  zero-result) or `undefined` when the shape is not one it recognises.
 *  `settleCents`, where given, sees the rows, or `null` for a failure the
 *  vendor bills (an unbilled one settles at 0 cents in the seam). */
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
    onFailure?: OnVendorFailure;
  }
): Promise<Measured<T[]>> {
  const at = new Date();
  const startedMs = Date.now();
  let reason: string | undefined;
  const settle = call.settleCents;

  const result = await c.recordFetch<T[] | VendorFailure>({
    source: call.source,
    cacheKey: call.cacheKey,
    freshnessDays: call.freshnessDays,
    costCents: call.costCents,
    ...(settle ? { settleCents: (p: T[] | VendorFailure) => settle(isVendorFailure(p) ? null : p) } : {}),
    run: async () => {
      const out = await call.fetch();
      if (!out.ok) {
        reason = out.reason;
        return failureRow(call.source, out);
      }
      // "no search results." — the engine answered with nothing (issue
      // 869). The zero-result this seam already has a word for, settled at
      // what it reserved because the vendor charges for it, and never
      // cached (§6.4: no negative cache), so the next pass asks again.
      if (out.noResults === true) return [];
      const rows = call.parse(out.result);
      if (rows === undefined) {
        reason = "dataforseo: unparseable result";
        // The task completed and was charged; only its shape was new.
        return failureRow(call.source, failure("unparseable", true, reason));
      }
      return rows;
    },
  });

  if ("skipped" in result) {
    logVendorCall({ source: call.source, outcome: "cap", rows: 0, costCents: 0, fresh: false, durationMs: Date.now() - startedMs });
    return unmeasured("not_attempted", at);
  }

  const payload = result.payload;
  const failed = isVendorFailure(payload) ? payload : undefined;
  logVendorCall({
    source: call.source,
    outcome: failed ? "failed" : "ok",
    rows: failed ? 0 : (payload as T[]).length,
    costCents: result.costCents,
    fresh: result.fresh,
    durationMs: Date.now() - startedMs,
    ...(failed ? { failure: failed.vendorFailure, billed: failed.billed } : {}),
    ...(reason ? { reason } : {}),
  });

  if (failed) {
    call.onFailure?.(failed);
    return unmeasured("undeterminable", at);
  }
  const rows = payload as T[];
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
 * `null`/`undefined`/`[]` (and a refusal or a vendor failure row) and
 * nothing else, and it must keep recognising this call's zero: a vendor
 * answer with no rows is cached as `[]`, so it stays a miss and is
 * re-bought and re-ledgered, which is BP-007 decision 3 and the cold-start
 * law. Only a non-empty answer travels as `{ rows, total }`.
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
    onFailure?: OnVendorFailure;
  }
): Promise<Measured<{ rows: readonly T[]; total: number | null }>> {
  const at = new Date();
  const startedMs = Date.now();
  let reason: string | undefined;

  type Payload = { rows: T[]; total: number | null } | [] | VendorFailure;

  const result = await c.recordFetch<Payload>({
    source: call.source,
    cacheKey: call.cacheKey,
    freshnessDays: call.freshnessDays,
    costCents: call.costCents,
    run: async (): Promise<Payload> => {
      const out = await call.fetch();
      if (!out.ok) {
        reason = out.reason;
        return failureRow(call.source, out);
      }
      const parsed = call.parse(out.result);
      if (parsed === undefined) {
        reason = "dataforseo: unparseable result";
        return failureRow(call.source, failure("unparseable", true, reason));
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
  const failed = isVendorFailure(payload) ? payload : undefined;
  const rows = failed || Array.isArray(payload) ? [] : (payload as { rows: T[] }).rows;
  logVendorCall({
    source: call.source,
    outcome: failed ? "failed" : "ok",
    rows: rows.length,
    costCents: result.costCents,
    fresh: result.fresh,
    durationMs: Date.now() - startedMs,
    ...(failed ? { failure: failed.vendorFailure, billed: failed.billed } : {}),
    ...(reason ? { reason } : {}),
  });

  if (failed) {
    call.onFailure?.(failed);
    return unmeasured("undeterminable", at);
  }
  // A domain that ranks for nothing: zero rows and a total of zero, which
  // is a measurement and not an absence.
  if (Array.isArray(payload)) return measuredZero<{ rows: readonly T[]; total: number | null }>({ rows: [], total: 0 }, at);
  const answer = payload as { rows: T[]; total: number | null };
  return measured({ rows: answer.rows, total: answer.total }, at);
}

/** BP-008's observability line — endpoint, rows returned, cost, cache hit
 *  or miss, duration, and for a failed call its kind and bill. Field set is
 *  closed; nothing from the request (so never the credential, never a
 *  query) reaches it. */
function logVendorCall(record: {
  source: string;
  outcome: "ok" | "failed" | "cap";
  rows: number;
  costCents: number;
  fresh: boolean;
  durationMs: number;
  failure?: VendorFailureKind | string;
  billed?: boolean;
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
