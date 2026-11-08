// The cost seam's two alert ports. It imports nothing, so a boot registers them without loading the ledgers' database client.

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

/** A ledger that could not be read, in closed words: the owner's mail is keyed by them, never by a site or a message. */
export interface LedgerUnreadable {
  readonly ledger: "product" | "site";
  readonly cause: "read-failed" | "not-a-number" | "threw";
  readonly at: Date;
}

export type LedgerUnreadableSink = (unreadable: LedgerUnreadable) => void;

/** On `globalThis`, not a module variable: Next bundles `src/instrumentation.ts`
 *  apart from the routes, and each bundle has its own copy of this module. */
const SINK = Symbol.for("reachkit.costs.spendAlertSink");
const UNREADABLE_SINK = Symbol.for("reachkit.costs.ledgerUnreadableSink");
const slot = globalThis as { [SINK]?: SpendAlertSink | null; [UNREADABLE_SINK]?: LedgerUnreadableSink | null };

/** Registered once, at boot, by the side that can send mail. `null`
 *  unregisters — the shape every other port in this codebase uses, and
 *  what lets a test put its own sink in and take it out again. */
export function registerSpendAlertSink(next: SpendAlertSink | null): void {
  slot[SINK] = next;
}

/** Registered at boot beside the crossing sink; `null` unregisters. */
export function registerLedgerUnreadableSink(next: LedgerUnreadableSink | null): void {
  slot[UNREADABLE_SINK] = next;
}

/** Told on every unreadable read; the sink decides once a day. Never throws into the read. */
export function publishLedgerUnreadable(unreadable: LedgerUnreadable): void {
  try {
    slot[UNREADABLE_SINK]?.(unreadable);
  } catch (error) {
    console.warn(JSON.stringify({ event: "spend_alert_failed", crossed: "unreadable", detail: String(error) }));
  }
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
