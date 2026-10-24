// The cost seam. A cache hit is free and skips the caps; a miss reserves `costCents` against every ceiling before
// `run()`, and settles the ledgered figure afterwards, never above the reservation. Reservations in flight
// accumulate, so concurrent calls are checked against the cap together.
//
// Three ceilings stand over a call: this pass's cap bounds one measurement, the product's day bounds the company's
// exposure, and the site's day (read off the scan row, so no caller can leave it out) keeps one customer from
// spending everyone else's day.
import { dbAdmin } from "@/lib/db";
// A cost context lives exactly as long as a scan, so it scopes the robots memo; `src/lib/egress/` decides what is in it.
import { withRobotsMemo } from "@/lib/egress/robots-memo";
import { CAPS } from "@/lib/config/constants";
import { now } from "@/lib/config/now";
import { readCache } from "./cache";
import { openDayLedger, openSiteDayLedger, type SiteDayLedger } from "./daily";
import { nameDraftOnRows, writeFetchRow } from "./ledger";
import { isFetchRefusal, isVendorFailure } from "./refusal";
export {
  isFetchRefusal,
  isVendorFailure,
  refusalOf,
  type FetchRefusal,
  type FetchRefusalReason,
  type VendorFailure,
} from "./refusal";

export type CapName = "FREE" | "DEEP" | "WEEKLY" | "DRAFT";

const CAP_VALUES: Record<CapName, number> = {
  FREE: CAPS.FREE_C,
  DEEP: CAPS.DEEP_C,
  WEEKLY: CAPS.WEEKLY_C,
  DRAFT: CAPS.DRAFT_C,
};

/** Why a call was refused. All three refuse alike (`{ skipped: "cap" }`,
 *  degrade, never throw), so the reason is logged rather than returned. */
type CapReason = "scan_cap" | "daily_ceiling" | "site_cap";

/** One line the first time a context refuses, naming the ceiling; a line per
 *  skipped call would bury it. */
function logCapHit(a: {
  reason: CapReason;
  source: string;
  cap: CapName;
  spentCents: number;
  ceilingCents: number;
  /** Whose cap, where the refusal is a site's, so the log says which customer. */
  siteId?: string;
}): void {
  console.warn(JSON.stringify({ event: "cap_hit", ...a }));
}

export interface CostContext {
  /** Which ceiling this context runs under. `src/lib/vendors/dataforseo/ai.ts`
   *  reads it to keep the free path at zero AI Optimization calls (BUILD
   *  §6.2/§6.3): no compile-time shape tells a free context from a paid one. */
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
    /** Optional **settlement**, where a vendor's documented rule makes the
     *  charge a function of the response. `settled <= reserved` is enforced,
     *  not trusted: more is clamped and logged, since the cap never
     *  authorised the excess. */
    settleCents?: (payload: P) => number;
    /** What the vendor says it charged for this call, in cents, asked once
     *  `run` has answered. Stored beside the settled
     *  figure as `fetches.billed_cents` and read by nothing that decides
     *  whether to call. `undefined` where the response carried no charge,
     *  which is stored as null and never as a guess. */
    billedCents?: () => number | undefined;
    run: () => Promise<P>;
  }): Promise<
    { payload: P; fresh: boolean; costCents: number; storedAt: Date | null } | { skipped: "cap" }
  >;
  // The returned `costCents` is the settled figure where one was
  // supplied, the reservation otherwise — one number, and it is the one
  // the row carries.
  //
  // `storedAt` is when the served row was bought, non-`null` exactly when `fresh` is `false` (SPEC §2).

  /** True once any of the three ceilings is reached. Re-checked between calls
   *  in any multi-call step. */
  capHit(): boolean;
  spentCents(): number;
  degraded(): boolean;
  /** True once a vendor refused a call of this context for lack of credit.
   *  Absent on a stand-in context, which is never refused. */
  fundsRefused?(): boolean;

  /** The draft this context's calls are for, once it has a row.
   *  The calls made since the context opened, or since the last `null`,
   *  that name no draft are named for it, and so is every call after it, so
   *  `drafts.cost_cents` is the ledger's sum over the draft. `null` starts
   *  the next page, which has no row yet: one day's context may try a
   *  second topic. Present on a draft's context (`rollUp: "none"`); a
   *  stand-in context may leave it out. */
  forDraft?(draftId: string | null): Promise<void>;
}

