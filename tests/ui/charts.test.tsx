// tests/ui/charts.test.tsx
//
// §2.4's rules, each asserted against the clause it comes from, over a
// fixture story per chart. Criterion source: `BUILD.md` and the archived
// WO-035/WO-036 test plans, not a requirement — the design system has no
// requirement ancestor.
//
// The stories are rendered to static markup and read back in jsdom, the
// same way `components-2.test.tsx` reads the registered components: these
// are server-renderable SVG, so what the browser gets is what the string
// says.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as barrel from "@/ui/charts";
import { CHART, CHART_INK, SVG } from "@/ui/charts/chart-primitives";
import { SERIES_COLOR } from "@/ui/charts/series";
import { GrowthLine, type GrowthWeek } from "@/ui/charts/GrowthLine";
import { PresenceBars } from "@/ui/charts/PresenceBars";
import { RivalSparkline } from "@/ui/charts/RivalSparkline";
import { AiDotMatrixChart, type AiDotMatrixRow } from "@/ui/charts/AiDotMatrixChart";
import { WeekStrip, type SevenDays } from "@/ui/charts/WeekStrip";
import { CHART_INVENTORY } from "@/ui/charts/inventory";

const CHARTS_DIR = path.resolve(__dirname, "../../src/ui/charts");

/* ── the fixture stories ─────────────────────────────────────────────── */

/** A quarter of weekly points, starting at 0 (§6.6: "the line leaving the
 *  floor"), with one week that was never measured. */
const WEEKS: readonly [GrowthWeek, ...GrowthWeek[]] = [
  { name: "wk 1", value: 0 },
  { name: "wk 2", value: 14 },
  { name: "wk 3", value: 37 },
  { name: "wk 4", value: null, account: "domain changed" },
  { name: "wk 5", value: 91 },
  { name: "wk 6", value: 122 },
  { name: "wk 7", value: 158 },
];

const PRESENCE = {
  you: { name: "acme.com", value: 1 },
  rivals: [
    { name: "one.com", value: 9 },
    { name: "two.com", value: 7 },
    { name: "three.com", value: 5 },
  ],
  measured: 12,
} as const;

const QUESTIONS = ["q1", "q2", "q3", "q4", "q5", "q6"];

const MATRIX_ROWS: readonly AiDotMatrixRow[] = [
  {
    name: "acme.com",
    identity: "you",
    count: "0/4",
    cells: ["not-cited", "not-cited", "muted", "not-cited", "not-cited", "muted"],
  },
  {
    name: "one.com",
    identity: "rival",
    count: "3/4",
    cells: ["cited", "cited", "muted", "not-cited", "cited", "muted"],
  },
];

const DAY = { date: "26", state: "done", mark: "done" } as const;
const DAYS: SevenDays = [
  DAY,
  { date: "27", state: "done", mark: "done" },
  { date: "28", state: "nothing-measured", mark: "nothing measured" },
  { date: "29", state: "done", mark: "done" },
  { date: "30", state: "done", mark: "done" },
  { date: "01", state: "today", mark: "today" },
  { date: "02", state: "to-come", mark: "to come" },
];

const STORIES: Record<string, () => React.JSX.Element> = {
  // No goal marker since #353: the approved set draws the goal as the
  // card's right-hand footnote, never as a rule across the plot, and the
  // prop is gone with the drawing (UI-SPEC §2's GrowthLine contract).
  GrowthLine: () => <GrowthLine weeks={WEEKS} label="growth" />,
  PresenceBars: () => (
    <PresenceBars you={PRESENCE.you} rivals={PRESENCE.rivals} measured={PRESENCE.measured} label="presence" />
  ),
  AiDotMatrixChart: () => <AiDotMatrixChart rows={MATRIX_ROWS} questions={QUESTIONS} label="matrix" />,
  RivalSparkline: () => <RivalSparkline name="one.com" value="78×" points={[302, 240, 190, 120, 78]} label="gap" />,
  WeekStrip: () => <WeekStrip days={DAYS} label="week" />,
};

/* ── reading a story back ────────────────────────────────────────────── */

function markupOf(el: React.JSX.Element): string {
  return renderToStaticMarkup(el);
}

