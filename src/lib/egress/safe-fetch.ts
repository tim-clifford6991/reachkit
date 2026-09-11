// BUILD §6.4 — the one way a byte leaves toward a customer- or dataset-supplied URL.
// src/lib/egress/safe-fetch.ts — WO-018, BP-006 `## Public interface` /
// `## Error & edge behavior`.
//
// resolve → check → connect, in that order, and never the other way round:
// `dns.lookup` resolves the hostname to exactly one address, `policy.ts`
// checks that address, and only then does this module open a socket — to
// that same, already-checked address (`options.host` below), never back to
// the hostname. A hostname passed to the transport layer instead of the
// pinned address would let the name be re-resolved between check and
// connect (DNS rebinding / TOCTOU), which is the one hole BP-006 exists to
// close (`tests/egress/safe-fetch.test.ts`'s pinning case fails first
// against exactly that mistake — constitution §8).
//
// Never throws: every failure is a typed `FetchOutcome` with `ok: false`
// (BP-006 decision 1) so a caller can tell "could not determine" apart from
// "read it and it was empty" (REQ-004 criteria 6 and 7).
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-07: safeFetch carries verb, headers and body (GET, no body remains the
//   default); a caller can never displace `Host` (the DNS pin rests on it) and a request
//   carrying caller state is refused, not followed, when a redirect leaves the origin the
//   caller named. Adapters receive a decrypted config only through `withConfig`; the select
//   never names the sealed column. — #161
//
// DECISIONS 2026-09-10: The customer's own documents are read with their own size cap,
//   `OWN_DOCUMENT_MAX_BYTES` 6 MB; vendor and rival reads keep the fetcher's 2 MB default;
//   above a cap a read is refused, never truncated. A refusal is ledgered as a row (0 ¢),
//   never a null payload, and a pass whose home read was refused ends `site_unreadable`, never
//   `complete`. — master, #479 (M3 run 5, cal.com; BUILD §6.4)

import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { isIP } from "node:net";
import { checkAddress, checkSchemeAndPort } from "./policy";
import { productToken, readRobots } from "./robots";
import type { FetchOutcome, RobotsPolicy } from "./types";
import { VERIFY } from "@/lib/config/constants";

// ── Parameters chosen here, not stated by BP-006 (rule 1.1) ────────────────
//
// `MAX_REDIRECTS = 5`: BP-006 requires "redirects that leave the policy
// (each hop re-checked)" but names no hop count. 5 is the common
// server-side default (curl's own default is 50, most SSRF-guard libraries
// use single digits); chosen narrow because every extra hop is another
// opportunity to leave the policy, and this module's whole job is refusing
// early. Reversal cost: one constant, no customer-visible consequence.
const MAX_REDIRECTS = 5;

// `MEASURE_USER_AGENT`: BP-005's `constants.ts` (WO-006, out of this WO's
// file plan) declares `VERIFY.userAgent` for the `'reachkit-verify'` token
// but no `MEASURE` group for `'reachkit-measure'` — WO-018's own `opts`
// type names both tokens without either being declared for the second.
// Chosen here as a parameter, same convention as `VERIFY.userAgent`: our
// own machine token, never one of BP-005's six named AI reader agents, and
// never customer copy. Reversal cost: trivial — a string literal used only
// when `opts.userAgent === 'reachkit-measure'`; a one-line substitution
// once BP-005 declares its own `MEASURE.userAgent`.
const MEASURE_USER_AGENT = "ReachKitMeasure/1.0 (+https://reachkit.app)";

// Default token when `opts.userAgent` is omitted. BP-006's interface
// comment states no default for this option (unlike `timeoutMs`/`maxBytes`,
// which do). Chosen here (rule 1.1): `'reachkit-measure'`, because
// BP-006's `## Responsibility` names measurement ("Fetch any
// customer-supplied or dataset-supplied URL exactly once") as the
// module's primary caller (BP-010's measurement engine); verification
// callers pass `userAgent: 'reachkit-verify'` explicitly. Reversal cost:
// one default value, no customer-visible consequence — no caller in this
// corpus yet omits the option.
const DEFAULT_USER_AGENT_TOKEN: "reachkit-measure" | "reachkit-verify" = "reachkit-measure";

const DEFAULT_TIMEOUT_MS = 8000;
const HARD_MAX_TIMEOUT_MS = 15000;
const DEFAULT_MAX_BYTES = 2_000_000;

export type SafeFetchOpts = {
  timeoutMs?: number;
  maxBytes?: number;
  respectRobots?: boolean;
  userAgent?: "reachkit-measure" | "reachkit-verify";
  /** The verb. Omitted is `GET`, which is every measurement caller — this
   *  module's original and still principal use (issue #54). */
  method?: "GET" | "POST";
  /** Request headers the caller needs the destination to see: an
   *  `Authorization` for an API the site's own administrator authorised, a
   *  `Content-Type` for a body. **They are never logged** — `logFetch`
   *  below carries five fields and none of them is a header — and they are
   *  **dropped rather than carried** across a redirect that leaves the
   *  origin the caller named (see the redirect arm). `Host` cannot be
   *  overridden: the pin depends on it naming the resolved address's own
   *  name. */
  headers?: Readonly<Record<string, string>>;
  /** The request body, already serialised. Sent with an explicit
   *  `Content-Length`, so nothing is chunked and nothing is guessed. */
  body?: string;
};

// ── The robots port (BP-006 `readRobots`) ───────────────────────────────
//
// `robots.ts` (issue #22) is the reader behind this narrow port: it fetches
// the document through this very module with `respectRobots: false`, so the
// import cycle below is deliberate and terminates. When the reader cannot
// determine — `{ ok: false }`, REQ-004 criterion 6's undeterminable — this
// module never fabricates a disallow. Overridable only from test files, so
// a real caller always gets the wired default.
export type RobotsPort = (
  origin: string,
  userAgent: string
) => Promise<RobotsPolicy | { ok: false; reason: string }>;

const wiredReader: RobotsPort = (origin) => readRobots(origin);

let robotsPort: RobotsPort = wiredReader;

/** Test-only seam. Never called from production code. */
export function __setRobotsPortForTesting(port: RobotsPort | null): void {
  robotsPort = port ?? wiredReader;
}

/** RFC 9309 §2.2.1: the group that names our product token decides, and the
 *  wildcard group applies only where no group names us — so a document that
 *  disallows every reader but allows us by name allows us, and one that
 *  allows every reader but disallows us by name refuses us. */
function isDisallowed(policy: RobotsPolicy, userAgentToken: string, userAgentValue: string): boolean {
  const named =
    policy.disallowedAgents[productToken(userAgentValue)] ?? policy.disallowedAgents[userAgentToken];
  return named ?? policy.disallowsAll;
}

// ── Observability — BP-006 NFR budget, verbatim field set ──────────────
//
// "host, outcome reason, status, bytes and duration; never a body." Exactly
// these five keys, every time — `tests/egress/safe-fetch.test.ts` asserts
// the field set, not a superset (constitution rule 2.4: the WO's log-record
// row is the one place this shape is stated).
function logFetch(host: string, reason: string, status: number | null, bytes: number, durationMs: number): void {
  console.log(JSON.stringify({ host, reason, status, bytes, duration: durationMs }));
}

function userAgentString(token: "reachkit-measure" | "reachkit-verify"): string {
  return token === "reachkit-verify" ? VERIFY.userAgent : MEASURE_USER_AGENT;
}

function clampTimeout(ms: number | undefined): number {
  const v = ms ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(v, HARD_MAX_TIMEOUT_MS);
}

function fail(
  reason: Exclude<FetchOutcome, { ok: true }>["reason"],
  url: string,
  readAt: Date,
  status?: number
): FetchOutcome {
  return status === undefined
    ? { ok: false, reason, url, readAt }
    : { ok: false, reason, url, readAt, status };
}

type HopResult =
  | { kind: "final"; status: number; headers: http.IncomingHttpHeaders; body: Buffer }
  | { kind: "redirect"; status: number; location: string }
  | { kind: "too_large" }
  | { kind: "timeout" }
  | { kind: "refused" }
  | { kind: "status" };

type ResolveResult =
  | { kind: "resolved"; address: string; family: number }
  | { kind: "dns" }
  | { kind: "timeout" };

/** Resolves `hostname` to a single address unless it is already an IP
 *  literal (in which case there is nothing to resolve — the "address" the
 *  caller wrote is the address checked and connected to). Bounded by
 *  `remainingMs` so a hanging resolver cannot itself exceed the fetch's own
 *  deadline; a lookup that does not finish in time is `"timeout"`, never
 *  `"dns"` — those are different failure classes in `FetchOutcome`.
 *  Exported for `dns.ts`'s `resolvesInDns`, so "does this name resolve" is
 *  answered by the same lookup this module connects on. */
export async function resolveAddress(hostname: string, remainingMs: number): Promise<ResolveResult> {
  const family = isIP(hostname);
  if (family !== 0) return { kind: "resolved", address: hostname, family };

  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<ResolveResult>((resolve) => {
    timer = setTimeout(() => resolve({ kind: "timeout" }), remainingMs);
  });
  const lookup = dns.promises
    .lookup(hostname)
    .then((r): ResolveResult => ({ kind: "resolved", address: r.address, family: r.family }))
    .catch((): ResolveResult => ({ kind: "dns" }));

  const result = await Promise.race([lookup, timeout]);
  clearTimeout(timer!);
  return result;
}

/** Issues one HTTP(S) request to `address` — the checked, resolved address,
 *  never the hostname — while keeping `hostname` for the `Host` header and
 *  (HTTPS) the TLS SNI `servername`, so virtual hosting and certificate
 *  validation both still see the name the caller wrote. This is the pin:
 *  `options.host` is the literal IP the policy check just approved, so
 *  nothing between check and connect can re-resolve the name. */
function performRequest(
  targetUrl: URL,
  address: string,
  hostname: string,
  userAgentValue: string,
  remainingMs: number,
  maxBytes: number,
  request: { method: "GET" | "POST"; headers: Readonly<Record<string, string>>; body: string | null }
): Promise<HopResult> {
  return new Promise((resolve) => {
    const isHttps = targetUrl.protocol === "https:";
    const transport = isHttps ? https : http;
    const port = targetUrl.port !== "" ? Number(targetUrl.port) : isHttps ? 443 : 80;
    const hostHeader = targetUrl.port !== "" ? `${hostname}:${targetUrl.port}` : hostname;

    let settled = false;
    const settle = (result: HopResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    // The caller's headers go on first and the three below overwrite them:
    // `Host` is what the pin rests on (the socket is opened to an address,
    // and this is the only thing that still names the site), and the other
    // two are this module's own contract with the destination.
    const headers: Record<string, string> = {
      ...request.headers,
      Host: hostHeader,
      "User-Agent": userAgentValue,
      "Accept-Encoding": "identity",
    };
    if (request.body !== null) {
      headers["Content-Length"] = String(Buffer.byteLength(request.body, "utf8"));
    }

    const options: http.RequestOptions & { servername?: string } = {
      host: address,
      port,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: request.method,
      headers,
      ...(isHttps ? { servername: hostname } : {}),
    };

    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      let tooLarge = false;

      res.on("data", (chunk: Buffer) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > maxBytes) {
          tooLarge = true;
          res.destroy();
          settle({ kind: "too_large" });
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        if (tooLarge) return;
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          const location = res.headers.location;
          if (typeof location !== "string" || location === "") {
            settle({ kind: "status" });
            return;
          }
          settle({ kind: "redirect", status, location });
          return;
        }
        settle({ kind: "final", status, headers: res.headers, body: Buffer.concat(chunks) });
      });
      res.on("error", () => settle({ kind: "refused" }));
    });

    req.on("error", () => settle({ kind: "refused" }));

    const timer = setTimeout(() => {
      req.destroy();
      settle({ kind: "timeout" });
    }, remainingMs);

    if (request.body !== null) req.write(request.body);
    req.end();
  });
}

