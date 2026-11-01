// BUILD §6.3 — the closed list's shared plumbing
// What every endpoint does the same way, so each endpoint module holds only what differs:
// 1. The envelope: `{ tasks: [{ id, status_code, result }] }`. 20000 is done, 20100 queued, 40601/40602 in flight.
// 2. The standard queue (BUILD §6.4 "everything scheduled = standard queue"): `task_post`, then poll `task_get` until done
//    or the earlier of `VENDOR.stdQueueDeadlineMin` and the caller's `untilMs`, since no between-calls check reaches this wait.
// 3. The seam mapping: every call runs inside `CostContext.recordFetch` (BUILD §6.5) and never throws. A failure is a row,
//    never a `null`, because `fetches.payload` is `not null`. A failure and `[]` are both "empty payload", never served from
//    cache (BUILD §6.4: "an empty payload is always a miss; no negative cache"). Cap-skipped → `unmeasured / not_attempted`,
//    failure → `unmeasured / undeterminable`, `[]` → `zero`, rows → `measured`. Zero rows is billed, never `unmeasured` (§6.6).
// 4. What a failure costs: an `http_<n>` or `task_<code>` refusal of a live call or of a `task_post` ran nothing and is
//    ledgered at 0. Anything else may have been charged (§6.5: "money already spent is always ledgered"), so it is ledgered
//    at the reservation: over-count an uncharged call rather than under-count a charged one. A funds refusal is always 0.
import type { CostContext, VendorFailure } from "@/lib/costs";
import { isVendorFailure } from "@/lib/costs";
import { VENDOR } from "@/lib/config/constants";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import type { Locale } from "@/lib/locale/locales";
import { resolvedHost } from "@/lib/market/rivals/domains";
import { sendGet, sendRequest, type DataForSeoMode, type SerpDepth, type TransportFailure } from "./transport";

/** Task-level status codes the queue flow reads, vendor-documented. */
const TASK_OK = 20000;
const TASK_CREATED = 20100;
const TASK_IN_FLIGHT = new Set([40601, 40602]); // Task Handed · Task In Queue

/** `40102` "no search results.": the task ran and is billed, so it is the zero-result `[]`, never "could not measure".
 *  It is AI Mode's ordinary answer for a query with no AI Mode block
 *  (https://dataforseo.com/help-center/what-does-the-40102-error-mean). */
const TASK_NO_RESULTS = 40102;

/** `40103` — "task execution failed, please try to resubmit the task." The vendor asks for one more ask. */
const TASK_EXECUTION_FAILED = 40103;

/** "Payment required" and "insufficient funds" (https://docs.dataforseo.com/v3/appendix/errors/),
 *  at the top level or on the task, and HTTP 402. `50001` is the vendor's own balance check failing, not funds. */
const FUNDS_CODES: ReadonlySet<number> = new Set([40200, 40210]);
const FUNDS_KINDS: ReadonlySet<string> = new Set(["http_402", ...[...FUNDS_CODES].map((code) => `task_${code}`)]);

/** A refusal for lack of credit: the vendor ran nothing and charged nothing. */
export function isFundsRefusal(kind: string): boolean {
  return FUNDS_KINDS.has(kind);
}

const MS_PER_S = 1000;
const MS_PER_MIN = 60 * MS_PER_S;

interface VendorTask {
  id?: unknown;
  status_code?: unknown;
  status_message?: unknown;
  cost?: unknown;
  result?: unknown;
}

/** Every way a DataForSEO call can fail, closed — the
 *  `vendorFailure` a failed call's ledger row carries. The transport's own
 *  four, plus: a task-level error code (`task_<code>`), a standard-queue
 *  task still not ready at the pinned deadline (`deadline`), and a mode the
 *  endpoint has no surface for (`no_surface`, never sent). A response with
 *  no task, a completed task with no result, and a result the parser does
 *  not recognise are all `unparseable`, except a response whose top-level
 *  code is a funds refusal, which is that `task_<code>`. */
export type VendorFailureKind = TransportFailure | `task_${number}` | "deadline" | "no_surface";

