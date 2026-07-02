/**
 * fetch() with a hard timeout. Every external call in the scan pipeline must use
 * this — a single hung vendor otherwise stalls the durable step and freezes the feed.
 * Default 8s: above p99 for our vendors, well under the 300s step cap.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

/**
 * SSRF guard for the arbitrary-URL fetcher. Rejects non-http(s) schemes and any
 * host that resolves (by literal form) to loopback, private, link-local, or cloud
 * metadata ranges. This is a HOST-STRING check, not DNS resolution — it stops
 * literal-IP and known-name SSRF, but full DNS-rebind protection (resolving the
 * host and re-checking the concrete IP) is intentionally out of scope.
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

  // Strip IPv6 brackets; l-case; drop a trailing dot (FQDN root).
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

  // Named targets: localhost (+ subdomains) and cloud metadata hostnames.
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") {
    throw new Error(`SSRF guard: blocked host: ${host}`);
  }

  // IPv6 loopback / unique-local (fc00::/7) / link-local (fe80::/10).
  if (host === "::1" || host === "::") {
    throw new Error(`SSRF guard: blocked IPv6 host: ${host}`);
  }
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) {
    throw new Error(`SSRF guard: blocked IPv6 ULA host: ${host}`);
  }
  if (/^fe[89ab][0-9a-f]:/i.test(host)) {
    throw new Error(`SSRF guard: blocked IPv6 link-local host: ${host}`);
  }

  // IPv4 literals: parse dotted-quad and range-check.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const bad =
      a === 127 || // 127.0.0.0/8 loopback
      a === 10 || // 10.0.0.0/8 private
      a === 0 || // 0.0.0.0/8 "this host"
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
      (a === 192 && b === 168) || // 192.168.0.0/16 private
      (a === 169 && b === 254); // 169.254.0.0/16 link-local (incl. 169.254.169.254 metadata)
    if (bad) throw new Error(`SSRF guard: blocked private/loopback IP: ${host}`);
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
  // SSRF guard runs on the INITIAL url only. Redirects are still followed (default
  // redirect mode) because callers depend on it; a 3xx to a private target would
  // NOT be re-checked here. Residual risk accepted — the primary attack surface is
  // the attacker-supplied initial URL, which this blocks.
  assertPublicHttpUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", onCallerAbort, { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
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
