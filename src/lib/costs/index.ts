// src/lib/costs/index.ts — BP-007's public interface (WO-022, folded into
// WO-276), verbatim from `## Public interface`.
//
// `withCostContext()` opens the context, runs `body`, and at close writes
// the roll-up (`spentCents()`, `degraded()`) to `scans.cost_cents` and
// `scans.status` (BP-007 `## NFR budget`). `recordFetch` is cache-first,
// ledger-always (`cache.ts`, `ledger.ts`): a cache hit costs nothing and
// touches neither the cap nor the ledger; a miss **reserves** `costCents`
// before `run()` — the cap is checked against the reservation, never a
// figure that does not exist yet — and, where the call site supplies
// `settleCents`, **settles** the ledgered figure from the response
// afterwards, clamped to the reservation (ADR-094 decision 3a, BP-007
// decision 4).
//
// **Sequential-calls assumption (rule 1.1 — parameter, recorded once
// here).** `capHit()`'s own contract — "re-checked between calls in any
// multi-call step" — and every multi-call example in BP-007 describe a
// caller `await`ing one `recordFetch` at a time inside a loop, never
// several run concurrently (e.g. via `Promise.all`). This implementation
// tracks one in-flight reservation at a time on that assumption; a caller
// that fans multiple `recordFetch` calls out concurrently would race that
// single slot. No call site in this WO's scope does — BP-008/BP-009's
// callers are this seam's, out of scope here — and enforcing mutual
// exclusion defensively (a queue, a lock) is not asked for by any test
// row and is not added speculatively. Reversal cost if this assumption
// stops holding: replace the single `inFlightReserved` number with a set
// of concurrent reservations, summed — a change local to this file.
import { dbAdmin } from "@/lib/db";
// §6.4's first rule — "nothing is fetched that no rendered surface reads"
// and, with it, nothing fetched twice that one scan already holds. A cost
// context is the one thing in this codebase whose lifetime *is* a scan, so
// it is what opens the robots memo (#73). This seam learns nothing about
// robots: it opens a scope and closes it, and `src/lib/egress/` decides
// everything inside.
import { withRobotsMemo } from "@/lib/egress/robots-memo";
import { CAPS } from "@/lib/config/constants";
import { now } from "@/lib/config/now";
import { readCache } from "./cache";
import { openDayLedger } from "./daily";
import { writeFetchRow } from "./ledger";

export type CapName = "FREE" | "DEEP" | "WEEKLY" | "DRAFT";

const CAP_VALUES: Record<CapName, number> = {
  FREE: CAPS.FREE_C,
  DEEP: CAPS.DEEP_C,
  WEEKLY: CAPS.WEEKLY_C,
  DRAFT: CAPS.DRAFT_C,
};

/** Why a call was refused. The per-pass cap is the one BP-007 wrote; the
 *  day's ceiling is the product-wide one (issue #329). Both refuse the same
 *  way — `{ skipped: "cap" }`, degrade, never throw — and a stage that has
 *  been told to stop spending has no use for the difference. It is recorded
 *  rather than returned: what needs to know why is whoever reads the logs
 *  after a day the product went quiet. */
type CapReason = "scan_cap" | "daily_ceiling";

/** The seam's own log channel, the shape `logClampedSettlement` already
 *  uses. One line the first time a context refuses, naming which ceiling
 *  did it — a second line per skipped call would say nothing new and would
 *  bury the first under a twelve-SERP stage. */
function logCapHit(a: {
  reason: CapReason;
  source: string;
  cap: CapName;
  spentCents: number;
  ceilingCents: number;
}): void {
  console.warn(JSON.stringify({ event: "cap_hit", ...a }));
}

export interface CostContext {
  /** Which ceiling this context runs under. Read by the one call site that
   *  must refuse under a ceiling regardless of headroom: BUILD §6.2/§6.3 —
   *  "the free path makes **zero** AI Optimization API calls" — is enforced
   *  in `src/lib/vendors/dataforseo/ai.ts` by reading this, since no
   *  compile-time shape can tell a free context from a paid one. Added
   *  with issue #23; every other member is unchanged. */
  readonly cap: CapName;

