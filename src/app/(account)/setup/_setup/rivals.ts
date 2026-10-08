// §5 — the rivals setup offers, sought on the server.
//
// `POST /api/setup/rivals` asks here whenever the founder gives an address
// or states a market. The report is read from the domain, never taken from
// the browser. ReachKit concludes the market and its rivals itself, each
// with its reason (owner D28 of 2026-10-02, #1185), spent under the `DEEP`
// cap against the deep pass's own `scans` row, which this claims when setup
// accepts the address (owner ruling, 2026-09-16), and counted in its
// `cost_cents`. The pass adopts that row later. The kill switch refuses the
// call. Where nothing of the site has been read yet, or the conclusion did
// not come back, the card is offered what it was before #1185: the rivals
// the site names and `competitors_domain`.
//
// **Every missing fact settles to a written state.** No site, a finished
// setup, an address that is not a domain, a claim that could not be
// written, a vendor that failed or ran past `TIMING.suggestCeilingS` — each
// answers "none found" and the founder types their own; only a market
// nobody has stated answers "waiting on the market". Nothing here can leave
// the card seeking.
import type { Measured } from "@/lib/measure/measured";
import type { Spend } from "@/lib/market/rivals/suggest";

/** What the card settles on: candidates (possibly none), or `null` where
 *  nothing was sought — no market is known (REQ-026 c10), or the screen
 *  read would have needed a paid call it cannot make. */
export type SettledRivals = readonly string[] | null;

/** `suggestRivals`'s three arms, as the card reads them. `not_attempted`
 *  is the one arm that sought nothing; a bound reached or a vendor failure
 *  is settled like an empty answer, as `suggest.ts` documents. */
export function settledRivals(answer: Measured<string[]>): SettledRivals {
  if (answer.kind === "unmeasured") return answer.reason === "not_attempted" ? null : [];
  return answer.value;
}

/** What the route answers (§5, D28): the rivals to offer, ReachKit's one
 *  line for each it concluded, and the market it concluded — `null` where it
 *  concluded none and the card keeps what it has. */
export interface SeekAnswer {
  candidates: SettledRivals;
  reasons: Readonly<Record<string, string>>;
  market: { category: string; reason: string } | null;
}

/**
 * The suggestions for the address and market the founder has on screen.
 *
 * `category` is the market they stated, or `null` for the one the report
 * behind `domain` infers — which this reads, so an inferred card is only
 * ever settled from the report for that address (REQ-021 c12).
 */
export async function seekRivals(a: {
  userId: string;
  domain: string;
  category: string | null;
  at: Date;
}): Promise<SeekAnswer> {
  const unsought = (candidates: SettledRivals): SeekAnswer => ({ candidates, reasons: {}, market: null });
  try {
    const { setupStore } = await import("./provider");
    const progress = await setupStore().readProgress(a.userId);
    // Setup is where the deep pass is claimed, and a finished setup's pass
    // has already run: nothing is claimed or spent for it.
    if (progress.complete) return unsought([]);

    const { registrableDomain } = await import("@/lib/market/rivals/domains");
    const domain = registrableDomain(a.domain);
    if (domain === null) return unsought([]);

    const { initialSetupState, onDomainChanged, onMarketStated } = await import(
      "@/lib/market/setup/state"
    );
    const { readReportFor } = await import("./provider");
    const report = await readReportFor(domain);
    const category = a.category?.trim() ?? "";
    const given = onDomainChanged(initialSetupState(null), { domain, report });
    const state = category === "" ? given : onMarketStated(given, category);

    const scanId = await claimFor({ siteId: progress.siteId, domain });
    const spend: Spend =
      scanId === null
        ? () => Promise.reject(new Error("no claimed row to spend against"))
        : async (body) => {
            const [{ env }, { withCostContext }, { FREE_SCAN_POLICY_VERSION }] = await Promise.all([
              import("@/lib/config/env"),
              import("@/lib/costs"),
              import("@/lib/scan/ceilings"),
            ]);
            // The kill switch stops every paid call (issue 798), and this
            // one runs on a request rather than a job, so no runner's guard
            // reads it first. Refused, the card settles "none found".
            if (env.KILL_SWITCH) throw new Error("the kill switch is engaged");
            // `rollUp: "add"`: the row is the pass's, still running, so its
            // status is not touched — a full roll-up would close it `done`
            // before the pass has begun — but what the call cost is added
            // to its `cost_cents`, which the pass then carries (issue 798).
            return withCostContext(
              { scanId, cap: "DEEP", policyVersion: FREE_SCAN_POLICY_VERSION, rollUp: "add" },
              body
            );
          };

    // D28 (#1185): ReachKit concludes the market and its rivals itself,
    // each with its reason, and the founder never has to. Where nothing of
    // the site has been read yet, or the call did not come back, the card
    // is offered what it was before.
    if (scanId !== null) {
      const { concludeAtSetup } = await import("@/lib/scan/market-conclusion");
      const concluded = await concludeAtSetup({
        siteId: progress.siteId,
        domain,
        stated: category === "" ? null : category,
        spend,
        at: a.at,
      }).catch((error: unknown) => {
        logUnsought(error);
        return null;
      });
      if (concluded !== null && concluded.rivals.length > 0) {
        return {
          candidates: concluded.rivals.map((rival) => rival.domain),
          reasons: Object.fromEntries(concluded.rivals.map((rival) => [rival.domain, rival.reason])),
          market:
            category === "" ? { category: concluded.category, reason: concluded.categoryReason } : null,
        };
      }
    }

    const [{ suggestRivals }, { siteLocale }] = await Promise.all([
      import("@/lib/market/rivals/suggest"),
      import("@/lib/locale/site"),
    ]);
    return unsought(settledRivals(await suggestRivals(spend, { state, report, at: a.at, locale: await siteLocale(progress.siteId) })));
  } catch (error) {
    logUnsought(error);
    return unsought([]);
  }
}

/** The claim, or `null` where it could not be written. An inferred market
 *  needs no row, so a failed claim costs only the stated path's call. */
async function claimFor(a: { siteId: string; domain: string }): Promise<string | null> {
  try {
    const { claimOnboardingPass } = await import("@/lib/scan/run");
    return await claimOnboardingPass(a);
  } catch (error) {
    logUnsought(error);
    return null;
  }
}

function logUnsought(error: unknown): void {
  console.log(
    JSON.stringify({
      event: "rival_suggestion_unsought",
      because: error instanceof Error ? error.message : String(error),
    })
  );
}
