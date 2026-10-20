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
// `react-dom/server`'s `renderToStaticMarkup`; the layout is an async Server
// Component, so it is awaited to a tree first and rendered second.
//
// **`copy()` is mocked to `(key) => key`, and `COPY` is not.** The mock lets
// these suites assert *which key a line resolves from* without depending on
// the owner's wording; keeping `COPY` real is what lets `writtenLine`'s
// owner-owed branch behave exactly as it does in production, so a line the
// owner has not written renders as nothing here too.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { settledMarkup } from "./settled";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

/** Which address the shell is rendering at. Mutable since #267: the current
 *  mark is a function of the path, so a suite that can only be at `/app`
 *  cannot see a route that is on no destination. */
const at = vi.hoisted(() => ({ pathname: "/app" }));

vi.mock("next/navigation", () => ({
  usePathname: () => at.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import { COPY, type CopyKey } from "@/lib/presentation/copy";
import AppLayout from "@/app/(account)/app/layout";
import { DomainBlock } from "@/app/(account)/app/_shell/DomainBlock";
import { PublishingCard } from "@/app/(account)/app/_shell/PublishingCard";
import { SidebarNav } from "@/app/(account)/app/_shell/SidebarNav";
import { AppDock } from "@/app/(account)/app/_shell/AppDock";
import { Shortcuts } from "@/app/(account)/app/_shell/Shortcuts";
import { WaitingCard } from "@/app/(account)/app/_shell/WaitingCard";
import { DESTINATIONS, DESTINATION_HREF, destinationOf } from "@/app/(account)/app/_shell/destinations";
import { DRAWER_FOCUS_RING, DRAWER_TOGGLE_ID, RAIL_SCRIPT, RAIL_STORAGE_KEY } from "@/app/(account)/app/_shell/drawer";
import { formatDate, formatDateTime } from "@/app/(account)/app/_shell/format";
import type { ShellModel } from "@/app/(account)/app/_shell/model";

// BUILD §4.4–§4.6, issue #169 — the surfaces under test now resolve who is
// asking through `_session/account.ts`, which reads a signed cookie and a
// `sites` row. This suite has neither, so it signs in as the reserved
// fixture account: the surfaces then take the same fixture branch they
// always took, and what changed is only how they learned whose it is.
import { resetAccount, signedInAs } from "../account-door";

beforeEach(() => signedInAs());
afterEach(() => resetAccount());


const ZONE = "America/New_York";
const MONDAY = (day: number): Date => new Date(Date.UTC(2026, 8, day, 6, 0, 0));

const SCHEDULED: ShellModel = {
  domain: "example.com",
  timeZone: ZONE,
  weeks: { kind: "counted", weeks: 3, lastMeasuredOn: MONDAY(14) },
  waiting: 2,
  review: {
    draftId: "draft-1",
    title: "How much does a bike service cost in 2026?",
    goesLiveAt: new Date(Date.UTC(2026, 8, 16, 11, 0, 0)),
  },
  blog: "https://blog.example.com",
  publishing: { mode: "autopilot", next: new Date(Date.UTC(2026, 8, 16, 13, 0, 0)) },
  stopped: null,
};

/** A count of none, as the promise the menu now takes. Every structural
 *  render below uses it: at zero the badge draws nothing whether the
 *  promise has settled or not, so these assertions are about the links. */
const NONE = Promise.resolve(0);

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  const root = container.firstElementChild;
  if (!root) throw new Error("rendered no root element");
  return root;
}

/**
 * The same render, streamed to the end (issue 912).
 *
 * The menu's waiting badge reads a **promise** now — the three links are in
 * the first response and only the number waits — so a synchronous
 * `renderToStaticMarkup` sees the boundary's fallback and stops. This reads
 * the stream to completion, which is the markup a browser ends up with:
 * React emits the resolved boundary later in the same response and the
 * badge is in the document either way.
 */
async function renderStreamed(el: React.ReactElement): Promise<Element> {
  const stream = await renderToReadableStream(el);
  await stream.allReady;
  const html = await new Response(stream).text();
  const container = document.createElement("div");
  container.innerHTML = html;
  const root = container.firstElementChild;
  if (!root) throw new Error("rendered no root element");
  return root;
}

/** The shell, settled. Its parts are behind `<Suspense>` boundaries since
 *  issue 912, so a synchronous render sees their skeletons; every
 *  assertion below is about what the shell *contains*, which is the
 *  stream read to the end. */
async function renderLayout(): Promise<Element> {
  const tree = await AppLayout({ children: React.createElement("p", null, "screen") });
  const container = document.createElement("div");
  container.innerHTML = await settledMarkup(tree);
  // **The container, not its first child.** A streamed response puts a
  // boundary that resolved after the first flush in a `<div hidden>`
  // *beside* the shell rather than inside it — the browser moves it into
  // place with the script React emits beside it, and jsdom runs no script.
  // Searching the container finds the shell's parts wherever in the
  // response they arrived, which is the document a customer ends up with.
  if (container.firstElementChild === null) throw new Error("rendered no root element");
  return container;
}

// ── criterion 1 ─────────────────────────────────────────────────────────
describe("REQ-040 c1 — exactly three destinations, from the one tuple", () => {
  it("the tuple is Overview, Calendar and Settings, and a fourth is a type change", () => {
    expect([...DESTINATIONS]).toEqual(["overview", "calendar", "settings"]);
  });

  it("the sidebar renders exactly three destinations and no fourth", () => {
    const root = render(<SidebarNav waiting={NONE} />);
    const links = root.querySelectorAll("a");
    expect(links).toHaveLength(3);
    expect([...links].map((a) => a.getAttribute("href"))).toEqual([
      DESTINATION_HREF.overview,
      DESTINATION_HREF.calendar,
      DESTINATION_HREF.settings,
    ]);
  });

  it("on the whole shell, no /app address appears that the tuple does not name", async () => {
    // SPEC §4 (2026-09-20) adds links that are not destinations — the page
    // in review, the customer's own blog, a mailbox — so the closed set is
    // stated over the app's own addresses, which is what "No other
    // navigation" was ever about. `/app/draft/{id}` is the review screen,
    // which is on no destination by design (`destinationOf`).
    const root = await renderLayout();
    const appHrefs = new Set(
      [...root.querySelectorAll("a")]
        .map((a) => a.getAttribute("href") ?? "")
        .filter((href) => href.startsWith("/app"))
        .filter((href) => !href.startsWith("/app/draft/"))
    );
    expect(appHrefs).toEqual(new Set(DESTINATIONS.map((d) => DESTINATION_HREF[d])));
  });

  it("the three are reachable twice and no more: the panel's menu and the phone's dock", async () => {
    const root = await renderLayout();
    for (const destination of DESTINATIONS) {
      expect(
        root.querySelectorAll(`[data-testid='shell-navlink-${destination}']`).length +
          root.querySelectorAll(`[data-testid='shell-docklink-${destination}']`).length,
        destination
      ).toBe(3); // panel + rail + dock
    }
  });
});

// ── criterion 2 ─────────────────────────────────────────────────────────
describe("REQ-040 c2 — the waiting count, now on Overview (SPEC §4, 2026-09-20)", () => {
  it("shows the count when non-zero, on Overview and on no other destination", async () => {
    const root = await renderStreamed(<SidebarNav waiting={Promise.resolve(7)} />);
    const counts = root.querySelectorAll("[data-testid='shell-waiting-count']");
    expect(counts).toHaveLength(1);
    expect(counts[0]?.textContent).toBe("7");
    expect(root.querySelector("[data-testid='shell-navlink-overview']")?.textContent).toContain("7");
    expect(root.querySelector("[data-testid='shell-navlink-calendar']")?.textContent).not.toMatch(/\d/);
  });

  it("every destination carries its glyph before its word, hidden from the tree (issue #506)", async () => {
    const root = await renderStreamed(<SidebarNav waiting={Promise.resolve(7)} />);
    for (const destination of DESTINATIONS) {
      const link = root.querySelector(`[data-testid='shell-navlink-${destination}']`);
      const svgs = link?.querySelectorAll("svg") ?? [];
      expect(svgs, destination).toHaveLength(1);
      expect(svgs[0]?.getAttribute("aria-hidden"), destination).toBe("true");
      expect(link?.firstElementChild?.tagName.toLowerCase(), destination).toBe("svg");
    }
  });

  it("renders no count at all at zero — not a 0, not an empty element", async () => {
    const root = await renderStreamed(<SidebarNav waiting={Promise.resolve(0)} />);
    expect(root.querySelectorAll("[data-testid='shell-waiting-count']")).toHaveLength(0);
    expect(root.textContent).not.toContain("0");
  });

  it("the count is a numeral, so it carries the mono class (§2.3)", async () => {
    const root = await renderStreamed(<SidebarNav waiting={Promise.resolve(7)} />);
    expect(root.querySelector("[data-testid='shell-waiting-count']")?.className).toContain("num");
  });

  it("the icon rail states the same count on the same destination, and none at zero", async () => {
    const rail = await renderStreamed(<SidebarNav waiting={Promise.resolve(7)} rail />);
    expect(rail.querySelector("[data-testid='shell-waiting-count']")?.textContent).toBe("7");
    expect(
      rail.querySelector("[data-testid='shell-navlink-overview']")?.getAttribute("aria-label")
    ).toBe("shell.nav.overview");
    expect(
      (await renderStreamed(<SidebarNav waiting={Promise.resolve(0)} rail />)).querySelector(
        "[data-testid='shell-waiting-count']"
      )
    ).toBeNull();
  });

  it("the dock states it too, so a phone is told what a desktop is told", async () => {
    const dock = await renderStreamed(<AppDock waiting={Promise.resolve(7)} />);
    expect(dock.querySelector("[data-testid='shell-dock-count']")?.textContent).toBe("7");
    expect(dock.querySelector("[data-testid='shell-docklink-calendar']")?.textContent).not.toMatch(/\d/);
    expect(
      (await renderStreamed(<AppDock waiting={Promise.resolve(0)} />)).querySelector(
        "[data-testid='shell-dock-count']"
      )
    ).toBeNull();
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

  it("a copilot row still reads Autopilot, and the card draws no mode picker (SPEC §7, #476)", () => {
    const copilot: ShellModel = { ...SCHEDULED, publishing: { mode: "copilot" as never, next: MONDAY(16) } };
    const root = render(<PublishingCard shell={copilot} />);
    expect(root.textContent).toContain("shell.publishing.mode.autopilot");
    expect(root.textContent).not.toMatch(/copilot/i);
    for (const card of [root, render(<PublishingCard shell={SCHEDULED} />)]) {
      expect(card.querySelector("input, button, [role='switch']")).toBeNull();
    }
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
  const withReason = (because: "reachkit_stopped" | "publishing_paused" | "not_written" | "nothing_planned"): ShellModel => ({
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
    expect(root.textContent).not.toContain("next-publish.being-written");
    expect(root.textContent).not.toContain("next-publish.none-planned");
    expect(root.textContent).not.toContain("next-publish.scheduled");
  });

  it.each(["publishing_paused", "not_written", "nothing_planned"] as const)(
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
describe("REQ-040 c5 / SPEC §4 (2026-09-20) — a viewport too narrow keeps all three", () => {
  // The compact header's horizontal nav row is gone: below `lg` the three
  // items are a daisyUI `dock` at the foot of the viewport and the panel
  // itself is a drawer. What has not changed is that all three survive, in
  // order, labelled, with their count — which is what c5 is.
  it("the dock renders the same three destinations, labelled, in order", () => {
    const dock = render(<AppDock waiting={NONE} />);
    const links = [...dock.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual([
      "shell.nav.overview",
      "shell.nav.plan",
      "shell.nav.settings",
    ]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(
      DESTINATIONS.map((d) => DESTINATION_HREF[d])
    );
  });

  // ── Issue #267 ────────────────────────────────────────────────────
  //
  // The old tab bar took `current ?? DESTINATIONS[0]`, so on a route that is
  // on no destination it marked **Overview** current. The pair below is what
  // discriminates: an implementation that falls back to the first
  // destination passes the first row and fails the second.
  it("each of the three destinations marks itself current at its own address", () => {
    for (const [pathname, label] of [
      ["/app", "shell.nav.overview"],
      ["/app/calendar", "shell.nav.plan"],
      ["/app/settings", "shell.nav.settings"],
    ] as const) {
      at.pathname = pathname;
      const current = [...render(<AppDock waiting={NONE} />).querySelectorAll("a")].filter(
        (a) => a.getAttribute("aria-current") === "page"
      );
      expect(current.map((a) => a.textContent), pathname).toEqual([label]);
    }
    at.pathname = "/app";
  });

  it("Overview's own tabs mark Overview — not nothing (#915)", () => {
    // SPEC §4 (2026-09-20): Overview has four tabs, each its own address.
    // Matching `/app` exactly lit no menu item on three of the four.
    for (const pathname of ["/app", "/app/search", "/app/ai-answers", "/app/rivals"] as const) {
      expect(destinationOf(pathname), pathname).toBe("overview");
    }
    for (const pathname of ["/app/calendar", "/app/calendar/2026-09"] as const) {
      expect(destinationOf(pathname), pathname).toBe("calendar");
    }
    for (const pathname of ["/app/settings", "/app/settings/mail"] as const) {
      expect(destinationOf(pathname), pathname).toBe("settings");
    }
    // The draft view is reached from a card, not the menu, so it claims none.
    for (const pathname of ["/app/draft", "/app/draft/d1"] as const) {
      expect(destinationOf(pathname), pathname).toBeUndefined();
    }
    // And nothing outside `/app` is any of them.
    for (const pathname of ["/", "/setup", "/applesauce"] as const) {
      expect(destinationOf(pathname), pathname).toBeUndefined();
    }
  });

  it("a tab of Overview's marks Overview in the dock too", () => {
    at.pathname = "/app/rivals";
    const current = [...render(<AppDock waiting={NONE} />).querySelectorAll("a")].filter(
      (a) => a.getAttribute("aria-current") === "page"
    );
    expect(current.map((a) => a.textContent)).toEqual(["shell.nav.overview"]);
    at.pathname = "/app";
  });

  it("**a route on no destination marks none** — the draft view", () => {
    at.pathname = "/app/draft/draft-1";
    const links = [...render(<AppDock waiting={NONE} />).querySelectorAll("a")];
    expect(links).toHaveLength(3);
    expect(links.filter((a) => a.getAttribute("aria-current") === "page")).toEqual([]);
    at.pathname = "/app";
  });

  it("the dock, the panel and the rail agree about what is current, at every address", () => {
    for (const pathname of ["/app", "/app/calendar", "/app/settings", "/app/draft/d1"] as const) {
      at.pathname = pathname;
      const marks = (el: Element): (string | null)[] =>
        [...el.querySelectorAll("a")]
          .filter((a) => a.getAttribute("aria-current") === "page")
          .map((a) => a.getAttribute("data-testid"));
      const panel = marks(render(<SidebarNav waiting={NONE} />));
      const rail = marks(render(<SidebarNav waiting={NONE} rail />));
      const dock = marks(render(<AppDock waiting={NONE} />)).map((id) =>
        id === null ? null : id.replace("shell-docklink-", "shell-navlink-")
      );
      expect(rail, pathname).toEqual(panel);
      expect(dock, pathname).toEqual(panel);
    }
    at.pathname = "/app";
  });

  it("the phone's top bar carries the domain, the theme control and the publishing line, and opens nothing", async () => {
    // Owner, 2026-10-08 (issue 1339): on a phone the dock is the
    // navigation. No control anywhere below `lg` opens a panel, and what
    // the panel held that a phone still needs is on the bar.
    const root = await renderLayout();
    const top = root.querySelector("[data-testid='shell-top']");
    expect(top).not.toBeNull();
    expect(top?.textContent).toContain("example.com");
    expect(top?.querySelector("[data-testid='theme-toggle']")).not.toBeNull();
    // The panel's own statement, not a second sentence.
    expect(top?.querySelector("[data-testid='shell-top-publishing']")?.textContent).toBe(
      root.querySelector("[data-testid='shell-publishing-line']")?.textContent
    );
    expect(top?.querySelector(`[for='${DRAWER_TOGGLE_ID}']`)).toBeNull();
    expect(root.querySelector("[data-testid='shell-menu-button']")).toBeNull();
    expect(root.querySelector("[data-testid='shell-dock']")).not.toBeNull();
  });

  it("the side panel is rendered once — not once per breakpoint (issue #911)", async () => {
    const root = await renderLayout();
    expect(root.querySelectorAll("[data-testid='shell-sidebar']")).toHaveLength(1);
    expect(root.querySelectorAll("[data-testid='shell-domain']")).toHaveLength(1);
    expect(root.querySelectorAll("[data-testid='shell-publishing']")).toHaveLength(1);
    expect(root.querySelectorAll("[data-testid='shell-onboarding']").length).toBeLessThanOrEqual(1);
  });
});

// ── the collapsible panel ───────────────────────────────────────────────
describe("SPEC §4 (2026-09-20) — one button collapses the panel, and the choice survives a reload", () => {
  it("the panel and the rail are two arms of one drawer, driven by one checkbox", async () => {
    const root = await renderLayout();
    const toggle = root.querySelector(`#${DRAWER_TOGGLE_ID}`);
    expect(toggle?.getAttribute("type")).toBe("checkbox");
    expect(toggle?.className).toContain("drawer-toggle");
    for (const id of ["shell-collapse", "shell-expand"]) {
      expect(root.querySelector(`[data-testid='${id}']`)?.getAttribute("for"), id).toBe(
        DRAWER_TOGGLE_ID
      );
    }
    expect(root.querySelector("[data-testid='shell-rail']")).not.toBeNull();
  });

  it("collapsing needs no script: the rail is chosen by daisyUI's own drawer variants", async () => {
    const root = await renderLayout();
    const panel = root.querySelector("[data-testid='shell-sidebar']");
    expect(panel?.className).toContain("lg:is-drawer-open:w-18");
    expect(root.querySelector("[data-testid='shell-rail']")?.className).toContain(
      "lg:is-drawer-open:flex"
    );
  });

  it("the two icon-only buttons carry a tooltip, and the checkbox carries the name", async () => {
    const root = await renderLayout();
    expect(root.querySelector("[data-testid='shell-collapse']")?.getAttribute("data-tip")).toBe(
      "shell.panel.collapse"
    );
    expect(root.querySelector("[data-testid='shell-expand']")?.getAttribute("data-tip")).toBe(
      "shell.panel.open"
    );
    expect(root.querySelector(`#${DRAWER_TOGGLE_ID}`)?.getAttribute("aria-label")).toBe(
      "shell.panel.label"
    );
  });

  it("a keyboard can see where it is: the toggle it cannot draw a ring on lights the button on screen", async () => {
    // #328. The checkbox above is the only thing here a keyboard can
    // operate — Space on it collapses and expands the panel — and daisyUI
    // draws it at `width: 0; height: 0; opacity: 0`, so it can paint no
    // focus ring of its own: a reader tabbing into `/app` was moved to a
    // control that showed nothing, which is WCAG 2.1 2.4.7, Level AA.
    //
    // What a customer observes is that every button the toggle drives
    // lights up when the toggle has focus. That is what is asserted, on
    // both, rather than the selector that achieves it.
    const root = await renderLayout();
    for (const id of ["shell-collapse", "shell-expand"]) {
      expect(root.querySelector(`[data-testid='${id}']`)?.className, id).toContain(
        DRAWER_FOCUS_RING
      );
    }
  });

  it("what is remembered is remembered per browser, and only where the rail exists", () => {
    // A checked box means "collapsed" at `lg`; below it there is no panel
    // and the box is not drawn (issue 1339). The script guards the restore
    // with the same media query the layout uses, and re-applies it when the
    // band changes.
    expect(RAIL_SCRIPT).toContain(RAIL_STORAGE_KEY);
    expect(RAIL_SCRIPT).toContain("localStorage");
    expect(RAIL_SCRIPT).toContain("matchMedia");
    expect(RAIL_SCRIPT).toContain("m.matches&&read()");
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
      expect(root.querySelector("[data-testid='shell-domain-line']")).toBeNull();
    } else {
      expect(root.querySelector("[data-testid='shell-domain-line']")?.textContent).toBe("shell.domain.measured-weeks");
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
      expect(root.querySelector("[data-testid='shell-domain-line']")?.textContent).toBe("shell.domain.not-measured");
    } else {
      expect(root.querySelector("[data-testid='shell-domain-line']")).toBeNull();
    }
  });

  it("the domain itself is still stated", () => {
    expect(render(<DomainBlock shell={unmeasured} />).querySelector(".num")?.textContent).toBe(
      "example.com"
    );
  });

  it("the autopilot card states what the mode is doing before the first pass (S13)", () => {
    // "First page after the deep pass" — the set's own sentence, in place
    // of the mode's ordinary state. The arm is the same `WeekCount` the
    // domain block above reads, so the two lines in this column cannot
    // disagree about whether a week has been measured.
    const root = render(<PublishingCard shell={unmeasured} />);
    expect(root.querySelector("[data-testid='shell-publishing-state']")?.textContent).toBe(
      "shell.publishing.state.week-zero"
    );
  });

  it("and once a week is counted it states the mode's own state instead", () => {
    const root = render(<PublishingCard shell={SCHEDULED} />);
    expect(root.querySelector("[data-testid='shell-publishing-state']")?.textContent).toBe(
      "shell.publishing.state.autopilot"
    );
  });

  it("the waiting count is the count, in week 0 as in any week (REQ-040 c2)", async () => {
    // **No week-0 branch in the nav, deliberately.** UI-SPEC S13 draws the
    // sidebar with no count beside Calendar, and #353's Done-when repeats
    // that — but the set's own S13 body draws the first page sitting in
    // "Needs you", and `waiting` is §9's `in_review` and `needs_attention`
    // drafts ("how many pages are waiting on this customer right now").
    // A page in review is a page waiting, so a screen that showed it in one
    // card and denied it in the nav would state two different facts.
    //
    // c2 is unambiguous and is the law: "the destination shows how many are
    // waiting; when none are, it shows no count." So the count is
    // suppressed at zero and nowhere else, and the set's S13 sidebar is a
    // drawing to reconcile — flagged to the owner rather than implemented
    // as a branch that hides a real number.
    expect(
      (await renderStreamed(<SidebarNav waiting={NONE} />)).querySelectorAll(
        "[data-testid='shell-waiting-count']"
      )
    ).toHaveLength(0);
    expect(
      (await renderStreamed(<SidebarNav waiting={Promise.resolve(1)} />)).querySelector(
        "[data-testid='shell-waiting-count']"
      )?.textContent
    ).toBe("1");
  });
});

// ── the frame itself ────────────────────────────────────────────────────
describe("the frame is the route's one screen root, and it invents no sentence", () => {
  it("renders exactly one [data-surface] root, declaring an arm per band", async () => {
    const root = await renderLayout();
    // `renderLayout` answers the container the response was written into
    // (issue 912), so the screen root is the one element inside it carrying
    // the attribute — and **exactly one**, which is the rule.
    const surfaces = root.querySelectorAll("[data-surface]");
    expect(surfaces).toHaveLength(1);
    const surface = surfaces[0];
    expect(surface?.getAttribute("data-surface")).toBe("");
    // Full width (#1100): the shell declares its own edges, so the surface
    // draws no centred measure and no gutter around it.
    expect(surface?.getAttribute("data-arm-compact")).toMatch(/^declared:/);
    expect(surface?.getAttribute("data-arm-medium")).toBe("same-as-below");
    expect(surface?.getAttribute("data-arm-wide")).toBe("same-as-below");
  });

  it("wraps the screen it was given", async () => {
    const root = await renderLayout();
    expect(root.querySelector("main")?.textContent).toBe("screen");
  });

  it("the *Waiting for you* card names the page, links to its review and draws the whole title", () => {
    const card = render(<WaitingCard review={SCHEDULED.review} timeZone={ZONE} />);
    expect(card.getAttribute("href")).toBe("/app/draft/draft-1");
    expect(card.textContent).toContain("shell.waiting.head");
    const title = card.querySelector("[data-testid='shell-waiting-title']");
    expect(title?.textContent).toBe("How much does a bike service cost in 2026?");
    expect(title?.className).not.toMatch(/line-clamp|truncate/);
    // The time is a value, and a value is never clamped.
    const when = card.querySelector("[data-testid='shell-waiting-when']");
    expect(when?.textContent).toBe("shell.waiting.goes-live");
    expect(when?.className).not.toMatch(/line-clamp|truncate/);
  });

  it("with nothing waiting the card is not drawn at all", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<WaitingCard review={null} timeZone={ZONE} />);
    expect(container.firstElementChild).toBeNull();
  });

  it("with no page waiting, no card is drawn beside a count of nothing", () => {
    const nav = render(<SidebarNav waiting={NONE} />);
    expect(nav.querySelector("[data-testid='shell-waiting-count']")).toBeNull();
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<WaitingCard review={null} timeZone={ZONE} />);
    expect(container.querySelector("[data-testid='shell-waiting']")).toBeNull();
  });

  it("*Visit your blog* is drawn only where there is a blog; Help always is", () => {
    const withBlog = render(<Shortcuts blog="https://blog.example.com" />);
    const link = withBlog.querySelector("[data-testid='shell-blog-link']");
    expect(link?.getAttribute("href")).toBe("https://blog.example.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(withBlog.querySelector("[data-testid='shell-help-link']")).not.toBeNull();

    const without = render(<Shortcuts blog={null} />);
    expect(without.querySelector("[data-testid='shell-blog-link']")).toBeNull();
    expect(without.querySelector("[data-testid='shell-help-link']")).not.toBeNull();
  });

  it("reports which of the shell's keys the owner still owes (rule 5.5)", () => {
    const SHELL_KEYS: CopyKey[] = [
      "shell.nav.overview",
      "shell.nav.plan",
      "shell.nav.settings",
      "shell.panel.label",
      "shell.panel.collapse",
      "shell.panel.open",
      "shell.waiting.head",
      "shell.waiting.goes-live",
      "shell.shortcut.blog",
      "shell.shortcut.help",
      "shell.publishing.mode.autopilot",
      "shell.domain.measured-weeks",
      "shell.domain.not-measured",
      "next-publish.scheduled",
      "next-publish.stopped",
      "next-publish.paused",
      "next-publish.being-written",
      "next-publish.none-planned",
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
    expect(COPY["shell.nav.plan"]).toBe("Plan");
    expect(COPY["shell.nav.settings"]).toBe("Settings");
  });
});
