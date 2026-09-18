// BUILD §6.5 — the daily ceilings: what the whole product, and what one
// site, may spend in one UTC day, over and above what any one pass may
// spend.
//
// The four caps in `CAPS` each bound *one* pass. Nothing bounded their
// sum, so the product's exposure for a day was whatever the day's traffic
// multiplied them by — the free path alone can bring 200 scans (BUILD §11)
// and a runaway anywhere else adds to that unopposed. `CAPS.DAILY_PRODUCT_C`
// is the missing figure and this module is the whole of its machinery
// (issue #329):
//
//  - **the day** is UTC. There is no site whose clock this could keep: one
//    figure for the whole product has no customer to be local to.
//  - **the ledger is `fetches`**, the same rows the per-scan caps are
//    settled from — "money already spent is always ledgered" — summed in
//    the database by `fetches_spend_since()`, never row by row in this
//    process (a busy day is thousands of rows and this is asked once a
//    pass).
//  - **what it reads is exact, in cents.** `fetches.cost_cents` is
//    `numeric(12,4)` and `fetches_spend_since()` sums into `numeric`
//    (issue #449), so a day of 0.06¢ SERPs totals 0.06¢ × n rather than
//    the 0¢ an `integer` column recorded for every one of them. The unit
//    is the one `CAPS.DAILY_PRODUCT_C` is written in, so the comparison
//    below needs no conversion. Until #449 this paragraph said the
//    opposite — the stored total was a floor, and the guard erred toward
//    spending slightly over the ceiling; that was the ledger's own defect,
//    named under *Adjacent* on issue #329's PR, and it is gone.
//  - **it degrades, it never throws.** §6.5's own rule. A ceiling that is
//    reached skips remaining work, and so does a ledger that cannot be
//    *read* (issue 792): a figure nobody has is not room to spend. The
//    call is skipped, `daily_spend_unreadable` says why, and the next call
//    or tick asks the ledger again.
//
// **Why the alert leaves through a port rather than a call.**
// ARCHITECTURE rule 2 puts `src/lib/costs` at the bottom of the dependency
// order (`src/lib/` → `src/lib/{config,egress,costs,db}`), so this module
// cannot reach `src/lib/mail` and must not learn how to. It publishes the
// crossing and knows nothing about what is done with it; the mail side
// registers itself at boot (`src/instrumentation.ts`), the shape
// `registerActiveAccessGate` and `registerSuppressionReader` already use.
// Nothing registered means nothing is told — never a throw, and never a
// scan that fails because an alert could not go out.
//
// **The per-site ceiling (issue 885) is the same machinery, one predicate
// narrower.** `CAPS.DAILY_PRODUCT_C` is one figure for everyone and so
// does not care whose spend reached it: one site in a retry loop could
// consume the day and every other customer was refused until midnight
// UTC, silently. `CAPS.DAILY_SITE_C` is read off the same `fetches` rows
// through `fetches_site_spend_since(site_id, since)` — the same shape as
// the product's read, the same UTC day, the same exact `numeric` unit, the
// same "unreadable is not room to spend" rule — and it is checked in the
// same seam (`src/lib/costs/index.ts`), so no caller can spend around it.
// What the two protect is not the same thing and they are not
// interchangeable: the product's ceiling is the company's exposure for a
// day, and the site's is one customer's share of it.
import { CAPS, SPEND_ALERT_AT } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";

/** Which of the two crossings happened. `warn` is `SPEND_ALERT_AT.warn` of
 *  the day's ceiling; `ceiling` is the ceiling itself — the point at which
 *  the seam stops authorising calls. */
export type SpendCrossing = "warn" | "ceiling";

/** Whose ceiling an alert is about (issue 885). Absent on an alert is the
 *  product's — what every alert was before this field existed, and what a
 *  caller that names no subject still means.
 *
 *  `site` carries the site's own id, which is the whole point of the
 *  per-site cap: an owner told that *a* ceiling was reached cannot act,
 *  and an owner told which site can. `free-scan` names the bound, never
 *  the network key and never the domain — the ops mails' own closed-name
 *  rule (`src/lib/mail/templates/ops/`), and a bound name is what the
 *  owner acts on. */
