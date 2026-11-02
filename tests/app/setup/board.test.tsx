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
    // #1737: the empty-group arm, which "a group nothing was read for" below reads on its own render.
    const arms = [{ string: "Nothing read for this yet. Add what we missed." }];
    const result = compare(html, textOf(await mount(step)), [...readAllow(board), ...arms]);
    expect(result.missing).toEqual([]);
  });
});

describe("Site, in the board's order and words", () => {
  it("the steps, the time once, the question, the lead, then the website, where the buyers are and the city, then Continue", async () => {
    const texts = textOf(await mount("site"));
    inOrder(texts, [
      "ReachKit",
      "Site",
      "Details",
      "Connect",
      "About 10 minutes, once",
      "Is this your business?",
      "We write every page from this site. Fix anything wrong.",
      "Your website",
      "example.com",
      "Change",
      "Where your buyers are",
      "United States · English",
      "Your pages are written in this language.",
      "City or area you serve",
      "Leave it empty if you sell nationwide or online.",
      "Continue",
    ]);
    const screen = texts.join("\n");
    for (const cut of ["Step 1 of 3", "What happens next", "You can cancel or export", "Your site\n", "Back"]) {
      expect(screen, cut).not.toContain(cut);
    }
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
  it("the steps, the status, the question, the lead, the read line, the four sections, then Back and Looks right", async () => {
    const texts = textOf(await mount("check"));
    inOrder(texts, [
      "Site",
      "Details",
      "Connect",
      "Checking your buyers and competitors · started ",
      "What we found on your site",
      "Open a section to change it, or carry on.",
      "example.com · 5 pages read",
      "Your business ",
      "We never invent prices, people or reviews. If a fact isn’t on your site, it won’t be in your pages.",
      "What you do",
      "What you sell",
      "Who you serve",
      "What you promise",
      "Your market and competitors ",
      "We read this from your site and update it every Monday. Change it only if it’s wrong.",
      "Competitors 4 of 5",
      "Add a competitor",
      "How your pages sound ",
      "How your pages sound",
      "Never say",
      "Five things only you know Answer any, or none.",
      "Optional. We use an answer in your pages as something you told us.",
      "Who buys from you, and why?",
      "Back",
      "Looks right",
    ]);
    const screen = texts.join("\n");
    for (const cut of ["Step 2 of 3", "What happens next", "Your site What we read Every page", "Your business read", "know optional"]) {
      expect(screen, cut).not.toContain(cut);
    }
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

  it("a market read from the report with no stated reason still names itself in the board's line", async () => {
    const root = await mount("check", { concluded: null });
    const line = root.querySelector('[data-testid="setup-market-concluded"] p')?.textContent;
    expect(line).toBe(
      `${FIXTURE_SETUP_FACTS.measured?.report.category}. We read this from your site and update it every Monday. Change it only if it’s wrong.`,
    );
  });

  it("D28 — Change sits on the market's line and opens the field filled, and a new category re-derives the twelve", async () => {
    const root = await mount("check");
    const category = FIXTURE_SETUP_FACTS.measured!.report.category;
    const change = root.querySelector('[data-testid="setup-market-concluded"] button');
    expect(change?.textContent).toBe(COPY["setup.market.change"]);
    await press(change);

    const field = root.querySelector<HTMLInputElement>('[data-testid="setup-market"] input[name="category"]');
    expect(field?.value).toBe(category);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, "time tracking software");
      field?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await press(root.querySelector('[data-testid="setup-market"] input[name="category"] + button'));

    const market = root.querySelector('[data-testid="setup-market"]');
    expect(market?.querySelector('input[name="category"]')).toBeNull();
    expect(market?.querySelector('[data-testid="setup-market-stated"] strong')?.textContent).toBe("time tracking software.");
    expect(market?.querySelector('[data-testid="setup-market-stated"] button')?.textContent).toBe(COPY["setup.market.change"]);
    const searches = [...(market?.querySelectorAll('[data-testid="setup-market-questions"] li') ?? [])].map((li) => li.textContent ?? "");
    expect(searches.some((text) => text.includes("time tracking software"))).toBe(true);
  });

  it("before the read lands, and a group nothing was read for, are said in the board's words", async () => {
    const texts = textOf(await mount("check", { measured: null, concluded: null, profile: null, market: null }));
    expect(texts).toContain("We’re still reading your site, so carry on. You can change what we find in Settings.");
    expect(texts).toContain("Nothing read for this yet. Add what we missed.");
  });
});

describe("the site's own mark beside its domain, on Site and Check", () => {
  const LOGO = "/scans/logo/example.com";
  const withLogo = { profile: { ...FIXTURE_SETUP_FACTS.profile!, hasLogo: true } };
  /** The row that holds the domain: Site's address well, or Check's read line. */
  const markRow = (root: HTMLElement, step: "site" | "check"): Element =>
    step === "site"
      ? root.querySelector('[data-testid="setup-address-value"]')!.parentElement!
      : root.querySelector('[data-testid="setup-check-read"]')!;

  it.each(["site", "check"] as const)("%s: a stored logo is drawn from our own origin beside the domain", async (step) => {
    const root = await mount(step, withLogo);
    const row = markRow(root, step);
    expect(row.querySelector("img")?.getAttribute("src")).toBe(LOGO);
    expect(row.querySelector("img")?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it.each(["site", "check"] as const)("%s: with no stored logo, the domain's first letter stands in its place", async (step) => {
    const root = await mount(step);
    const row = markRow(root, step);
    expect(row.querySelector("img")).toBeNull();
    expect(row.querySelector('[aria-hidden="true"].badge')?.textContent).toBe("E");
  });

  it("a logo read for another domain is not drawn beside a new one", async () => {
    const root = await mount("site", { profile: { ...FIXTURE_SETUP_FACTS.profile!, domain: "other.example", hasLogo: true } });
    expect(root.querySelector("img")).toBeNull();
  });
});
