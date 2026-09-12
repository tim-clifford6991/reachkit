// BUILD §6.3 — the one DataForSEO request builder and credential read (issue #23)
//
// The one place `env.DATAFORSEO_LOGIN` / `env.DATAFORSEO_PASSWORD` are read
// (risk: high — money, data leaving the system). Not exported through
// `index.ts` — the package's public barrel is exactly the six functions
// ARCHITECTURE.md names; this module is imported only from inside
// `src/lib/vendors/dataforseo/**`.
//
// **Credentials never appear in a log, a payload or an error message**
// (BP-008 `## Error & edge behavior`). The only place the raw login and
// password strings are read is `authorizationHeader()` below, and the only
// place that header is placed is a request's own `Authorization` field —
// never logged, never included in a thrown value or a `DataForSeoOutcome`.
//
// **Every call is fixed to `SERP_LOCATION` (Google US / en) and depth 10**
// (BP-008 `## Public interface`, both read from `constants.ts`, never a
// caller argument). `buildRequest` enforces this structurally: the three
// reserved task keys are deleted from whatever the caller supplies and then
// set from the pins, in that order, so a caller cannot shadow them even by
// constructing an object that carries those keys. `depth` is *set* only on
// the one vendor family that has a `depth` parameter — organic SERPs
// (`/v3/serp/google/organic/`); Labs, AI Mode and the LLM scraper have no
// such field and the vendor rejects unknown fields (`40501 Invalid Field`),
// so on those paths the key is stripped and left unset. Either way no
// caller can set it — the never-list's "SERP depth > 10" stays enforced by
// absence (BUILD §6.4).
//
// **Two request shapes, both built here.** Live endpoints are one `POST`.
// The standard queue (`mode: "std"`, BUILD §6.4 "everything scheduled =
// standard queue") is `task_post` followed by a `GET task_get/…/{id}` —
// `sendGet` below is that second leg, same credential, same outcome shape.
import { env } from "@/lib/config/env";
import { SERP_LOCATION } from "@/lib/config/constants";

const DATAFORSEO_BASE_URL = "https://api.dataforseo.com";

/** The one vendor path family whose tasks take `depth` (see header). */
const DEPTH_PATH_PREFIX = "/v3/serp/google/organic/";
const SERP_DEPTH = 10;

/** BP-008 decision 2's pattern, applied here at the transport level too:
 *  every request this module builds states which vendor API surface it
 *  targets — `'live'` (synchronous) or `'std'` (the vendor's cheaper,
 *  queued surface) — and there is no default. A call site that has not
 *  decided is a compile error, not an inherited value. */
export type DataForSeoMode = "live" | "std";

/** The three fields `buildRequest` fixes on every task, never accepted from
 *  a caller (BP-008: "Every call is fixed to SERP_LOCATION … and depth
 *  10"). Named once so the strip-then-set logic below and its test can
 *  both cite the same closed list. */
const RESERVED_TASK_KEYS = ["location_name", "language_code", "depth"] as const;

export interface DataForSeoRequestSpec {
  /** The literal vendor API path, e.g. `/v3/serp/google/organic/live/advanced`
   *  — supplied by the endpoint function that calls this builder (WO-024's,
   *  WO-025's), never derived from a caller-supplied string (decision 1: no
   *  export takes an endpoint name). */
  path: string;
  mode: DataForSeoMode;
  /** Endpoint-specific task fields — everything DataForSEO's own request
   *  body needs beyond the three pinned fields below. A key named among
   *  `RESERVED_TASK_KEYS` is silently dropped, never merged: those three
   *  are this module's alone to set. */
  fields?: Record<string, unknown>;
}

export interface DataForSeoRequest {
  url: string;
  method: "POST";
  headers: Readonly<Record<string, string>>;
  body: string;
}

/** The one place `env.DATAFORSEO_LOGIN` and `env.DATAFORSEO_PASSWORD` are
 *  read. Returns only the finished header value — the raw strings never
 *  leave this function's stack frame. */
function authorizationHeader(): string {
  const token = Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString("base64");
  return `Basic ${token}`;
}

/** Builds the one shape of request this module ever issues: `POST`, JSON
 *  body of one task, `SERP_LOCATION` and depth 10 fixed, credentials in the
 *  `Authorization` header only. Never exported outside this package. */
