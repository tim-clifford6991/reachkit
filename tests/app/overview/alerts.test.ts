// tests/app/overview/alerts.test.ts — BUILD §4.5 item 5.
//
// "up to two alerts" and, where more exist, "how many remain and where to
// see them". The cap, the ordering that makes it deterministic, the one
// control per alert, and the empty list that is a success state.
import { describe, expect, it } from "vitest";
import { OVERVIEW_ALERT_CAP } from "@/lib/config/constants";
import {
  ALERTS_EMPTY_KEY,
  ISSUE_OVERFLOW_WHERE_KEY,
  OVERFLOW_WHERE_KEY,
  readAlerts,
  waitingIssues,
  type WaitingDraft,
} from "@/app/(account)/app/_overview/alerts";
import type { SiteIssue, SiteIssuesSection } from "@/lib/site-issues/types";
import { NEEDS_YOU_COPY } from "@/lib/publish/record/lines";

/** The instant every window below is measured against. Fixed, because a
 *  duration read from the wall clock is a different assertion every run. */
const AT = new Date(Date.UTC(2026, 8, 3, 12, 0));

const item = (over: Partial<WaitingDraft> = {}): WaitingDraft => ({
  kind: "pending_veto",
  title: "a draft",
  since: new Date(Date.UTC(2026, 8, 3)),
  vetoDeadline: new Date(Date.UTC(2026, 8, 4)),
  href: "/app/draft/1",
  ...over,
});

describe("the cap and the remainder", () => {
  it("with five waiting items exactly two alerts come back and overflow carries three", () => {
    const five = Array.from({ length: 5 }, (_, i) => item({ href: `/app/draft/${i}` }));
    const { alerts, overflow } = readAlerts(five, AT);
    expect(alerts).toHaveLength(OVERVIEW_ALERT_CAP);
    expect(overflow).toEqual({ remaining: 3, whereKey: OVERFLOW_WHERE_KEY });
  });

  it("with exactly two waiting there is no overflow at all", () => {
    const { alerts, overflow } = readAlerts([item(), item({ href: "/app/draft/2" })], AT);
    expect(alerts).toHaveLength(2);
    expect(overflow).toBeUndefined();
  });

  it("the remainder is never a third alert", () => {
    const { alerts } = readAlerts(
      Array.from({ length: 9 }, (_, i) => item({ href: `/${i}` })),
      AT
    );
    expect(alerts.length).toBeLessThanOrEqual(OVERVIEW_ALERT_CAP);
  });
});

describe("each alert has exactly one control", () => {
  it("every alert carries one href and no second action field", () => {
    const { alerts } = readAlerts([item({ href: "/app/draft/veto" })], AT);
    expect(alerts[0]?.href).toBe("/app/draft/veto");
    expect(Object.keys(alerts[0] ?? {}).filter((k) => k.toLowerCase().includes("href"))).toEqual([
      "href",
    ]);
  });

  it("its line and its control's label are two keys, both from the registry", () => {
    const { alerts } = readAlerts([item()], AT);
    expect(alerts[0]?.key).not.toBe(alerts[0]?.actionKey);
  });
});

describe("ordering is the resolver's, never the caller's array order", () => {
  it("an item that cannot proceed without the customer outranks a page awaiting review", () => {
    const { alerts } = readAlerts([
      item({ kind: "pending_veto", href: "/veto" }),
      item({ kind: "needs_you", href: "/needs" }),
    ], AT);
    expect(alerts[0]?.kind).toBe("needs_you");
  });

  it("within a kind the oldest waits first", () => {
    const { alerts } = readAlerts([
      item({ href: "/new", since: new Date(Date.UTC(2026, 8, 4)) }),
      item({ href: "/old", since: new Date(Date.UTC(2026, 8, 1)) }),
    ], AT);
    expect(alerts[0]?.href).toBe("/old");
  });

  it("the same items in a different order produce the same two alerts", () => {
    const items = [
      item({ kind: "needs_you", href: "/a", since: new Date(Date.UTC(2026, 8, 1)) }),
      item({ kind: "pending_veto", href: "/b", since: new Date(Date.UTC(2026, 8, 2)) }),
      item({ kind: "pending_veto", href: "/c", since: new Date(Date.UTC(2026, 8, 3)) }),
    ];
    const forwards = readAlerts(items, AT).alerts.map((a) => a.href);
    const backwards = readAlerts([...items].reverse(), AT).alerts.map((a) => a.href);
    expect(backwards).toEqual(forwards);
  });

  it("the caller's own array is not mutated", () => {
    const items = [item({ kind: "pending_veto", href: "/b" }), item({ kind: "needs_you", href: "/a" })];
    readAlerts(items, AT);
    expect(items.map((i) => i.href)).toEqual(["/b", "/a"]);
  });
});