export type SpendSubject =
  | { readonly kind: "product" }
  | { readonly kind: "site"; readonly siteId: string }
  | { readonly kind: "free-scan"; readonly bound: FreeScanBound };

/** Which free-path bound reached its figure (issue 885). One network's
 *  day, or one domain's. */
export type FreeScanBound = "network-day" | "domain-day";

export interface SpendAlert {
  readonly crossed: SpendCrossing;
  /** What the day's ledger stood at when the crossing was noticed. */
  readonly spentCents: number;
  readonly ceilingCents: number;
  /** Whose ceiling (issue 885). Absent is the product's. */
  readonly subject?: SpendSubject;
}

export type SpendAlertSink = (alert: SpendAlert) => void;

/** Kept on `globalThis`, not in a module variable (issue 863): Next
 *  bundles `src/instrumentation.ts` apart from every route, so a sink it
 *  registered into its own copy of this module was never seen by the
 *  routes that spend. One process, one slot. */
const SINK = Symbol.for("reachkit.costs.spendAlertSink");
const slot = globalThis as { [SINK]?: SpendAlertSink | null };

/** Registered once, at boot, by the side that can send mail. `null`
 *  unregisters — the shape every other port in this codebase uses, and
 *  what lets a test put its own sink in and take it out again. */
export function registerSpendAlertSink(next: SpendAlertSink | null): void {
  slot[SINK] = next;
}

/** The two figures in cents, derived from the one pinned ceiling so the
 *  warning can never drift away from what it warns about. */
export function alertThresholdsCents(): { readonly warn: number; readonly ceiling: number } {
  return {
    warn: CAPS.DAILY_PRODUCT_C * SPEND_ALERT_AT.warn,
    ceiling: CAPS.DAILY_PRODUCT_C * SPEND_ALERT_AT.ceiling,
  };
}

/** Midnight UTC of the day `now` falls in — the instant the day's ledger
 *  is summed from. */
