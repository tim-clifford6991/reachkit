// tests/ui/count-up.test.ts — #1079: a big figure counts up once on first
// view, never flashes its final value first, and always reads as its final
// value; under reduced motion it is drawn at once.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COUNT_UP_SCRIPT } from "@/ui/count-up";

let intersect: (targets: Element[]) => void = () => {};

function stubBrowser(reducedMotion: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("no-preference") ? !reducedMotion : reducedMotion,
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean; target: Element }[]) => void) {
        intersect = (targets) => callback(targets.map((target) => ({ isIntersecting: true, target })));
      }
      observe(): void {}
      unobserve(): void {}
    },
  );
  vi.stubGlobal("CSS", { registerProperty: () => {}, supports: () => true });
}

/** The server's markup, already hydrated, then the head script. */
function load(html: string): [HTMLElement, HTMLElement, ...HTMLElement[]] {
  document.body.innerHTML = html;
  const figures = [...document.querySelectorAll<HTMLElement>(".figure")];
  for (const figure of figures) Object.assign(figure, { "__reactFiber$test": {} });
  new Function(COUNT_UP_SCRIPT)();
  return figures as [HTMLElement, HTMLElement, ...HTMLElement[]];
}

function finish(figure: HTMLElement): void {
  figure.dispatchEvent(Object.assign(new Event("animationend"), { animationName: "figure-count" }));
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-countup");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("#1079 — the figure count-up", () => {
  it("holds a score at 0 until it is in view, counts it once, and its text is the final figure throughout", () => {
    stubBrowser(false);
    const [score, ratio] = load('<p class="figure">72</p><p class="figure">12/20</p>');

    expect(document.documentElement.hasAttribute("data-countup")).toBe(true);
    expect(score.dataset.figure).toBe("wait");
    expect(ratio.dataset.figurePost).toBe("/20");

    intersect([score]);
    expect(score.dataset.figure).toBe("run");
    expect(score.style.getPropertyValue("--figure-to")).toBe("72");
    expect(score.textContent).toBe("72");

    finish(score);
    expect(score.dataset.figure).toBe("done");
    expect(score.textContent).toBe("72");
  });

  it("draws a dash, a decimal or a grouped number as it is", () => {
    stubBrowser(false);
    const figures = load('<p class="figure">—</p><p class="figure">4.5</p><p class="figure">1,240</p>');
    expect(figures.map((f) => f.dataset.figure)).toEqual(["off", "off", "off"]);
  });

  it("counts a figure that streams in after the first paint", async () => {
    stubBrowser(false);
    load("");
    const late = Object.assign(document.createElement("span"), { className: "figure", textContent: "9" });
    Object.assign(late, { "__reactFiber$test": {} });
    document.body.append(late);
    await Promise.resolve();
    expect(late.dataset.figure).toBe("wait");
  });

  it("under reduced motion marks nothing, so every figure is drawn final", () => {
    stubBrowser(true);
    const [score] = load('<p class="figure">72</p>');
    expect(document.documentElement.hasAttribute("data-countup")).toBe(false);
    expect(score.hasAttribute("data-figure")).toBe(false);
  });
});