// ── issue 880: the alert states the page's own cause, and offers the act
// that matches it ─────────────────────────────────────────────────────
describe("issue 880 — a needs-you alert says why, from the page's own record", () => {
  const needsYou = (cause: WaitingDraft["cause"]): ReturnType<typeof readAlerts>["alerts"][number] => {
    const [alert] = readAlerts([item({ kind: "needs_you", cause, href: "/app/draft/1" })], AT).alerts;
    if (alert === undefined) throw new Error("no alert");
    return alert;
  };

  it("a page the system rescues or sets aside is no alert at all (owner O7)", () => {
    const stopped: WaitingDraft["cause"][] = [
      { kind: "rules", rules: ["no_private_figure", "brand_gap"] },
      { kind: "step", step: "claim_check" },
      { kind: "adds" },
      { kind: "elsewhere" },
      { kind: "pack", missing: ["buyer_questions"] },
    ];
    for (const cause of stopped) {
      expect(readAlerts([item({ kind: "needs_you", cause, href: "/app/draft/1" })], AT).alerts, cause?.kind).toEqual([]);
    }
  });

  it("the customer's own edit of a live page stays an alert, read where it is", () => {
    const alert = needsYou({ kind: "live_edit" });
    expect(alert.lineKey).toBe(NEEDS_YOU_COPY.live_edit);
    expect(alert.actionKey).toBe("overview.alert.needs-you.read");
  });

  it("a publish tried to exhaustion is re-attempted for seven days, and only then an alert", () => {
    const day = 86_400_000;
    const since = (days: number) => new Date(AT.getTime() - days * day).toISOString();
    expect(readAlerts([item({ kind: "needs_you", cause: { kind: "delivery", since: since(7) } })], AT).alerts).toEqual([]);
    expect(needsYou({ kind: "delivery", since: since(8) }).lineKey).toBe(NEEDS_YOU_COPY.delivery);
  });

  it("a page waiting on the destination keeps the reconnect and the delivery line", () => {
    for (const cause of [{ kind: "destination" }, { kind: "delivery" }] as const) {
      const alert = needsYou(cause);
      expect(alert.actionKey, cause.kind).toBe("overview.alert.needs-you.action");
      expect(alert.lineKey, cause.kind).toBe(NEEDS_YOU_COPY[cause.kind]);
    }
  });

  it("a page whose record states no cause is read, not reconnected on a guess", () => {
    expect(needsYou({ kind: "unknown" }).actionKey).toBe("overview.alert.needs-you.read");
    expect(needsYou(null).actionKey).toBe("overview.alert.needs-you.read");
  });

  it("the veto arm is untouched — it needs no cause and keeps its own two keys", () => {
    const [alert] = readAlerts([item({ kind: "pending_veto" })], AT).alerts;
    expect(alert?.lineKey).toBe("overview.alert.pending-veto.due");
    expect(alert?.actionKey).toBe("overview.alert.pending-veto.action");
  });
});

describe("nothing waiting", () => {
  it("returns an empty list and no overflow — and the screen has a line for it", () => {
    expect(readAlerts([], AT)).toEqual({ alerts: [] });
    expect(ALERTS_EMPTY_KEY).toBe("overview.alerts.empty");
  });
});

describe("the veto window the panel's line states (S12)", () => {
  it("a window closing at 18:12 has 6 h 12 m left at noon", () => {
    const vetoDeadline = new Date(Date.UTC(2026, 8, 3, 18, 12));
    const { alerts } = readAlerts([item({ vetoDeadline })], AT);
    expect(alerts[0]?.timeLeft).toEqual({ hours: 6, minutes: 12 });
    expect(alerts[0]?.lineKey).toBe("overview.alert.pending-veto.due");
  });

  it("the countdown is the stored deadline, never a default length from when it started waiting (issue 794)", () => {
    // Written 17 h 48 m ago, but the site's window was 20 hours: 2 h 12 m left.
    const since = new Date(Date.UTC(2026, 8, 2, 18, 12));
    const vetoDeadline = new Date(Date.UTC(2026, 8, 3, 14, 12));
    const { alerts } = readAlerts([item({ since, vetoDeadline })], AT);
    expect(alerts[0]?.timeLeft).toEqual({ hours: 2, minutes: 12 });
  });

  it("a window that has already closed states no time rather than a negative one", () => {
    const { alerts } = readAlerts([item({ vetoDeadline: new Date(Date.UTC(2026, 8, 1)) })], AT);
    expect(alerts[0]?.timeLeft).toEqual({ hours: 0, minutes: 0 });
  });

  it("a page in review with no window running carries no countdown and says it waits", () => {
    const { alerts } = readAlerts([item({ vetoDeadline: null })], AT);
    expect(alerts[0]?.timeLeft).toBeUndefined();
    expect(alerts[0]?.lineKey).toBe("overview.alert.pending-veto.no-window");
  });

  it("a needs-you item is not on a clock and carries no window at all", () => {
    const { alerts } = readAlerts([item({ kind: "needs_you" })], AT);
    expect(alerts[0]?.timeLeft).toBeUndefined();
  });
});

