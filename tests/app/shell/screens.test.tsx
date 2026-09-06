/** @vitest-environment jsdom */
// tests/app/shell/screens.test.tsx — BUILD §4.4, and the three screens the
// shell frames: BUILD §4.5 Overview, BUILD §4.6 Calendar, BUILD §4.7
// Settings.
//
// Issue #9 builds the frame, not the screens: Overview's chart and tiles are
// #15's, the calendar grid and day panel are #16's (and #10's), and the
// settings cards are #18's. What this file holds is the contract those three
// builds inherit and must not break —
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
// `SCREENS` is down to Overview, the last of the three still a placeholder
// (#15). The table stays rather than being inlined: the contract is the
// frame's, and the next screen to be built should have to leave it
// deliberately, as these two did.
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

const SCREENS = [
  { name: "overview", file: "page.tsx", Page: OverviewPage, nav: "shell.nav.overview", head: "overview.head" },
] as const satisfies readonly {
  name: string;
  file: string;
  Page: () => React.JSX.Element;
  nav: CopyKey;
  head: CopyKey;
}[];

function markup(el: React.ReactElement): string {
  return renderToStaticMarkup(el);
}

describe.each(SCREENS)("$name — the screen renders inside the shell", ({ file, Page, nav, head }) => {
  it("renders, and names itself from the destination's own registry key", () => {
    const html = markup(<Page />);
    expect(html).toContain(`<h1>${nav}</h1>`);
  });

  it("declares no Surface — the shell's layout owns this route's screen root", () => {
    // By source (the import is the only way to reach it) and by output.
    const source = readFileSync(path.join(APP_DIR, file), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/ui\/layout/);
    expect(source).not.toContain("<Surface");
    expect(markup(<Page />)).not.toContain("data-surface");
  });

  it("speaks only through the registry: the head line resolves from its key, or not at all", () => {
    const html = markup(<Page />);
    if (COPY[head] === "") {
      // Owner-owed: nothing is written in its place. Not a placeholder, not
      // the key, not an empty paragraph.
      expect(html).not.toContain(head);
      expect(html).not.toContain("<p>");
    } else {
      expect(html).toContain(`<p>${head}</p>`);
    }
  });

  it("its head key exists in the registry, so filling it is the whole change", () => {
    expect(Object.keys(COPY)).toContain(head);
  });
});

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
