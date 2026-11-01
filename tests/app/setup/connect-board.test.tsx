/** @vitest-environment jsdom */
// Setup's Connect step and the time-zone screen against boards Setup and
// SetupZone: each screen rendered as the browser draws it, read with the
// parity check's own reader, and each string in the board's order.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import { expectStateParity } from "../../ui/layout/state-parity";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), redirect: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { SetupForm } = await import("@/app/(account)/setup/SetupForm");
const { ConnectScreen } = await import("@/app/(account)/setup/connect/ConnectScreen");
const { ZoneScreen } = await import("@/app/(account)/setup/zone/ZoneScreen");
const { assembleSetup } = await import("@/app/(account)/setup/_setup/facts");
const { FIXTURE_SETUP_FACTS } = await import("@/app/(account)/setup/_setup/fixture");
const { COPY } = await import("@/lib/presentation/copy");

const HOST = "content.example.com";
const RECORD = { type: "CNAME", name: HOST, value: "edge.example.net" } as const;

const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  vi.useRealTimers();
});

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(node));
  return container;
}

/** Step 3 of `/setup`, as the browser shows it. */
const connectStep = (): Promise<HTMLElement> =>
  mount(
    <NuqsTestingAdapter searchParams={{ step: "publishing" }}>
      <SetupForm model={assembleSetup(FIXTURE_SETUP_FACTS)} />
    </NuqsTestingAdapter>,
  );

/** `/setup/connect` as the server sends it: the record's provider lookup runs only in a browser. */
function connectScreen(): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<ConnectScreen hostname={HOST} record={RECORD} />);
  return container;
}

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

describe("Connect matches board Setup string for string", () => {
  it("nothing the board draws is missing but its allowed sample data, rulings and states", async () => {
    const html = readFileSync(boardFile("Setup"), "utf8");
    const result = compare(html, [...textOf(await connectStep()), ...textOf(connectScreen())], readAllow("Setup"));
    expect(result.missing).toEqual([]);
  });

  it("step 3: the head, then where pages live, with no diagram of how it connects", async () => {
    const step = textOf(await connectStep());
    inOrder(step, [
      "Site",
      "Details",
      "Connect",
      "Step 3 of 3 about 10 minutes of your time",
      "Connect your website",
      "Where should pages live?",
      `On your web address, run by us ${HOST} One setting, once. Recommended.`,
      "On my WordPress site Pages go live on your WordPress. You create an app password for us.",
    ]);
    expect(step.join("\n")).not.toContain("How it connects");
  });

  it("the connect screen: the record, the steps, doing it later, then the week, with no list of what happens after", () => {
    const screen = textOf(connectScreen());
    expect(screen.join("\n")).not.toContain("After you add it");
    inOrder(screen, [
      "Paste this where you bought example.com",
      "Look for its DNS settings.",
      "Type CNAME",
      "Copy Type",
      "Name content",
      "Copy Name",
      "Value edge.example.net",
      "Copy Value",
      "Show the steps",
      "Sign in where you bought your web address.",
      "Open the DNS settings and add a new record.",
      "Pick the type CNAME, then paste the name and the value above.",
      "Save. Come back here and press I’ve added it, check now.",
      "Steps for where you bought your address",
      "I’ve added it, check now",
      "Do this later",
      "If you do it later, we’ll email you a reminder. Your first page waits for it.",
      "After this, nothing to do",
      "Mon",
      "Sun",
      "Every Monday we plan up to 7 pages, new or updated. Never filler.",
      "Each page goes live on its day, by itself.",
      "You can edit or stop any page before it goes live. You never have to.",
      "You can cancel or export in Settings at any time.",
    ]);
  });

  it("the per-provider guide stays behind the steps' one link", () => {
    const steps = connectScreen().querySelector('[data-testid="setup-connect-steps"]');
    expect(steps?.querySelector('[data-testid="dns-guide"]')).not.toBeNull();
  });

  it("names no go-live hour while the address is not connected (Q11)", async () => {
    const texts = [...textOf(await connectStep()), ...textOf(connectScreen())].join("\n");
    expect(texts).not.toMatch(/\d:\d\d/);
  });

  it("says hosted, never blog, on either screen", async () => {
    const texts = [...textOf(await connectStep()), ...textOf(connectScreen())].join("\n");
    expect(texts).not.toMatch(/\bblog\b/i);
  });
});

describe("the time-zone screen matches board SetupZone", () => {
  async function zone(): Promise<HTMLElement> {
    return mount(<ZoneScreen />);
  }

  it("parity: SetupZone reads its rendered arms", async () => {
    vi.useFakeTimers();
    const root = await zone();
    await act(async () => vi.advanceTimersByTime(10_000));
    expectStateParity("SetupZone", [root.innerHTML]);
  });

  it("the head without a full stop, the line, why it matters, and nothing to press", async () => {
    inOrder(textOf(await zone()), [
      "Setting your time zone",
      COPY["setup.zone.line"],
      "Why it matters",
      COPY["setup.zone.example"],
      COPY["setup.zone.example.not"],
      "This takes a few seconds and happens once. Nothing to press.",
    ]);
    expect((await zone()).querySelector("h1")?.textContent).toBe("Setting your time zone");
  });

  it("the line under it comes after ten seconds and not before, with the address to write to", async () => {
    vi.useFakeTimers();
    const root = await zone();
    await act(async () => vi.advanceTimersByTime(9_999));
    expect(root.querySelector('[data-testid="setup-zone-slow"]')).toBeNull();
    await act(async () => vi.advanceTimersByTime(1));
    const slow = root.querySelector('[data-testid="setup-zone-slow"]');
    expect(slow?.textContent).toBe(`${COPY["setup.zone.slow"]} hello@reachkit.app`);
    expect(slow?.querySelector("a")?.getAttribute("href")).toBe("mailto:hello@reachkit.app");
  });

  it("names no go-live hour, since it shows before the address is connected (Q11)", async () => {
    vi.useFakeTimers();
    const root = await zone();
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(textOf(root).join("\n")).not.toMatch(/\d:\d\d/);
  });
});
