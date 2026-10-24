// BUILD §6.5 — the daily ceilings: what the whole product, and what one
// site, may spend in one UTC day, over and above what any one pass may
// spend.
//
// The day is UTC: one figure for the whole product has no customer to be local to. Each ledger is `fetches`,
// summed exactly in `numeric` cents by the database. A ledger that cannot be read is not room to spend: the call
// degrades and `*_spend_unreadable` says why. The alert leaves through a port the mail side registers at boot,
// since `src/lib/costs` sits below `src/lib/mail`; nothing registered means nothing is told, never a throw.
import { CAPS, DAILY_PRODUCT_CEILING, SPEND_ALERT_AT } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";

/** Which of the two crossings happened. `warn` is `SPEND_ALERT_AT.warn` of
 *  the day's ceiling; `ceiling` is the ceiling itself — the point at which
 *  the seam stops authorising calls. */
export type SpendCrossing = "warn" | "ceiling";

/** Whose ceiling an alert is about; absent is the product's. `site` carries
 *  the id so the owner can act; `free-scan` names the bound, never the
 *  network key or the domain (`src/lib/mail/templates/ops/`). */
export type SpendSubject =
  | { readonly kind: "product" }
  | { readonly kind: "site"; readonly siteId: string }
  | { readonly kind: "free-scan"; readonly bound: FreeScanBound };

/** Which free-path bound reached its figure: one network's day, or one domain's. */
export type FreeScanBound = "network-day" | "domain-day";

export interface SpendAlert {
  readonly crossed: SpendCrossing;
  /** What the day's ledger stood at when the crossing was noticed. */
  readonly spentCents: number;
  readonly ceilingCents: number;
  /** Whose ceiling. Absent is the product's. */
  readonly subject?: SpendSubject;
}

export type SpendAlertSink = (alert: SpendAlert) => void;

/** On `globalThis`, not a module variable: Next bundles `src/instrumentation.ts`
 *  apart from the routes, and each bundle has its own copy of this module. */
const SINK = Symbol.for("reachkit.costs.spendAlertSink");
const slot = globalThis as { [SINK]?: SpendAlertSink | null };

/** Registered once, at boot, by the side that can send mail. `null`
 *  unregisters — the shape every other port in this codebase uses, and
 *  what lets a test put its own sink in and take it out again. */
export function registerSpendAlertSink(next: SpendAlertSink | null): void {
  slot[SINK] = next;
}

/** The two figures in cents, derived from the day's ceiling so the
 *  warning can never drift away from what it warns about. */
export function alertThresholdsCents(
  ceilingCents: number
): { readonly warn: number; readonly ceiling: number } {
  return {
    warn: ceilingCents * SPEND_ALERT_AT.warn,
    ceiling: ceilingCents * SPEND_ALERT_AT.ceiling,
  };
}

/** The day's ceiling for this many paying sites. */
export function dayCeilingCents(payingSites: number): number {
  return DAILY_PRODUCT_CEILING.baseC + DAILY_PRODUCT_CEILING.perPayingSiteC * payingSites;
}

/** How many sites had active access at `at`. Billing registers it at boot:
 *  this module sits below billing and cannot ask it directly. */
export type PayingSiteCounter = (at: Date) => Promise<number>;

/** On `globalThis` for the reason the alert sink is: one process, one slot,
 *  whichever bundle registered it. The day's count is cached beside it. */
const CEILING = Symbol.for("reachkit.costs.dayCeiling");
const ceilingSlot = globalThis as {
  [CEILING]?: {
    counter: PayingSiteCounter | null;
    cached: { day: number; cents: Promise<number | null> } | null;
  };
};

function ceilingState() {
  return (ceilingSlot[CEILING] ??= { counter: null, cached: null });
}

export function registerPayingSiteCounter(next: PayingSiteCounter | null): void {
  ceilingSlot[CEILING] = { counter: next, cached: null };
}