function rootOf(el: React.JSX.Element): Element {
  const container = document.createElement("div");
  container.innerHTML = markupOf(el);
  const root = container.firstElementChild;
  if (!root) throw new Error("chart rendered no root element");
  return root;
}

/** The `<svg>` of a story. `RivalSparkline` is a row — name, plot, value —
 *  so its svg is nested; every other chart is the svg. */
function svgOf(el: React.JSX.Element): Element {
  const root = rootOf(el);
  const svg = root.tagName.toLowerCase() === "svg" ? root : root.querySelector("svg");
  if (!svg) throw new Error("chart rendered no <svg>");
  return svg;
}

function sources(): { file: string; text: string }[] {
  return readdirSync(CHARTS_DIR)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => ({ file: f, text: readFileSync(path.join(CHARTS_DIR, f), "utf8") }));
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const ALL_STORIES = Object.entries(STORIES);

/* ── the closed inventory ────────────────────────────────────────────── */

describe('BUILD.md §2.4: "The chart inventory is closed … A new chart form is a design-artifact approval first."', () => {
  it("the inventory names exactly the five §2.4 lists, in its order", () => {
    expect([...CHART_INVENTORY]).toEqual([
      "GrowthLine",
      "PresenceBars",
      "AiDotMatrixChart",
      "RivalSparkline",
      "WeekStrip",
    ]);
  });

  it("the barrel exports exactly the five components, no more and no fewer", () => {
    const exported = Object.keys(barrel).filter((k) => typeof (barrel as Record<string, unknown>)[k] === "function");
    expect(exported.sort()).toEqual([...CHART_INVENTORY].sort());
  });

  it("every chart component file in the directory is one of the five — a sixth has nowhere to hide", () => {
    // Components are PascalCase files; the directory's own modules
    // (`chart-primitives`, `series`, `mark`, `inventory`, `index`) are not.
    const components = readdirSync(CHARTS_DIR)
      .filter((f) => /^[A-Z].*\.tsx$/.test(f))
      .map((f) => f.replace(/\.tsx$/, ""));
    expect(components.sort()).toEqual([...CHART_INVENTORY].sort());
  });

  it("a story exists for each of the five, and each renders", () => {
    expect(Object.keys(STORIES).sort()).toEqual([...CHART_INVENTORY].sort());
    for (const [name, story] of ALL_STORIES) {
      expect(markupOf(story()), name).toContain("<svg");
    }
  });
});

/* ── §2.4's implementation rule ──────────────────────────────────────── */

describe('BUILD.md §2.4: "Inline SVG, hand-sized viewBoxes — no chart library."', () => {
  it.each(ALL_STORIES)("%s renders an inline <svg> with a literal viewBox", (_name, story) => {
    const svg = svgOf(story());
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("viewBox")).toMatch(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/);
  });

  it("nothing under src/ui/charts/ imports a package other than react", () => {
    const bare: string[] = [];
    for (const { text } of sources()) {
      for (const m of text.matchAll(/from "([^"]+)"/g)) {
        const spec = m[1] ?? "";
        if (!spec.startsWith(".") && spec !== "react" && spec !== "react-dom") bare.push(spec);
      }
    }
    expect(bare).toEqual([]);
  });
});

/* ── §2.4's colour rule ──────────────────────────────────────────────── */