  /** Cache-first, ledger-always. `fresh` false means the payload came from
   *  cache and cost nothing. An empty payload is always a miss; there is
   *  no negative cache. */
  recordFetch<P>(call: {
    source: string; // vendor endpoint or model id
    cacheKey: string;
    freshnessDays: number;
    /** The **reservation**: the most this call can cost, known before it
     *  runs. The cap is checked against this, so no call is made against
     *  money the context has not got. */
    costCents: number;
    /** Optional **settlement** (ADR-094 decision 3a). Where a vendor's own
     *  documented rule makes the final charge a function of the response,
     *  the call site supplies it and the ledger records the settled
     *  figure instead of the reservation. `settled <= reserved` is
     *  enforced here, not trusted: a closure returning more is clamped to
     *  the reservation and logged, since the excess would be money the
     *  cap never authorised. One call site uses it today — BP-008's
     *  flagged `serpOrganic`. Omitting it is the ordinary case and
     *  behaves exactly as before this argument existed. */
    settleCents?: (payload: P) => number;
    run: () => Promise<P>;
  }): Promise<{ payload: P; fresh: boolean; costCents: number } | { skipped: "cap" }>;
  // The returned `costCents` is the settled figure where one was
  // supplied, the reservation otherwise — one number, and it is the one
  // the row carries.

  /** True once *either* ceiling is reached — this pass's own cap, or the
   *  product's daily one (issue #329). Re-checked between calls in any
   *  multi-call step. */
  capHit(): boolean;
  spentCents(): number;
  degraded(): boolean;
}

/** `console.warn` is this seam's own log channel for the one invariant it
 *  enforces rather than trusts (rule 1.1 — parameter: no logging seam is
 *  in this WO's file plan or `depends-on`, and `console.warn` is what
 *  every other module in this corpus reaches for absent one — e.g.
 *  `src/lib/scan/admission.ts`'s `logAdmission`, `console.log`).
 *  Reversal cost: swap the one call site for a real logger once BP-016 or
 *  an observability seam exists. */
function logClampedSettlement(source: string, reservedCents: number, proposedCents: number): void {
  console.warn(
    JSON.stringify({
      event: "cost_settlement_clamped",
      source,
      reservedCents,
      proposedCents,
    })
  );
}

