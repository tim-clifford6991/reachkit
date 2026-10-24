// tests/ui/recharts-charts.test.tsx
//
// The growth line, presence bars and rival sparkline, drawn by Recharts
// (#550). Recharts paints on the client after measuring its box, so each
// chart is mounted in jsdom with a box to measure, and the assertions read
// what a viewer sees: which series carries which colour, where the line
// breaks, and that every reading is written.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GrowthLine, type GrowthWeek } from "@/ui/charts/GrowthLine";
import { PresenceBars } from "@/ui/charts/PresenceBars";
import { RivalSparkline } from "@/ui/charts/RivalSparkline";

const BOX = { width: 320, height: 100 };
const realRect = HTMLElement.prototype.getBoundingClientRect;
const realObserver = globalThis.ResizeObserver;
const realMatchMedia = window.matchMedia;
const mounted: { root: Root; host: HTMLElement }[] = [];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ ...BOX, top: 0, left: 0, right: BOX.width, bottom: BOX.height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  // A reader who asked for no motion (#1065). Every series draws over 1.4s
  // for everybody else; for this reader it is its final state at once, which
  // is the state every assertion below reads. jsdom has no `matchMedia`, and
  // Recharts takes a missing one as "motion is fine".
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = realRect;
  globalThis.ResizeObserver = realObserver;
  window.matchMedia = realMatchMedia;
});

async function draw(el: React.JSX.Element): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  await act(async () => root.render(el));
  const svg = host.querySelector("svg.recharts-surface");
  if (!svg) throw new Error("Recharts drew no surface");
  return host;
}

/** The drawn text of the chart surface, one entry per `<text>`. */
function texts(host: HTMLElement): string[] {
  return [...host.querySelectorAll("svg.recharts-surface text")].map((t) => t.textContent ?? "");
}

/** Each bar's label line, as a reader sees it: the name, then the reading.
 *  HTML since #943 — see that test for why it is not read out of the
 *  chart's `<svg>`. */
function labelLines(host: HTMLElement): string[][] {
  return [...host.querySelectorAll("figure > div")].map((row) =>
    [...row.querySelectorAll(":scope > div > span")].map((s) => s.textContent ?? "")
  );
}

/** The written readings: the list a screen reader and a server render get. */
function readings(host: HTMLElement): string[] {
  return [...host.querySelectorAll("figure ul.sr-only li")].map((li) => li.textContent ?? "");
}

/** The vertices of a path's `d`, per subpath. */
function subpaths(d: string): string[][] {
  return d
    .split("M")
    .filter(Boolean)
    .map((sub) => sub.split("L").map((pt) => pt.trim()));
}

describe("GrowthLine", () => {
  const gap: readonly [GrowthWeek, ...GrowthWeek[]] = [
    { name: "wk 1", value: 0 },
    { name: "wk 2", value: 36 },
    { name: "wk 3", value: null, account: "not measured", cuts: false },
    { name: "wk 4", value: 81 },
  ];
  const changed: readonly [GrowthWeek, ...GrowthWeek[]] = [
    { name: "wk 1", value: 0 },
    { name: "wk 2", value: 14 },
    { name: "wk 3", value: null, account: "domain changed", cuts: true },
    { name: "wk 4", value: 91 },
    { name: "wk 5", value: 122 },
  ];

  it("joins across a week nobody measured and ends on the last measured week, labelled with its value", async () => {
    const host = await draw(<GrowthLine weeks={gap} label="growth" />);
    const curves = [...host.querySelectorAll("path.recharts-area-curve")].filter((c) => c.getAttribute("d"));
    expect(curves).toHaveLength(1);
    const [run] = subpaths(curves[0]?.getAttribute("d") ?? "");
    expect(run).toHaveLength(3);
    const [x, y] = (run?.at(-1) ?? "").split(",").map(Number);
    const dot = host.querySelector("circle.recharts-reference-dot-dot");
    expect(Number(dot?.getAttribute("cx"))).toBeCloseTo(x ?? NaN);
    expect(Number(dot?.getAttribute("cy"))).toBeCloseTo(y ?? NaN);
    expect(dot?.getAttribute("stroke")).toBe("var(--color-base-100)");
    expect(texts(host)).toEqual(["81"]);
  });

  it("never joins a measurement to one taken after a change, and draws nothing in the gap", async () => {
    const host = await draw(<GrowthLine weeks={changed} label="growth" />);
    const runs = [...host.querySelectorAll("path.recharts-area-curve")].map((c) =>
      subpaths(c.getAttribute("d") ?? "").flat(),
    );
    expect(runs.map((r) => r.length)).toEqual([2, 2]);
    expect(host.querySelectorAll("[stroke-dasharray]")).toHaveLength(0);
    for (const curve of host.querySelectorAll("path.recharts-area-curve")) {
      expect(curve.getAttribute("stroke")).toBe("var(--chart-you)");
    }
  });

  it("names itself and writes every week's reading, the unmeasured week's account included", async () => {
    const host = await draw(<GrowthLine weeks={changed} label="growth" />);
    expect(host.querySelector("figure")?.getAttribute("aria-label")).toBe("growth");
    expect(readings(host)).toEqual(["wk 1 · 0", "wk 2 · 14", "wk 3 · domain changed", "wk 4 · 91", "wk 5 · 122"]);
  });
});