/**
 * Whether one more ask is worth making inside the same pass. Deliberately narrow: a clock, a connection, a 429 or a 5xx
 * may go right the second time, and `task_40103` asks to be resubmitted. Anything else is the same answer twice, so
 * asking again would only spend. `task_40102` is not a failure at all (`TASK_NO_RESULTS`).
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
      /** The vendor processed the request and returned nothing:
       *  `TASK_NO_RESULTS`. The seam reads it as the zero-result `[]`, so
       *  `parse` is never asked to make sense of a result that is not
       *  there. */
      noResults?: true;
      /** What the vendor says it charged for this call, in cents — see
       *  `chargedCents`. Absent where the response carried no figure. */
      vendorCents?: number;
      /** A live call's task: what a second request names to
       *  read something the vendor kept from the first. */
      taskId?: string;
    }
  | {
      ok: false;
      failure: VendorFailureKind;
      vendorCents?: number;
      /** Whether the vendor charges for a call that failed this way (the header's point 4). */
      billed: boolean;
      /** The log line's words; never stored. */
      reason: string;
      /** The standard-queue task this call posted, paid for and stopped
       *  waiting on. The vendor still finishes it, and reading it
       *  later is free, so the ledger row keeps the id. */
      taskId?: string;
    };

type Failed = Extract<VendorOutcome, { ok: false }>;