export function dayStartedAt(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** How long until the ceiling lifts, as an **elapsed duration in seconds**
 *  and never a clock time — the shape every refusal in `admission.ts`
 *  promises (REQ-003's third assumption). The day's spend is the only
 *  bound in this product that can promise a time honestly: it goes to zero
 *  at the next UTC midnight whatever anyone does. */
export function secondsUntilDayRollsOver(now: Date): number {
  const next = dayStartedAt(now).getTime() + 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((next - now.getTime()) / 1000));
}

/** Whether a day's ledger standing at `spentCents` has reached the
 *  ceiling. `>=`, so the ceiling is a figure the product spends *up to*,
 *  never through. */
export function ceilingReached(spentCents: number): boolean {
  return spentCents >= alertThresholdsCents().ceiling;
}

/**
 * Which crossing, if any, moving from `beforeCents` to `afterCents` made.
 *
 * Pure, and the whole of the at-most-once rule: a crossing belongs to the
 * one call whose own spend carried the day's total over the line, so
 * nothing has to remember that an alert was sent. A call large enough to
 * pass both lines at once reports the ceiling — the more serious of the
 * two, and the one that changes what the product does.
 */
export function crossingOf(beforeCents: number, afterCents: number): SpendCrossing | null {
  const { warn, ceiling } = alertThresholdsCents();
  if (beforeCents < ceiling && afterCents >= ceiling) return "ceiling";
  if (beforeCents < warn && afterCents >= warn) return "warn";
  return null;
}

/** Tells whoever registered, and survives them failing. An alert that
 *  throws is the alerting path's problem, never the spending path's: the
 *  scan that noticed the crossing carries on and the failure is logged. */
export function publishSpendAlert(alert: SpendAlert): void {
  const sink = slot[SINK] ?? null;
  if (sink === null) return;
  try {
    sink(alert);
  } catch (error) {
    console.warn(
      JSON.stringify({ event: "spend_alert_failed", crossed: alert.crossed, detail: String(error) })
    );
  }
}

interface MinimalRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** The one cast boundary this module needs: `fetches_spend_since` is this
 *  migration's own function and `src/lib/db/types.generated.ts` is BP-002's
 *  generated artifact, the same gap `ledger.ts` and `scan/store.ts` already
 *  name and work around the same way. */
function untypedRpc(client: ReturnType<typeof dbAdmin>): MinimalRpcClient {
  return client as unknown as MinimalRpcClient;
}

/**
 * What the whole product has spent since midnight UTC, in cents.
 *
 * `null` means the ledger could not be read — not zero. The caller decides
 * what an unreadable ledger means, and every caller here decides the same
 * thing: nothing is spent on a number nobody has (issue 792).
 */
export async function readDaySpendCents(now: Date): Promise<number | null> {
  try {
    const { data, error } = await untypedRpc(dbAdmin()).rpc("fetches_spend_since", {
      p_since: dayStartedAt(now).toISOString(),
    });
    if (error) {
      logUnreadable(error.message);
      return null;
    }
    const spent = Number(data);
    if (!Number.isFinite(spent)) {
      logUnreadable(`fetches_spend_since returned ${String(data)}`);
      return null;
    }
    return spent;
  } catch (error) {
    logUnreadable(String(error));
    return null;
  }
}

function logUnreadable(reason: string): void {
  console.warn(JSON.stringify({ event: "daily_spend_unreadable", reason }));
}

/**
 * The day's ledger as one pass sees it: read when a cost context opens, and
 * read again before every paid call (issue 792).
 *
 * Once a pass was not enough: two passes running together each read the
 * day once at their start and each spent up to the ceiling on its own. The
 * re-read sees what every other pass has ledgered since. What this pass
 * has in flight is not in the ledger yet, so the caller hands it in.
 */
export interface DayLedger {
  /** The day's total as this pass last read it, plus what it has ledgered
   *  since. */
  spentCents(): number;
  /** Reads the day's total again, for the day `at` falls in. */
  refresh(at: Date): Promise<void>;
  /** Whether the day's ceiling is reached, counting `pendingCents` this
   *  pass has reserved and not yet ledgered — the seam's refusal. Always
   *  true where the ledger could not be read on its last read. */
  ceilingReached(pendingCents?: number): boolean;
  /** Records `cents` against the day and publishes a crossing if this is
   *  the spend that made one. */
  add(cents: number): void;
}

export async function openDayLedger(now: Date): Promise<DayLedger> {
  let readable = false;
  let spent = 0;
  let day = dayStartedAt(now).getTime();

  async function refresh(at: Date): Promise<void> {
    const read = await readDaySpendCents(at);
    readable = read !== null;
    if (read === null) return;
    // Within one day the total only grows. A read that began before this
    // pass's last ledgered call and answered after it must not take that
    // call back out — the crossing it made would be made, and told, twice.
    const readDay = dayStartedAt(at).getTime();
    spent = readDay === day ? Math.max(spent, read) : read;
    day = readDay;
  }

  await refresh(now);

  return {
    spentCents: () => spent,
    refresh,
    ceilingReached: (pendingCents = 0) => !readable || ceilingReached(spent + pendingCents),
    add(cents: number): void {
      // No alert off a figure nobody has.
      if (!readable) return;
      const before = spent;
      spent += cents;
      const crossed = crossingOf(before, spent);
      if (crossed === null) return;
      publishSpendAlert({
        crossed,
        spentCents: spent,
        ceilingCents: alertThresholdsCents().ceiling,
      });
    },
  };
}

// ── The per-site ceiling (issue 885) ───────────────────────────────────

/** Whether a site's day, standing at `spentCents`, has reached its own
 *  cap. `>=`, like the product's: a figure spent up to, never through. */
export function siteCeilingReached(spentCents: number): boolean {
  return spentCents >= CAPS.DAILY_SITE_C;
}

/** The site crossing, by the same at-most-once rule the product's uses: it
 *  belongs to the one call whose own spend carried this site's total over
 *  its cap, so nothing has to remember that an alert was sent. There is no
 *  warn line for a site — one figure, one crossing. */
export function siteCrossingOf(beforeCents: number, afterCents: number): SpendCrossing | null {
  return beforeCents < CAPS.DAILY_SITE_C && afterCents >= CAPS.DAILY_SITE_C ? "ceiling" : null;
}

/**
 * What one site has spent since midnight UTC, in cents.
 *
 * `null` means the ledger could not be read — not zero, and the caller
 * decides the same thing every caller of `readDaySpendCents` decides
 * (issue 792): nothing is spent on a number nobody has.
 */
export async function readSiteDaySpendCents(siteId: string, now: Date): Promise<number | null> {
  try {
    const { data, error } = await untypedRpc(dbAdmin()).rpc("fetches_site_spend_since", {
      p_site_id: siteId,
      p_since: dayStartedAt(now).toISOString(),
    });
    if (error) {
      logSiteUnreadable(siteId, error.message);
      return null;
    }
    const spent = Number(data);
    if (!Number.isFinite(spent)) {
      logSiteUnreadable(siteId, `fetches_site_spend_since returned ${String(data)}`);
      return null;
    }
    return spent;
  } catch (error) {
    logSiteUnreadable(siteId, String(error));
    return null;
  }
}

function logSiteUnreadable(siteId: string, reason: string): void {
  console.warn(JSON.stringify({ event: "site_spend_unreadable", siteId, reason }));
}

/** One site's day, as one pass sees it. The shape of `DayLedger`, minus
 *  the warn line a site does not have, and plus `siteId` so the refusal
 *  and the alert can both name whose cap was reached. */
export interface SiteDayLedger {
  readonly siteId: string;
  spentCents(): number;
  refresh(at: Date): Promise<void>;
  /** Whether this site's cap is reached, counting `pendingCents` the pass
   *  has reserved and not yet ledgered. Always true where the site's total
   *  could not be read on its last read. */
  capReached(pendingCents?: number): boolean;
  add(cents: number): void;
}

export async function openSiteDayLedger(siteId: string, now: Date): Promise<SiteDayLedger> {
  let readable = false;
  let spent = 0;
  let day = dayStartedAt(now).getTime();

  async function refresh(at: Date): Promise<void> {
    const read = await readSiteDaySpendCents(siteId, at);
    readable = read !== null;
    if (read === null) return;
    // Within one day a site's total only grows — the same reason the
    // product's read takes the larger of the two figures.
    const readDay = dayStartedAt(at).getTime();
    spent = readDay === day ? Math.max(spent, read) : read;
    day = readDay;
  }

  await refresh(now);

  return {
    siteId,
    spentCents: () => spent,
    refresh,
    capReached: (pendingCents = 0) => !readable || siteCeilingReached(spent + pendingCents),
    add(cents: number): void {
      if (!readable) return;
      const before = spent;
      spent += cents;
      if (siteCrossingOf(before, spent) === null) return;
      publishSpendAlert({
        crossed: "ceiling",
        spentCents: spent,
        ceilingCents: CAPS.DAILY_SITE_C,
        subject: { kind: "site", siteId },
      });
    },
  };
}

/**
 * The owner's telling that a free-path bound has been reached (issue 885).
 *
 * The bounds are counts of scans, not sums of money, so what the alert
 * carries is what those counts hold back: `scans x CAPS.FREE_C`, the most
 * the admitted scans could have cost and the most the refused ones would
 * have. It is published by the one claim that filled the bound — the same
 * at-most-once rule the two spend crossings use — so a source that goes on
 * asking is refused in silence rather than mailing the owner per request.
 */
export function publishFreeScanBoundReached(bound: FreeScanBound, scans: number): void {
  const cents = scans * CAPS.FREE_C;
  publishSpendAlert({
    crossed: "ceiling",
    spentCents: cents,
    ceilingCents: cents,
    subject: { kind: "free-scan", bound },
  });
}