/** The log line for a settlement the seam clamped rather than trusted. */
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
     *  `"none"` is a draft's (BUILD §8): its rows are keyed to the grounding
     *  scan, but its spend is `drafts.cost_cents` (BUILD §10), and rolling it
     *  in would overstate the scan and flip a degraded one to `done`.
     *
     *  `"add"` is spend against a row outside the pass that closes it, such
     *  as setup's rival suggestion: the row's `cost_cents` counts against the
     *  cap and the close writes the total back, leaving the status alone. */
    rollUp?: "scan" | "add" | "none";
    /** Spend already ledgered against this row by an earlier context: the
     *  claimed onboarding row carries setup's rival suggestion.
     *  It counts against this cap and is part of the roll-up, so the row's
     *  `cost_cents` is every paid call made against it, not only this
     *  context's. `rollUp: "add"` reads it from the row instead. */
    priorCents?: number;
    /** The draft this context spends for, where it already has
     *  a row — an edit, or a rewrite of the date's row. */
    draftId?: string;
    /** Cents of the cap this context may not spend, so a later context on the same row still has them. */
    holdBackCents?: number;
    /** A close after a refusal for credit rolls the row up `failed`, so it never reads as measured. */
    failsWhenFundsRefused?: true;
  },
  body: (cost: CostContext) => Promise<T>
): Promise<T> {
  const capValue = CAP_VALUES[ctx.cap] - (ctx.holdBackCents ?? 0);
  // The site is read off the row, never taken as an argument: a cap a caller could omit is one it could walk past.
  const row = await readScanRow(ctx.scanId);
  if (ctx.rollUp === "add" && row.costCents === null) {
    // Counting an unreadable row as nothing would open with headroom already spent, and the close would erase it.
    throw new Error(`withCostContext: could not read ${ctx.scanId}'s cost: ${row.unreadable}`);
  }
  let ledgeredCents = ctx.rollUp === "add" ? (row.costCents ?? 0) : (ctx.priorCents ?? 0);
  let inFlightReserved = 0;
  let isDegraded = false;
  // Read now and again before every paid call; `daily.ts` says what an unreadable ledger means.
  const day = await openDayLedger(now());
  // `null` for a free scan: no customer to charge, and its bounds are checked at the door in `admission.ts`.
  const site: SiteDayLedger | null =
    row.siteId === null ? null : await openSiteDayLedger(row.siteId, now());
  let capHitLogged = false;
  let refusedForFunds = false;
  // A context that writes no roll-up is a draft's, and its rows say so; any other's activity the database reads off the scan.
  const isDraft = ctx.rollUp === "none";
  let draftId = ctx.draftId;
  /** This context's rows written while no draft was named. */
  let unnamed: string[] = [];

  function refuse(reason: CapReason, source: string, ceilingCents: number): { skipped: "cap" } {
    isDegraded = true;
    if (!capHitLogged) {
      capHitLogged = true;
      logCapHit({
        reason,
        source,
        cap: ctx.cap,
        spentCents:
          reason === "daily_ceiling"
            ? day.spentCents()
            : reason === "site_cap"
              ? (site?.spentCents() ?? 0)
              : spentCents(),
        ceilingCents,
        ...(reason === "site_cap" && site !== null ? { siteId: site.siteId } : {}),
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
      billedCents?: () => number | undefined;
      run: () => Promise<P>;
    }): Promise<
      { payload: P; fresh: boolean; costCents: number; storedAt: Date | null } | { skipped: "cap" }
    > {
      // A hit never reaches the vendor, so there is nothing for the cap to protect.
      const cached = await readCache({
        source: call.source,
        cacheKey: call.cacheKey,
        policyVersion: ctx.policyVersion,
        freshnessDays: call.freshnessDays,
      });
      if (cached) {
        return { payload: cached.payload as P, fresh: false, costCents: 0, storedAt: cached.storedAt };
      }

      // The product's day outranks this pass's headroom. Re-read so a pass beside this one is counted, with this
      // pass's in-flight calls added; this call may still carry the day over, and that crossing is the alert.
      await day.refresh(now());
      if (day.ceilingReached(inFlightReserved)) {
        return refuse("daily_ceiling", call.source, day.ceilingCents());
      }

      // Then this site's share, re-read the same way; refusing only here leaves every other site's call untouched.
      if (site !== null) {
        await site.refresh(now());
        if (site.capReached(inFlightReserved)) {
          return refuse("site_cap", call.source, CAPS.DAILY_SITE_C);
        }
      }

      // Checked against the reservation: the settlement does not exist yet.
      if (spentCents() + call.costCents > capValue) {
        return refuse("scan_cap", call.source, capValue);
      }

      // Accumulated, since several calls may be in flight, and held until the settlement reaches the ledger so the
      // money is always in one of the two figures `spentCents()` sums. The `finally` releases it on every path.
      inFlightReserved += call.costCents;
      // Vendor failures come back as a payload, not a raise, so one clock times both.
      const startedMs = Date.now();
      try {
        const payload = await call.run();

        let settledCents = call.costCents;
        if (isFetchRefusal(payload)) {
          // A refused fetch bought nothing, whatever was reserved for it.
          settledCents = 0;
        } else if (isVendorFailure(payload) && !payload.billed) {
          // A failure the vendor does not charge for, by the call site's word, is ledgered at 0 cents.
          settledCents = 0;
          if (payload.funds === true && !refusedForFunds) {
            refusedForFunds = true;
            // One line a run, so an empty account reads as the cause and not as a blank week.
            console.warn(JSON.stringify({ event: "vendor_funds_refused", scanId: ctx.scanId, source: call.source, failure: payload.vendorFailure }));
          }
        } else if (call.settleCents) {
          const proposedCents = call.settleCents(payload);
          if (proposedCents > call.costCents) {
            // A settlement never raises a charge.
            logClampedSettlement(call.source, call.costCents, proposedCents);
          } else {
            settledCents = proposedCents;
          }
        }

        const billedCents = call.billedCents?.();
        const rowId = crypto.randomUUID();
        const namedDraft = draftId;
        await writeFetchRow({
          id: rowId,
          scanId: ctx.scanId,
          source: call.source,
          cacheKey: call.cacheKey,
          policyVersion: ctx.policyVersion,
          reservedCents: call.costCents,
          costCents: settledCents,
          payload,
          durationMs: Date.now() - startedMs,
          ...(billedCents === undefined ? {} : { billedCents }),
          ...(isDraft ? { activity: "draft" as const } : {}),
          ...(isDraft && namedDraft !== undefined ? { draftId: namedDraft } : {}),
        });
        if (isDraft && namedDraft === undefined) {
          // The draft may have been named while this row was being written.
          if (draftId === undefined) unnamed.push(rowId);
          else await nameDraftOnRows([rowId], draftId);
        }
        ledgeredCents += settledCents;
        // The day's total moves by what was actually ledgered, and `add`
        // publishes the crossing if this is the call that made one. The
        // site's total moves with it, by its own cap and its own crossing.
        day.add(settledCents);
        site?.add(settledCents);

        return { payload, fresh: true, costCents: settledCents, storedAt: null };
      } finally {
        inFlightReserved -= call.costCents;
      }
    },

    capHit(): boolean {
      // A step stops on the first refusal, and the pass ends `spend_ceiling` (`src/lib/scan/ceilings.ts`).
      return spentCents() >= capValue || day.ceilingReached() || (site?.capReached() ?? false);
    },

    spentCents,

    degraded(): boolean {
      return isDegraded;
    },

    fundsRefused(): boolean {
      return refusedForFunds;
    },

    ...(isDraft
      ? {
          async forDraft(id: string | null): Promise<void> {
            draftId = id ?? undefined;
            if (id === null) return;
            const rows = unnamed;
            unnamed = [];
            await nameDraftOnRows(rows, id);
          },
        }
      : {}),
  };

  // The roll-up is written on a clean close only: an exception from `body` propagates untouched for the scan's own
  // error path, and every ledgered row stands, since `fetches` is the source of truth. The robots memo closes with it.
  const result = await withRobotsMemo(() => body(cost));

  if (ctx.rollUp === "none") return result;

  // The database replaces this with the ledger's sum (`scans_cost_from_ledger`); it stands where that migration is absent.
  const { error } = await dbAdmin()
    .from("scans")
    .update(
      ctx.rollUp === "add"
        ? { cost_cents: cost.spentCents() }
        : {
            cost_cents: cost.spentCents(),
            status:
              ctx.failsWhenFundsRefused === true && refusedForFunds ? "failed" : cost.degraded() ? "degraded" : "done",
          }
    )
    .eq("id", ctx.scanId);
  if (error) {
    throw new Error(`withCostContext: roll-up write to scans failed: ${error.message}`);
  }

  return result;
}

/** The two facts the row this context spends against holds: what it has
 *  already been charged, and whose site it belongs to.
 *
 *  `costCents` is `null` where the row could not be read — the `"add"`
 *  roll-up raises on that, for the reason its own caller states. `siteId`
 *  is `null` both for a row that carries no site (every free scan) and for
 *  a row that could not be read: an unreadable row is not evidence of a
 *  site whose cap could be reached, and the product's own ceiling still
 *  stands over the call either way. An unreadable site *total* does hold the
 *  call (`SiteDayLedger`); failing closed on whether there is a site at all
 *  would stop the free path too. The log line makes it visible. */
async function readScanRow(
  scanId: string
): Promise<{ costCents: number | null; siteId: string | null; unreadable: string | null }> {
  const { data, error } = await dbAdmin()
    .from("scans")
    .select("cost_cents, site_id")
    .eq("id", scanId)
    .limit(1);
  if (error) {
    console.warn(JSON.stringify({ event: "scan_row_unreadable", scanId, reason: error.message }));
    return { costCents: null, siteId: null, unreadable: error.message };
  }
  const row = data?.[0] as { cost_cents?: unknown; site_id?: unknown } | undefined;
  const cents = Number(row?.cost_cents ?? 0);
  const siteId = typeof row?.site_id === "string" && row.site_id.length > 0 ? row.site_id : null;
  return { costCents: Number.isFinite(cents) ? cents : 0, siteId, unreadable: null };
}
