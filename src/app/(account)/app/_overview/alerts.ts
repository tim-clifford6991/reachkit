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
//
// **Technical issues rank last** (SPEC §9 on the dashboard, #572). Only the
// ones the customer fixes ("Free fix · 10 min") are waiting on them —
// ReachKit's own rewrites are its Fix work — and only where the stored
// Monday reading counts one. Critical before Worth fixing, then §9's order.
// A fault fixed before Monday is a zero on the next stored reading, so it
// leaves this list with nothing deleted here. Their remainder is counted on
// its own line: "more in the calendar" is not where an issue is.
// A caller's array order is never trusted: two customers with the same
// waiting items must see the same two alerts.
import type { CopyKey } from "@/lib/presentation/copy";
import { SITE_CHECK_TITLE, SITE_SEVERITY_WORD } from "@/lib/presentation/site-issues";
import { OVERVIEW_ALERT_CAP } from "@/lib/config/constants";
import { SITE_CHECKS, type SiteCheck, type SiteIssuesSection } from "@/lib/site-issues/types";

/** The kinds, in the order they outrank each other. */
export const ALERT_KINDS = ["needs_you", "pending_veto", "site_issue"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export type WaitingItem = WaitingDraft | WaitingIssue;

/** A technical issue the customer fixes, as the stored reading counted it. */
export interface WaitingIssue {
  kind: "site_issue";
  check: SiteCheck;
  count: number;
  /** The set the count was taken over — the report's own denominator. */
  over: number;
  severity: "worth_fixing" | "critical";
  /** When it was measured. */
  since: Date;
  /** The free report, where the fix lines are. */
  href: string;
}

/** One thing waiting on the customer, as §9's `drafts` rows describe it. */
export interface WaitingDraft {
  kind: "needs_you" | "pending_veto";
  /** The item's own title — the customer's own words for their page, never
   *  a sentence this product composed. */
  title: string;
  /** When it started waiting; the tie-break, oldest first. */
  since: Date;
  /** When its veto window closes — the draft's own stored `veto_deadline`,
   *  stamped from the site's `veto_hours` when it entered review (issue
   *  794). `null` where no window is running: nothing publishes it on a
   *  clock, so there is no countdown to state. */
  vetoDeadline: Date | null;
  /** The one control: where it takes them. */
  href: string;
}

export interface Alert {
  kind: AlertKind;
  key: CopyKey;
  actionKey: CopyKey;
  /** The dim line under the title (UI-SPEC S12's panel). Its own key, and
   *  for the veto arm the window it is about — see `timeLeft` below. */
  lineKey: CopyKey;
  vars: Record<string, string>;
  /** How much of the veto window is left, where the alert is about one.
   *  Numbers, not a written string: the model states the measurement and
   *  the module writes it, so no unit is composed here. Absent on the
   *  `needs_you` arm, which is not on a clock. */
  timeLeft?: { hours: number; minutes: number };
  /** A technical issue's count over its set, exactly as stored. */
  figure?: { count: number; over: number };
  /** A technical issue's severity, which picks the panel's ground. */
  severity?: WaitingIssue["severity"];
  href: string;
}

export interface Overflow {
  remaining: number;
  whereKey: CopyKey;
}

const ALERT_COPY: Readonly<
  Record<WaitingDraft["kind"], { key: CopyKey; actionKey: CopyKey; lineKey: CopyKey }>
> = Object.freeze({
  needs_you: {
    key: "overview.alert.needs-you",
    actionKey: "overview.alert.needs-you.action",
    lineKey: "overview.alert.needs-you.cause",
  },
  pending_veto: {
    key: "overview.alert.pending-veto",
    actionKey: "overview.alert.pending-veto.action",
    lineKey: "overview.alert.pending-veto.due",
  },
});

/** The line a screen with nothing waiting carries in the alerts' place. */
export const ALERTS_EMPTY_KEY = "overview.alerts.empty" satisfies CopyKey;
export const OVERFLOW_WHERE_KEY = "overview.alert.overflow" satisfies CopyKey;
export const ISSUE_OVERFLOW_WHERE_KEY = "overview.alert.site-issue.overflow" satisfies CopyKey;
const ISSUE_ACTION_KEY = "overview.alert.site-issue.action" satisfies CopyKey;
const PENDING_NO_WINDOW_KEY = "overview.alert.pending-veto.no-window" satisfies CopyKey;

/** The stored section's issues that wait on the customer: ran, counted at
 *  least one, and theirs to fix. A projection — nothing is re-checked. */
export function waitingIssues(
  section: SiteIssuesSection | null,
  at: { measuredAt: Date; reportHref: string }
): readonly WaitingIssue[] {
  const out: WaitingIssue[] = [];
  for (const issue of section?.issues ?? []) {
    if (!issue.ran || issue.count === 0 || issue.doer !== "free_fix") continue;
    if (issue.severity === "nothing_to_fix") continue;
    out.push({
      kind: "site_issue",
      check: issue.check,
      count: issue.count,
      over: issue.over,
      severity: issue.severity,
      since: at.measuredAt,
      href: at.reportHref,
    });
  }
  return out;
}

export function readAlerts(
  waiting: readonly WaitingItem[],
  /** The instant the window is measured against — the screen's own `today`,
   *  which on the layout sweep is the pinned clock. Passed in rather than
   *  read here, so this stays pure and a test can state the hour. */
  at: Date
): {
  alerts: readonly Alert[];
  overflow?: Overflow;
  issuesOverflow?: Overflow;
} {
  const ranked = [...waiting].sort(byRankThenAge);
  const shown = ranked.slice(0, OVERVIEW_ALERT_CAP);
  const rest = ranked.slice(OVERVIEW_ALERT_CAP);
  const remaining = rest.filter((item) => item.kind !== "site_issue").length;
  const issuesRemaining = rest.length - remaining;

  const alerts = shown.map((item): Alert => {
    if (item.kind === "site_issue") {
      return {
        kind: item.kind,
        key: SITE_CHECK_TITLE[item.check],
        actionKey: ISSUE_ACTION_KEY,
        lineKey: SITE_SEVERITY_WORD[item.severity],
        vars: {},
        figure: { count: item.count, over: item.over },
        severity: item.severity,
        href: item.href,
      };
    }
    const copyKeys = ALERT_COPY[item.kind];
    const left =
      item.kind === "pending_veto" && item.vetoDeadline !== null ? timeLeft(item.vetoDeadline, at) : undefined;
    // A page in review with no window running is not on a clock: its line
    // says it waits for the customer rather than stating a countdown.
    const lineKey =
      item.kind === "pending_veto" && left === undefined ? PENDING_NO_WINDOW_KEY : copyKeys.lineKey;
    return {
      kind: item.kind,
      key: copyKeys.key,
      actionKey: copyKeys.actionKey,
      lineKey,
      vars: { title: item.title },
      ...(left === undefined ? {} : { timeLeft: left }),
      href: item.href,
    };
  });

  return {
    alerts,
    ...(remaining > 0 ? { overflow: { remaining, whereKey: OVERFLOW_WHERE_KEY } } : {}),
    ...(issuesRemaining > 0
      ? { issuesOverflow: { remaining: issuesRemaining, whereKey: ISSUE_OVERFLOW_WHERE_KEY } }
      : {}),
  };
}

function byRankThenAge(a: WaitingItem, b: WaitingItem): number {
  const rank = ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind);
  if (rank !== 0) return rank;
  if (a.kind === "site_issue" && b.kind === "site_issue") {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return SITE_CHECKS.indexOf(a.check) - SITE_CHECKS.indexOf(b.check);
  }
  return a.since.getTime() - b.since.getTime();
}

/**
 * What is left of a veto window, as whole hours and whole minutes.
 *
 * The window closes at the draft's stored `veto_deadline` — the instant the
 * publish sweep itself approves it at — never a default length counted from
 * when the row was written (issue 794). A window that has already run out
 * is `0 h 0 m` rather than a negative duration: the page publishes at the
 * boundary, and a countdown that went below zero would state a time that
 * has not arrived as one that has passed.
 */
function timeLeft(closes: Date, at: Date): { hours: number; minutes: number } {
  const ms = Math.max(0, closes.getTime() - at.getTime());
  const minutes = Math.floor(ms / 60_000);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
