// BUILD §6.6 — the two suggestion sources, and why one of them is free.
//
// The archived plan is WO-085. §4.3 says setup's chips come from
// `competitors_domain`; §6.6 says "At setup the suggested chips come from
// this list" — the market derivation — and that "`competitors_domain`
// adds candidates only when the customer has presence (warm-start
// supplement)". Read as one rule they conflict; read against which facts
// exist at the moment the card renders they do not, and the branch below
// is that reconciliation:
//
//   - **The market was inferred from a completed report.** The
//     suggestions are the market-derived rivals that report already
//     holds — `deriveRivals` over the twelve SERPs, counted over data
//     already bought, 0¢ (§6.4's reuse rule). No vendor call is made on
//     this path at all, and the list is identical whether the customer
//     ranks for 10,000 searches or for none.
//   - **The founder stated the market.** No report measured it — either
//     none backs the purchase, or the founder replaced the one that did —
//     so the market-derived list cannot exist: it needs twelve SERPs only
//     a scan produces. The one remaining source is `competitorsDomain`,
//     which is keyed on the customer's own rankings. §6.6's "only when the
//     customer has presence" is held by that endpoint's own semantics
//     rather than by a second gate in front of it: a domain that ranks for
//     nothing has no competitors to return, so it returns none, the card
//     says none were found, and the founder types their own. Presence is
//     never a *dependency* — it is the difference between a supplement
//     arriving and not arriving.
//   - **No market yet.** Nothing is sought and nothing is called. The card
//     stays waiting on the market; it never says no rivals were found for
//     a market nobody has stated.
//
// **The founder can always type a rival**, on every one of those paths.
// That is `addRival`'s, not this module's, and it is why an empty result
// here is a legal outcome rather than a failure (REQ-026 c11).
//
// **Setup is never held on suggestions.** The one vendor call is bounded
// at `TIMING.suggestCeilingS`; a bound reached, a vendor failure and a
// vendor's own empty answer all release the screen. The caller settles the
// card from the returned candidates — none of the three can leave it
// spinning.
//
// **No rival found for a replaced domain is offered as theirs** (REQ-021
// c12): this function reads only the current `siteDomain` and the
// `ReportFacts` the caller currently holds, both re-keyed by
// `onDomainChanged`, so a stale report cannot reach it.
import { BATTERY, TIMING } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import { competitorsDomain } from "@/lib/vendors/dataforseo";
import type { ReportFacts, SetupState } from "../setup/state";
import { registrableDomain } from "./domains";

const SUGGEST_CEILING_MS = TIMING.suggestCeilingS * 1000;

/**
 * Suggested rival domains for the card, canonical and ready to be added.
 *
 * The three `Measured` arms say which of the three paths above was taken,
 * and the distinction is load-bearing for REQ-026 c10's two states:
 *
 *   - `unmeasured` / `not_attempted` — nothing was sought. A card with no
 *     market can only ever reach this arm, so "none were found" is
 *     structurally unreachable from a state that never sought.
 *   - `zero` — a source was consulted and offered nothing. This is the
 *     card's `none_found`.
 *   - `measured` — candidates, at most `BATTERY.COMPETITORS_MAX` of them.
 *
 * A vendor failure or a reached bound returns `unmeasured` /
 * `undeterminable`: the product tried and cannot say. The caller settles
 * that card the same way it settles `zero` — with no candidates, and the
 * founder typing their own — which is why setup is released either way;
 * the arm is kept apart so the reason survives into the log rather than
 * being rewritten as an answer nobody measured.
 */
export async function suggestRivals(
  c: CostContext,
  a: { state: SetupState; report: ReportFacts | null; at: Date }
): Promise<Measured<string[]>> {
  const own = a.state.siteDomain;

  if (a.state.market.state === "empty") {
    logSuggestion({ source: "none", count: 0 });
    return unmeasured<string[]>("not_attempted", a.at);
  }

  // `inferred` is the market a completed report measured, so that report's
  // own derivation is the market's rival list. A `stated` market is one the
  // founder replaced or supplied: the report behind the purchase, if there
  // is one at all, measured a different market, and its rivals are not
  // theirs — which is the same rule REQ-021 c12 states for a replaced
  // domain, applied to a replaced market.
  if (a.state.market.state === "inferred") {
    const candidates = admissible(a.report?.rivals ?? [], a.state, own);
    logSuggestion({ source: "report", count: candidates.length });
    return candidates.length === 0
      ? measuredZero<string[]>([], a.at)
      : measured(candidates, a.at);
  }

  if (own === null) {
    logSuggestion({ source: "none", count: 0 });
    return unmeasured<string[]>("not_attempted", a.at);
  }

  const rows = await withinCeiling(competitorsDomain(c, { domain: own }), a.at);
  if (rows.kind === "unmeasured") {
    logSuggestion({ source: "competitors_domain", count: 0 });
    return unmeasured<string[]>(rows.reason, a.at);
  }

  const candidates = admissible(
    rows.value.map((row) => row.domain),
    a.state,
    own
  );
  logSuggestion({ source: "competitors_domain", count: candidates.length });
  return candidates.length === 0 ? measuredZero<string[]>([], a.at) : measured(candidates, a.at);
}

/**
 * Canonical, de-duplicated, and already free of everything `addRival`
 * would refuse for a reason the founder cannot act on: a value that is not
 * a domain, the account's own address, and a rival already in the set. The
 * list is capped at `BATTERY.COMPETITORS_MAX` — the whole set the product
 * tracks — so a card can never offer more chips than a founder could
 * accept.
 *
 * Refusals are `addRival`'s and are not re-implemented: this filter offers
 * fewer candidates, it never admits one. Anything it lets through still
 * goes through `addRival`, which is where the DNS check and the five
 * refusal reasons live.
 */
function admissible(
  raw: readonly string[],
  state: SetupState,
  own: string | null
): string[] {
  const held = new Set(state.rivals.map((rival) => rival.domain));
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of raw) {
    const domain = registrableDomain(value);
    if (domain === null) continue;
    if (own !== null && domain === own) continue;
    if (held.has(domain) || seen.has(domain)) continue;
    seen.add(domain);
    out.push(domain);
    if (out.length === BATTERY.COMPETITORS_MAX) break;
  }
  return out;
}

/** The bound that keeps the screen moving. A call still running when the
 *  ceiling is reached is abandoned — not retried, not awaited, not
 *  cancelled mid-ledger: the cost seam has already reserved and will still
 *  settle whatever the call ends up costing, and the founder is released
 *  meanwhile. */
async function withinCeiling(
  call: Promise<Measured<{ domain: string }[]>>,
  at: Date
): Promise<Measured<{ domain: string }[]>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<Measured<{ domain: string }[]>>((resolve) => {
    timer = setTimeout(() => resolve(unmeasured("undeterminable", at)), SUGGEST_CEILING_MS);
  });
  try {
    return await Promise.race([call, ceiling]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** BP-034's observability line for this node: which source produced the
 *  suggestions, and how many. No domain reaches it. */
function logSuggestion(record: { source: "report" | "competitors_domain" | "none"; count: number }): void {
  console.log(JSON.stringify({ event: "rival_suggestion", ...record }));
}
