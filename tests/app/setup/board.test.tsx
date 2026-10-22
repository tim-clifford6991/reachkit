/** @vitest-environment jsdom */
// `/setup`'s Site and Check steps against boards Setup1 and Setup2: each step
// rendered as the browser draws it, read with the parity check's own reader,
// and each state the board draws beside it reached on the rendered screen.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import type { SetupFacts } from "@/app/(account)/setup/_setup/facts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), redirect: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { SetupForm } = await import("@/app/(account)/setup/SetupForm");
const { assembleSetup } = await import("@/app/(account)/setup/_setup/facts");
const { FIXTURE_SETUP_FACTS } = await import("@/app/(account)/setup/_setup/fixture");
const { COPY } = await import("@/lib/presentation/copy");

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  vi.unstubAllGlobals();
});

/** The step as a browser shows it once the page runs. */
async function mount(step: "site" | "check", over: Partial<SetupFacts> = {}): Promise<HTMLElement> {
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  await act(async () =>
    root.render(
      <NuqsTestingAdapter searchParams={{ step }}>
        <SetupForm model={assembleSetup({ ...FIXTURE_SETUP_FACTS, ...over })} />
      </NuqsTestingAdapter>,
    ),
  );
  return container;
}

async function press(el: Element | null | undefined): Promise<void> {
  await act(async () => (el as HTMLElement).click());
}

/** The visible strings in reading order, as one string per block. */
const textOf = (root: HTMLElement): string[] => segments(root.innerHTML);

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

describe("Site and Check match their boards string for string", () => {
  it.each([
    ["Setup1", "site"],
    ["Setup2", "check"],
  ] as const)("%s: nothing the board draws is missing but its allowed sample data and states", async (board, step) => {
    const html = readFileSync(boardFile(board), "utf8");
    const result = compare(html, textOf(await mount(step)), readAllow(board));
    expect(result.missing).toEqual([]);
  });
});

describe("Site, in the board's order and words", () => {
  it("the steps, where the founder is, the question, the lead, the three questions and the preview, then what happens next", async () => {
    inOrder(textOf(await mount("site")), [
      "ReachKit",
      "Site",
      "Check",
      "Connect",
      "Step 1 of 3 about 10 minutes, once",
      "Is this your business?",
      "Your free scan read this site. We write every page for it, so fix anything wrong now.",
      "Your site",
      "Your website",
      "example.com",
      "Change",
      "The site your free report checked. Keep it, or change it.",
      "Where your buyers are, and the language they search in",
      "Read from your site. Your pages are written in that language.",
      "The city or area you serve",
      "Leave it empty if you sell across the country or online. A local business is checked where it works.",
      "United States · in English We check what buyers here search and ask AI, and who they find instead of you.",
      "What happens next",
      "1 Confirm your site you are here Where your buyers are.",
      "2 Check what we read Fix anything wrong, or carry on.",
      "3 Connect your website One setting, copied from us.",
      "After this, nothing to do Pages go live on their day. A Monday email shows what moved.",
      "Back",
      "Continue",
      "You can reach Settings, cancel or export at any time, without finishing setup.",
    ]);
  });

  it("an address that does not resolve is refused in the board's words", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ domain: "nope.example", resolves: false, report: null })));
    const root = await mount("site");
    await press([...root.querySelectorAll("button")].find((b) => b.textContent === COPY["setup.address.change"]));
    const field = root.querySelector<HTMLInputElement>('input[name="domain"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, "nope.example");
      field?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await press([...root.querySelectorAll("button")].find((b) => b.textContent === COPY["setup.address.change"]));
    await vi.waitFor(() => expect(root.querySelector('[role="alert"]')?.textContent).toBe(COPY["setup.address.refused.unreachable"]));
  });

  it("a save that never came back is said in the board's words, and the step stays", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const root = await mount("site");
    await press(root.querySelector('[data-testid="setup-onwards"]'));
    await vi.waitFor(() =>
      expect(root.querySelector('[data-testid="setup-submit-refusal"]')?.textContent).toBe(COPY["setup.refused.could-not-ask"]),
    );
    expect(root.querySelector('[data-testid="setup-form"]')?.getAttribute("data-step")).toBe("site");
  });
});

describe("Check, in the board's order and words", () => {
  it("the status, where the founder is, the question, the lead, the figure, the four sections, then what happens next", async () => {
    inOrder(textOf(await mount("check")), [
      "Site",
      "Check",
      "Connect",
      "Checking your buyers and competitors · started ",
      "Step 2 of 3 about 10 minutes, once",
      "Here’s what we read",
      "Every page we write uses this. Open a section to change it, or carry on.",
      "example.com 5 pages read",
      "Your site What we read Every page",
      "Your business read ",
      "We never invent prices, people or reviews. If a fact isn’t on your site, it won’t be in your pages.",
      "What you do",
      "What you sell",
      "Who you serve",
      "What you promise",
      "Your market and competitors read ",
      "ReachKit read this from your site and keeps it current each week. Change it only if it’s wrong.",
      "Competitors 4 of 5",
      "Add a competitor",
      "Your voice read ",
      "How your pages sound",
      "Things we should never say about you",
      "Five things only you know optional Answer any, or none.",
      "Optional. We use an answer in your pages as something you told us.",
      "Who buys from you, and why?",
      "What happens next",
      "Confirm your site Where your buyers are.",
      "2 Check what we read you are here Fix anything wrong, or carry on.",
      "After this, nothing to do",
      "Back",
      "Looks right",
    ]);
  });

  it("the pass's start is on the reader's clock, and no line is drawn with no pass running", async () => {
    const zone = process.env.TZ;
    process.env.TZ = "America/Chicago";
    try {
      const line = (await mount("check")).querySelector('[data-testid="setup-check-status"]')?.textContent;
      // 09:31 UTC on 5 September is 4:31 AM in Chicago.
      expect(line).toBe("Checking your buyers and competitors · started 4:31 AM");
    } finally {
      process.env.TZ = zone;
    }
    expect((await mount("check", { passStartedAt: null })).querySelector('[data-testid="setup-check-status"]')).toBeNull();
  });

  it("before the read lands, and a group nothing was read for, are said in the board's words", async () => {
    const texts = textOf(await mount("check", { measured: null, concluded: null, profile: null, market: null }));
    expect(texts).toContain("We’re still reading your site. Carry on. What we find shows in Settings, where you can change it.");
    expect(texts).toContain("Nothing read for this yet. Add what we missed.");
  });
});