export function buildRequest(spec: DataForSeoRequestSpec): DataForSeoRequest {
  const task: Record<string, unknown> = { ...(spec.fields ?? {}) };
  for (const key of RESERVED_TASK_KEYS) delete task[key];
  task.location_name = SERP_LOCATION.location;
  task.language_code = SERP_LOCATION.language;
  if (spec.path.startsWith(DEPTH_PATH_PREFIX)) task.depth = SERP_DEPTH;

  return {
    url: `${DATAFORSEO_BASE_URL}${spec.path}`,
    method: "POST",
    headers: {
      Authorization: authorizationHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify([task]),
  };
}

/** Why a request came back without a body to read (issue #504), closed:
 *  the vendor answered a non-2xx status (`http_<n>`); `fetch` rejected
 *  on a timeout signal (`timeout`) or on anything else — a refused
 *  connection, a reset (`transport`); or a 2xx body that was not JSON
 *  (`unparseable`). */
export type TransportFailure = `http_${number}` | "timeout" | "transport" | "unparseable";

export type DataForSeoOutcome<T> =
  | { ok: true; payload: T }
  | { ok: false; failure: TransportFailure; reason: string };

/** Issues one `buildRequest`-built request through the platform's global
 *  `fetch` (the vendor host is one we authored, not a customer- or
 *  dataset-supplied URL — BP-006's `## Module / boundary`: "Vendor API
 *  calls do not [go through `safeFetch`]: they are BP-008's, to hosts we
 *  authored" — and `eslint.config.mjs`'s `no-fetch-outside-egress` rule
 *  carves `src/lib/vendors/**` out for exactly this reason). Never throws:
 *  every failure — a rejected `fetch`, a non-2xx status, an unparseable
 *  body — becomes `{ ok: false, reason }`, and `reason` is built from
 *  nothing but the response's own status/statusText or the caught error's
 *  `message`, never from the request (so never from its `Authorization`
 *  header). */
export async function sendRequest<T>(spec: DataForSeoRequestSpec): Promise<DataForSeoOutcome<T>> {
  const request = buildRequest(spec);
  return issue<T>(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
}

/** The standard queue's second leg: `GET {path}` (a `task_get/…/{id}`
 *  path the endpoint module builds from the vendor's own task id, never
 *  from caller input). Same credential placement, same never-throws
 *  outcome contract as `sendRequest`. */
export async function sendGet<T>(path: string): Promise<DataForSeoOutcome<T>> {
  return issue<T>(`${DATAFORSEO_BASE_URL}${path}`, {
    method: "GET",
    headers: { Authorization: authorizationHeader() },
  });
}

/** The wall clock one vendor request may hold, in milliseconds.
 *
 *  **There was no bound at all** (issue #539). `fetch` was called with no
 *  signal, so a vendor that accepted the connection and then said nothing
 *  held the request open until the platform froze the whole invocation —
 *  and `isTimeout` below, which exists to classify precisely that, could
 *  only ever have seen a timeout somebody else set. A free pass's stage
 *  budget (`src/lib/scan/budgets.ts`) bounds the *stage* around such a
 *  call, but the request itself is this module's to bound, and the two
 *  passes with no report deadline at all have nothing else that would.
 *
 *  10 s is under every per-stage budget in `STAGE_BUDGETS`, so a single
 *  unanswered request comes back as this module's own `timeout` failure —
 *  ledgered, and `undeterminable` for the one driver that asked — rather
 *  than being the thing that spends the whole stage. Reversal cost: one
 *  constant, this file only. */
const REQUEST_TIMEOUT_MS = 10_000;

async function issue<T>(url: string, init: RequestInit): Promise<DataForSeoOutcome<T>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    return {
      ok: false,
      failure: isTimeout(error) ? "timeout" : "transport",
      reason: `dataforseo: request failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
  if (!response.ok) {
    return { ok: false, failure: `http_${response.status}`, reason: `dataforseo: ${response.status} ${response.statusText}` };
  }
  try {
    const payload = (await response.json()) as T;
    return { ok: true, payload };
  } catch (error) {
    return {
      ok: false,
      failure: "unparseable",
      reason: `dataforseo: unparseable body: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

/** `AbortSignal.timeout()` rejects with a `TimeoutError`; an aborted
 *  signal with an `AbortError`. Either is the clock, not the network. */
function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
