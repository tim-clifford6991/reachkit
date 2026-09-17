// §5 — the rivals setup offers, sought on the server for both ways in.
//
// `suggestRivals` decides which source a market's suggestions come from;
// this is the adapter that gives it the facts and settles the card with
// its answer (issue 750). Two callers:
//
//   - **The screen read** (`provider.ts`), for a free upgrade. The market
//     is inferred from the report the purchase came from, so the rivals
//     are that report's own and the ones the site names — no vendor call,
//     no row, no write while a page renders. A report with neither leaves
//     the card seeking, and the browser asks the route (issue 838).
//   - **`POST /api/setup/rivals`**, whenever the founder gives an address
//     or states a market. The report is read here from the domain, never
//     taken from the browser. A stated market — or an inferred one whose
//     report found no rivals (issue 838) — buys `competitors_domain`, spent under the `DEEP` cap against the
//     deep pass's own `scans` row, which this claims when setup accepts the
//     address (owner ruling, 2026-09-16), and counted in its `cost_cents`.
//     The pass adopts that row later. The kill switch refuses the call.
//
// **Every missing fact settles to a written state.** No site, a finished
// setup, an address that is not a domain, a claim that could not be
// written, a vendor that failed or ran past `TIMING.suggestCeilingS` — each
// answers "none found" and the founder types their own; only a market
// nobody has stated answers "waiting on the market". Nothing here can leave
// the card seeking.
import type { Measured } from "@/lib/measure/measured";
import type { Spend } from "@/lib/market/rivals/suggest";
import type { ReportFacts, SetupState } from "@/lib/market/setup/state";

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

/** The free upgrade's suggestions, for the state the screen opens in. */
export async function rivalsForScreen(a: {
  state: SetupState;
  report: ReportFacts | null;
  at: Date;
}): Promise<SettledRivals> {
  try {
    const { suggestRivals } = await import("@/lib/market/rivals/suggest");
    // A screen read spends nothing: where only a paid call could answer,
    // the card opens seeking and the route answers it.
    return settledRivals(await suggestRivals(null, a));
  } catch (error) {
    logUnsought(error);
    return null;
  }
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
}): Promise<SettledRivals> {
  try {
    const { setupStore } = await import("./provider");
    const progress = await setupStore().readProgress(a.userId);
    // Setup is where the deep pass is claimed, and a finished setup's pass
    // has already run: nothing is claimed or spent for it.
    if (progress.complete) return [];

    const { registrableDomain } = await import("@/lib/market/rivals/domains");
    const domain = registrableDomain(a.domain);
    if (domain === null) return [];

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

    const { suggestRivals } = await import("@/lib/market/rivals/suggest");
    return settledRivals(await suggestRivals(spend, { state, report, at: a.at }));
  } catch (error) {
    logUnsought(error);
    return [];
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