export async function withCostContext<T>(
  ctx: {
    scanId: string;
    cap: CapName;
    policyVersion: number;
    /** Which row the close writes its roll-up to. `"scan"` (the default,
     *  and every caller's behaviour before this argument existed) writes
     *  `scans.cost_cents` and `scans.status`; `"none"` writes nothing.
     *
     *  `"none"` exists for the generation pipeline (BUILD §8), which spends
     *  under `CAP_DRAFT` against the scan that grounds the day's page:
     *  `fetches.scan_id` is `not null`, so every ledger row a draft writes
     *  is keyed to that scan — but the draft's spend is the *draft's*
     *  (`drafts.cost_cents`, BUILD §10), and rolling it into the scan's
     *  total would overstate what the scan cost and would flip a scan that
     *  degraded back to `done`. Every ledgered `fetches` row stands either
     *  way: the roll-up is a cached summary, `fetches` is the source of
     *  truth. */
    rollUp?: "scan" | "none";
  },
  body: (cost: CostContext) => Promise<T>
): Promise<T> {
  const capValue = CAP_VALUES[ctx.cap];
  let ledgeredCents = 0;
  let inFlightReserved = 0;
  let isDegraded = false;
  // One read, when the context opens, of what the whole product has spent
  // today (issue #329) — see `daily.ts` for why it is asked once a pass and
  // not once a call, and for what an unreadable ledger means.
  const day = await openDayLedger(now());
  let capHitLogged = false;

  function refuse(reason: CapReason, source: string, ceilingCents: number): { skipped: "cap" } {
    isDegraded = true;
    if (!capHitLogged) {
      capHitLogged = true;
      logCapHit({
        reason,
        source,
        cap: ctx.cap,
        spentCents: reason === "daily_ceiling" ? day.spentCents() : spentCents(),
        ceilingCents,
      });
    }
    return { skipped: "cap" };
  }

  function spentCents(): number {
    return ledgeredCents + inFlightReserved;
  }

  const cost: CostContext = {
    cap: ctx.cap,

    async recordFetch<P>(call: {
      source: string;
      cacheKey: string;
      freshnessDays: number;
      costCents: number;
      settleCents?: (payload: P) => number;
      run: () => Promise<P>;
    }): Promise<{ payload: P; fresh: boolean; costCents: number } | { skipped: "cap" }> {
      // Cache-first: a hit is free and bypasses the cap entirely — it
      // never reaches the vendor, so there is nothing for the cap to
      // protect against.
      const cached = await readCache({
        source: call.source,
        cacheKey: call.cacheKey,
        policyVersion: ctx.policyVersion,
        freshnessDays: call.freshnessDays,
      });
      if (cached) {
        return { payload: cached.payload as P, fresh: false, costCents: 0 };
      }

      // The product-wide ceiling first: it is the one that outranks this
      // pass's own budget. A pass with headroom of its own still stops when
      // the day has none, which is the whole point of a ceiling above the
      // caps — and it stops the way §6.5 says every cap stops, by skipping
      // the remaining work and marking the pass `degraded`, never by
      // throwing. A free scan never gets this far on a day that is already
      // over: `admitFreeScan` refuses it at the door (`admission.ts`), so
      // what this arm holds is the paid pass, which holds rather than fails.
      if (day.ceilingReached()) {
        return refuse("daily_ceiling", call.source, CAPS.DAILY_PRODUCT_C);
      }

      // The cap is checked against the **reservation** — the settlement
      // does not exist yet (BP-007 `## Public interface`).
      if (spentCents() + call.costCents > capValue) {
        return refuse("scan_cap", call.source, capValue);
      }

      // Between the reservation and the settlement the context is
      // charged the higher (reserved) figure, so a cap can never be
      // exceeded by a call in flight (BP-007 `## Error & edge behavior`).
      inFlightReserved = call.costCents;
      let payload: P;
      try {
        payload = await call.run();
      } finally {
        inFlightReserved = 0;
      }

      let settledCents = call.costCents;
      if (call.settleCents) {
        const proposedCents = call.settleCents(payload);
        if (proposedCents > call.costCents) {
          // A settlement never raises a charge (BP-007 `## Error & edge
          // behavior`) — clamp to the reservation and log, never trust
          // the closure.
          logClampedSettlement(call.source, call.costCents, proposedCents);
        } else {
          settledCents = proposedCents;
        }
      }

      await writeFetchRow({
        scanId: ctx.scanId,
        source: call.source,
        cacheKey: call.cacheKey,
        policyVersion: ctx.policyVersion,
        reservedCents: call.costCents,
        costCents: settledCents,
        payload,
      });
      ledgeredCents += settledCents;
      // The day's total moves by what was actually ledgered, and `add`
      // publishes the crossing if this is the call that made one.
      day.add(settledCents);

      return { payload, fresh: true, costCents: settledCents };
    },

    capHit(): boolean {
      // Either ceiling. A multi-call step re-checks this between calls and
      // stops on it, so a step that would otherwise keep asking and keep
      // being refused stops on the first refusal instead — and the pass
      // ends `spend_ceiling` (`src/lib/scan/ceilings.ts`), which is where
      // the reason reaches the stored report and the screen.
      return spentCents() >= capValue || day.ceilingReached();
    },

    spentCents,

    degraded(): boolean {
      return isDegraded;
    },
  };

  // Money already spent inside `body` is kept regardless of how `body`
  // itself concludes — the roll-up below only reflects a *clean* close,
  // per BP-007 `## NFR budget`, "a per-scan roll-up ... is written to
  // `scans.cost_cents` and `scans.status` at close". Setting a terminal
  // `scans.status` on an error path (e.g. `failed`) is BP-012's own
  // scan-lifecycle decision, not this seam's (`## Out of scope`: this
  // order opens the context it is given, nothing about the pipeline
  // around it) — an exception from `body` therefore propagates untouched,
  // leaving `scans.cost_cents`/`scans.status` for BP-012's own error path
  // to set. Every already-ledgered `fetches` row stands regardless: the
  // roll-up is a cached summary, `fetches` is the source of truth.
  // `withRobotsMemo` scopes one robots.txt read per origin to this
  // context (#73): opened here so it cannot outlive the pass, and closed
  // by the same `await` — an exception from `body` still propagates
  // untouched, and takes the memo with it.
  const result = await withRobotsMemo(() => body(cost));

  if (ctx.rollUp === "none") return result;

  const { error } = await dbAdmin()
    .from("scans")
    .update({
      cost_cents: cost.spentCents(),
      status: cost.degraded() ? "degraded" : "done",
    })
    .eq("id", ctx.scanId);
  if (error) {
    throw new Error(`withCostContext: roll-up write to scans failed: ${error.message}`);
  }

  return result;
}