describe('BUILD.md §2.4: "Two chart colors only: --chart-you (accent) and --chart-rival (neutral gray) … Status colors (ok/warn/bad) are for state, never for series."', () => {
  it("the series map holds those two colours and nothing else", () => {
    expect(SERIES_COLOR).toEqual({ you: "var(--chart-you)", rival: "var(--chart-rival)" });
  });

  it("no chart file names --ok or --warn at all", () => {
    for (const { file, text } of sources()) {
      expect(count(text, "var(--ok)"), file).toBe(0);
      expect(count(text, "var(--warn)"), file).toBe(0);
    }
  });

  it("--bad is named exactly once in the directory, on the customer's own absent ring — a state, never a series", () => {
    const hits = sources().filter(({ text }) => text.includes("var(--bad)"));
    expect(hits.map((h) => h.file)).toEqual(["chart-primitives.ts"]);
    expect(count(hits[0]?.text ?? "", "var(--bad)")).toBe(1);
    expect(CHART_INK.absentRing).toBe("var(--bad)");
  });

  it("PresenceBars paints the customer in --chart-you and every rival in --chart-rival, and no third colour", () => {
    const svg = svgOf(STORIES.PresenceBars?.() as React.JSX.Element);
    const fills = [...svg.querySelectorAll("rect")]
      .map((r) => r.getAttribute("fill"))
      // The hit area, the tooltip chip, and — since #352 — each row's own
      // track, which is `--sunk`: the ground a bar is drawn against, the
      // same one the dot matrix's muted cell stands on. It carries no
      // identity, so it is not a series colour.
      .filter((f) => f !== SVG.hitArea && f !== CHART_INK.tipFill && f !== CHART_INK.sunk);
    expect(fills.filter((f) => f === SERIES_COLOR.you)).toHaveLength(1);
    expect(fills.filter((f) => f === SERIES_COLOR.rival)).toHaveLength(PRESENCE.rivals.length);
    expect(new Set(fills)).toEqual(new Set([SERIES_COLOR.you, SERIES_COLOR.rival]));
  });

  it("every bar is drawn on a track of the same length, so a short bar reads against what it could have been", () => {
    const svg = svgOf(STORIES.PresenceBars?.() as React.JSX.Element);
    const tracks = [...svg.querySelectorAll("rect")].filter(
      (r) => r.getAttribute("fill") === CHART_INK.sunk
    );
    expect(tracks).toHaveLength(PRESENCE.rivals.length + 1);
    const widths = new Set(tracks.map((t) => t.getAttribute("width")));
    expect(widths.size).toBe(1);
  });

  it("every bar carries its own denominator, not a bare count (§2.4)", () => {
    const text = svgOf(STORIES.PresenceBars?.() as React.JSX.Element).textContent ?? "";
    for (const bar of [PRESENCE.you, ...PRESENCE.rivals]) {
      expect(text).toContain(`${bar.value}/${PRESENCE.measured}`);
    }
  });

  it("a rival's sparkline is grey whatever it says; the accent is on the endpoint dot alone (§4.5, transcribed)", () => {
    const svg = svgOf(STORIES.RivalSparkline?.() as React.JSX.Element);
    for (const line of svg.querySelectorAll("polyline")) {
      expect(line.getAttribute("stroke")).toBe(SERIES_COLOR.rival);
    }
    expect(svg.querySelector("circle")?.getAttribute("fill")).toBe(CHART_INK.accent);
  });
});

/* ── §2.4's labelling rule ───────────────────────────────────────────── */

