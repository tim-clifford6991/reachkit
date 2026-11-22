/** @vitest-environment jsdom */
// The time-zone screen against board SetupZone: rendered as the browser draws
// it, read with the parity check's own reader, and each string in the board's order.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { segments } from "../../../scripts/design/parity.mjs";
import { expectStateParity } from "../../ui/layout/state-parity";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), redirect: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { ZoneScreen } = await import("@/app/(account)/setup/zone/ZoneScreen");
const { COPY } = await import("@/lib/presentation/copy");

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

const textOf = (root: HTMLElement): string[] => segments(root.innerHTML);

/** Each string is on the screen, and in the order given. */
function inOrder(texts: string[], wanted: string[]): void {
  const screen = texts.join("\n").toLowerCase();
  let from = 0;
  for (const want of wanted) {
    const at = screen.indexOf(want.toLowerCase(), from);
    expect(at, `"${want}" is not on the screen after "${screen.slice(Math.max(0, from - 60), from)}"`).toBeGreaterThanOrEqual(0);
    from = at + want.length;
  }
}

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
      "So every date shows in your time. A few seconds, once, with nothing to press.",
    ]);
    expect((await zone()).querySelector("button")).toBeNull();
    expect((await zone()).querySelector("h1")?.textContent).toBe("Setting Your Time Zone");
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