async function countDayCeiling(dayStart: Date): Promise<number | null> {
  const counter = ceilingState().counter;
  // A process without billing has no paying sites to count: the base day, decided rather than failed.
  if (counter === null) {
    const ceilingCents: number = DAILY_PRODUCT_CEILING.baseC;
    console.info(
      JSON.stringify({ event: "daily_ceiling", day: dayStart.toISOString(), payingSites: null, ceilingCents })
    );
    return ceilingCents;
  }
  try {
    const payingSites = await counter(dayStart);
    if (!Number.isInteger(payingSites) || payingSites < 0) {
      throw new Error(`paying-site count was ${String(payingSites)}`);
    }
    const ceilingCents = dayCeilingCents(payingSites);
    console.info(
      JSON.stringify({ event: "daily_ceiling", day: dayStart.toISOString(), payingSites, ceilingCents })
    );
    return ceilingCents;
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "daily_ceiling_unreadable",
        reason: String(error),
        ceilingCents: DAILY_PRODUCT_CEILING.baseC,
      })
    );
    return null;
  }
}

/**
 * The product's ceiling for the UTC day `now` falls in, in cents: read once
 * a day and cached. A count that cannot be read is the base figure — a
 * smaller day, never an unlimited one — and is asked again on the next call.
 */
export async function readDayCeilingCents(now: Date): Promise<number> {
  const state = ceilingState();
  const dayStart = dayStartedAt(now);
  if (state.cached?.day !== dayStart.getTime()) {
    state.cached = { day: dayStart.getTime(), cents: countDayCeiling(dayStart) };
  }
  const entry = state.cached;
  const cents = await entry.cents;
  if (cents !== null) return cents;
  if (state.cached === entry) state.cached = null;
  return DAILY_PRODUCT_CEILING.baseC;
}

/** Midnight UTC of the day `now` falls in — the instant the day's ledger
 *  is summed from. */
export function dayStartedAt(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** How long until the ceiling lifts, in elapsed seconds, never a clock time:
 *  the shape every refusal in `admission.ts` promises. */
export function secondsUntilDayRollsOver(now: Date): number {
  const next = dayStartedAt(now).getTime() + 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((next - now.getTime()) / 1000));
}

/** Whether a day's ledger standing at `spentCents` has reached the
 *  ceiling. `>=`, so the ceiling is a figure the product spends *up to*,
 *  never through. */
export function ceilingReached(spentCents: number, ceilingCents: number): boolean {
  return spentCents >= alertThresholdsCents(ceilingCents).ceiling;
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
export function crossingOf(
  beforeCents: number,
  afterCents: number,
  ceilingCents: number
): SpendCrossing | null {
  const { warn, ceiling } = alertThresholdsCents(ceilingCents);
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

/** The one cast this module needs, for spend functions the generated types do not hold. */
function untypedRpc(client: ReturnType<typeof dbAdmin>): MinimalRpcClient {
  return client as unknown as MinimalRpcClient;
}

/**
 * What the whole product has spent since midnight UTC, in cents.
 *
 * `null` means the ledger could not be read — not zero. The caller decides
 * what an unreadable ledger means, and every caller here decides the same
 * thing: nothing is spent on a number nobody has.
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
 * again before every paid call, so what every other pass has ledgered since
 * is counted. What this pass has in flight the caller hands in.
 */
export interface DayLedger {
  /** The day's total as this pass last read it, plus what it has ledgered
   *  since. */
  spentCents(): number;
  /** Reads the day's total again, for the day `at` falls in. */
  refresh(at: Date): Promise<void>;
  /** The day's ceiling, in cents, as this pass last read it. */
  ceilingCents(): number;
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
  let ceiling: number = DAILY_PRODUCT_CEILING.baseC;
  let day = dayStartedAt(now).getTime();

  async function refresh(at: Date): Promise<void> {
    const [read, ceilingCents] = await Promise.all([readDaySpendCents(at), readDayCeilingCents(at)]);
    ceiling = ceilingCents;
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
    ceilingCents: () => ceiling,
    refresh,
    ceilingReached: (pendingCents = 0) => !readable || ceilingReached(spent + pendingCents, ceiling),
    add(cents: number): void {
      // No alert off a figure nobody has.
      if (!readable) return;
      const before = spent;
      spent += cents;
      const crossed = crossingOf(before, spent, ceiling);
      if (crossed === null) return;
      publishSpendAlert({
        crossed,
        spentCents: spent,
        ceilingCents: alertThresholdsCents(ceiling).ceiling,
      });
    },
  };
}

// ── The per-site ceiling ───────────────────────────────────────────────

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
 * decides the same thing every caller of `readDaySpendCents` decides:
 * nothing is spent on a number nobody has.
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
 * The owner's telling that a free-path bound has been reached.
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
