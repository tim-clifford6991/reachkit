// BUILD §4.3 — the setup cards' state machine: which market renders, what a
// domain change clears, and what must be true to submit.
//
// The archived plan is WO-084, whose `## Public interface` this file
// follows: `MarketCard`, `SuggestionState`, `ReportFacts`, `SetupState`,
// `marketCardFor`, `onDomainChanged`, `onMarketStated`, `validateSetup`.
// Every function here is pure — no I/O, no clock, no throw — which is what
// lets every REQ-021 and REQ-026 criterion below be decided by a test with
// no database and no network at all.
//
// **`ReportFacts` is deliberately not the stored report** (WO-084 decision
// note, from BP-034 decision 4): importing `src/lib/scan/`'s report type —
// a type-only import included — would close a `src/lib/market` ↔
// `src/lib/scan` cycle. The three fields are a projection the `/setup`
// adapter supplies, never a rival definition of the report. If this node
// ever needs a fourth fact, the adapter passes a fourth field; widening
// this interface toward the stored report field by field is the same
// mistake taken slowly. `tests/market/setup/state.test.ts` asserts the
// absence of that import, pre-erasure.
//
// **Every domain reaching these functions is already canonical**, for the
// reason `rivals.ts`'s header gives at length: the canonicaliser imports
// `node:net`, this module runs inside the setup screen's client bundle,
// and Turbopack refuses a Node built-in there. The one impure step happens
// on the server and arrives here as a `string`, or as `null` for a value
// that is not a domain name at all.
//
// **What decides confirm-versus-state is whether a completed report exists
// for the address the account will use**, never how the purchase was made
// (REQ-021 c11, REQ-026 c1): none of these functions takes a purchase, a
// plan or a checkout argument.
import { clearSuggested, type RivalSet } from "./rivals";
import type { Profile } from "../questions/profile";
import type { SuggestionRow } from "../questions/market-set";

/** REQ-026 c1 and c3. The `empty` arm carries no category and no scan id,
 *  so nothing can be pre-filled from it and nothing on it can be labelled
 *  inferred or measured. */
export type MarketCard =
  | { state: "inferred"; category: string; fromScanId: string }
  | { state: "empty" }
  | { state: "stated"; category: string };

/** REQ-026 c10. `awaiting_market` and `none_found` are two states and never
 *  merge: a card with no market yet says it is waiting on the market, never
 *  that no rivals were found. */
export type SuggestionState = "awaiting_market" | "seeking" | "none_found" | "offered";

/** What this node needs from the current stored report, supplied by the
 *  caller. See the header for why it is not the stored report's own type. */
export interface ReportFacts {
  scanId: string;
  category: string | null;
  rivals: readonly string[];
  /** The twelve the stored report holds, in its own order. Shown read-only
   *  at setup — §12 ruling 4 — and re-derived, never edited. */
  questions: readonly SetupQuestion[];
  /** What a corrected category re-derives its twelve from: the market this
   *  scan already bought, and the profile it read. `null` where the scan
   *  measured no market, which derives nothing rather than guessing. */
  derivable: DerivableMarket | null;
}

/** The measured market a re-derivation selects over. Carried whole so the
 *  screen re-derives without a second read and without a second purchase. */
export interface DerivableMarket {
  profile: Profile;
  market: readonly SuggestionRow[];
}

/** One of the twelve, as a screen holds it: the wording, and the search it
 *  was derived from. Both are carried together — REQ-093 c3 admits a
 *  wording only beside its search. */
export interface SetupQuestion {
  wording: string;
  search: string;
}

/** REQ-021 c6 versus c7 — the one thing on this screen that is identity
 *  rather than configuration (REQ-025 c1).
 *
 *  `measured`: a completed report measured this address, so it is shown to
 *  confirm or change rather than typed. `given`: the founder typed it.
 *  `asked`: the purchase had no report behind it and nothing has been
 *  given yet — an empty field with nothing pre-filled and nothing offered
 *  from the payment (REQ-021 c7). */
