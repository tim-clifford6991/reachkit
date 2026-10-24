// tests/app/shell/first-response.test.tsx — SPEC §4 (2026-09-20, #908),
// issue 912.
//
// "No loading screens in the app: a route paints its shell and daisyUI
// `skeleton` placeholders at once and fills in."
//
// **This file measures "at once" rather than asserting it.** Every other
// test in this corpus renders a finished tree; the property this issue is
// about is *what arrives first*, which a finished tree cannot show. So each
// row below renders the real layout to a stream and reads **only the first
// chunk** — the bytes a browser has before any further round trip, and
// before any JavaScript of ours runs.
//
// The shell's reads are stubbed to promises that **never resolve**. That is
// the whole method: if the layout awaited any of them the stream would have
// no first chunk at all, and every assertion below would time out rather
// than pass. What the chunk contains is therefore exactly what a customer
// on a slow connection sees while the database is still thinking — the
// done-when's "throttled to slow 3G, no `/app` navigation shows a blank or
// text-only wait", asked as a question a test can answer.
//
// **Why the session read is not stubbed away.** It is the one read the
// layout still waits for, and deliberately: it decides whether a stranger
// should see this frame at all (`layout.tsx` says why). It is stubbed to
// *resolve*, because a signed-in customer is the case being measured.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";
import { renderToReadableStream } from "react-dom/server";

const account = {
  siteId: "site-1",
  domain: "example.com",
  timeZone: "America/New_York",
  mode: "autopilot" as const,
  createdAt: new Date(Date.UTC(2026, 8, 1)),
};

/** A promise that never settles: the database, still thinking. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

// The menu marks the current destination from the pathname, which has no
// router in a test process.
const at = { pathname: "/app" };
vi.mock("next/navigation", () => ({
  usePathname: () => at.pathname,
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

vi.mock("@/app/(account)/app/_session/account", () => ({
  requireSetUpAccount: async () => account,
  requireAppAccount: async () => account,
  isReservedFixtureAccount: () => false,
}));
vi.mock("@/app/(account)/app/_shell/provider", () => ({
  readShell: () => pending(),
}));
vi.mock("@/app/(account)/app/_shell/onboarding", () => ({
  readOnboarding: () => pending(),
  readReleaseNotice: () => pending(),
  overviewNotice: () => null,
}));
vi.mock("@/app/(account)/app/_shell/nonce", () => ({
  cspNonce: async () => "test-nonce",
}));

const { default: AppLayout } = await import("@/app/(account)/app/layout");
const { default: OverviewLoading } = await import("@/app/(account)/app/(tabs)/loading");
const { default: SearchLoading } = await import("@/app/(account)/app/(tabs)/search/loading");
const { default: RivalsLoading } = await import("@/app/(account)/app/(tabs)/rivals/loading");
const { default: AiAnswersLoading } = await import(
  "@/app/(account)/app/(tabs)/ai-answers/loading"
);
const { default: CalendarLoading } = await import("@/app/(account)/app/calendar/loading");
const { default: DraftLoading } = await import("@/app/(account)/app/draft/[draftId]/loading");
const { default: SettingsLoading } = await import("@/app/(account)/app/settings/loading");

beforeEach(() => {
  // React logs a warning for every boundary it leaves unresolved when a
  // stream is cancelled. Cancelling is the point of this file.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

/**
 * Everything the server can send for one screen **before any read answers**.
 *
 * Not "the first chunk": React flushes a response in several, and a chunk
 * boundary is an artefact of buffer sizes rather than of anything a
 * customer experiences. What matters is the *first response* — the bytes
 * that arrive with no further round trip — so this drains the stream until
 * it goes quiet.
 *
 * Quiet is the measurement. Every read in this file is a promise that never
 * settles, so the moment the stream stops producing is the moment it has
 * emitted everything that did not need the database. Anything asserted
 * below is therefore in the response by construction; anything that needed
 * a read cannot be, which the last test in this file checks from the other
 * side.
 */
async function firstResponse(screen: React.ReactNode): Promise<string> {
  const tree = await AppLayout({ children: screen });
  const stream = await renderToReadableStream(tree);
  const reader = stream.getReader();
  let html = "";
  for (;;) {
    const next = await Promise.race([
      reader.read(),
      // Idle: nothing more is coming without a read answering.
      new Promise<{ done: true; value: undefined }>((yes) =>
        setTimeout(() => yes({ done: true, value: undefined }), 250)
      ),
    ]);
    if (next.done || next.value === undefined) break;
    html += new TextDecoder().decode(next.value);
  }
  await reader.cancel();
  if (html === "") throw new Error("nothing was sent — the layout is awaiting a read");
  return html;
}