/** BP-006 `safeFetch`. Never throws — see the module header. */
export async function safeFetch(url: string, opts?: SafeFetchOpts): Promise<FetchOutcome> {
  const readAt = new Date();
  const start = Date.now();
  const timeoutMs = clampTimeout(opts?.timeoutMs);
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  const respectRobots = opts?.respectRobots ?? true;
  const method = opts?.method ?? "GET";
  const callerHeaders = opts?.headers ?? {};
  const body = opts?.body ?? null;
  const carriesCallerState = method !== "GET" || Object.keys(callerHeaders).length > 0 || body !== null;
  const userAgentToken = opts?.userAgent ?? DEFAULT_USER_AGENT_TOKEN;
  const userAgentValue = userAgentString(userAgentToken);
  const deadline = start + timeoutMs;

  let currentUrl: URL;
  try {
    currentUrl = new URL(url);
  } catch {
    logFetch(url, "blocked_by_policy", null, 0, Date.now() - start);
    return fail("blocked_by_policy", url, readAt);
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const hopUrlString = currentUrl.toString();

    // 1. Scheme and port — no DNS, no connection.
    const schemeCheck = checkSchemeAndPort(currentUrl);
    if (!schemeCheck.ok) {
      logFetch(currentUrl.hostname, "blocked_by_policy", null, 0, Date.now() - start);
      return fail("blocked_by_policy", hopUrlString, readAt);
    }

    // 2. Resolve once. This is the address that gets checked and the
    //    address that gets connected to — nothing re-resolves it.
    const remainingForDns = deadline - Date.now();
    if (remainingForDns <= 0) {
      logFetch(currentUrl.hostname, "timeout", null, 0, Date.now() - start);
      return fail("timeout", hopUrlString, readAt);
    }
    const resolved = await resolveAddress(currentUrl.hostname, remainingForDns);
    if (resolved.kind === "timeout") {
      logFetch(currentUrl.hostname, "timeout", null, 0, Date.now() - start);
      return fail("timeout", hopUrlString, readAt);
    }
    if (resolved.kind === "dns") {
      logFetch(currentUrl.hostname, "dns", null, 0, Date.now() - start);
      return fail("dns", hopUrlString, readAt);
    }

    // 3. Check the resolved address before any connection.
    const addressCheck = checkAddress(resolved.address);
    if (!addressCheck.ok) {
      logFetch(currentUrl.hostname, "blocked_by_policy", null, 0, Date.now() - start);
      return fail("blocked_by_policy", hopUrlString, readAt);
    }

    // 4. Robots — delegated through the port, on by default, never a
    //    fabricated disallow when the reader cannot determine.
    if (respectRobots) {
      const robots = await robotsPort(currentUrl.origin, userAgentToken);
      if (robots.ok && isDisallowed(robots, userAgentToken, userAgentValue)) {
        logFetch(currentUrl.hostname, "robots_disallowed", null, 0, Date.now() - start);
        return fail("robots_disallowed", hopUrlString, readAt);
      }
    }

    // 5. Connect — to the resolved, checked address (the pin).
    const remainingForConnect = deadline - Date.now();
    if (remainingForConnect <= 0) {
      logFetch(currentUrl.hostname, "timeout", null, 0, Date.now() - start);
      return fail("timeout", hopUrlString, readAt);
    }
    const result = await performRequest(
      currentUrl,
      resolved.address,
      currentUrl.hostname,
      userAgentValue,
      remainingForConnect,
      maxBytes,
      { method, headers: callerHeaders, body }
    );

    if (result.kind === "too_large") {
      logFetch(currentUrl.hostname, "too_large", null, 0, Date.now() - start);
      return fail("too_large", hopUrlString, readAt);
    }
    if (result.kind === "timeout") {
      logFetch(currentUrl.hostname, "timeout", null, 0, Date.now() - start);
      return fail("timeout", hopUrlString, readAt);
    }
    if (result.kind === "refused") {
      logFetch(currentUrl.hostname, "refused", null, 0, Date.now() - start);
      return fail("refused", hopUrlString, readAt);
    }
    if (result.kind === "status") {
      logFetch(currentUrl.hostname, "status", null, 0, Date.now() - start);
      return fail("status", hopUrlString, readAt);
    }
    if (result.kind === "redirect") {
      let next: URL;
      try {
        next = new URL(result.location, currentUrl);
      } catch {
        logFetch(currentUrl.hostname, "status", result.status, 0, Date.now() - start);
        return fail("status", hopUrlString, readAt, result.status);
      }
      // A caller that supplied headers or a body named one origin, and a
      // credential must never travel to a host it did not name (issue #54).
      // The hop is refused rather than re-issued stripped: a stripped
      // re-issue would send an unauthenticated request the caller would
      // read as the destination's own answer, and a create call is not a
      // thing to half-make.
      if (carriesCallerState && next.origin !== currentUrl.origin) {
        logFetch(currentUrl.hostname, "blocked_by_policy", result.status, 0, Date.now() - start);
        return fail("blocked_by_policy", hopUrlString, readAt, result.status);
      }
      currentUrl = next;
      continue; // each hop re-checked from step 1, per BP-006
    }

    // result.kind === "final"
    const html = result.body.toString("utf8");
    // Node lowercases header names and joins a repeated header itself; an
    // array-valued header (`set-cookie`) is joined here rather than
    // dropped, so the map is total over what the server actually sent.
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(result.headers)) {
      if (value === undefined) continue;
      headers[name] = Array.isArray(value) ? value.join(", ") : value;
    }
    logFetch(currentUrl.hostname, "ok", result.status, result.body.length, Date.now() - start);
    return {
      ok: true,
      status: result.status,
      url: hopUrlString,
      html,
      bytes: result.body.length,
      readAt,
      headers,
    };
  }

  // Exceeded MAX_REDIRECTS without settling — the redirect chain itself
  // prevented reaching content, which is a status-mechanism failure, not a
  // policy refusal or a transport error.
  logFetch(currentUrl.hostname, "status", null, 0, Date.now() - start);
  return fail("status", currentUrl.toString(), readAt);
}
