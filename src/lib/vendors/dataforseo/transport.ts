// BUILD §6.3 — the one DataForSEO request builder and credential read
// Imported only inside `src/lib/vendors/dataforseo/**`, never through `index.ts`.
// Credentials are read only in `authorizationHeader()` and placed only in a request's `Authorization` field: never
// logged, thrown or put in a `DataForSeoOutcome`.
// Every call is made in the site's country and language (SPEC §6, D66), one row of `src/lib/locale`'s closed list.
// The reserved task keys are stripped from the caller's `fields` and set here, so a locale cannot arrive as a free string.
// `depth` is set only on families that take it; the vendor rejects unknown fields (`40501 Invalid Field`), and On-Page
// declares no locale either (`NO_LOCALE_PATH_PREFIXES`).
// Live is one `POST`; the standard queue (BUILD §6.4 "everything scheduled = standard queue") adds `sendGet` for `task_get`.
import { env } from "@/lib/config/env";
import { VENDOR } from "@/lib/config/constants";
import { COUNTRIES, localeOf, type Locale } from "@/lib/locale/locales";

const DATAFORSEO_BASE_URL = "https://api.dataforseo.com";

/** The path families whose tasks take `depth`: organic SERPs and the news search (D48), both billed per ten results. */
const DEPTH_PATH_PREFIXES = ["/v3/serp/google/organic/", "/v3/serp/google/news/"] as const;

/** On-Page (SPEC §6) reads one address in a browser, and an address has no
 *  country to be searched from; the vendor rejects a field it does not
 *  declare, so its tasks carry no locale at all. */
const NO_LOCALE_PATH_PREFIXES = ["/v3/on_page/"] as const;

/** The path families that are read from a city (SPEC §6, D67): Google's own results, organic and AI Mode,
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

/** `'live'` (synchronous) or `'std'` (cheaper, queued), with no default: an undecided call site is a compile error. */
export type DataForSeoMode = "live" | "std";

/** The three fields `buildRequest` alone writes on a task: the two the spec's `locale` decides, and the depth. */
const RESERVED_TASK_KEYS = ["location_name", "language_code", "depth"] as const;

export interface DataForSeoRequestSpec {
  /** The literal vendor path, from the endpoint module, never from a caller's string: no export takes an endpoint name. */
  path: string;
  mode: DataForSeoMode;
  /** The country and language this read is made in (D66): the site's own,
   *  one row of the closed list. `null` only for the families that take
   *  no locale at all (`NO_LOCALE_PATH_PREFIXES`). Required: a default would measure a market in the wrong country. */
  locale: Locale | null;
  /** Endpoint-specific task fields. A key among `RESERVED_TASK_KEYS` is dropped, never merged. */
  fields?: Record<string, unknown>;
  /** The wall clock this one request may hold; absent is `REQUEST_TIMEOUT_MS`. Per call, since one process serves every tier. */
  timeoutMs?: number;
  /** How deep a SERP family's result is read; absent is `VENDOR.serpDepth`.
   *  The vendor bills each ten results as one page. */
  depth?: SerpDepth;
}

/** The depths a SERP may be bought at: whole pages of ten, at most a hundred. */
export type SerpDepth = 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100;

/** A locale as every cache key of this package spells it: the vendor's
 *  country name and the language, so a read bought in one country is never
 *  served to a site in another (D66). */
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
  if (!NO_LOCALE_PATH_PREFIXES.some((prefix) => spec.path.startsWith(prefix))) {
    const locale = spec.locale === null ? null : localeOf(spec.locale.country, spec.locale.language);
    if (locale === null) throw new Error(`dataforseo: ${spec.path} was asked for in a locale that is not on the list`);
    task.location_name = locationName(spec.path, { ...locale, ...(spec.locale?.place === undefined ? {} : { place: spec.locale.place }) });
    task.language_code = locale.language;
  }
  if (DEPTH_PATH_PREFIXES.some((prefix) => spec.path.startsWith(prefix))) task.depth = spec.depth ?? VENDOR.serpDepth;

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

/** Why a request came back without a body to read, closed:
 *  the vendor answered a non-2xx status (`http_<n>`); `fetch` rejected
 *  on a timeout signal (`timeout`) or on anything else — a refused
 *  connection, a reset (`transport`); or a 2xx body that was not JSON
 *  (`unparseable`). */
export type TransportFailure = `http_${number}` | "timeout" | "transport" | "unparseable";

export type DataForSeoOutcome<T> =
  | { ok: true; payload: T }
  | { ok: false; failure: TransportFailure; reason: string };

/** Global `fetch`, not `safeFetch`: the host is one we authored, and `no-fetch-outside-egress` exempts this folder.
 *  Never throws. `reason` comes from the response status or the error's `message`, never from the request or its header. */
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

/** The default wall clock for one request: a silent vendor would otherwise hold the invocation until the platform
 *  froze it. Under every `STAGE_BUDGETS` entry, so it ends as a ledgered `timeout` rather than spending the stage. */
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
