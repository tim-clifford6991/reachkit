// The product's one domain parser: every written form of a domain canonicalises to one `CanonicalDomain`; a malformed value fails to one of five `DomainProblem` handles.
// Pure: no DNS, no fetch, no clock, never throws. The WHATWG URL host parser lowercases and IDNA-encodes, `node:net.isIP` rejects IP literals, and `psl` checks the public suffix.
// `psl`'s types are unreachable under `moduleResolution: "bundler"`, hence the shim in `psl.d.ts`.
import { isIP } from "node:net";
import { parse as pslParse } from "psl";

/** The product's one domain key. Produced only by `parseDomain`; every
 *  domain-keyed row, URL segment, cache key and counter uses this value. */
export type CanonicalDomain = string & { readonly __canonicalDomain: unique symbol };

export type DomainProblem =
  | "empty"
  | "not_a_hostname"
  | "ip_literal"
  | "no_public_suffix"
  | "too_long";

export type DomainParse =
  | { ok: true; domain: CanonicalDomain }
  | { ok: false; problem: DomainProblem };

// Step 1: load the public-suffix table once, at module scope, and assert
// it is non-empty. `psl` exposes no raw rule count, so the assertion is a
// smoke check on a suffix every build of the table must carry: if "com" is
// not a listed public suffix, the table did not load.
const SMOKE = pslParse("example.com");
if ("error" in SMOKE || !SMOKE.listed) {
  throw new Error(
    "src/lib/scan/domain.ts: the public-suffix table did not load (psl reports 'com' as unlisted)"
  );
}

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const TOO_LONG_CODES = new Set(["DOMAIN_TOO_LONG", "LABEL_TOO_LONG"]);

/** A bare hostname candidate has no scheme; give the WHATWG URL parser one
 *  so it does the userinfo/port/path/query/fragment split for us. A
 *  protocol-relative form (`//host/...`) already has the `//` half. */
function toUrlString(trimmed: string): string {
  if (SCHEME_RE.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return "http:" + trimmed;
  return "http://" + trimmed;
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/** Accepts every written form (scheme or none, `www` or none, trailing path, any case, trailing dot, IDN) and returns one value. No DNS, no fetch. */
export function parseDomain(raw: string): DomainParse {
  try {
    const trimmed = raw.trim();
    if (trimmed === "") return { ok: false, problem: "empty" };

    let url: URL;
    try {
      // Lowercase, strip scheme, userinfo, port, path, query and fragment, and punycode IDN labels: the WHATWG URL host parser does all of it at once.
      url = new URL(toUrlString(trimmed));
    } catch {
      return { ok: false, problem: "not_a_hostname" };
    }

    const rawHost = url.hostname;
    const unbracketed = stripBrackets(rawHost);
    if (isIP(unbracketed) !== 0) return { ok: false, problem: "ip_literal" };

    // Strip a leading `www.`, then a trailing dot.
    let host = rawHost.startsWith("www.") ? rawHost.slice(4) : rawHost;
    host = host.replace(/\.+$/, "");
    if (host === "") return { ok: false, problem: "not_a_hostname" };

    const parsed = pslParse(host);
    if ("error" in parsed) {
      return {
        ok: false,
        problem: TOO_LONG_CODES.has(parsed.error.code) ? "too_long" : "not_a_hostname",
      };
    }
    if (!parsed.listed) return { ok: false, problem: "no_public_suffix" };

    return { ok: true, domain: host as CanonicalDomain };
  } catch {
    // Defence in depth: this function must never throw for any input.
    return { ok: false, problem: "not_a_hostname" };
  }
}