function failure(kind: VendorFailureKind, billed: boolean, reason: string): Failed {
  // A funds refusal ran nothing, so it is never billed whatever the step.
  return { ok: false, failure: kind, billed: billed && !isFundsRefusal(kind), reason };
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

/** A response with no task: a top-level funds refusal by its code, else one
 *  that could not be read. */
function noTask(payload: unknown, step: string): Failed {
  const code = isRecord(payload) ? payload.status_code : undefined;
  if (typeof code === "number" && FUNDS_CODES.has(code)) {
    return failure(`task_${code}`, false, `dataforseo: ${step}${code} ${asString(isRecord(payload) ? payload.status_message : undefined) ?? ""}`.trim());
  }
  return failure("unparseable", true, `dataforseo: ${step}response carries no task`);
}

/** The first `result` element of the first task, or the vendor's own
 *  status message as the reason it is not there. `accepted` is true where
 *  the vendor has already charged for the task (a standard-queue task
 *  whose `task_post` it accepted), so no failure read here is unbilled. */
function firstResult(payload: unknown, accepted: boolean): VendorOutcome {
  const task = firstTask(payload);
  if (!task) return noTask(payload, "");
  // The vendor's own zero-result, whatever it cost.
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

const CENTS_PER_USD = 100;

/**
 * The task's own `cost` in cents, from the response the vendor charged on (`task_post` on the queue; `task_get` says 0).
 * `ledgered` checks the price book against it, and the row stores it as `billed_cents` to hold against the balance.
 */
function chargedCents(payload: unknown): number | undefined {
  const usd = asNumber(firstTask(payload)?.cost);
  return usd === undefined ? undefined : usd * CENTS_PER_USD;
}

function withCharge(out: VendorOutcome, payload: unknown): VendorOutcome {
  const vendorCents = chargedCents(payload);
  return vendorCents === undefined ? out : { ...out, vendorCents };
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

/** The least one `task_get` is given, however near the deadline it is
 *  made: under this nothing answers, and the last look would be a
 *  timeout by construction. */
const MIN_POLL_ABORT_MS = 1_000;

export async function callEndpoint(
  paths: EndpointPaths,
  mode: DataForSeoMode,
  /** The site's country and language (D66), or `null` for the one family
   *  that takes none. Both legs of a queued call are the one task, so it
   *  rides on the post alone. */
  locale: Locale | null,
  fields: Record<string, unknown>,
  /** The wall clock each request of this call may hold — the
   *  caller's, where it has one. Both legs of the standard queue take it:
   *  a `task_get` is the same kind of request as the post that made it. */
  timeoutMs?: number,
  /** When the caller's own ceiling runs out, as epoch milliseconds. `timeoutMs` bounds one request, not the queue's
   *  poll, which otherwise runs to `VENDOR.stdQueueDeadlineMin`, far past any pass's ceiling. Past it the charged task is
   *  left and only the wait is abandoned. Already past, nothing is posted: a task nobody collects buys no answer. */
  untilMs?: number,
  /** How long the queue's poll waits between asks — the
   *  caller's, where somebody is waiting on it. Absent is
   *  `VENDOR.stdQueuePollIntervalS`. */
  pollMs?: number,
  /** How deep a SERP is read; absent is the transport's default. */
  depth?: SerpDepth
): Promise<VendorOutcome> {
  const extra = { ...(timeoutMs === undefined ? {} : { timeoutMs }), ...(depth === undefined ? {} : { depth }) };
  if (mode === "live") {
    if (!paths.live) return failure("no_surface", false, "dataforseo: endpoint has no live surface");
    const out = await sendRequest<unknown>({ path: paths.live, mode, locale, fields, ...extra });
    if (!out.ok) return fromTransport(out);
    const answer = withCharge(firstResult(out.payload, false), out.payload);
    const taskId = asString(firstTask(out.payload)?.id);
    return answer.ok && taskId !== undefined ? { ...answer, taskId } : answer;
  }

  if (!paths.std) return failure("no_surface", false, "dataforseo: endpoint has no standard-queue surface");
  // The post is what is charged, and its answer would arrive after the caller stopped.
  if (untilMs !== undefined && Date.now() >= untilMs) {
    return failure("deadline", false, "dataforseo: the caller's ceiling ran out before the task was posted");
  }
  const std = paths.std;
  const posted = await sendRequest<unknown>({ path: std.taskPost, mode, locale, fields, ...extra });
  if (!posted.ok) return fromTransport(posted);
  const task = firstTask(posted.payload);
  if (!task) return withCharge(noTask(posted.payload, "task_post "), posted.payload);
  const id = asString(task.id);
  if (task.status_code !== TASK_CREATED || !id) {
    // Not accepted, so not charged — unless the answer could not be read.
    const kind = task.status_code !== TASK_CREATED ? taskFailure(task.status_code) : "unparseable";
    return withCharge(
      failure(
        kind,
        kind === "unparseable",
        `dataforseo: task_post ${String(task.status_code)} ${asString(task.status_message) ?? ""}`.trim()
      ),
      posted.payload
    );
  }
  // From here the task is accepted and charged: every failure below is billed.

  // A slow task never holds a caller past its own ceiling.
  const deadline = Math.min(Date.now() + VENDOR.stdQueueDeadlineMin * MS_PER_MIN, untilMs ?? Number.POSITIVE_INFINITY);
  return withCharge(await awaitTask(std.taskGet, id, deadline, timeoutMs, pollMs), posted.payload);
}

/** Polls one accepted task until it completes or `deadline` passes. Every
 *  failure here is billed: the task was charged when it was posted. */
async function awaitTask(
  taskGet: (id: string) => string,
  id: string,
  deadline: number,
  timeoutMs?: number,
  pollMs?: number
): Promise<VendorOutcome> {
  const interval = pollMs ?? VENDOR.stdQueuePollIntervalS * MS_PER_S;
  for (;;) {
    // The last look is at the deadline, not an interval and a request's whole bound after it.
    const left = deadline - Date.now();
    await sleep(Math.max(0, Math.min(interval, left)));
    const lastAsk = Date.now() >= deadline;
    const untilDeadline = Math.max(MIN_POLL_ABORT_MS, deadline - Date.now());
    const got = await sendGet<unknown>(taskGet(id), Math.min(timeoutMs ?? VENDOR.requestAbortMs, untilDeadline));
    if (!got.ok) {
      // A lost ask says nothing about the paid task, so ask again while there is time.
      if (!lastAsk && worthAskingAgain(got.failure)) continue;
      return {
        ...failure(got.failure, true, got.reason),
        // The ask was lost, not the task: it can still be read.
        ...(worthAskingAgain(got.failure) ? { taskId: id } : {}),
      };
    }
    const polled = firstTask(got.payload);
    if (polled && typeof polled.status_code === "number" && TASK_IN_FLIGHT.has(polled.status_code)) {
      if (lastAsk || Date.now() >= deadline) {
        return {
          ...failure("deadline", true, "dataforseo: standard-queue task not ready by the pinned deadline"),
          taskId: id,
        };
      }
      continue;
    }
    return firstResult(got.payload, true);
  }
}

/**
 * Reads a task an earlier call posted and stopped waiting on. It
 * posts nothing and costs nothing: the task was charged at `task_post`, and
 * `task_get` is free. It waits until `untilMs` and answers as the first
 * call would have, with the id still on a failure that can be read later.
 */
export async function collectTask(paths: EndpointPaths, taskId: string, untilMs: number): Promise<VendorOutcome> {
  if (!paths.std) return failure("no_surface", false, "dataforseo: endpoint has no standard-queue surface");
  return awaitTask(paths.std.taskGet, taskId, untilMs);
}


/** A failure as the row the ledger stores: the kind, the
 *  endpoint (the ledger `source`), and whether the vendor bills it. The
 *  seam settles an unbilled one at 0 cents; the cache never serves one. */
function failureRow(source: string, out: Failed): VendorFailure {
  return {
    vendorFailure: out.failure,
    endpoint: source,
    billed: out.billed,
    ...(out.taskId === undefined ? {} : { taskId: out.taskId }),
    ...(isFundsRefusal(out.failure) ? { funds: true as const } : {}),
  };
}

/** Where the stage that made a call wants to hear why it failed —
 *  told once, after the row is ledgered, only for a failure this
 *  call bought (a cache hit is never a failure; a cap-skip is not one). */
export type OnVendorFailure = (failure: VendorFailure) => void;

/** Where a call site hears that its answer was not bought at all — it came
 *  back from `fetches`, and this is when the row that holds it was bought
 *  (SPEC §2). Told only on a hit, and never for a failure or a
 *  cap-skip, neither of which the cache ever serves. A caller that says
 *  "reused from {date}" to a reader reads the date here. */
export type OnReusedAnswer = (storedAt: Date) => void;

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
    onReused?: OnReusedAnswer;
  }
): Promise<Measured<T[]>> {
  const at = new Date();
  const startedMs = Date.now();
  let reason: string | undefined;
  let vendorCents: number | undefined;
  const settle = call.settleCents;

  const result = await c.recordFetch<T[] | VendorFailure>({
    source: call.source,
    cacheKey: call.cacheKey,
    freshnessDays: call.freshnessDays,
    costCents: call.costCents,
    ...(settle ? { settleCents: (p: T[] | VendorFailure) => settle(isVendorFailure(p) ? null : p) } : {}),
    billedCents: () => vendorCents,
    run: async () => {
      const out = await call.fetch();
      vendorCents = out.vendorCents;
      if (!out.ok) {
        reason = out.reason;
        return failureRow(call.source, out);
      }
      // Billed, so settled at the reservation, and never cached (§6.4), so the next pass asks again.
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
  // A cache hit is never a failure, so only a non-failure with a stored row was reused.
  if (!failed && result.storedAt !== null) call.onReused?.(result.storedAt);
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
  if (result.fresh) logCostMismatch(call.source, result.costCents, vendorCents);

  if (failed) {
    call.onFailure?.(failed);
    return unmeasured("undeterminable", at);
  }
  const rows = payload as T[];
  if (rows.length === 0) return measuredZero<T[]>([], at);
  return measured(rows, at);
}

/**
 * `ledgered`, for a call whose answer is more than its rows: `ranked_keywords`' `total_count` must be cached with them,
 * or every cache hit would lose it.
 * No rows is stored as `[]`, the zero `src/lib/costs/cache.ts` recognises, so it stays a miss and is bought again (§6.6).
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
  let vendorCents: number | undefined;

  type Payload = { rows: T[]; total: number | null } | [] | VendorFailure;

  const result = await c.recordFetch<Payload>({
    source: call.source,
    cacheKey: call.cacheKey,
    freshnessDays: call.freshnessDays,
    costCents: call.costCents,
    billedCents: () => vendorCents,
    run: async (): Promise<Payload> => {
      const out = await call.fetch();
      vendorCents = out.vendorCents;
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
  if (result.fresh) logCostMismatch(call.source, result.costCents, vendorCents);

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

/** The vendor-call log line. Its field set is closed, so nothing from the request, credential or query, reaches it. */
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

/** A hundred-thousandth of a cent: under any price the vendor lists, over
 *  what multiplying its dollars by a hundred leaves behind. */
const COST_TOLERANCE_C = 1e-5;

/** Warns when the ledgered price and the vendor's charge differ: the answer is good, but caps and spend mails read the
 *  wrong number. Silent without a figure; never asked about a cache hit. */
function logCostMismatch(source: string, ledgeredCents: number, vendorCents: number | undefined): void {
  if (vendorCents === undefined || Math.abs(vendorCents - ledgeredCents) <= COST_TOLERANCE_C) return;
  console.warn(JSON.stringify({ event: "vendor_cost_mismatch", source, ledgeredCents, vendorCents }));
}

/** A vendor reference's domain: the documented `domain` field, else the
 *  host of its `url`. Lower-cased and trimmed only — canonicalisation is
 *  the consumer's (`src/lib/market/rivals/domains.ts`). A reference behind a
 *  Google redirect that names no site is `""`, so an answer still shows it cited one. */
export function referenceDomain(ref: unknown): string | undefined {
  if (!isRecord(ref)) return undefined;
  const url = asString(ref.url);
  let domain = asString(ref.domain)?.trim().toLowerCase();
  try {
    domain ||= url ? new URL(url).hostname.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
  if (!domain) return undefined;
  return resolvedHost({ domain, url, websiteName: asString(ref.source) }) ?? "";
}

/** Addresses from a list of references, de-duplicated in vendor order.
 *  A reference that carries a domain and no address has none. */
export function referenceUrls(refs: unknown): string[] {
  const seen = new Set<string>();
  for (const ref of asArray(refs)) {
    const url = isRecord(ref) ? asString(ref.url) : undefined;
    if (url) seen.add(url.trim());
  }
  return [...seen];
}

/** Domains from a list of references, de-duplicated in vendor order. */
export function referenceDomains(refs: unknown): string[] {
  const seen = new Set<string>();
  for (const ref of asArray(refs)) {
    const domain = referenceDomain(ref);
    if (domain !== undefined) seen.add(domain);
  }
  return [...seen];
}