describe("GrowthLine compact", () => {
  it("is a small hidden mark: the line and its endpoint dot, with no tooltip, value label or written list", async () => {
    const host = await draw(<GrowthLine compact weeks={[{ name: "scan", value: 27 }, { name: "now", value: 31 }]} />);
    const figure = host.querySelector("figure");
    expect(figure?.getAttribute("aria-hidden")).toBe("true");
    expect(figure?.hasAttribute("aria-label")).toBe(false);
    expect(figure?.getAttribute("data-points")).toBe("2");
    const [run] = [...host.querySelectorAll("path.recharts-area-curve")].map((c) => subpaths(c.getAttribute("d") ?? "").flat());
    expect(run).toHaveLength(2);
    expect(host.querySelectorAll("circle.recharts-reference-dot-dot")).toHaveLength(1);
    expect(texts(host)).toEqual([]);
    expect(host.querySelector(".recharts-tooltip-wrapper")).toBeNull();
    expect(host.querySelector("ul")).toBeNull();
    expect(host.querySelectorAll('[tabindex]:not([tabindex="-1"]), a[href], button, input, select, textarea')).toHaveLength(0);
  });
});

describe("PresenceBars", () => {
  const rivals = [
    { name: "one.com", value: 9 },
    { name: "two.com", value: 0 },
  ];

  function bars(host: HTMLElement): Element[] {
    return [...host.querySelectorAll(".recharts-bar-rectangle path")];
  }

  it("paints the customer in --chart-you and every rival in --chart-rival, each on a --color-base-200 track", async () => {
    const host = await draw(<PresenceBars you={{ name: "acme.com", value: 4 }} rivals={rivals} measured={12} label="presence" />);
    expect(bars(host).map((b) => b.getAttribute("fill"))).toEqual([
      "var(--chart-rival)",
      "var(--chart-rival)",
      "var(--chart-you)",
    ]);
    const tracks = [...host.querySelectorAll(".recharts-bar-background-rectangle")];
    expect(tracks).toHaveLength(3);
    expect(new Set(tracks.map((t) => t.getAttribute("width"))).size).toBe(1);
  });

  it("writes every row's name and its reading on a line above the bar, where nothing can clip them (#943)", async () => {
    const host = await draw(<PresenceBars you={{ name: "acme.com", value: 4 }} rivals={rivals} measured={12} label="presence" />);
    // **Not `texts()`.** Until #943 these strings were Recharts `YAxis`
    // ticks, and this assertion read them out of the chart's `<svg>` and
    // passed while a reader saw `t`, `t`, `g`, `m`: a `<text>` drawn
    // outside its viewBox is in the document and on nobody's screen. They
    // are a line of HTML above each bar now, which is where the 2026-09-20
    // ruling puts them, so this reads them where a reader reads them.
    expect(labelLines(host)).toEqual([
      ["one.com", "9/12"],
      ["two.com", "0/12"],
      ["acme.com", "4/12"],
    ]);
    // And no string is left inside the drawing to be cut off by it.
    expect(texts(host)).toEqual([]);
    expect(readings(host)).toEqual(["one.com · 9/12", "two.com · 0/12", "acme.com · 4/12"]);
  });

  it("clamps a domain to one line and keeps the whole of it reachable; the reading never clamps", async () => {
    // The 2026-09-20 ruling: "A label that can grow (a title, a domain, a
    // search) is clamped to one or two lines with an ellipsis; a number is
    // never clamped, so the box changes instead." A domain has no length
    // this card controls, so it takes the clamp and carries its whole value
    // on `title`; the ratio is a value, and a value cut in half is a
    // different value.
    const long = "a-very-long-rival-domain-that-will-not-fit.example.net";
    const host = await draw(
      <PresenceBars you={{ name: "acme.com", value: 4 }} rivals={[{ name: long, value: 9 }]} measured={12} label="presence" />
    );
    const [name, ratio] = [...host.querySelectorAll("figure > div > div > span")];
    expect(name?.className).toContain("truncate");
    expect(name?.getAttribute("title")).toBe(long);
    expect(ratio?.className).toContain("whitespace-nowrap");
    expect(ratio?.className).not.toContain("truncate");
  });

  it("draws the customer's zero as their whole track ringed in --color-error, and never rings a rival's zero", async () => {
    const host = await draw(<PresenceBars you={{ name: "acme.com", value: 0 }} rivals={rivals} measured={12} label="presence" />);
    const ringed = bars(host).filter((b) => b.getAttribute("stroke") === "var(--color-error)");
    expect(ringed.map((b) => b.getAttribute("name"))).toEqual(["acme.com"]);
    const track = host.querySelector(".recharts-bar-background-rectangle");
    expect(ringed[0]?.getAttribute("width")).toBe(track?.getAttribute("width"));
    const rivalZero = bars(host).find((b) => b.getAttribute("name") === "two.com");
    expect(Number(rivalZero?.getAttribute("width"))).toBeGreaterThan(0);
  });
});

