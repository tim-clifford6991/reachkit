// BUILD §4.5 — at most two alerts, each with one control, and a count for
// whatever is left.
//
// §4.5 item 5, verbatim: "up to two alerts (today's page pending veto →
// 'Read it'; a needs-you item → action button)."
//
// Three properties, each made structural rather than reviewed:
//
//   - **At most two.** The cap is `OVERVIEW_ALERT_CAP`, read from the pins,
//     and the remainder never becomes a third alert — it becomes a count
//     with where to see it.
//   - **One control each.** An `Alert` carries exactly one `href`. There is
//     no second action field, so an alert with two buttons has no shape.
//   - **An empty list is a success state, not a blank.** §2.5: "an empty
//     queue is a success state". The empty arm carries its own line, so a
//     screen with nothing waiting still says something.
//
// Ordering is by kind first — an item that cannot proceed without the
// customer outranks a page merely awaiting review, because one is blocked
// and the other is running — then by the item's own `since`, oldest first.
// A caller's array order is never trusted: two customers with the same
// waiting items must see the same two alerts.
import type { CopyKey } from "@/lib/presentation/copy";
import { OVERVIEW_ALERT_CAP } from "@/lib/config/constants";

/** The two kinds §4.5 names, in the order they outrank each other. */
export const ALERT_KINDS = ["needs_you", "pending_veto"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

/** One thing waiting on the customer, as §9's drafts (#45) will supply it. */
export interface WaitingItem {
  kind: AlertKind;
  /** The item's own title — the customer's own words for their page, never
   *  a sentence this product composed. */
  title: string;
  /** When it started waiting; the tie-break, oldest first. */
  since: Date;
  /** The one control: where it takes them. */
  href: string;
}

export interface Alert {
  kind: AlertKind;
  key: CopyKey;
  actionKey: CopyKey;
  vars: Record<string, string>;
  href: string;
}

export interface Overflow {
  remaining: number;
  whereKey: CopyKey;
}

const ALERT_COPY: Readonly<Record<AlertKind, { key: CopyKey; actionKey: CopyKey }>> = Object.freeze({
  needs_you: { key: "overview.alert.needs-you", actionKey: "overview.alert.needs-you.action" },
  pending_veto: {
    key: "overview.alert.pending-veto",
    actionKey: "overview.alert.pending-veto.action",
  },
});

/** The line a screen with nothing waiting carries in the alerts' place. */
export const ALERTS_EMPTY_KEY = "overview.alerts.empty" satisfies CopyKey;
export const OVERFLOW_WHERE_KEY = "overview.alert.overflow" satisfies CopyKey;

export function readAlerts(waiting: readonly WaitingItem[]): {
  alerts: readonly Alert[];
  overflow?: Overflow;
} {
  const ranked = [...waiting].sort(byRankThenAge);
  const shown = ranked.slice(0, OVERVIEW_ALERT_CAP);
  const remaining = ranked.length - shown.length;

  const alerts = shown.map((item): Alert => {
    const copyKeys = ALERT_COPY[item.kind];
    return {
      kind: item.kind,
      key: copyKeys.key,
      actionKey: copyKeys.actionKey,
      vars: { title: item.title },
      href: item.href,
    };
  });

  return remaining > 0
    ? { alerts, overflow: { remaining, whereKey: OVERFLOW_WHERE_KEY } }
    : { alerts };
}

function byRankThenAge(a: WaitingItem, b: WaitingItem): number {
  const rank = ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind);
  return rank !== 0 ? rank : a.since.getTime() - b.since.getTime();
}
