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
//     already bought, 0¢ (§6.4's reuse rule). No vendor call is made
//     while that list has a rival in it, and the list is identical whether
//     the customer ranks for 10,000 searches or for none. **A report that
//     found none falls back to `competitors_domain`** (issue 838): a new
//     site whose market read no searches has no SERPs to derive rivals
//     from, and it is exactly the site that needs them offered. That call
//     is the stated path's own — same row, same cap, same bound.
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
//   - **Named on the site.** The rivals the site's own pages name, which
//     the profile already read, are offered first on both paths above.
//     They cost nothing, so they never wait on the vendor (issue 838).
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
import type { CompetitorRow } from "@/lib/vendors/dataforseo/types";
import { bandRivalSize } from "./band";
import { registrableDomain } from "./domains";

const SUGGEST_CEILING_MS = TIMING.suggestCeilingS * 1000;

/**
 * Opens the cost context the one vendor call spends in, only when that
 * call is made. The empty path and an inferred market with free rivals
 * never open one — which is what lets the screen read settle those
 * suggestions with no row to spend against — and the paid path's is the
 * caller's: setup keys it to the deep pass's claimed row (owner ruling,
 * 2026-09-16). A spend that cannot open rejects, and is settled like a
 * vendor failure. A caller with no spend at all passes `null`, and a card
 * that needs the call is then left unsought rather than settled.
 */
export type Spend = <T>(body: (c: CostContext) => Promise<T>) => Promise<T>;

/**
 * Suggested rival domains for the card, canonical and ready to be added.
 *
 * The three `Measured` arms say which of the three paths above was taken,
 * and the distinction is load-bearing for REQ-026 c10's two states:
 *
 *   - `unmeasured` / `not_attempted` — nothing was sought. A card with no
 *     market can only ever reach this arm, so "none were found" is
 *     structurally unreachable from a state that never sought. A caller
 *     with no spend reaches it too, where the answer needs the paid call.
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
  spend: Spend | null,
  a: { state: SetupState; report: ReportFacts | null; at: Date }
): Promise<Measured<string[]>> {
  const own = a.state.siteDomain;

  if (a.state.market.state === "empty") {
    logSuggestion({ source: "none", count: 0 });
    return unmeasured<string[]>("not_attempted", a.at);
  }

  // The rivals the site's own pages name are free on every path: the
  // profile read them off the founder's site, so they are theirs whichever
  // market is on the card (issue 838).
  const named = a.report?.namedRivals ?? [];

  // `inferred` is the market a completed report measured, so that report's
  // own derivation is the market's rival list. A `stated` market is one the
  // founder replaced or supplied: the report behind the purchase, if there
  // is one at all, measured a different market, and its rivals are not
  // theirs — which is the same rule REQ-021 c12 states for a replaced
  // domain, applied to a replaced market.
  if (a.state.market.state === "inferred") {
    const free = admissible([...named, ...(a.report?.rivals ?? [])], a.state, own);
    if (free.length > 0) {
      logSuggestion({ source: "report", count: free.length });
      return measured(free, a.at);
    }
    // A report that found no rivals — a new site whose market read no
    // searches, so no SERPs to derive them from — still gets suggestions:
    // the same `competitors_domain` call a stated market makes (issue 838).
  }

  // No caller that can spend: the screen read. Nothing is sought, so the
  // card opens seeking and the founder's browser asks the route, which can.
  if (own === null || spend === null) {
    logSuggestion({ source: "none", count: 0 });
    return unmeasured<string[]>("not_attempted", a.at);
  }

  const rows = await withinCeiling(
    spend((c) => competitorsDomain(c, { domain: own })).catch(() =>
      unmeasured<CompetitorRow[]>("undeterminable", a.at)
    ),
    a.at
  );
  const candidates = admissible(
    [...named, ...(rows.kind === "unmeasured" ? [] : reachable(rows.value))],
    a.state,
    own
  );
  logSuggestion({ source: "competitors_domain", count: candidates.length });
  if (candidates.length > 0) return measured(candidates, a.at);
  return rows.kind === "unmeasured"
    ? unmeasured<string[]>(rows.reason, a.at)
    : measuredZero<string[]>([], a.at);
}

/**
 * The vendor's competitors, right-sized to the founder's own site (SPEC §6,
 * owner walk 2026-09-17, issue 858): the call already reports each domain's
 * footprint and the site's own, so a rival far beyond the site is never
 * offered as theirs, and the nearest come first. A competitor the vendor
 * gave no count for keeps its place after the sized ones — nothing about
 * it says it is far.
 */
function reachable(rows: readonly CompetitorRow[]): string[] {
  const order = (row: CompetitorRow): number => {
    if (row.rankedCount === undefined) return 2;
    const band = bandRivalSize({ rivalRanked: row.rankedCount, ownRanked: row.ownRankedCount ?? 0 });
    return band === "near" ? 0 : band === "middle" ? 1 : 3;
  };
  return rows
    .map((row) => ({ row, order: order(row) }))
    .filter(({ order }) => order !== 3)
    .sort((x, y) => x.order - y.order)
    .map(({ row }) => row.domain);
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
  call: Promise<Measured<CompetitorRow[]>>,
  at: Date
): Promise<Measured<CompetitorRow[]>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<Measured<CompetitorRow[]>>((resolve) => {
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
