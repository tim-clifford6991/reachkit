/** @vitest-environment jsdom */
// tests/app/shell/frame.test.tsx — BUILD §4.4, REQ-040 criteria 1-7
//
// WO-155 `## Test plan`, all seven rows. The frame is what makes REQ-040's
// promise structural: three destinations from one tuple, the Calendar's
// waiting count, and the publishing state — on every app screen, at every
// breakpoint, because they live in the layout and in no screen.
//
// **Rendering convention.** `tests/app/**` runs under Vitest's "node"
// project, whose environment has no `document`. This file needs one — it
// asserts against a parsed tree, not against markup text — so it declares
// `jsdom` for itself with the docblock below, the per-file form of the same
// choice `vitest.config.ts` makes for `tests/ui/**`. It renders with
// `react-dom/server`'s `renderToStaticMarkup`, exactly as
// `tests/ui/components-1.test.tsx` does; the layout is an async Server
// Component, so it is awaited to a tree first and rendered second.
//
// **`copy()` is mocked to `(key) => key`, and `COPY` is not.** The mock lets
// these suites assert *which key a line resolves from* without depending on
// the owner's wording; keeping `COPY` real is what lets `writtenLine`'s
// owner-owed branch behave exactly as it does in production, so a line the
// owner has not written renders as nothing here too.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: vi.fn() }),
}));

import { COPY, type CopyKey } from "@/lib/presentation/copy";
import AppLayout from "@/app/(account)/app/layout";
import { DomainBlock } from "@/app/(account)/app/_shell/DomainBlock";
import { PublishingCard } from "@/app/(account)/app/_shell/PublishingCard";
import { SidebarNav } from "@/app/(account)/app/_shell/SidebarNav";
import { TabBar } from "@/app/(account)/app/_shell/TabBar";
import { DESTINATIONS, DESTINATION_HREF } from "@/app/(account)/app/_shell/destinations";
import { formatDate, formatDateTime } from "@/app/(account)/app/_shell/format";
import type { ShellModel } from "@/app/(account)/app/_shell/model";

const ZONE = "America/New_York";
const MONDAY = (day: number): Date => new Date(Date.UTC(2026, 8, day, 6, 0, 0));

const SCHEDULED: ShellModel = {
  domain: "example.com",
  timeZone: ZONE,
  weeks: { kind: "counted", weeks: 3, lastMeasuredOn: MONDAY(14) },
  waiting: 2,
  publishing: { mode: "autopilot", next: new Date(Date.UTC(2026, 8, 16, 13, 0, 0)) },
  stopped: null,
};

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  const root = container.firstElementChild;
  if (!root) throw new Error("rendered no root element");
  return root;
}

async function renderLayout(): Promise<Element> {
  const tree = await AppLayout({ children: React.createElement("p", null, "screen") });
  return render(tree);
}

