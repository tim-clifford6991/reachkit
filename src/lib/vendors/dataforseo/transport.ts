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
// **Every call is made in the site's own country and language, and at depth
// 10** (SPEC §6, owner D66 of 2026-10-07, issue 1311; before it every call
// was fixed to Google US / en). The locale is the caller's — the site's,
// read or confirmed — and it is one row of `src/lib/locale`'s closed list:
// `buildRequest` writes the vendor's name for that row's country and its
// language, and has no other source for either. The three reserved task
// keys are still deleted from whatever the caller's `fields` carry and then
// set here, so a locale cannot arrive as a free string in `fields`, and
// `depth` cannot arrive at all. `depth` is *set* only on the vendor
// families that have a `depth` parameter — organic SERPs and the news
// search; Labs, AI Mode and the LLM scraper have no such field and the
// vendor rejects unknown fields (`40501 Invalid Field`), so on those paths
// the key is stripped and left unset. The same is true of the locale on one
// family: LLM Mentions declares neither field, and its dataset is
// US/English by construction, so `NO_LOCALE_PATH_PREFIX` below leaves them
// unset there (SPEC §6, 2026-09-22, #1004) and its spec carries `null`.
//
// **Two request shapes, both built here.** Live endpoints are one `POST`.
// The standard queue (`mode: "std"`, BUILD §6.4 "everything scheduled =
// standard queue") is `task_post` followed by a `GET task_get/…/{id}` —
// `sendGet` below is that second leg, same credential, same outcome shape.
import { env } from "@/lib/config/env";
import { VENDOR } from "@/lib/config/constants";
import { COUNTRIES, localeOf, type Locale } from "@/lib/locale/locales";

const DATAFORSEO_BASE_URL = "https://api.dataforseo.com";

/** The vendor path families whose tasks take `depth` (see header): organic
 *  SERPs and, since D48 (SPEC §7, 2026-10-04), the news search, which is
 *  billed by the ten results like the organic one. */
const DEPTH_PATH_PREFIXES = ["/v3/serp/google/organic/", "/v3/serp/google/news/"] as const;
const SERP_DEPTH = 10;

/** LLM Mentions (SPEC §6, 2026-09-22, #1004) — the one path family whose
 *  tasks take **no locale fields at all**, and the reason the two pins
 *  below are set per family rather than unconditionally.
 *
 *  `search_mentions` declares neither `location_name` nor `language_code`,
 *  and the vendor rejects a field an endpoint does not declare with
 *  `40501 Invalid Field` at $0.00 — the same refusal the pilot's own
 *  `search_scope` mistake drew (#1003). The database is US/English by
 *  construction, so there is no locale to select and nothing is lost by
 *  omitting them; the pilot's successful run of 2026-09-22 sent neither.
 *
 *  This is the `depth` rule again, one family further: a pin is set where
 *  the vendor has a field for it, and stripped everywhere else, and a
 *  caller can still set none of them. */
const NO_LOCALE_PATH_PREFIX = "/v3/ai_optimization/llm_mentions";

/** The path families that are read from a city (SPEC §6, owner D67 of
 *  2026-10-07, issue 1318): Google's own results, organic and AI Mode,
 *  which the vendor serves from any of the cities on its list. Labs holds
 *  volumes by country alone and the ChatGPT scraper is asked by country,
 *  so on every other family a place's read is made in its country. */
const PLACE_PATH_PREFIXES = ["/v3/serp/google/organic/", "/v3/serp/google/ai_mode/"] as const;

/** The vendor's name for where a read is made: the place's own where the
 *  site serves one, the vendor lists it and the path is read by city; else
 *  the country's. A place's name is the vendor's own, taken from its list
 *  (`locations.ts`), and one that does not end in the locale's country is
 *  not used: a stored string never moves a read to another country. */
function locationName(path: string, locale: Locale): string {
  const country = COUNTRIES[locale.country].location;
  const city = locale.place?.location;
  if (city === undefined || !city.endsWith(`,${country}`) || city.length > 160) return country;
  return PLACE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)) ? city : country;
}

/** A locale as the cache key of a read made by city spells it: the
 *  country's key, and the city where the read is made there (D67). A
 *  business with no place keeps the key it had. */
export function placeCacheKey(locale: Locale): string {
  const city = locationName(PLACE_PATH_PREFIXES[0], locale);
  return city === COUNTRIES[locale.country].location ? localeCacheKey(locale) : `${localeCacheKey(locale)}|${city}`;
}

/** The LLM Mentions family, for the endpoint module that builds its paths
 *  (`mentions.ts`) — one spelling, so the prefix that is exempted and the
 *  path that is exempted cannot drift apart. */
export const LLM_MENTIONS_PATH_PREFIX = NO_LOCALE_PATH_PREFIX;

