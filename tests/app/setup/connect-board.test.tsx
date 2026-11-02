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
      "Connect your website",
      "We’re already writing your first page. It goes live once you connect.",
      "Where should pages live?",
      `On your web address, run by us ${HOST} One setting, once. Recommended.`,
      "On my WordPress site You create an app password for us.",
    ]);
    expect(step.join("\n")).not.toContain("How it connects");
  });

  it("the connect screen: the record, the steps, doing it later, the week, then the press in the bar, with no list of what happens after", () => {
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
      "Do this later",
      "We’ll email you a reminder. Your first page waits for it.",
      "After this, nothing to do",
      "Every Monday we plan up to 7 pages, new or updated.",
      "Each page goes live on its day, by itself.",
      "You can edit or stop any page first. You never have to.",
      "Cancel or export in Settings at any time.",
      "I’ve added it, check now",
    ]);
  });

  it("board Setup — the record is on this step, its Name row is the label, and it points at the deployment's own edge (#2270)", async () => {
    const m = assembleSetup(FIXTURE_SETUP_FACTS);
    const tree = await connectStep();
    const rows = [...tree.querySelectorAll('[data-testid="setup-record"] > div')];
    expect(rows).toHaveLength(3);
    expect(rows[1]?.querySelector<HTMLInputElement>('input[name="label"]')?.value).toBe("content");
    // The Value is the deployment's binding, never the customer's own host.
    expect(rows[2]?.textContent).toContain(m.cnameTarget);
    expect(rows[2]?.textContent).not.toContain("content.example.com");
    expect(tree.querySelector('[data-testid="setup-connect-later-action"]')?.textContent).toBe(COPY["setup.connect.later"]);
    expect(tree.querySelector('[data-testid="setup-connect-week"]')).not.toBeNull();
  });

  it("the hosted address's primary is the check, and there is no Finish", async () => {
    const tree = await connectStep();
    expect(tree.querySelector('footer [data-testid="setup-onwards"]')?.textContent).toBe(COPY["setup.connect.check"]);
    expect(tree.querySelector('[data-testid="check-connection-press"]')).toBeNull();
    expect(tree.textContent).not.toContain("Finish");
  });

  it("the per-provider guide stays behind the steps' one link", () => {
    const steps = connectScreen().querySelector('[data-testid="setup-connect-steps"]');
    expect(steps?.querySelector('[data-testid="dns-guide"]')).not.toBeNull();
  });

  it("names no go-live hour while the address is not connected (Q11)", async () => {
    // The status line's clock is when the pass started, not an hour a page goes live.
    const step = await connectStep();
    step.querySelector('[data-testid="setup-pass-status"]')?.remove();
    const texts = [...textOf(step), ...textOf(connectScreen())].join("\n");
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

  it("the head without a full stop, then the one status line, and nothing to press", async () => {
    inOrder(textOf(await zone()), [
      "ReachKit",
      "Setting your time zone",
      "So every date shows in your time. A few seconds, once. Nothing to press.",
    ]);
    expect((await zone()).querySelector("button")).toBeNull();
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
