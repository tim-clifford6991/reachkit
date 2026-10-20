// tests/ui/how-example-switch.test.tsx
//
// How it works' Plumber · Software switch, mounted in jsdom with a real
// visual: it opens on the plumber, and a press swaps the drawing for the
// software firm's and back.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { Switched, WeekOfPages } from "@/app/(public)/_how/visuals";
import { EXAMPLES } from "@/app/(public)/_how/specimen";

let mounted: Root | null = null;

function mount(): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  mounted = createRoot(host);
  act(() => mounted?.render(<Switched draw={WeekOfPages} />));
  return host;
}

function press(host: HTMLElement, name: string): void {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === name);
  act(() => button?.click());
}

const pressed = (host: HTMLElement): string => host.querySelector('[aria-pressed="true"]')?.textContent ?? "";

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  document.body.innerHTML = "";
});

describe("the Plumber · Software switch", () => {
  it("opens on the plumber", () => {
    const host = mount();
    expect(pressed(host)).toBe(copy("how.switch.plumber"));
    expect(host.textContent).toContain(EXAMPLES.plumber.blog);
    expect(host.textContent).not.toContain(EXAMPLES.software.blog);
  });

  it("swaps to the software firm and back", () => {
    const host = mount();
    press(host, copy("how.switch.software"));
    expect(pressed(host)).toBe(copy("how.switch.software"));
    expect(host.textContent).toContain(EXAMPLES.software.blog);
    expect(host.textContent).toContain(EXAMPLES.software.plan[0]?.title);
    expect(host.textContent).not.toContain(EXAMPLES.plumber.blog);

    press(host, copy("how.switch.plumber"));
    expect(host.textContent).toContain(EXAMPLES.plumber.blog);
    expect(host.textContent).not.toContain(EXAMPLES.software.blog);
  });
});
