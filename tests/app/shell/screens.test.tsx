/** @vitest-environment jsdom */
// tests/app/shell/screens.test.tsx — BUILD §4.4, and the three screens the
// shell frames: BUILD §4.5 Overview, BUILD §4.6 Calendar, BUILD §4.7
// Settings.
//
// Issue #9 built the frame, not the screens: the calendar grid and day panel
// are #16's (and #10's) and the settings cards are #18's. Overview's own
// content landed with #15, so it is no longer one of the placeholder screens
// this file sweeps — its five modules are covered by `tests/app/overview/`,
// and the two contract rows it still owes the shell (no `Surface` of its
// own, no sentence of its own) are asserted for it separately below.
//
// What this file holds is the contract those builds inherit and must not
// break —
//
//   1. each destination has a route, and it renders;
//   2. no page declares a `Surface` of its own, because the shell's layout
//      owns the route's one screen root (ADR-093 decision 6's sweep asserts
//      exactly one `[data-surface]` per document, and would catch a second
//      only in a browser run);
//   3. no page writes a sentence — every word comes from the registry, and a
//      line the owner has not written renders as nothing rather than as a
//      placeholder.
//
// **Calendar left the shared table on 2026-09-05 (issue #16).** Its screen is
// built, so it no longer heads itself with the destination's nav word and it
// no longer renders `calendar.head` as a subordinate line — §4.6 gives it a
// head of its own ("One page a day. Every day.") and a `searchParams` prop
// for the month switcher, so it can neither be rendered nor asserted by the
// same three rows as the two placeholders. The contract it inherits is
// unchanged and is asserted for it below, in its own block.
//
// **Settings left it on 2026-09-05 too (issue #18).** Same reason, one
// difference: §4.7 gives the screen no head line of its own, so it keeps
// naming itself with the destination's nav word and keeps `settings.head` as
// the subordinate line — what it can no longer do is share the table's
// rendering, because it is an async Server Component (it awaits `readSettings`)
// and the table renders its rows synchronously. Its block below therefore
// awaits the page to a tree and renders it second, exactly as
// `frame.test.tsx` already does for the layout. The head-line assertion also
// stops reading "the document contains no `<p>` at all" as "no placeholder
// paragraph": that was a fair proxy on a screen whose whole body was one line,
// and is false on one with eight cards. It now says what it meant.
//
// **Overview left it on 2026-09-05 as well (issue #15), and it was the
// last one.** §4.5 gives the screen five modules and an async read, so it
// can no more be rendered by the table's synchronous row than Settings
// could; and its head is `OVERVIEW_HEAD[direction]`, one of four lines the
// measured direction selects, rather than the single `overview.head` the
// table asserted. Where none of the four is written it falls back to the
// destination's nav word, so the document is never headless — which is the
// one thing the table's first row was really holding.
//
// With that, **the table is gone**: all three destinations are built, and
// §4.4 closes the navigation at three ("No other navigation"), so there is
// no fourth screen left to inherit it. The contract is still the frame's
// and is still asserted three times — once per screen, in its own block
// below, because each screen now renders differently enough that a shared
// row could only assert what they have in common by asserting almost
// nothing.
//
// `copy()` is mocked to `(key) => key` and `COPY` is left real, the same
// convention `frame.test.tsx` uses and for the same reason.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

import { COPY, type CopyKey } from "@/lib/presentation/copy";
import OverviewPage from "@/app/(account)/app/page";
import CalendarPage from "@/app/(account)/app/calendar/page";
import SettingsPage from "@/app/(account)/app/settings/page";

const APP_DIR = path.resolve(import.meta.dirname, "../../../src/app/(account)/app");

async function markup(el: React.ReactElement | Promise<React.ReactElement>): Promise<string> {
  return renderToStaticMarkup(await el);
}

