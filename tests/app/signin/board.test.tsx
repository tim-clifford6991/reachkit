/** @vitest-environment jsdom */
// `/signin` and its sent and dead-link arms against boards AuthSignIn,
// AuthCheckEmail and AuthExpired: each arm rendered as the browser draws it,
// read with the parity check's own reader, and its end time on the reader's clock.
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

describe("each arm is one card, in the board's order and words", () => {
  it("sign in: the heading, the body, then the form card", async () => {
    inOrder(textOf(await inBrowser({})), [
      "Welcome back",
      "Enter the email you paid with. We’ll send you a sign-in link.",
      "Your email",
      "Send my sign-in link",
    ]);
  });

  it("check email: the answer, one card of three facts, the spam line, the way back", async () => {
    const html = await inBrowser({ state: SENT });
    inOrder(textOf(html), [
      "Check your inbox",
      "If that address has an account, a sign-in link is on its way.",
      "Sent to dana@harborplumbing.example",
      "Subject Your sign-in link",
      "Works until Tomorrow, 9:41 AM",
      "Not there in a minute? Check your spam folder.",
      "Use a different email",
    ]);
    const screen = document.createElement("div");
    screen.innerHTML = html;
    expect(screen.querySelectorAll(".card")).toHaveLength(1);
    expect(screen.querySelectorAll('[data-testid="signin-sent-facts"] > p')).toHaveLength(3);
  });

  it("expired: the heading, the lead that nothing changed, then the field under its own label", async () => {
    const { copy } = await import("@/lib/presentation/copy");
    const screen = document.createElement("div");
    screen.innerHTML = await inBrowser({ searchParams: { link: "dead" } });
    inOrder(textOf(screen.innerHTML), [
      "This link no longer works",
      "Links work for 24 hours, and only the newest one works. Nothing in your account changed.",
      "The email you paid with",
      "Send a new link",
    ]);
    expect(screen.querySelector("form label span")?.textContent).toBe(copy("signin.expired.field"));
    expect(screen.querySelectorAll(".card")).toHaveLength(1);
  });

  it.each([{}, { state: SENT }, { searchParams: { link: "dead" } }] as Arm[])(
    "no phone, no progress bar, no second column and no free-scan link on %j",
    async (arm) => {
      const screen = document.createElement("div");
      screen.innerHTML = await inBrowser(arm);
      expect(screen.querySelector(".mockup-phone, progress, aside")).toBeNull();
      expect(screen.textContent).not.toContain("Start a free scan");
    }
  );
});

describe("sign-in's board icons", () => {
  it("no icon on an idle submit, Send on the sent mark, Clock on the expired mark", async () => {
    const icons = (html: string, name: string): number => {
      const screen = document.createElement("div");
      screen.innerHTML = html;
      for (const svg of screen.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");
      return screen.querySelectorAll(`svg.lucide-${name}`).length;
    };
    const request = await inBrowser({});
    expect(request).not.toContain("<svg");
    expect(icons(await inBrowser({ state: SENT }), "send")).toBe(1);
    expect(icons(await inBrowser({ searchParams: { link: "dead" } }), "clock")).toBe(1);
  });

  it("a refused address marks the field and says why between it and the button", async () => {
    const screen = document.createElement("div");
    screen.innerHTML = await inBrowser({ state: { answer: "invalid", value: "dana@harborplumbing" } });
    expect(screen.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
    const line = screen.querySelector("label + p");
    expect(line?.textContent).toBe("That doesn’t look like an email address. Check it and try again.");
    expect(line?.querySelector("svg.lucide-circle-alert")).not.toBeNull();
    expect(line?.nextElementSibling?.tagName).toBe("BUTTON");
  });
});

describe("Works until is the reader's own clock, written by the browser", () => {
  it("the same send reads on each reader's clock", async () => {
    expect(textOf(await inBrowser({ state: SENT }, "America/New_York"))).toContain("Works until Tomorrow, 9:41 AM");
    expect(textOf(await inBrowser({ state: SENT }, "Asia/Tokyo"))).toContain("Works until Tomorrow, 10:41 PM");
  });

  it("a server render writes no time, so no zone is guessed", async () => {
    process.env.TZ = "America/New_York";
    const html = renderToStaticMarkup(await loadPage({ state: SENT }));
    expect(html).toContain("Works until");
    expect(html).not.toMatch(/\d:\d\d [AP]M/);
  });
});