describe("RivalSparkline", () => {
  it("draws the rival in --chart-rival with the accent on the endpoint alone, beside its name and value", async () => {
    const host = await draw(<RivalSparkline name="one.com" value="78×" points={[302, 240, 190, 120, 78]} label="gap" />);
    expect(host.querySelector("path.recharts-line-curve")?.getAttribute("stroke")).toBe("var(--chart-rival)");
    const dots = [...host.querySelectorAll("circle")];
    expect(dots.map((d) => d.getAttribute("fill"))).toEqual(["var(--color-primary)"]);
    expect(host.textContent).toContain("one.com");
    expect(host.textContent).toContain("78×");
  });

  it("cuts the line at a break, marks it with a dashed rule, and writes the account", async () => {
    const host = await draw(
      <RivalSparkline name="one.com" value="78×" points={[302, 240, null, 120, 78]} account="domain changed" label="gap" />,
    );
    const d = host.querySelector("path.recharts-line-curve")?.getAttribute("d") ?? "";
    expect(subpaths(d)).toHaveLength(2);
    const rule = host.querySelector(".recharts-reference-line-line");
    expect(rule?.getAttribute("stroke-dasharray")).not.toBeNull();
    expect(rule?.getAttribute("stroke")).toBe("var(--ink-3)");
    expect(readings(host)).toContain("one.com · domain changed");
    expect(host.querySelector("p")?.textContent).toBe("domain changed");
  });

  it("never breaks the rival's name mid-word, and keeps the whole of it on the element (#959)", async () => {
    // At 390 the name used to share a row with the plot and the figure and
    // was given about 58px, where `wrap-anywhere` broke `secondplace.io`
    // into `secon` / `dplac` / `e.io`. A domain is a value and §2.3 does
    // not break one. It has a line of its own now, clamped with its whole
    // value on `title` — the shape #955 gave `PresenceBars`.
    const host = await draw(
      <RivalSparkline name="secondplace.io" value="5×" points={[12, 9, 6, 5]} label="gap" />,
    );
    const name = [...host.querySelectorAll("span")].find(
      (el) => el.textContent === "secondplace.io",
    );
    expect(name).toBeDefined();
    expect(name?.className).toContain("truncate");
    expect(name?.className).not.toContain("wrap-anywhere");
    expect(name?.getAttribute("title")).toBe("secondplace.io");
  });

  it("gives the plot the whole width, under that line rather than beside it", async () => {
    const host = await draw(
      <RivalSparkline name="one.com" value="78×" points={[302, 240, 190, 120, 78]} label="gap" />,
    );
    const figure = host.querySelector("figure");
    expect(figure?.className).toContain("w-full");
    expect(figure?.className).not.toContain("w-32");
  });
});
