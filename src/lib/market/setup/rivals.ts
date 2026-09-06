// BUILD §4.3 — the rival set the founder leaves setup with.
//
// "**Competitors** — suggested chips from `competitors_domain`, up to 5
// selected." (§4.3). The set is a value, not a store: four total functions
// over `RivalSet`, no I/O, no clock, no throw. Whether a typed domain
// resolves in DNS is decided outside — `resolves` is an argument — because
// that is the one part of REQ-026 c8 that is a network fact, and this
// module is the part that must stay pure enough to decide every refusal in
// a unit test.
//
// **Every domain reaching these functions is already canonical**, and the
// caller is what canonicalises it — `registrableDomain` (WO-077) is
// deliberately *not* imported here. That is not tidiness: `parseDomain`,
// which it calls, imports `node:net` for its IP-literal rejection, and this
// module runs inside the setup screen's client bundle, where Turbopack
// refuses a Node built-in outright ("the chunking context does not support
// external modules (request: node:net)"). So the one impure step — turning
// what a person typed into an eTLD+1 — happens on the server, in
// `POST /api/setup/domain` and in `completeSetup`, and arrives here as a
// `string` or as `null` for a value that is not a domain name at all.
// Comparison is then plain equality on the canonical form, which is
// exactly what "already in the set however it is typed" (REQ-026 c8) and
// "is their own site" (which reduces `www.` and the `content.` publishing
// subdomain alike) both mean.
//
// The archived plan for this leaf is WO-083 (`src/lib/market/rivalset/`),
// which never landed and whose `RivalSet` this file is the first
// implementation of. It is placed under `market/setup/` beside the state
// machine that consumes it (WO-084's only consumer) rather than at
// WO-083's own path: one directory for the setup decision, and no
// second module for a four-function value type. When §4.7's Settings
// build (#18) needs the same rules after setup — REQ-071 c4 says it is
// the same rule — it imports this file rather than restating it.
import { BATTERY } from "@/lib/config/constants";

/** Where a rival in the set came from. The distinction is load-bearing:
 *  a domain change clears every suggestion and keeps everything the
 *  founder typed (REQ-026 c12). */
export type RivalOrigin = "suggested" | "typed";

export interface Rival {
  /** The registrable domain, canonicalised by the caller before it got
   *  here — so "already in the set however it is typed" (REQ-026 c8) is a
   *  plain equality on this field. */
  readonly domain: string;
  readonly origin: RivalOrigin;
}

export type RivalSet = readonly Rival[];

/** Every reason a value is not added, and the closed list of them. Each
 *  one "consumes none of the five" — refusal never mutates the set. */
export type RivalRefusal =
  | "not_a_domain"
  | "does_not_resolve"
  | "own_domain"
  | "already_present"
  | "set_full";

export type AddRivalResult = { ok: true; set: RivalSet } | { ok: false; because: RivalRefusal };

/**
 * REQ-026 c8 and c9 as one function.
 *
 * `domain` is the caller's canonical form, or `null` where what the
 * founder typed is not a domain name at all. `ownDomain` is canonical for
 * the same reason, so `own_domain` is one equality and covers `www.` and
 * the `content.` publishing subdomain without special-casing either.
 *
 * Refusal order is deliberate and asserted: what the value *is* outranks
 * how full the set is, so a founder who types their own address into a
 * full set is told it is their own address — the true reason — rather
 * than being told the set is full and left believing a different domain
 * would have fitted.
 *
 * `resolves` is supplied by the caller (the adapter awaits
 * `resolvesInDns`). A caller that cannot check passes `false`: an
 * unverified domain is refused, never admitted on trust.
 */
export function addRival(
  set: RivalSet,
  a: {
    domain: string | null;
    origin: RivalOrigin;
    ownDomain: string | null;
    resolves: boolean;
  }
): AddRivalResult {
  const domain = a.domain;
  if (domain === null) return { ok: false, because: "not_a_domain" };
  if (a.ownDomain !== null && domain === a.ownDomain) {
    return { ok: false, because: "own_domain" };
  }
  if (set.some((rival) => rival.domain === domain)) {
    return { ok: false, because: "already_present" };
  }
  if (!a.resolves) return { ok: false, because: "does_not_resolve" };
  if (set.length >= BATTERY.COMPETITORS_MAX) return { ok: false, because: "set_full" };

  return { ok: true, set: Object.freeze([...set, Object.freeze({ domain, origin: a.origin })]) };
}

/** Removes one rival by its canonical domain. A domain that is not in the
 *  set returns the set unchanged — rejecting a suggestion twice is not an
 *  error the founder can make, and neither is rejecting one that was
 *  already dropped by a domain change. */
export function removeRival(set: RivalSet, domain: string): RivalSet {
  return Object.freeze(set.filter((rival) => rival.domain !== domain));
}

/** REQ-026 c12: on a domain change "every rival that came from suggestions
 *  for the replaced domain is cleared from the set, a rival they typed
 *  themselves is kept". Order is preserved. */
export function clearSuggested(set: RivalSet): RivalSet {
  return Object.freeze(set.filter((rival) => rival.origin === "typed"));
}

/** True once the founder holds the five the product tracks. The screen
 *  states the limit rather than enforcing it silently (REQ-026 c9), so
 *  this predicate exists for the renderer as much as for `addRival`. */
export function isFull(set: RivalSet): boolean {
  return set.length >= BATTERY.COMPETITORS_MAX;
}