export type AddressCard =
  | { state: "measured"; domain: string; fromScanId: string }
  | { state: "given"; domain: string }
  | { state: "asked" };

/** REQ-021 c9. `does_not_resolve` is the whole of "not one the product can
 *  reach": a site that is new, thin, unbuilt, coming-soon or blocking our
 *  fetcher resolves in DNS and is accepted. */
export type AddressRefusal = "not_a_domain" | "does_not_resolve";

export type AddressResult =
  | { ok: true; domain: string }
  | { ok: false; because: AddressRefusal };

export interface SetupState {
  address: AddressCard;
  /** The address the account will use, canonicalised — `null` only while
   *  the address card is `asked`. Derived from `address`; never set alone. */
  siteDomain: string | null;
  market: MarketCard;
  suggestions: { state: SuggestionState; candidates: readonly string[] };
  rivals: RivalSet;
  /** The twelve the settled category derives, or empty while none has been
   *  derived for it yet. Never edited: §12 ruling 4 shows them read-only. */
  questions: readonly SetupQuestion[];
  /** What a corrected category re-derives over — this address's own
   *  measured market, or `null` where the product has measured none. */
  derivable: DerivableMarket | null;
}

/** REQ-026 c1 and c3. A non-null report with a non-null category is an
 *  inferred market; a null report, or a report with no category, is the
 *  empty card. There is no fallback to a previous domain's category. */
export function marketCardFor(a: { siteDomain: string; report: ReportFacts | null }): MarketCard {
  if (a.report !== null && a.report.category !== null) {
    return { state: "inferred", category: a.report.category, fromScanId: a.report.scanId };
  }
  return { state: "empty" };
}

/** The suggestion state a freshly derived market card implies: a card with
 *  no market is waiting on the founder (REQ-026 c10), any other card is
 *  seeking. Fetching the candidates is the adapter's; this performs no I/O. */
function suggestionsFor(market: MarketCard): { state: SuggestionState; candidates: readonly string[] } {
  return {
    state: market.state === "empty" ? "awaiting_market" : "seeking",
    candidates: Object.freeze([]),
  };
}

/**
 * The state the screen opens in.
 *
 * `measured` is the address a completed report measured for the account —
 * shown to confirm or change (REQ-021 c6). `null` is a purchase with no
 * report behind it: the field is empty and nothing is pre-filled from the
 * payment (REQ-021 c7).
 */
export function initialSetupState(
  measured: { domain: string; report: ReportFacts } | null
): SetupState {
  if (measured === null) {
    const market: MarketCard = { state: "empty" };
    return {
      address: { state: "asked" },
      siteDomain: null,
      market,
      suggestions: suggestionsFor(market),
      rivals: Object.freeze([]),
      questions: Object.freeze([]),
      derivable: null,
    };
  }

  const market = marketCardFor({ siteDomain: measured.domain, report: measured.report });
  return {
    address: { state: "measured", domain: measured.domain, fromScanId: measured.report.scanId },
    siteDomain: measured.domain,
    market,
    suggestions: suggestionsFor(market),
    rivals: Object.freeze([]),
    questions: measured.report.questions,
    derivable: measured.report.derivable,
  };
}

/** REQ-021 c9. Reaching is that the address is a domain name that resolves
 *  in DNS — the same test a rival domain meets (REQ-026 c8). Both facts are
 *  the caller's: `domain` is the canonical form, or `null` where what was
 *  typed is not a domain name; `resolves` is the network answer. This
 *  function decides nothing else about the site behind the address, which
 *  is the whole of what c9 promises a new, thin, unbuilt, coming-soon or
 *  fetcher-blocking site. */
export function validateAddress(domain: string | null, resolves: boolean): AddressResult {
  if (domain === null) return { ok: false, because: "not_a_domain" };
  if (!resolves) return { ok: false, because: "does_not_resolve" };
  return { ok: true, domain };
}