// ── criterion 1 ─────────────────────────────────────────────────────────
describe("REQ-040 c1 — exactly three destinations, from the one tuple", () => {
  it("the tuple is Overview, Calendar and Settings, and a fourth is a type change", () => {
    expect([...DESTINATIONS]).toEqual(["overview", "calendar", "settings"]);
  });

  it("the sidebar renders exactly three destinations and no fourth", () => {
    const root = render(<SidebarNav waiting={0} />);
    const links = root.querySelectorAll("a");
    expect(links).toHaveLength(3);
    expect([...links].map((a) => a.getAttribute("href"))).toEqual([
      DESTINATION_HREF.overview,
      DESTINATION_HREF.calendar,
      DESTINATION_HREF.settings,
    ]);
  });

  it("on the whole shell, no destination address appears that the tuple does not name", async () => {
    const root = await renderLayout();
    const hrefs = new Set([...root.querySelectorAll("a")].map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(new Set(DESTINATIONS.map((d) => DESTINATION_HREF[d])));
  });
});

// ── criterion 2 ─────────────────────────────────────────────────────────
describe("REQ-040 c2 — the Calendar destination's waiting count", () => {
  it("shows the count when non-zero, on Calendar and on no other destination", () => {
    const root = render(<SidebarNav waiting={7} />);
    const counts = root.querySelectorAll("[data-testid='shell-calendar-count']");
    expect(counts).toHaveLength(1);
    expect(counts[0]?.textContent).toBe("7");
    expect(root.querySelector("[data-testid='shell-navlink-calendar']")?.textContent).toContain("7");
    expect(root.querySelector("[data-testid='shell-navlink-overview']")?.textContent).not.toMatch(/\d/);
  });

  it("renders no count at all at zero — not a 0, not an empty element", () => {
    const root = render(<SidebarNav waiting={0} />);
    expect(root.querySelectorAll("[data-testid='shell-calendar-count']")).toHaveLength(0);
    expect(root.textContent).not.toContain("0");
  });

  it("the count is a numeral, so it carries the mono class (§2.3)", () => {
    const root = render(<SidebarNav waiting={7} />);
    expect(root.querySelector("[data-testid='shell-calendar-count']")?.className).toContain("num");
  });
});

// ── criterion 3 ─────────────────────────────────────────────────────────
describe("REQ-040 c3 — the mode with the next publish time, in the customer's zone", () => {
  it("renders the mode's own key and the scheduled-publish line's key", () => {
    const root = render(<PublishingCard shell={SCHEDULED} />);
    expect(root.textContent).toContain("shell.publishing.mode.autopilot");
    expect(root.querySelector("[data-testid='shell-publishing-line']")?.textContent).toBe(
      "next-publish.scheduled"
    );
  });

  it("copilot renders the copilot word, and the toggle reports the mode it is in", () => {
    const copilot: ShellModel = { ...SCHEDULED, publishing: { mode: "copilot", next: MONDAY(16) } };
    const root = render(<PublishingCard shell={copilot} />);
    expect(root.textContent).toContain("shell.publishing.mode.copilot");
    expect(root.querySelector("input[type='checkbox']")?.hasAttribute("checked")).toBe(false);
    const auto = render(<PublishingCard shell={SCHEDULED} />);
    expect(auto.querySelector("input[type='checkbox']")?.hasAttribute("checked")).toBe(true);
  });

  it("the time is formatted in the site's zone, not the machine's", () => {
    // 2026-09-01 03:00 UTC is 2026-08-31 23:00 in New York: the zone decides
    // the calendar day, so a formatter ignoring it would print September.
    const at = new Date(Date.UTC(2026, 8, 1, 3, 0, 0));
    expect(formatDateTime(at, ZONE)).toContain("Aug 31, 2026");
    expect(formatDateTime(at, "UTC")).toContain("Sep 1, 2026");
  });

  it("the time names its zone — a time with no zone beside it is a guess", () => {
    expect(formatDateTime(new Date(Date.UTC(2026, 8, 16, 13, 0, 0)), ZONE)).toMatch(/EDT|EST|GMT/);
  });
});

// ── criterion 4 ─────────────────────────────────────────────────────────
describe("REQ-040 c4 — with no publish scheduled, one line for the resolved reason", () => {
  const withReason = (because: "reachkit_stopped" | "publishing_paused" | "nothing_approved" | "nothing_planned"): ShellModel => ({
    ...SCHEDULED,
    publishing: { mode: "autopilot", next: null, because },
  });

  it("the stopped arm resolves from next-publish.stopped — REQ-092 c7's own line", () => {
    // The key is what this test pins; its sentence is the owner's, and until
    // it is written `writtenLine` renders nothing rather than throwing.
    const root = render(<PublishingCard shell={withReason("reachkit_stopped")} />);
    const line = root.querySelector("[data-testid='shell-publishing-line']");
    // Issue #20: the card's line no longer goes through `writtenLine`, and
    // every `next-publish.*` key now carries at least `TODO(copy)` — REQ-091
    // c2 forbids a blank where a written line belongs. So the line is always
    // rendered, and what is pinned is the key it resolved from.
    expect(COPY["next-publish.stopped"]).not.toBe("");
    expect(line?.textContent).toBe("next-publish.stopped");
    // Whichever it is, no *other* cause's line reached this card.
    expect(root.textContent).not.toContain("next-publish.paused");
    expect(root.textContent).not.toContain("next-publish.nothing-approved");
    expect(root.textContent).not.toContain("next-publish.none-planned");
    expect(root.textContent).not.toContain("next-publish.scheduled");
  });

  it.each(["publishing_paused", "nothing_approved", "nothing_planned"] as const)(
    "%s never renders the scheduled line, and never a second cause's",
    (because) => {
      const root = render(<PublishingCard shell={withReason(because)} />);
      const lines = root.querySelectorAll("[data-testid='shell-publishing-line']");
      expect(lines.length).toBeLessThanOrEqual(1);
      expect(root.textContent).not.toContain("next-publish.scheduled");
      expect(root.textContent).not.toContain("next-publish.stopped");
    }
  );

  it("a scheduled publish renders the time's line and no cause's", () => {
    const root = render(<PublishingCard shell={SCHEDULED} />);
    expect(root.querySelector("[data-testid='shell-publishing-line']")?.textContent).toBe(
      "next-publish.scheduled"
    );
  });
});

// ── criterion 5 ─────────────────────────────────────────────────────────
describe("REQ-040 c5 — a viewport too narrow for the sidebar keeps all three", () => {
  it("the tab bar renders the same three destinations, from the same tuple", () => {
    const root = render(<TabBar />);
    const tabs = root.querySelectorAll("[role='tab']");
    expect(tabs).toHaveLength(3);
    expect([...tabs].map((t) => t.textContent)).toEqual([
      "shell.nav.overview",
      "shell.nav.calendar",
      "shell.nav.settings",
    ]);
  });

  it("mutation: the two renderers cannot offer different navigation", async () => {
    // Both map over DESTINATIONS, so the tab bar's labels and the sidebar's
    // addresses are the same three in the same order. A fourth entry added
    // to one renderer alone has nowhere to come from.
    const tabs = [...render(<TabBar />).querySelectorAll("[role='tab']")].map((t) => t.textContent);
    const links = [...render(<SidebarNav waiting={0} />).querySelectorAll("a")].map(
      (a) => a.getAttribute("href")
    );
    expect(tabs).toHaveLength(links.length);
    expect(links).toEqual(DESTINATIONS.map((d) => DESTINATION_HREF[d]));
  });

  it("the domain block and the publishing state collapse into the tab bar's header, not away", async () => {
    const root = await renderLayout();
    const top = root.querySelector("[data-testid='shell-top']");
    expect(top).not.toBeNull();
    expect(top?.querySelector("[data-testid='shell-tabbar']")).not.toBeNull();
    expect(top?.querySelector(".rk-domain")).not.toBeNull();
    expect(top?.querySelector("[data-testid='shell-publishing']")).not.toBeNull();
  });

  it("the sidebar carries the same three parts at the wide breakpoint", async () => {
    const root = await renderLayout();
    const sidebar = root.querySelector("[data-testid='shell-sidebar']");
    expect(sidebar?.querySelector(".rk-domain")).not.toBeNull();
    expect(sidebar?.querySelector("[data-testid='shell-sidebar-nav']")).not.toBeNull();
    expect(sidebar?.querySelector("[data-testid='shell-publishing']")).not.toBeNull();
  });
});

// ── criteria 6 and 7 ────────────────────────────────────────────────────
describe("REQ-040 c6 — the domain block states the domain and its measured weeks", () => {
  it("renders the domain, as a value in the mono face", () => {
    const root = render(<DomainBlock shell={SCHEDULED} />);
    const name = root.querySelector(".num");
    expect(name?.textContent).toBe("example.com");
  });

  it("the measurement date renders in the site's zone and never as a weekday word", () => {
    const at = new Date(Date.UTC(2026, 8, 1, 3, 0, 0));
    expect(formatDate(at, ZONE)).toBe("Aug 31, 2026");
    expect(formatDate(at, "UTC")).toBe("Sep 1, 2026");
    expect(formatDate(at, ZONE)).not.toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
  });

  it("the week line resolves from shell.domain.measured-weeks, or renders nothing while owed", () => {
    const root = render(<DomainBlock shell={SCHEDULED} />);
    if (COPY["shell.domain.measured-weeks"] === "") {
      expect(root.querySelector(".rk-prov")).toBeNull();
    } else {
      expect(root.querySelector(".rk-prov")?.textContent).toBe("shell.domain.measured-weeks");
    }
    // Either way, the not-measured line is not the one that reached it.
    expect(root.textContent).not.toContain("shell.domain.not-measured");
  });
});

describe("REQ-040 c7 — a never-measured domain states no number", () => {
  const unmeasured: ShellModel = {
    ...SCHEDULED,
    weeks: { kind: "none", firstDueOn: MONDAY(21) },
  };

  it("renders no week count, and resolves the not-measured line instead", () => {
    const root = render(<DomainBlock shell={unmeasured} />);
    expect(root.textContent).not.toContain("shell.domain.measured-weeks");
    if (COPY["shell.domain.not-measured"] !== "") {
      expect(root.querySelector(".rk-prov")?.textContent).toBe("shell.domain.not-measured");
    } else {
      expect(root.querySelector(".rk-prov")).toBeNull();
    }
  });

  it("the domain itself is still stated", () => {
    expect(render(<DomainBlock shell={unmeasured} />).querySelector(".num")?.textContent).toBe(
      "example.com"
    );
  });
});

// ── the frame itself ────────────────────────────────────────────────────
describe("the frame is the route's one screen root, and it invents no sentence", () => {
  it("renders exactly one [data-surface] root, declaring an arm per band", async () => {
    const root = await renderLayout();
    expect(root.getAttribute("data-surface")).toBe("");
    expect(root.querySelectorAll("[data-surface]")).toHaveLength(0);
    expect(root.getAttribute("data-arm-compact")).toBe("columns:1");
    expect(root.getAttribute("data-arm-medium")).toBe("columns:2");
    expect(root.getAttribute("data-arm-wide")).toBe("same-as-below");
  });

  it("wraps the screen it was given", async () => {
    const root = await renderLayout();
    expect(root.querySelector("main")?.textContent).toBe("screen");
  });

  it("reports which of the shell's keys the owner still owes (rule 5.5)", () => {
    const SHELL_KEYS: CopyKey[] = [
      "shell.nav.overview",
      "shell.nav.calendar",
      "shell.nav.settings",
      "shell.publishing.mode.autopilot",
      "shell.publishing.mode.copilot",
      "shell.domain.measured-weeks",
      "shell.domain.not-measured",
      "next-publish.scheduled",
      "next-publish.stopped",
      "next-publish.paused",
      "next-publish.nothing-approved",
      "next-publish.none-planned",
      "overview.head",
      "calendar.head",
      "settings.head",
    ];
    const owed = SHELL_KEYS.filter((key) => COPY[key] === "");
    console.log(
      `tests/app/shell/frame.test.tsx: the shell speaks ${SHELL_KEYS.length} key(s); ` +
        `${owed.length} still owner-owed: ${owed.join(", ") || "none"}`
    );
    // Every key the shell can reach exists in the registry — the property
    // that matters. Which ones are still owed is reported, not frozen: the
    // owner filling one must not fail a test.
    for (const key of SHELL_KEYS) expect(Object.keys(COPY)).toContain(key);
    // The three the nav is built from are never owed: a nav with no words is
    // not a nav (they are transcriptions of §4.4's own list, not new copy).
    expect(COPY["shell.nav.overview"]).toBe("Overview");
    expect(COPY["shell.nav.calendar"]).toBe("Calendar");
    expect(COPY["shell.nav.settings"]).toBe("Settings");
  });
});