describe('BUILD.md §2.4: "Every bar/point is direct-labelled (name + value) — identity is never color-alone."', () => {
  // UI-SPEC §2's GrowthLine contract is the narrower rule for this one
  // chart — "area fill under an accent line, endpoint dot with surface
  // ring, footnote pair start · goal" — and UI-SPEC wins where it and
  // BUILD differ (UI-SPEC §1). So the per-point reading lives in the
  // marks, which §2.4 requires of every chart anyway, and the plot itself
  // carries one numeral.
  it("GrowthLine writes the endpoint's value on the plot and no other numeral (#386)", () => {
    const svg = svgOf(STORIES.GrowthLine?.() as React.JSX.Element);
    const drawn = [...svg.querySelectorAll("text")].filter((t) => t.closest(".rk-mark") === null);
    const last = [...WEEKS].reverse().find((w) => w.value !== null);
    expect(drawn.map((t) => t.textContent)).toEqual([String(last?.value)]);
  });

  it("GrowthLine states every week's name and value on its own mark — identity is never colour-alone", () => {
    const svg = svgOf(STORIES.GrowthLine?.() as React.JSX.Element);
    const tips = [...svg.querySelectorAll(".rk-mark title")].map((t) => t.textContent ?? "");
    expect(tips).toHaveLength(WEEKS.length);
    WEEKS.forEach((week, i) => {
      const tip = tips[i] ?? "";
      expect(tip).toContain(week.name);
      expect(tip).toContain(week.value === null ? week.account : String(week.value));
    });
  });

  it("an unmeasured week is a gap, not a rule — nothing is drawn in its place (#386)", () => {
    const svg = svgOf(STORIES.GrowthLine?.() as React.JSX.Element);
    // The run is still cut: two polylines, one either side of the week
    // that did not run, and never one across it.
    expect(svg.querySelectorAll("polyline")).toHaveLength(2);
    // And nothing stands in the gap — no dashed rule of any kind.
    expect([...svg.querySelectorAll("[stroke-dasharray]")]).toEqual([]);
    // The week keeps its mark, which is where its account is written.
    const tips = [...svg.querySelectorAll(".rk-mark title")].map((t) => t.textContent ?? "");
    expect(tips.some((t) => t.includes("domain changed"))).toBe(true);
  });

  it("no week's numeral is drawn under the axis — the start value is the card's footnote", () => {
    const svg = svgOf(STORIES.GrowthLine?.() as React.JSX.Element);
    const drawn = [...svg.querySelectorAll("text")]
      .filter((t) => t.closest(".rk-mark") === null)
      .map((t) => t.textContent);
    for (const week of WEEKS.slice(0, -1)) {
      expect(drawn).not.toContain(week.value === null ? "—" : String(week.value));
      expect(drawn).not.toContain(week.name);
    }
  });

  it("PresenceBars writes every bar's name and value", () => {
    const text = svgOf(STORIES.PresenceBars?.() as React.JSX.Element).textContent ?? "";
    for (const bar of [PRESENCE.you, ...PRESENCE.rivals]) {
      expect(text).toContain(bar.name);
      expect(text).toContain(String(bar.value));
    }
  });

  it("AiDotMatrixChart writes every row's name and count, and every column's label", () => {
    const text = svgOf(STORIES.AiDotMatrixChart?.() as React.JSX.Element).textContent ?? "";
    for (const row of MATRIX_ROWS) {
      expect(text).toContain(row.name);
      expect(text).toContain(row.count);
    }
    for (const q of QUESTIONS) expect(text).toContain(q);
  });

  it("RivalSparkline writes the rival's name and its value beside the plot", () => {
    const text = rootOf(STORIES.RivalSparkline?.() as React.JSX.Element).textContent ?? "";
    expect(text).toContain("one.com");
    expect(text).toContain("78×");
  });

  it("WeekStrip labels all seven days, the unmeasured one included — a labelled empty mark, never a gap", () => {
    const svg = svgOf(STORIES.WeekStrip?.() as React.JSX.Element);
    const text = svg.textContent ?? "";
    for (const day of DAYS) {
      expect(text).toContain(day.date);
      expect(text).toContain(day.mark);
    }
    expect(text).toContain("nothing measured");
  });

  it("every numeral a chart writes is in the mono utility (§2.3)", () => {
    for (const [name, story] of ALL_STORIES) {
      const svg = svgOf(story());
      for (const t of svg.querySelectorAll("text")) {
        expect(t.getAttribute("class"), `${name}: ${t.textContent ?? ""}`).toBe("num");
      }
    }
  });

  it("no chart declares a legend prop — the labels are in the drawing, not in a key beside it", () => {
    for (const { file, text } of sources()) {
      // A prop or type member called `legend…`, i.e. the identifier
      // followed by `?:` or `:`. The word in a comment is prose.
      expect(text.match(/\blegend\w*\s*\??:/i), file).toBeNull();
    }
  });
});

/* ── §2.4's geometry ─────────────────────────────────────────────────── */