// ── Calendar, which is no longer a placeholder (issue #16, BUILD §4.6) ────
describe("calendar — the built screen keeps the three contracts the frame set", () => {
  async function calendarMarkup(): Promise<string> {
    return markup(await CalendarPage({ searchParams: Promise.resolve({}) }));
  }

  it("renders, and heads itself with §4.6's own line rather than the nav word", async () => {
    const html = await calendarMarkup();
    expect(html).toContain("<h1>calendar.head</h1>");
    expect(html).not.toContain("<h1>shell.nav.calendar</h1>");
  });

  it("declares no Surface — the shell's layout owns this route's screen root", async () => {
    const source = readFileSync(path.join(APP_DIR, "calendar/page.tsx"), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/ui\/layout/);
    expect(source).not.toContain("<Surface");
    expect(await calendarMarkup()).not.toContain("data-surface");
  });

  it("its head key exists in the registry, so filling it is the whole change", () => {
    expect(Object.keys(COPY)).toContain("calendar.head" satisfies CopyKey);
  });
});

// ── Settings, which is no longer a placeholder (issue #18, BUILD §4.7) ────
describe("settings — the built screen keeps the three contracts the frame set", () => {
  async function settingsMarkup(): Promise<string> {
    return markup(await SettingsPage());
  }

  it("renders, and names itself from the destination's own registry key", async () => {
    // Unlike Calendar, §4.7 gives this screen no head line of its own, so the
    // nav word is still its name.
    expect(await settingsMarkup()).toContain("<h1>shell.nav.settings</h1>");
  });

  it("declares no Surface — the shell's layout owns this route's screen root", async () => {
    const source = readFileSync(path.join(APP_DIR, "settings/page.tsx"), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/ui\/layout/);
    expect(source).not.toContain("<Surface");
    expect(await settingsMarkup()).not.toContain("data-surface");
  });

  it("speaks only through the registry: the head line resolves from its key, or not at all", async () => {
    const html = await settingsMarkup();
    if (COPY["settings.head" satisfies CopyKey] === "") {
      // Owner-owed: nothing is written in its place. Not a placeholder, not
      // the key, and not an empty paragraph — which is the assertion the
      // placeholder-era "no `<p>` at all" was standing in for.
      expect(html).not.toContain("settings.head");
      expect(html).not.toContain("<p></p>");
    } else {
      expect(html).toContain("<p>settings.head</p>");
    }
  });

  it("its head key exists in the registry, so filling it is the whole change", () => {
    expect(Object.keys(COPY)).toContain("settings.head" satisfies CopyKey);
  });
});

// ── Overview (#15) — built out, and still inside the shell ─────────────────
//
// The two rows every screen under `/app` owes the frame, asserted against
// the screen that now has content of its own. The five modules themselves —
// the head's direction, the growth break, the three tiles, both rival arms,
// the strip and the alert cap — are `tests/app/overview/`'s.
describe("overview — the built screen still keeps the shell's contract", () => {
  it("declares no Surface — the shell's layout owns this route's screen root", async () => {
    const source = readFileSync(path.join(APP_DIR, "page.tsx"), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/ui\/layout/);
    expect(source).not.toContain("<Surface");
    expect(await markup(OverviewPage())).not.toContain("data-surface");
  });

  it("renders, and is headed by a key from the registry", async () => {
    const html = await markup(OverviewPage());
    // `copy()` is mocked to the identity above, so the heading is whichever
    // key the head resolved to — the direction's own line where the owner
    // has written it, and the destination's name where they have not.
    expect(html).toMatch(/<h1>[a-z.\-]+<\/h1>/);
    expect(html).toContain('data-testid="overview"');
  });

  it("its head keys all exist in the registry, so filling one is the whole change", () => {
    const HEAD_KEYS: CopyKey[] = [
      "overview.head",
      "overview.head.rising",
      "overview.head.flat",
      "overview.head.falling",
      "overview.head.badge",
    ];
    for (const key of HEAD_KEYS) expect(Object.keys(COPY)).toContain(key);
  });
});