/** Every signed-in screen, by its address, with the waiting state Next
 *  serves for it while its own read is in flight. */
const SCREENS = [
  { path: "/app", screen: <OverviewLoading />, holds: "waiting-page-skeleton" },
  { path: "/app/search", screen: <SearchLoading />, holds: "search-table-skeleton" },
  { path: "/app/rivals", screen: <RivalsLoading />, holds: "rival-table-skeleton" },
  { path: "/app/ai-answers", screen: <AiAnswersLoading />, holds: "ai-pages-skeleton" },
  { path: "/app/calendar", screen: <CalendarLoading />, holds: "plan-skeleton" },
  { path: "/app/draft/{id}", screen: <DraftLoading />, holds: "page-skeleton" },
  { path: "/app/settings", screen: <SettingsLoading />, holds: "settings-panel-skeleton" },
];

describe("the shell is in the first server response, on every signed-in screen", () => {
  it.each(SCREENS)("$path — the frame is there before any read answers", async ({ path, screen }) => {
    at.pathname = path;
    const first = await firstResponse(screen);
    // The drawer, the screen root and the content well: the frame itself.
    expect(first).toContain("drawer");
    expect(first).toContain("data-surface");
    expect(first).toContain("<main");
    // The side panel, which is where a customer looks to go somewhere else.
    expect(first).toContain('data-testid="shell-sidebar"');
  });

  it.each(SCREENS)("$path — all three menu items are in it, not a skeleton of them", async ({ path, screen }) => {
    at.pathname = path;
    const first = await firstResponse(screen);
    // The point of the count travelling as a promise: the links have no
    // read behind them, so they are *here*, in the first bytes, and only
    // the badge waits. A menu a customer cannot use until the database
    // answers is the loading screen this issue removes.
    for (const destination of ["overview", "calendar", "settings"]) {
      expect(first, destination).toContain(`data-testid="shell-navlink-${destination}"`);
      expect(first, destination).toContain(`data-testid="shell-docklink-${destination}"`);
    }
  });

  it.each(SCREENS)("$path — its own first content is in it too", async ({ path, screen, holds }) => {
    at.pathname = path;
    const first = await firstResponse(screen);
    // Not "a screen is loading" — *this* screen's own boxes, in its own
    // order. `holds` is the card that tells this screen from the others.
    expect(first).toContain(`data-testid="${holds}"`);
    expect(first).toContain("skeleton");
  });

  it.each(SCREENS)("$path — nothing in it is a spinner, a bar or a blank wait", async ({ path, screen }) => {
    at.pathname = path;
    const first = await firstResponse(screen);
    expect(first).not.toContain("loading-spinner");
    expect(first).not.toContain("<progress");
    // A text-only wait is the other half of the done-when. The old single
    // `app/loading.tsx` drew exactly this and nothing else.
    expect(first).not.toContain("Loading…");
  });

  it.each(SCREENS)("$path — the wait is announced, once per region", async ({ path, screen }) => {
    at.pathname = path;
    const first = await firstResponse(screen);
    expect(first).toContain('role="status"');
    expect(first).toContain('aria-busy="true"');
    expect(first).toContain("data-waiting");
  });
});

describe("the parts that do have a read behind them hold their place", () => {
  it("the panel's cards are skeletons in the first response, not gaps", async () => {
    const first = await firstResponse(<OverviewLoading />);
    // Each is the box of the card that is coming, so the panel does not
    // reflow around the customer while they are reading the menu.
    for (const held of [
      "shell-domain-skeleton",
      "shell-waiting-skeleton",
      "shell-onboarding-skeleton",
      "shell-publishing-skeleton",
      "shell-top-skeleton",
    ]) {
      expect(first, held).toContain(`data-testid="${held}"`);
    }
  });

  it("and none of them has resolved — this is the picture before the database answers", async () => {
    const first = await firstResponse(<OverviewLoading />);
    // The proof that the measurement above measured anything: the real
    // cards are *not* here. Every read behind them is a promise that never
    // settles in this file, so a frame containing them would mean the
    // assertions above were passing on a finished render.
    expect(first).not.toContain('data-testid="shell-domain"');
    expect(first).not.toContain('data-testid="shell-publishing"');
    expect(first).not.toContain('data-testid="shell-waiting-count"');
  });
});
