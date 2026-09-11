// src/lib/scan/domain.ts — ADR-020
//
// WO-051. The product's one domain parser: every written form of one domain
// canonicalises to one CanonicalDomain, and every malformed value fails to
// one of five named DomainProblem handles and no others. No DNS, no fetch,
// no clock (ADR-020 decision 3) — canonicalisation and public-suffix
// membership are both pure, local, in-memory operations; `parseDomain`
// throws for no input.
//
// The public-suffix table (this WO's first `rests-on` row, inherited from
// ADR-020) is `psl` (npm, github.com/lupomontero/psl), which embeds the
// Mozilla/ICANN Public Suffix List at build time — no network call at
// module load or at request time. Chosen here as a parameter (constitution
// rule 1.1: an internal dependency, not a customer promise) over `tldts`:
// `psl` is the narrower tool — "does this ASCII hostname carry a listed
// public suffix" and its RFC 1035 label/total-length grammar check — and is
// not asked to do the scheme/userinfo/port/path/www/IDN stripping this
// module does itself first, in ADR-020 decision 1's order, using the
// platform's own WHATWG URL host parser (which lowercases and IDNA-encodes
// to punycode as one operation) and `node:net.isIP` for the IP-literal
// rejection.
//
// `psl`'s own `types/index.d.ts` (bundled in the package) is unreachable
// under `moduleResolution: "bundler"`: its `package.json` `exports` map
// declares no `types` condition, so TypeScript refuses the root `types`
// field fallback — see `src/lib/scan/psl.d.ts`, an ambient shim carrying
// the narrow slice of `psl`'s published types this module calls, which is
// how packages missing an `exports`-`types` condition are conventionally
// typed rather than by widening `tsconfig.json`'s resolution mode for the
// whole repo.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-03: One canonical domain key from one parser (`parseDomain` →
//   `CanonicalDomain`) used by every domain-keyed row, URL and counter. — ADR-020

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

/** Accepts every written form REQ-001 criterion 2 names — scheme or none, `www`
 *  or none, trailing path, any letter case, trailing dot, IDN — and returns one
 *  value for all of them. Does not resolve DNS and does not fetch. */
export function parseDomain(raw: string): DomainParse {
  try {
    const trimmed = raw.trim();
    if (trimmed === "") return { ok: false, problem: "empty" };

    let url: URL;
    try {
      // ADR-020 decision 1: lowercase, strip scheme, strip userinfo/port/
      // path/query/fragment, and convert IDN labels to punycode A-labels —
      // the WHATWG URL host parser does all four as one operation.
      url = new URL(toUrlString(trimmed));
    } catch {
      return { ok: false, problem: "not_a_hostname" };
    }

    const rawHost = url.hostname;
    const unbracketed = stripBrackets(rawHost);
    if (isIP(unbracketed) !== 0) return { ok: false, problem: "ip_literal" };

    // ADR-020 decision 1: strip a leading `www.`, then a trailing dot.
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
    // Defence in depth: nothing above should throw, but c4's "never throws"
    // property test binds this function to zero exceptions for any input.
    return { ok: false, problem: "not_a_hostname" };
  }
}
