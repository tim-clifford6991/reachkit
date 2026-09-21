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
// **Calendar left the shared table on 2026-09-05 (issue #16)**, and came
// back to its idiom on 2026-09-20 (issue #914). SPEC §4 of that date makes
// *Plan* the calendar's on-screen name, so the screen heads itself with the
// destination's nav word again — `shell.nav.plan` — and `calendar.head`
// (the owner's sentence of 2026-09-11, #516) is the subordinate line under
// it, exactly as `settings.head` is under Settings. What still keeps it out
// of the shared table is its `searchParams` prop for the month switcher.
// The contract it inherits is unchanged and is asserted for it below, in
// its own block.
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// Settings' heading and its one written line moved into its own sub-layout
// when the screen became seven tabs (#925), and the bar in that layout reads
// the pathname to mark the current tab. There is no router in a
// `renderToStaticMarkup` call, so the one hook it uses is answered here with
// the address the Settings block below renders — everything else
// `next/navigation` exports is left alone, because Calendar and the Overview
// in this same file use it for real.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, usePathname: () => "/app/settings" };
});

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

import { COPY, type CopyKey } from "@/lib/presentation/copy";
import OverviewPage from "@/app/(account)/app/(tabs)/page";
import CalendarPage from "@/app/(account)/app/calendar/page";
import SettingsPage from "@/app/(account)/app/settings/page";
import SettingsLayout from "@/app/(account)/app/settings/layout";

// BUILD §4.4–§4.6, issue #169 — the surfaces under test now resolve who is
// asking through `_session/account.ts`, which reads a signed cookie and a
// `sites` row. This suite has neither, so it signs in as the reserved
// fixture account: the surfaces then take the same fixture branch they
// always took, and what changed is only how they learned whose it is.
import { resetAccount, signedInAs } from "../account-door";

beforeEach(() => signedInAs());
afterEach(() => resetAccount());


const APP_DIR = path.resolve(import.meta.dirname, "../../../src/app/(account)/app");

async function markup(el: React.ReactElement | Promise<React.ReactElement>): Promise<string> {
  return renderToStaticMarkup(await el);
}

// ── Calendar, which is no longer a placeholder (issue #16, BUILD §4.6) ────
describe("calendar — the built screen keeps the three contracts the frame set", () => {
  async function calendarMarkup(): Promise<string> {
    return markup(await CalendarPage({ searchParams: Promise.resolve({}) }));
  }

  it("renders, and names itself from the destination's own registry key", async () => {
    // SPEC §4 (2026-09-20, #914): "*Plan* is the calendar's on-screen
    // name." The heading is the nav word; §4.6's own line is what stands
    // under it, so neither is lost.
    const html = await calendarMarkup();
    expect(html).toMatch(/<h1[^>]*>shell\.nav\.plan<\/h1>/);
    expect(html).toMatch(/<p[^>]*>calendar\.head<\/p>/);
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
  /** The screen as a customer reaches it: the sub-layout that draws the
   *  heading, the written line and the seven-tab bar (#925), around the tab
   *  that address lands on. Rendering the page alone would assert against
   *  two thirds of the screen and report the heading missing. */
  async function settingsMarkup(): Promise<string> {
    return markup(<SettingsLayout>{await SettingsPage()}</SettingsLayout>);
  }

  it("renders, and names itself from the destination's own registry key", async () => {
    // Unlike Calendar, §4.7 gives this screen no head line of its own, so the
    // nav word is still its name.
    expect(await settingsMarkup()).toContain("<h1>shell.nav.settings</h1>");
  });

  it("declares no Surface — the shell's layout owns this route's screen root", async () => {
    // Both halves of the screen: the tab, and the sub-layout that frames all
    // seven of them (#925). Exactly one `[data-surface]` per document, and
    // the shell one level up is what declares it.
    for (const file of ["settings/page.tsx", "settings/layout.tsx"]) {
      const source = readFileSync(path.join(APP_DIR, file), "utf8");
      expect(source, file).not.toMatch(/from\s+["']@\/ui\/layout/);
      expect(source, file).not.toContain("<Surface");
    }
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
    const source = readFileSync(path.join(APP_DIR, "(tabs)", "page.tsx"), "utf8");
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
