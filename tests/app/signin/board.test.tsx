/** @vitest-environment jsdom */
// `/signin` and its sent and dead-link arms against boards AuthSignIn,
// AuthCheckEmail and AuthExpired: each arm rendered as the browser draws it,
// read with the parity check's own reader, and its times on the reader's clock.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SignInState } from "@/app/(public)/signin/state";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import { applyEnvFixture } from "../../mail/env-fixture";
import { expectStateParity } from "../../ui/layout/state-parity";

applyEnvFixture();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 13:41 UTC: 9:41 AM in New York in October, as every board draws it. */
const SENT_AT = Date.UTC(2026, 9, 21, 13, 41);
const SENT: SignInState = { answer: "requested", value: "dana@harborplumbing.example", sentAt: SENT_AT };
const ZONE = process.env.TZ;

type Arm = { state?: SignInState; searchParams?: { link?: string } };

async function loadPage(arm: Arm) {
  vi.resetModules();
  if (arm.state) {
    const state = arm.state;
    vi.doMock("@/app/(public)/signin/state", async (importOriginal) => ({
      ...(await importOriginal<Record<string, unknown>>()),
      SIGN_IN_INITIAL: state,
    }));
  }
  const { default: SignInPage } = (await import("@/app/(public)/signin/page.tsx")) as {
    default: (p: { searchParams?: { link?: string } }) => React.JSX.Element;
  };
  vi.doUnmock("@/app/(public)/signin/state");
  return <SignInPage searchParams={arm.searchParams ?? {}} />;
}

/** The arm as a browser shows it once the page runs. */
async function inBrowser(arm: Arm, zone = "America/New_York"): Promise<string> {
  process.env.TZ = zone;
  const page = await loadPage(arm);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(page));
  const html = container.innerHTML;
  act(() => root.unmount());
  return html;
}

/** The board's own screen, without the public chrome the page sweep reads on the live route. */
function boardMain(board: string): string {
  const html = readFileSync(boardFile(board), "utf8");
  return html.slice(html.indexOf("<main>"), html.indexOf("</main>") + "</main>".length);
}

/** The visible strings in reading order, as one string per block. */
const textOf = (html: string): string[] => segments(html);

/** Each string is on the screen, and in the order given. */
function inOrder(texts: string[], wanted: string[]): void {
  const screen = texts.join("\n");
  let from = 0;
  for (const want of wanted) {
    const at = screen.indexOf(want, from);
    expect(at, `"${want}" is not on the screen after "${screen.slice(Math.max(0, from - 60), from)}"`).toBeGreaterThanOrEqual(0);
    from = at + want.length;
  }
}

afterEach(() => {
  process.env.TZ = ZONE;
});

describe("each arm matches its board's screen string for string", () => {
  it("AuthSignIn: nothing the board draws is missing", async () => {
    const result = compare(boardMain("AuthSignIn"), textOf(await inBrowser({})), readAllow("AuthSignIn"));
    expect(result.missing).toEqual([]);
  });

  it("parity: AuthCheckEmail reads its rendered arms", async () => {
    expectStateParity("AuthCheckEmail", [await inBrowser({ state: SENT })]);
  });

  it("parity: AuthExpired reads its rendered arms", async () => {
    expectStateParity("AuthExpired", [await inBrowser({ searchParams: { link: "dead" } })]);
  });
});

describe("each section is on the screen in the board's order and words", () => {
  it("sign in: the body, the two facts under the button, then how signing in works in three steps", async () => {
    inOrder(textOf(await inBrowser({})), [
      "Enter the email you paid with. We’ll send you a sign-in link.",
      "Send my sign-in link",
      "no password link works 24 hours",
      "New to ReachKit?",
      "Start a free scan →",
      "How signing in works",
      "Type your email",
      "The one you paid with.",
      "Open the link we send",
      "Subject: “Your sign-in link”.",
      "You’re in",
      "On your Overview, with this week’s pages.",
    ]);
  });

  it("check email: sent to, the 24 hours and its strip, the terms, the inbox, inside the email", async () => {
    inOrder(textOf(await inBrowser({ state: SENT })), [
      "Sent to dana@harborplumbing.example",
      "The link works for 24 hours",
      "Sent 9:41 AM Works until tomorrow, 9:41 AM",
      "A newer link replaces an older one. Not there in a minute? Check your spam folder.",
      "Use a different email",
      "Your sign-in link Sign in to ReachKit. The link works for 24 hours. Press it on any device.",
      "Your inbox",
      "Inside the email",
      "Press it on any device. You land on your Overview.",
    ]);
  });

  it("expired: the body, why links stop working in two figures, and that nothing changed", async () => {
    inOrder(textOf(await inBrowser({ searchParams: { link: "dead" } })), [
      "Sign-in links work for 24 hours, and only the newest one works. Ask for a new one below. It goes to the email you paid with.",
      "Send a new link",
      "Why links stop working",
      "Each link works for 24 hours",
      "Sent 24 hours later: stops working",
      "Only the newest link works",
      "Older link",
      "no longer works",
      "Newest link",
      "works for 24 hours",
      "Nothing in your account changed. Your pages carry on as planned.",
    ]);
  });
});

describe("sign-in's board icons", () => {
  it("Send on the submit, a Check per assurance, an arrow between the steps", async () => {
    const screen = document.createElement("div");
    screen.innerHTML = await inBrowser({});
    const icons = (el: Element | null | undefined, name: string): number => el?.querySelectorAll(`svg.lucide-${name}`).length ?? 0;
    const submit = screen.querySelector('form button[type="submit"]');
    expect([icons(submit, "send"), icons(submit, "arrow-right")]).toEqual([1, 0]);
    const assurances = [...screen.querySelectorAll("form p")].find((p) => p.textContent?.includes("no password"));
    expect([...assurances!.children].map((chip) => [icons(chip, "check"), chip.querySelectorAll("svg").length])).toEqual([
      [1, 1],
      [1, 1],
    ]);
    const steps = [...screen.querySelectorAll('section[aria-labelledby="signin-how"] ol > li')];
    expect(steps.map((step) => icons(step, "arrow-right"))).toEqual([1, 1, 0]);
    for (const svg of screen.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("the times are the reader's own, written by the browser", () => {
  it("the same send reads on each reader's clock", async () => {
    expect(textOf(await inBrowser({ state: SENT }, "America/New_York"))).toContain(
      "Sent 9:41 AM Works until tomorrow, 9:41 AM"
    );
    expect(textOf(await inBrowser({ state: SENT }, "Asia/Tokyo"))).toContain(
      "Sent 10:41 PM Works until tomorrow, 10:41 PM"
    );
  });

  it("a server render writes no time, so no zone is guessed", async () => {
    process.env.TZ = "America/New_York";
    const html = renderToStaticMarkup(await loadPage({ state: SENT }));
    expect(html).toContain("The link works for 24 hours");
    expect(html).not.toMatch(/\d:\d\d [AP]M/);
  });
});
