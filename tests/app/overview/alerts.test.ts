// tests/app/overview/alerts.test.ts — BUILD §4.5 item 5.
//
// "up to two alerts" and, where more exist, "how many remain and where to
// see them". The cap, the ordering that makes it deterministic, the one
// control per alert, and the empty list that is a success state.
import { describe, expect, it } from "vitest";
import { OVERVIEW_ALERT_CAP } from "@/lib/config/constants";
import {
  ALERTS_EMPTY_KEY,
  OVERFLOW_WHERE_KEY,
  readAlerts,
  type WaitingItem,
} from "@/app/(account)/app/_overview/alerts";

const item = (over: Partial<WaitingItem> = {}): WaitingItem => ({
  kind: "pending_veto",
  title: "a draft",
  since: new Date(Date.UTC(2026, 8, 3)),
  href: "/app/draft/1",
  ...over,
});

describe("the cap and the remainder", () => {
  it("with five waiting items exactly two alerts come back and overflow carries three", () => {
    const five = Array.from({ length: 5 }, (_, i) => item({ href: `/app/draft/${i}` }));
    const { alerts, overflow } = readAlerts(five);
    expect(alerts).toHaveLength(OVERVIEW_ALERT_CAP);
    expect(overflow).toEqual({ remaining: 3, whereKey: OVERFLOW_WHERE_KEY });
  });

  it("with exactly two waiting there is no overflow at all", () => {
    const { alerts, overflow } = readAlerts([item(), item({ href: "/app/draft/2" })]);
    expect(alerts).toHaveLength(2);
    expect(overflow).toBeUndefined();
  });

  it("the remainder is never a third alert", () => {
    const { alerts } = readAlerts(Array.from({ length: 9 }, (_, i) => item({ href: `/${i}` })));
    expect(alerts.length).toBeLessThanOrEqual(OVERVIEW_ALERT_CAP);
  });
});

describe("each alert has exactly one control", () => {
  it("every alert carries one href and no second action field", () => {
    const { alerts } = readAlerts([item({ href: "/app/draft/veto" })]);
    expect(alerts[0]?.href).toBe("/app/draft/veto");
    expect(Object.keys(alerts[0] ?? {}).filter((k) => k.toLowerCase().includes("href"))).toEqual([
      "href",
    ]);
  });

  it("its line and its control's label are two keys, both from the registry", () => {
    const { alerts } = readAlerts([item()]);
    expect(alerts[0]?.key).not.toBe(alerts[0]?.actionKey);
  });
});

describe("ordering is the resolver's, never the caller's array order", () => {
  it("an item that cannot proceed without the customer outranks a page awaiting review", () => {
    const { alerts } = readAlerts([
      item({ kind: "pending_veto", href: "/veto" }),
      item({ kind: "needs_you", href: "/needs" }),
    ]);
    expect(alerts[0]?.kind).toBe("needs_you");
  });

  it("within a kind the oldest waits first", () => {
    const { alerts } = readAlerts([
      item({ href: "/new", since: new Date(Date.UTC(2026, 8, 4)) }),
      item({ href: "/old", since: new Date(Date.UTC(2026, 8, 1)) }),
    ]);
    expect(alerts[0]?.href).toBe("/old");
  });

  it("the same items in a different order produce the same two alerts", () => {
    const items = [
      item({ kind: "needs_you", href: "/a", since: new Date(Date.UTC(2026, 8, 1)) }),
      item({ kind: "pending_veto", href: "/b", since: new Date(Date.UTC(2026, 8, 2)) }),
      item({ kind: "pending_veto", href: "/c", since: new Date(Date.UTC(2026, 8, 3)) }),
    ];
    const forwards = readAlerts(items).alerts.map((a) => a.href);
    const backwards = readAlerts([...items].reverse()).alerts.map((a) => a.href);
    expect(backwards).toEqual(forwards);
  });

  it("the caller's own array is not mutated", () => {
    const items = [item({ kind: "pending_veto", href: "/b" }), item({ kind: "needs_you", href: "/a" })];
    readAlerts(items);
    expect(items.map((i) => i.href)).toEqual(["/b", "/a"]);
  });
});

describe("nothing waiting", () => {
  it("returns an empty list and no overflow — and the screen has a line for it", () => {
    expect(readAlerts([])).toEqual({ alerts: [] });
    expect(ALERTS_EMPTY_KEY).toBe("overview.alerts.empty");
  });
});
