/**
 * fetch() with a hard timeout + SSRF hardening. Every external call in the scan
 * pipeline must use this — a single hung vendor otherwise stalls the durable
 * step and freezes the feed. Default 8s: above p99 for our vendors, well under
 * the 300s step cap.
 *
 * SSRF defence (the fetcher takes attacker-supplied URLs — a scan target):
 *   1. Scheme + literal-host check on the initial URL (`assertPublicHttpUrl`).
 *   2. DNS resolution of the host, every resolved A/AAAA re-checked against the
 *      blocked ranges (`resolveAndAssertPublic`) — closes the "attacker.com with
 *      an A-record pointing at 169.254.169.254" rebind class.
 *   3. Manual redirect handling — a 3xx `Location` to a private target is
 *      re-validated (scheme + literal + DNS) BEFORE it is followed, so a public
 *      URL can't 302 into cloud metadata.
 */
import { lookup } from "node:dns/promises";

export const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

/** Max redirect hops we'll follow (each re-validated). Beyond this we throw. */
export const MAX_REDIRECTS = 5;

// ---------------------------------------------------------------------------
// Blocked-IP predicates (shared by the literal check AND the DNS re-check).
// ---------------------------------------------------------------------------

/** IPv4 in a loopback/private/link-local/metadata/CGNAT range. */
export function isBlockedIpv4(a: number, b: number): boolean {
  return (
    a === 127 || // 127.0.0.0/8 loopback
    a === 10 || // 10.0.0.0/8 private
    a === 0 || // 0.0.0.0/8 "this host"
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
    (a === 192 && b === 168) || // 192.168.0.0/16 private
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local (incl. 169.254.169.254 metadata)
    (a === 100 && b >= 64 && b <= 127) // 100.64.0.0/10 CGNAT (can front internal networks)
  );
}

/**
 * Is `ip` a blocked address? Handles IPv4 dotted-quad, IPv6 loopback/ULA/
 * link-local, and IPv4-mapped IPv6 (`::ffff:169.254.169.254`) — the mapped form
 * is a common guard bypass. Non-IP strings return false (they're hostnames, not
 * addresses — resolved separately).
 */
export function isBlockedIp(ip: string): boolean {
  const host = ip.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

  // IPv4-mapped IPv6, dotted form (`::ffff:169.254.169.254`) → check as IPv4.
  const mapped = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  const v4 = mapped ? mapped[1]! : host;

  const m = v4.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) return isBlockedIpv4(Number(m[1]), Number(m[2]));

  // IPv4-mapped IPv6, HEX form (`::ffff:a9fe:a9fe`) — the form `new URL()`
  // normalizes the dotted mapped address to. The low 32 bits are the IPv4.
  const mappedHex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1]!, 16);
    return isBlockedIpv4((hi >> 8) & 0xff, hi & 0xff);
  }

  // IPv6 loopback / unspecified.
  if (host === "::1" || host === "::") return true;
  // fc00::/7 unique-local.
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
  // fe80::/10 link-local.
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true;

  return false;
}

/**
 * SSRF guard for the arbitrary-URL fetcher. Rejects non-http(s) schemes and any
 * host whose LITERAL form is loopback/private/link-local/metadata. This is the
 * string check; `resolveAndAssertPublic` adds DNS resolution.
 */
export function assertPublicHttpUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`SSRF guard: malformed URL: ${rawUrl}`);
  }

  const proto = parsed.protocol.toLowerCase();
  if (proto !== "http:" && proto !== "https:") {
    throw new Error(`SSRF guard: blocked non-http(s) scheme: ${proto}`);
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

  // Named targets: localhost (+ subdomains) and cloud metadata hostnames.
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") {
    throw new Error(`SSRF guard: blocked host: ${host}`);
  }

  if (isBlockedIp(host)) {
    throw new Error(`SSRF guard: blocked private/loopback IP: ${host}`);
  }
}

/**
 * Resolve `host` and reject if ANY resolved address is in a blocked range —
 * defeats a public hostname whose A/AAAA record points at an internal IP. A
 * resolution failure is NOT a bypass (the connection would fail too), so it's
 * left for `fetch` to surface. Literal IPs resolve to themselves (harmless
 * re-check). Server-only (`node:dns`).
 */
export async function resolveAndAssertPublic(host: string): Promise<void> {
  const bare = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  let addrs: { address: string }[];
  try {
    addrs = await lookup(bare, { all: true });
  } catch {
    return;
  }
  for (const { address } of addrs) {
    if (isBlockedIp(address)) {
      throw new Error(`SSRF guard: host ${bare} resolves to blocked IP ${address}`);
    }
  }
}

export class FetchTimeoutError extends Error {
  readonly url: string;
  readonly timeoutMs: number;
  constructor(url: string, timeoutMs: number) {
    super(`fetch timed out after ${timeoutMs}ms: ${url}`);
    // Preserve `instanceof` across all compile targets/bundlers (Error subclassing footgun).
    Object.setPrototypeOf(this, FetchTimeoutError.prototype);
    this.name = "FetchTimeoutError";
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", onCallerAbort, { once: true });
  }

  let currentUrl = url;
  try {
    // Manual redirect loop: every hop (initial + each 3xx target) is re-validated
    // — scheme + literal-host + DNS — BEFORE we connect to it, so a public URL
    // can't redirect into a private/metadata target.
    for (let hop = 0; ; hop++) {
      assertPublicHttpUrl(currentUrl);
      await resolveAndAssertPublic(new URL(currentUrl).hostname);

      const res = await fetch(currentUrl, { ...init, redirect: "manual", signal: controller.signal });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (location) {
          if (hop >= MAX_REDIRECTS) {
            throw new Error(`SSRF guard: too many redirects (>${MAX_REDIRECTS}) from ${url}`);
          }
          // Resolve relative Location against the current URL; the next loop
          // re-validates scheme/host/DNS before following.
          currentUrl = new URL(location, currentUrl).href;
          // Free the socket before the next hop.
          await res.body?.cancel().catch(() => {});
          continue;
        }
      }
      return res;
    }
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", onCallerAbort);
  }
}
