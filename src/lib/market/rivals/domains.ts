// src/lib/market/rivals/domains.ts — BP-026
//
// WO-077. The product's one answer to "what domain is this", "is it a
// platform" and "is it the customer's own", so a customer's own hosted page
// can never become their own rival (BP-026 `## Error & edge behavior`).
// Three pure, total functions — no network, no DNS, no clock, no throw.
//
// Rule 7.2 reuse: `registrableDomain` calls `parseDomain` (WO-051,
// `src/lib/scan/domain.ts`) for every step that function already owns —
// lower-casing, scheme/userinfo/port/path/query stripping, trailing-dot
// stripping, IP-literal rejection, IDN-to-punycode, and the listed-public-
// suffix check. `parseDomain`'s `CanonicalDomain` deliberately keeps
// subdomains other than `www.` (WO-051's own contract: `content.` stays
// `content.` there), so it is not by itself this file's eTLD+1. The one
// step this file adds is the eTLD+1 reduction `parseDomain` does not do:
// a second `psl.parse` call on the already-validated, already-normalised
// host, reading its `domain` field (`psl`'s eTLD+1, e.g.
// `content.example.co.uk` -> `example.co.uk`, never `co.uk` — verified
// against `psl`'s own behaviour, not hand-rolled). This is not a second
// implementation of `parseDomain` (rule 7.1): `psl` is already `domain.ts`'s
// own dependency and this file calls it for exactly the one field
// `domain.ts` does not expose.
import { parse as pslParse } from "psl";
import { parseDomain } from "@/lib/scan/domain";
import { PLATFORM_DOMAINS } from "@/lib/config/constants";

/** eTLD+1, lower-cased. Accepts a bare host or a full URL (scheme, userinfo,
 *  port, path, query and a trailing dot are all stripped by `parseDomain`).
 *  `example.co.uk` reduces to `example.co.uk`, never `co.uk` — the
 *  public-suffix table decides where the registrable boundary falls, not a
 *  fixed label count. Anything that is not a parseable hostname, and any IP
 *  literal, returns `null`. */
export function registrableDomain(hostOrUrl: string): string | null {
  const parsed = parseDomain(hostOrUrl);
  if (!parsed.ok) return null;

  const reduced = pslParse(parsed.domain);
  if ("error" in reduced || !reduced.domain) return null;
  return reduced.domain;
}

/** Membership in BP-005's closed `PLATFORM_DOMAINS` list — a domain absent
 *  from it is a product domain by default (BP-026 `## Error & edge
 *  behavior`: "the open-world side is the rival side").
 *
 *  `PLATFORM_DOMAINS` (`src/lib/config/constants.ts`, BP-005/SPEC.md §6.1)
 *  is a closed list of bare names — `"reddit"`, not `"reddit.com"` — with no
 *  TLD recorded, so membership cannot be a full eTLD+1 comparison. Matching
 *  is against the registrable domain's second-level label (`psl`'s `sld`:
 *  the single label immediately before the public suffix — `"example"` in
 *  `example.co.uk`, always dot-free, so `registrableDomain(...).split(".")[0]`
 *  reads it without a second `psl` call). This is a parameter this file
 *  chooses under constitution rule 1.1, not a customer promise: the
 *  membership *set* is BP-005's pin, transcribed and cited above, never
 *  restated here; only the *matching granularity* — sld-only rather than
 *  full eTLD+1 — is this file's own choice, forced by the set being
 *  recorded without TLDs. Reversal cost: low — it changes only which
 *  domains under an unlisted TLD false-positive-match a platform name
 *  (e.g. a hypothetical `reddit.io` would match `"reddit"`); no test in
 *  this WO's plan depends on the distinction, and no customer promise
 *  reads this file's granularity rather than the set itself. */
export function isPlatformDomain(host: string): boolean {
  const domain = registrableDomain(host);
  if (!domain) return false;

  const sld = domain.split(".")[0] ?? domain;
  return (PLATFORM_DOMAINS as readonly string[]).includes(sld);
}

/** True when `host` and `ownDomain` reduce to the same eTLD+1. That single
 *  rule already covers a `www.` prefix and the `content.` publishing
 *  subdomain — both reduce to the same registrable domain — so neither is
 *  special-cased here (BP-026 `## Error & edge behavior`: "matching on
 *  `www.` and on the `content.` publishing subdomain, so a customer's own
 *  hosted page never becomes their own rival"). A malformed `host` or
 *  `ownDomain` reduces to `null`, and `null === null` would be a false
 *  match, so both sides are required to parse. */
export function isOwnDomain(host: string, ownDomain: string): boolean {
  const a = registrableDomain(host);
  const b = registrableDomain(ownDomain);
  return a !== null && b !== null && a === b;
}