describe('BUILD.md §2.4: "One axis per chart, thin 2–2.5px lines, 3.5–5px endpoint dots with a surface-colored ring, faint gridlines at 2–3 values."', () => {
  it.each(ALL_STORIES)("%s draws exactly one axis", (_name, story) => {
    expect(svgOf(story()).querySelectorAll(".rk-axis")).toHaveLength(1);
  });

  it("the pinned line weights sit inside 2–2.5px", () => {
    expect(CHART.lineWidth).toBeGreaterThanOrEqual(2);
    expect(CHART.lineWidth).toBeLessThanOrEqual(2.5);
    expect(CHART.sparkLineWidth).toBeGreaterThanOrEqual(2);
    expect(CHART.sparkLineWidth).toBeLessThanOrEqual(2.5);
  });

  it("every series line drawn is inside that band", () => {
    for (const [name, story] of ALL_STORIES) {
      const svg = svgOf(story());
      for (const line of svg.querySelectorAll("polyline, path")) {
        const w = line.getAttribute("stroke-width");
        if (w === null) continue;
        expect(Number(w), name).toBeGreaterThanOrEqual(2);
        expect(Number(w), name).toBeLessThanOrEqual(2.5);
      }
    }
  });

  it("the endpoint dot is 3.5–5 across and ringed in --surface", () => {
    expect(CHART.endpointDotRadius * 2).toBeGreaterThanOrEqual(3.5);
    expect(CHART.endpointDotRadius * 2).toBeLessThanOrEqual(5);
    for (const name of ["GrowthLine", "RivalSparkline"]) {
      const svg = svgOf((STORIES[name] as () => React.JSX.Element)());
      const dot = svg.querySelector("circle");
      expect(dot, name).not.toBeNull();
      expect(Number(dot?.getAttribute("r")) * 2, name).toBeGreaterThanOrEqual(3.5);
      expect(Number(dot?.getAttribute("r")) * 2, name).toBeLessThanOrEqual(5);
      expect(dot?.getAttribute("stroke"), name).toBe(CHART_INK.surface);
      expect(Number(dot?.getAttribute("stroke-width")), name).toBeGreaterThan(0);
    }
  });

  it("GrowthLine's gridlines are faint and at 2–3 values", () => {
    const grid = svgOf(STORIES.GrowthLine?.() as React.JSX.Element).querySelectorAll(".rk-grid");
    expect(grid.length).toBeGreaterThanOrEqual(2);
    expect(grid.length).toBeLessThanOrEqual(3);
    for (const g of grid) expect(Number(g.getAttribute("opacity"))).toBeLessThan(1);
  });
});

/* ── §2.4's tooltip ──────────────────────────────────────────────────── */

describe('BUILD.md §2.4: "hover tooltip on every mark (fixed-position, ink-on-bg, mono)."', () => {
  const MARKS: Record<string, number> = {
    GrowthLine: WEEKS.length,
    PresenceBars: PRESENCE.rivals.length + 1,
    AiDotMatrixChart: MATRIX_ROWS.length * QUESTIONS.length,
    RivalSparkline: 5,
    WeekStrip: DAYS.length,
  };

  it.each(ALL_STORIES)("%s carries one tooltip per mark", (name, story) => {
    const svg = svgOf(story());
    const marks = svg.querySelectorAll(".rk-mark");
    expect(marks).toHaveLength(MARKS[name] ?? -1);
    for (const mark of marks) {
      expect(mark.querySelector("title")?.textContent ?? "").not.toBe("");
      expect(mark.querySelector(".rk-tip")).not.toBeNull();
    }
  });

  it.each(ALL_STORIES)("%s anchors every chip at the same place — it does not travel with the pointer", (_name, story) => {
    const ys = [...svgOf(story()).querySelectorAll(".rk-tip rect")].map((r) => r.getAttribute("y"));
    expect(new Set(ys).size).toBe(1);
  });

  it.each(ALL_STORIES)("%s draws the chip ink-on-bg, in mono", (_name, story) => {
    const tip = svgOf(story()).querySelector(".rk-tip");
    expect(tip?.querySelector("rect")?.getAttribute("fill")).toBe(CHART_INK.tipFill);
    const label = tip?.querySelector("text");
    expect(label?.getAttribute("fill")).toBe(CHART_INK.tipText);
    expect(label?.getAttribute("class")).toBe("num");
  });
});

/* ── the two shapes that carry a meaning rule ────────────────────────── */

describe('BUILD.md §6.2: "render a no-AI-answer question as a muted cell, never as a miss."', () => {
  it("a muted cell is drawn differently from a not-cited one", () => {
    const svg = svgOf(STORIES.AiDotMatrixChart?.() as React.JSX.Element);
    const cells = [...svg.querySelectorAll("rect")].filter((r) => r.getAttribute("rx") === "3");
    const muted = cells.filter((c) => c.getAttribute("fill") === CHART_INK.sunk);
    const absent = cells.filter((c) => c.getAttribute("stroke") === CHART_INK.absentRing);
    expect(muted.length).toBe(4);
    // §4.1: "customer's row empty red-ringed" — and only the customer's.
    expect(absent.length).toBe(4);
    expect(new Set(muted.map((m) => m.getAttribute("fill")))).not.toContain(CHART_INK.absentRing);
  });

  it("with a goal, the shortfall is dashed goal dots and the customer's cells take no red ring", () => {
    const svg = svgOf(
      <AiDotMatrixChart rows={MATRIX_ROWS} questions={QUESTIONS} goal={{ count: 3, name: "goal 3" }} label="tile" />,
    );
    const cells = [...svg.querySelectorAll("rect")];
    expect(cells.filter((c) => c.getAttribute("stroke") === CHART_INK.absentRing)).toHaveLength(0);
    expect(cells.filter((c) => c.getAttribute("stroke") === CHART_INK.goal)).toHaveLength(3);
  });
});