// ── SPEC §9 on the dashboard (#572) ───────────────────────────────────
const addresses = (count: number): string[] => Array.from({ length: count }, (_, i) => `https://example.com/${i}`);
const ran = (check: SiteIssue["check"], count: number, over: Partial<SiteIssue> = {}): SiteIssue =>
  ({
    check,
    ran: true,
    count,
    over: 40,
    unit: "pages",
    severity: count === 0 ? "nothing_to_fix" : "worth_fixing",
    doer: "free_fix",
    pages: addresses(count),
    ...(check === "slow_pages" ? { ms: addresses(count).map(() => 3_500) } : {}),
    ...over,
  }) as SiteIssue;
const section = (issues: SiteIssue[]): SiteIssuesSection => ({
  pagesChecked: 40,
  checkedPages: null,
  stoppedBy: "complete",
  issues,
});
const MONDAY = { measuredAt: AT };

describe("technical issues in Needs you", () => {
  it("only the customer's own open issues wait: not a zero, not ReachKit's, not one that could not run", () => {
    const waiting = waitingIssues(
      section([
        ran("slow_pages", 3),
        ran("broken_links", 0),
        ran("page_titles", 5, { doer: "reachkit_rewrites" }),
        { check: "sitemap", ran: false, because: "sitemap_unreadable" },
      ]),
      MONDAY
    );
    expect(waiting.map((w) => w.check)).toEqual(["slow_pages"]);
    expect(waiting[0]).toMatchObject({ count: 3, over: 40, href: "/app/issues#slow_pages" });
  });

  it("a fault fixed by Monday is a zero on Monday's report, so it is gone", () => {
    const before = waitingIssues(section([ran("noindex_pages", 2), ran("phone_usability", 4)]), MONDAY);
    const after = waitingIssues(section([ran("noindex_pages", 0), ran("phone_usability", 4)]), MONDAY);
    expect(before).toHaveLength(2);
    expect(after.map((w) => w.check)).toEqual(["phone_usability"]);
    expect(waitingIssues(null, MONDAY)).toEqual([]);
  });

  it("drafts outrank issues, Critical outranks Worth fixing, and the issue remainder is counted on its own line", () => {
    const issues = waitingIssues(
      section([ran("slow_pages", 3), ran("sitemap", 1, { severity: "critical", unit: "site", over: 1, pages: null }), ran("broken_links", 7)]),
      MONDAY
    );
    const { alerts, overflow, issuesOverflow } = readAlerts([...issues, item()], AT);
    expect(alerts.map((a) => a.kind)).toEqual(["pending_veto", "site_issue"]);
    expect(alerts[1]).toMatchObject({ severity: "critical", figure: { count: 1, over: 1 }, href: "/app/issues#sitemap" });
    expect(overflow).toBeUndefined();
    expect(issuesOverflow).toEqual({ remaining: 2, whereKey: ISSUE_OVERFLOW_WHERE_KEY });
  });
});

// Issue 1550: an item is something the customer can act on, from where it
// lands.
describe("a technical issue in Needs you is one the customer can act on", () => {
  it("opens the account's own view at its check, never the public report", () => {
    const [issue] = waitingIssues(section([ran("noindex_pages", 2)]), MONDAY);
    expect(issue?.href.startsWith("/app/")).toBe(true);
    expect(issue?.href).not.toContain("/scan/");
    expect(issue).toMatchObject({ fix: "check.noindex-pages.fix", pages: addresses(2) });
  });

  it("a check with nothing to name or no fix line is never an item", () => {
    const waiting = waitingIssues(
      section([
        // Counted before addresses were kept: nothing to name.
        ran("noindex_pages", 2, { pages: null }),
        ran("broken_links", 3, { unit: "links", pages: null }),
        ran("phone_usability", 4),
      ]),
      MONDAY
    );
    expect(waiting.map((w) => w.check)).toEqual(["phone_usability"]);
  });

  it("slow pages from one read are not an item; confirmed ones carry their time", () => {
    const once = waitingIssues(section([ran("slow_pages", 1, { ms: undefined })]), MONDAY);
    expect(once).toEqual([]);
    const twice = waitingIssues(section([ran("slow_pages", 1, { ms: [4_200] })]), MONDAY);
    expect(twice[0]).toMatchObject({ pages: addresses(1), ms: [4_200] });
  });
});