/** BP-008 decision 2's pattern, applied here at the transport level too:
 *  every request this module builds states which vendor API surface it
 *  targets — `'live'` (synchronous) or `'std'` (the vendor's cheaper,
 *  queued surface) — and there is no default. A call site that has not
 *  decided is a compile error, not an inherited value. */
export type DataForSeoMode = "live" | "std";

/** The three fields `buildRequest` alone writes on a task: the two the
 *  spec's `locale` decides, and the depth. Never taken from `fields`. Named
 *  once so the strip-then-set logic below and its test can both cite the
 *  same closed list. */
const RESERVED_TASK_KEYS = ["location_name", "language_code", "depth"] as const;

export interface DataForSeoRequestSpec {
  /** The literal vendor API path, e.g. `/v3/serp/google/organic/live/advanced`
   *  — supplied by the endpoint function that calls this builder (WO-024's,
   *  WO-025's), never derived from a caller-supplied string (decision 1: no
   *  export takes an endpoint name). */
  path: string;
  mode: DataForSeoMode;
  /** The country and language this read is made in (D66): the site's own,
   *  one row of the closed list. `null` only for the one family that takes
   *  no locale at all (`NO_LOCALE_PATH_PREFIX`). Required, never defaulted:
   *  a default would measure somebody's market in the wrong country
   *  without anyone having decided it. */
  locale: Locale | null;
  /** Endpoint-specific task fields — everything DataForSEO's own request
   *  body needs beyond the three pinned fields below. A key named among
   *  `RESERVED_TASK_KEYS` is silently dropped, never merged: those three
   *  are this module's alone to set. */
  fields?: Record<string, unknown>;
  /** The wall clock this one request may hold (issue 875). Absent is
   *  `REQUEST_TIMEOUT_MS`, which is what every call outside the free path's
   *  twelve takes. It is per call and never per module because one process
   *  serves every tier. */
  timeoutMs?: number;
}

/** A locale as every cache key of this package spells it: the vendor's
 *  country name and the language, so a read bought in one country is never
 *  served to a site in another (D66). The United States in English is
 *  spelled as it was before D66, so the reads held from then still serve. */
export function localeCacheKey(locale: Locale): string {
  return `${COUNTRIES[locale.country].location}|${locale.language}`;
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
 *  body of one task, the spec's locale and depth 10 written here,
 *  credentials in the `Authorization` header only. Never exported outside
 *  this package.
 *
 *  Throws on a locale that is not a row of the list, and on a path that
 *  takes one being handed none: both are a caller's mistake, made before
 *  anything is bought. */
export function buildRequest(spec: DataForSeoRequestSpec): DataForSeoRequest {
  const task: Record<string, unknown> = { ...(spec.fields ?? {}) };
  for (const key of RESERVED_TASK_KEYS) delete task[key];
  if (!spec.path.startsWith(NO_LOCALE_PATH_PREFIX)) {
    const locale = spec.locale === null ? null : localeOf(spec.locale.country, spec.locale.language);
    if (locale === null) throw new Error(`dataforseo: ${spec.path} was asked for in a locale that is not on the list`);
    task.location_name = locationName(spec.path, { ...locale, ...(spec.locale?.place === undefined ? {} : { place: spec.locale.place }) });
    task.language_code = locale.language;
  }
  if (DEPTH_PATH_PREFIXES.some((prefix) => spec.path.startsWith(prefix))) task.depth = SERP_DEPTH;

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
  return issue<T>(
    request.url,
    {
      method: request.method,
      headers: request.headers,
      body: request.body,
    },
    spec.timeoutMs
  );
}

/** The standard queue's second leg: `GET {path}` (a `task_get/…/{id}`
 *  path the endpoint module builds from the vendor's own task id, never
 *  from caller input). Same credential placement, same never-throws
 *  outcome contract as `sendRequest`. */
export async function sendGet<T>(path: string, timeoutMs?: number): Promise<DataForSeoOutcome<T>> {
  return issue<T>(
    `${DATAFORSEO_BASE_URL}${path}`,
    {
      method: "GET",
      headers: { Authorization: authorizationHeader() },
    },
    timeoutMs
  );
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
 *  than being the thing that spends the whole stage.
 *
 *  **It is the default, not the rule** (issue 875): a caller may name a
 *  shorter one, and the free path's question SERPs do — 10 s under a
 *  13-second stage at a fan-out of four is a quarter of that stage held by
 *  one stuck call. The pin lives in `constants.ts` with the free path's
 *  beside it. */
const REQUEST_TIMEOUT_MS = VENDOR.requestAbortMs;

async function issue<T>(url: string, init: RequestInit, timeoutMs?: number): Promise<DataForSeoOutcome<T>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs ?? REQUEST_TIMEOUT_MS) });
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
