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

/** The instant every window below is measured against. Fixed, because a
 *  duration read from the wall clock is a different assertion every run. */
const AT = new Date(Date.UTC(2026, 8, 3, 12, 0));

const item = (over: Partial<WaitingDraft> = {}): WaitingDraft => ({
  kind: "pending_veto",
  title: "a draft",
  since: new Date(Date.UTC(2026, 8, 3)),
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

describe("nothing waiting", () => {
  it("returns an empty list and no overflow — and the screen has a line for it", () => {
    expect(readAlerts([], AT)).toEqual({ alerts: [] });
    expect(ALERTS_EMPTY_KEY).toBe("overview.alerts.empty");
  });
});

describe("the veto window the panel's line states (S12)", () => {
  it("a page that started waiting 17 h 48 m ago has 6 h 12 m of window left", () => {
    // `VETO.defaultHours` is 24, so a window opened at 18:12 the day before
    // closes at 18:12 today, and at noon 6 h 12 m of it are left — the very
    // duration the approved set prints.
    const since = new Date(Date.UTC(2026, 8, 2, 18, 12));
    const { alerts } = readAlerts([item({ since })], AT);
    expect(alerts[0]?.timeLeft).toEqual({ hours: 6, minutes: 12 });
  });

  it("a window that has already closed states no time rather than a negative one", () => {
    const since = new Date(Date.UTC(2026, 8, 1));
    const { alerts } = readAlerts([item({ since })], AT);
    expect(alerts[0]?.timeLeft).toEqual({ hours: 0, minutes: 0 });
  });

  it("a needs-you item is not on a clock and carries no window at all", () => {
    const { alerts } = readAlerts([item({ kind: "needs_you" })], AT);
    expect(alerts[0]?.timeLeft).toBeUndefined();
  });
});

// ── SPEC §9 on the dashboard (#572) ───────────────────────────────────
const ran = (check: SiteIssue["check"], count: number, over: Partial<SiteIssue> = {}): SiteIssue =>
  ({
    check,
    ran: true,
    count,
    over: 40,
    unit: "pages",
    severity: count === 0 ? "nothing_to_fix" : "worth_fixing",
    doer: "free_fix",
    pages: null,
    ...over,
  }) as SiteIssue;
const section = (issues: SiteIssue[]): SiteIssuesSection => ({
  pagesChecked: 40,
  checkedPages: null,
  stoppedBy: "complete",
  issues,
});
const MONDAY = { measuredAt: AT, reportHref: "/scan/example.com" };

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
    expect(waiting[0]).toMatchObject({ count: 3, over: 40, href: "/scan/example.com" });
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
      section([ran("slow_pages", 3), ran("sitemap", 1, { severity: "critical", unit: "site", over: 1 }), ran("broken_links", 7)]),
      MONDAY
    );
    const { alerts, overflow, issuesOverflow } = readAlerts([...issues, item()], AT);
    expect(alerts.map((a) => a.kind)).toEqual(["pending_veto", "site_issue"]);
    expect(alerts[1]).toMatchObject({ severity: "critical", figure: { count: 1, over: 1 }, href: "/scan/example.com" });
    expect(overflow).toBeUndefined();
    expect(issuesOverflow).toEqual({ remaining: 2, whereKey: ISSUE_OVERFLOW_WHERE_KEY });
  });
});