/**
 * REQ-021 c6 and REQ-026 c6 and c12, in one transition.
 *
 * An `inferred` market is cleared and re-derived against the new address;
 * a `stated` market is kept exactly as the founder left it; an `empty` one
 * re-runs the derivation too. Every `suggested` rival is dropped and every
 * `typed` one kept. No rival found for the replaced domain survives.
 *
 * Refusing the newly given address as a rival is `addRival`'s `own_domain`
 * arm, reached because the caller passes this state's `siteDomain` as
 * `ownDomain` — it is not re-implemented here.
 */
export function onDomainChanged(
  s: SetupState,
  a: { domain: string; report: ReportFacts | null }
): SetupState {
  const market: MarketCard =
    s.market.state === "stated"
      ? s.market
      : marketCardFor({ siteDomain: a.domain, report: a.report });

  const address: AddressCard =
    a.report !== null
      ? { state: "measured", domain: a.domain, fromScanId: a.report.scanId }
      : { state: "given", domain: a.domain };

  return {
    address,
    siteDomain: a.domain,
    market,
    suggestions: suggestionsFor(market),
    rivals: clearSuggested(s.rivals),
    // A market the founder stated survives the address change, so the new
    // address's stored twelve are not its twelve: they are re-derived for
    // the stated category, and stand empty until they have been.
    questions: s.market.state === "stated" ? Object.freeze([]) : (a.report?.questions ?? Object.freeze([])),
    derivable: a.report?.derivable ?? null,
  };
}

/** REQ-026 c2 and c3. What the founder entered is the market from then on,
 *  and stating it is the transition out of `awaiting_market`. Fetching the
 *  candidates is the adapter's; this performs no I/O. */
export function onMarketStated(s: SetupState, category: string): SetupState {
  return {
    ...s,
    market: { state: "stated", category },
    suggestions: { state: "seeking", candidates: Object.freeze([]) },
    // The twelve were the old category's; a corrected category has none
    // until `onQuestionsRederived` carries its own back.
    questions: Object.freeze([]),
  };
}

/** REQ-026 c4 and §12 ruling 4: the twelve the settled category derives,
 *  carried back from the one re-derivation seam. It re-selects over the
 *  stored market and buys nothing, which is `rederiveQuestions`' promise. */
export function onQuestionsRederived(
  s: SetupState,
  questions: readonly SetupQuestion[]
): SetupState {
  return { ...s, questions };
}

/** REQ-026 c7 and c10, second limb: suggestions sought for a known market
 *  either came back or did not, and "none came back" is its own state with
 *  its own written line. */
export function onSuggestionsSettled(s: SetupState, candidates: readonly string[]): SetupState {
  return {
    ...s,
    suggestions: {
      state: candidates.length === 0 ? "none_found" : "offered",
      candidates: Object.freeze([...candidates]),
    },
  };
}

/**
 * Exactly two things block the founder, and the union below is the
 * guarantee that no third ever quietly joins them.
 *
 * WO-084 step 5 wrote this with a single arm — `market_missing` — because
 * that work order was cut against REQ-026 alone. This issue builds REQ-021
 * on the same screen, and REQ-021 c7 states outright that setup "does not
 * proceed without" a site address. Two requirements name two blockers, so
 * the return type carries exactly two literals and no more; the intent
 * WO-084's single arm protected — that no *future field* becomes a third
 * thing that stops a founder who has answered what they were asked — is
 * unchanged, and `tests/market/setup/state.test.ts` pins the union.
 *
 * An empty rival set is `{ ok: true }` (REQ-026 c11). So is a market the
 * founder stated in their own words, and so is a destination they have not
 * connected (REQ-028 c4).
 */
export function validateSetup(
  s: SetupState
): { ok: true } | { ok: false; because: "address_missing" | "market_missing" } {
  if (s.siteDomain === null) return { ok: false, because: "address_missing" };
  if (s.market.state === "empty") return { ok: false, because: "market_missing" };
  return { ok: true };
}

/** The market the deep pass and every screen afterwards use — the one the
 *  founder confirmed or stated, never re-inferred (REQ-026 c4). `null`
 *  only on the empty card, which `validateSetup` refuses to submit. */
export function settledCategory(s: SetupState): string | null {
  return s.market.state === "empty" ? null : s.market.category;
}
