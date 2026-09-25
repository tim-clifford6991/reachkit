// tests/ui/landing-inside-tabs.test.tsx — #1067.
//
// The landing's *Inside ReachKit* preview, mounted in jsdom: it moves to the
// next tab every five seconds, stops for good once a visitor picks a tab,
// and never turns for a visitor who asked for reduced motion (SPEC §1,
// 2026-09-24).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InsideTabs } from "@/app/(public)/_landing/InsideTabs";

const TABS = ["Week", "Score", "Answers", "Page"].map((label) => ({ label, panel: <p>{label} panel</p> }));

let mounted: { root: Root; host: HTMLElement } | null = null;

function reducedMotion(reduce: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function mount(): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<InsideTabs title="Inside" tabs={TABS} />));
  mounted = { root, host };
  return host;
}

function shown(host: HTMLElement): string {
  return host.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? "";
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => mounted?.root.unmount());
  mounted?.host.remove();
  mounted = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Inside ReachKit — four tabs that turn every 5s (#1067)", () => {
  it("moves to the next tab every five seconds and wraps round", () => {
    reducedMotion(false);
    const host = mount();
    expect(shown(host)).toBe("Week");
    advance(4_999);
    expect(shown(host)).toBe("Week");
    advance(1);
    expect(shown(host)).toBe("Score");
    for (const next of ["Answers", "Page", "Week"]) {
      advance(5_000);
      expect(shown(host)).toBe(next);
    }
  });

  it("shows only the current panel", () => {
    reducedMotion(false);
    const host = mount();
    advance(5_000);
    const visible = [...host.querySelectorAll('[role="tabpanel"]')].filter((p) => !p.classList.contains("invisible"));
    expect(visible.map((p) => p.textContent)).toEqual(["Score panel"]);
  });

  it("stops once someone picks a tab", () => {
    reducedMotion(false);
    const host = mount();
    const page = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) => t.textContent === "Page");
    act(() => page?.click());
    expect(shown(host)).toBe("Page");
    advance(20_000);
    expect(shown(host)).toBe("Page");
  });

  it("does not turn under reduced motion, and draws no progress line", () => {
    reducedMotion(true);
    const host = mount();
    advance(20_000);
    expect(shown(host)).toBe("Week");
    expect(host.querySelector('[role="tab"] [aria-hidden]')).toBeNull();
  });
});