describe('BUILD.md §2.5: "Rival strength is neutral gray, never red — rivals are context, not alarms."', () => {
  it("no rival mark in any story reaches a status colour", () => {
    for (const [name, story] of ALL_STORIES) {
      const svg = svgOf(story());
      const painted = [...svg.querySelectorAll("rect, polyline, path, circle")]
        .flatMap((n) => [n.getAttribute("fill"), n.getAttribute("stroke")])
        .filter((v): v is string => v !== null);
      expect(painted.filter((v) => v === "var(--ok)" || v === "var(--warn)"), name).toEqual([]);
    }
  });

  it("the growth line never joins a measurement to one taken after a break", () => {
    const svg = svgOf(STORIES.GrowthLine?.() as React.JSX.Element);
    // Three measured weeks, then a hole, then three: two runs, never one.
    expect(svg.querySelectorAll("polyline")).toHaveLength(2);
  });

  it("zero is a measurement: the customer's row is drawn, ringed and labelled, not dropped", () => {
    // The approved set draws the customer's zero as their own track, empty
    // and ringed in `--bad` (UI-SPEC §2), with `0/12` beside it. The row is
    // there, the denominator is there, and the ring is §2.5's one admitted
    // red — the customer's own problem shown to them.
    const svg = svgOf(
      <PresenceBars you={{ name: "acme.com", value: 0 }} rivals={PRESENCE.rivals} measured={12} label="presence" />,
    );
    const ringed = [...svg.querySelectorAll("rect")].filter(
      (r) => r.getAttribute("stroke") === CHART_INK.absentRing
    );
    expect(ringed).toHaveLength(1);
    expect(Number(ringed[0]?.getAttribute("width"))).toBeGreaterThan(0);
    expect(svg.textContent ?? "").toContain("0/12");
  });

  it("a rival at zero is never ringed — the red is the customer's own row and nothing else (§2.5)", () => {
    const svg = svgOf(
      <PresenceBars
        you={{ name: "acme.com", value: 4 }}
        rivals={[{ name: "one.com", value: 0 }]}
        measured={12}
        label="presence"
      />,
    );
    const ringed = [...svg.querySelectorAll("rect")].filter(
      (r) => r.getAttribute("stroke") === CHART_INK.absentRing
    );
    expect(ringed).toHaveLength(0);
  });
});

/* ── the rules held by the type, not by a reviewer ───────────────────── */

describe("BP-018: the props refuse what §2.4 and §2.5 forbid", () => {
  /** Never called. `npm run typecheck` compiles this file, so each
   *  `@ts-expect-error` below fails the build if the shape it names ever
   *  becomes legal. */
  function refused(): void {
    // A rival series takes no tone at all (§2.5).
    // @ts-expect-error — `tone` is not a prop of any chart in the inventory
    void <RivalSparkline name="one.com" value="78×" points={[3, 2, 1]} label="gap" tone="bad" />;
    // A series with a hole in it has no call shape without its account.
    // @ts-expect-error — a broken series must state what broke it
    void <RivalSparkline name="one.com" value="78×" points={[3, null, 1]} label="gap" />;
    // Seven days can never become six.
    // @ts-expect-error — the strip is a seven-tuple
    void <WeekStrip days={[DAY, DAY, DAY, DAY, DAY, DAY]} label="week" />;
    // "No measurement yet" is a written line in place of the chart, never
    // an empty frame: axes over nothing read as a measurement of zero.
    // @ts-expect-error — `weeks` is non-empty
    void <GrowthLine weeks={[]} label="growth" />;
  }

  it("compiles only because those four shapes are refused", () => {
    expect(typeof refused).toBe("function");
  });
});
