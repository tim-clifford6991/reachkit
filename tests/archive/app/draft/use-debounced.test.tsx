/** @vitest-environment jsdom */
// The autosave and preview timer must die with the screen: a timer that fires
// after unmount sets state on a torn-down tree.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebounced } from "@/app/(account)/app/draft/[draftId]/useDebounced";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const seen = vi.fn<(settled: string) => void>();

function Probe({ value }: { value: string }) {
  seen(useDebounced(value, 1200));
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  seen.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe value="before" />));
  act(() => root.render(<Probe value="after" />));
});

afterEach(() => {
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDebounced", () => {
  it("settles on the new value once it has held for the interval", () => {
    act(() => vi.advanceTimersByTime(1199));
    expect(seen).not.toHaveBeenCalledWith("after");
    act(() => vi.advanceTimersByTime(1));
    expect(seen).toHaveBeenLastCalledWith("after");
    act(() => root.unmount());
  });

  it("does nothing after unmount: no pending timer, no late render, no error", () => {
    const error = vi.spyOn(console, "error");
    act(() => vi.advanceTimersByTime(600));
    act(() => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(2000));
    expect(seen).not.toHaveBeenCalledWith("after");
    expect(error).not.toHaveBeenCalled();
  });
});
