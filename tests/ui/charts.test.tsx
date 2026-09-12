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
import { CHART, CHART_INK, SVG, tooltipBox } from "@/ui/charts/chart-primitives";
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
  { name: "wk 4", value: null, account: "domain changed", cuts: true },
  { name: "wk 5", value: 91 },
  { name: "wk 6", value: 122 },
  { name: "wk 7", value: 158 },
];

/** The reserved preview's own shape: measured weeks with one week that
 *  nobody measured in the middle of them (`cuts: false`). */
const GAP_WEEKS: readonly [GrowthWeek, ...GrowthWeek[]] = [
  { name: "wk 1", value: 0 },
  { name: "wk 2", value: 36 },
  { name: "wk 3", value: null, account: "not measured", cuts: false },
  { name: "wk 4", value: 81 },
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

/** The four SVG charts. `WeekStrip` is HTML cells since #521 — a
 *  hand-sized viewBox cannot be the full width of its card and keep the
 *  ladder's type size at every band (see its header) — so every assertion
 *  that reads an `<svg>` reads these, and the strip has its own block. */
const SVG_STORIES = ALL_STORIES.filter(([name]) => name !== "WeekStrip");

/* ── the closed inventory ────────────────────────────────────────────── */

describe('BUILD §2.4: "The chart inventory is closed … A new chart form is a design-artifact approval first."', () => {
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
      expect(markupOf(story()), name).toContain(name === "WeekStrip" ? "<ol" : "<svg");
    }
  });
});

/* ── §2.4's implementation rule ──────────────────────────────────────── */

describe('BUILD §2.4: "Inline SVG, hand-sized viewBoxes — no chart library."', () => {
  it.each(SVG_STORIES)("%s renders an inline <svg> with a literal viewBox", (_name, story) => {
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

describe('BUILD §2.4: "Two chart colors only: --chart-you (accent) and --chart-rival (neutral gray) … Status colors (ok/warn/bad) are for state, never for series."', () => {
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

describe('BUILD §2.4: "Every bar/point is direct-labelled (name + value) — identity is never color-alone."', () => {
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

  it("a change is a gap, not a rule — nothing is drawn in its place (#386)", () => {
    const svg = svgOf(STORIES.GrowthLine?.() as React.JSX.Element);
    // The run is cut: two polylines, one either side of the change, and
    // never one across it.
    expect(svg.querySelectorAll("polyline")).toHaveLength(2);
    // And nothing stands in the gap — no dashed rule of any kind.
    expect([...svg.querySelectorAll("[stroke-dasharray]")]).toEqual([]);
    // The week keeps its mark, which is where its account is written.
    const tips = [...svg.querySelectorAll(".rk-mark title")].map((t) => t.textContent ?? "");
    expect(tips.some((t) => t.includes("domain changed"))).toBe(true);
  });

  it("a week with no reading does not cut the line — it runs on to the last measured week (#386)", () => {
    // The master's picture, and the set's: the line is the whole plot and
    // the end dot sits on its last vertex. A week nobody measured is not a
    // change of market, so the line joins the weeks either side of it —
    // drawing no vertex over its column, so no reading is stated for it —
    // and the week keeps its own mark and its account.
    const svg = svgOf(<GrowthLine weeks={GAP_WEEKS} label="growth" />);
    const runs = [...svg.querySelectorAll("polyline")];
    expect(runs).toHaveLength(1);
    const points = (runs[0]?.getAttribute("points") ?? "").split(" ");
    // Three measured weeks in a four-week series: three vertices, not four.
    expect(points).toHaveLength(3);
    const dot = svg.querySelector("circle");
    const [x, y] = (points.at(-1) ?? "").split(",");
    expect(dot?.getAttribute("cx")).toBe(x);
    expect(dot?.getAttribute("cy")).toBe(y);
    // …and the numeral on the plot is that vertex's own value.
    const drawn = [...svg.querySelectorAll("text")].filter((t) => t.closest(".rk-mark") === null);
    expect(drawn.map((t) => t.textContent)).toEqual(["81"]);
    // The unmeasured week is still a week: it holds its column and says why.
    const tips = [...svg.querySelectorAll(".rk-mark title")].map((t) => t.textContent ?? "");
    expect(tips).toHaveLength(GAP_WEEKS.length);
    expect(tips.some((t) => t.includes("not measured"))).toBe(true);
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
    // The date is drawn; the word is each date's accessible name (#521).
    const names = [...rootOf(STORIES.WeekStrip?.() as React.JSX.Element).querySelectorAll(".rk-week-n")].map(
      (n) => n.getAttribute("aria-label") ?? ""
    );
    DAYS.forEach((day, i) => {
      expect(names[i]).toContain(day.date);
      expect(names[i]).toContain(day.mark);
    });
    expect(names.join(" ")).toContain("nothing measured");
  });

  it("every numeral a chart writes is in the mono utility (§2.3)", () => {
    for (const [name, story] of SVG_STORIES) {
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

describe('BUILD §2.4: "One axis per chart, thin 2–2.5px lines, 3.5–5px endpoint dots with a surface-colored ring, faint gridlines at 2–3 values."', () => {
  // Four of the five. The growth line draws none since #386: UI-SPEC §2's
  // contract for it is the fill, the line, the endpoint dot and the two
  // footnotes, and the set's `areaChart()` draws no rule at all — which
  // wins over §2.4's general geometry for this one chart (UI-SPEC §1). The
  // count is still asserted, so an axis cannot appear or vanish unnoticed
  // on any of them.
  it.each(SVG_STORIES)("%s draws exactly one axis, or none where the set draws none", (name, story) => {
    expect(svgOf(story()).querySelectorAll(".rk-axis")).toHaveLength(name === "GrowthLine" ? 0 : 1);
  });

  it("the pinned line weights sit inside 2–2.5px", () => {
    expect(CHART.lineWidth).toBeGreaterThanOrEqual(2);
    expect(CHART.lineWidth).toBeLessThanOrEqual(2.5);
    expect(CHART.sparkLineWidth).toBeGreaterThanOrEqual(2);
    expect(CHART.sparkLineWidth).toBeLessThanOrEqual(2.5);
  });

  it("every series line drawn is inside that band", () => {
    for (const [name, story] of SVG_STORIES) {
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

  it("GrowthLine draws no rule of any kind — no axis, no gridline, nothing dashed (#386)", () => {
    const svg = svgOf(STORIES.GrowthLine?.() as React.JSX.Element);
    expect(svg.querySelectorAll(".rk-axis")).toHaveLength(0);
    expect(svg.querySelectorAll(".rk-grid")).toHaveLength(0);
    // Not by class either: no <line> element at all is left in the drawing.
    expect(svg.querySelectorAll("line")).toHaveLength(0);
    expect([...svg.querySelectorAll("[stroke-dasharray]")]).toEqual([]);
  });

  it("GrowthLine's endpoint dot sits on the last measured point, never at the frame's edge", () => {
    const svg = svgOf(STORIES.GrowthLine?.() as React.JSX.Element);
    const dot = svg.querySelector("circle");
    // The fixture's last week is measured, so the dot is the last mark of
    // the last run — the same x the tooltip for that week is centred on,
    // and the same y `plot()` gives its value. A dot at the viewBox edge
    // would be a dot anchored to the frame rather than to a reading.
    const runs = [...svg.querySelectorAll("polyline")];
    const lastRun = runs.at(-1)?.getAttribute("points") ?? "";
    const [x, y] = (lastRun.split(" ").at(-1) ?? "").split(",");
    expect(dot?.getAttribute("cx")).toBe(x);
    expect(dot?.getAttribute("cy")).toBe(y);
  });
});

/* ── §2.4's tooltip ──────────────────────────────────────────────────── */

describe('BUILD §2.4: "hover tooltip on every mark (fixed-position, ink-on-bg, mono)."', () => {
  const MARKS: Record<string, number> = {
    GrowthLine: WEEKS.length,
    PresenceBars: PRESENCE.rivals.length + 1,
    AiDotMatrixChart: MATRIX_ROWS.length * QUESTIONS.length,
    RivalSparkline: 5,
  };

  it.each(SVG_STORIES)("%s carries one tooltip per mark", (name, story) => {
    const svg = svgOf(story());
    const marks = svg.querySelectorAll(".rk-mark");
    expect(marks).toHaveLength(MARKS[name] ?? -1);
    for (const mark of marks) {
      expect(mark.querySelector("title")?.textContent ?? "").not.toBe("");
      expect(mark.querySelector(".rk-tip")).not.toBeNull();
    }
  });

  it.each(SVG_STORIES)("%s anchors every chip at the same place — it does not travel with the pointer", (_name, story) => {
    const ys = [...svgOf(story()).querySelectorAll(".rk-tip rect")].map((r) => r.getAttribute("y"));
    expect(new Set(ys).size).toBe(1);
  });

  it.each(SVG_STORIES)("%s draws the chip ink-on-bg, in mono", (_name, story) => {
    const tip = svgOf(story()).querySelector(".rk-tip");
    expect(tip?.querySelector("rect")?.getAttribute("fill")).toBe(CHART_INK.tipFill);
    const label = tip?.querySelector("text");
    expect(label?.getAttribute("fill")).toBe(CHART_INK.tipText);
    expect(label?.getAttribute("class")).toBe("num");
  });
});

/* ── the two shapes that carry a meaning rule ────────────────────────── */

describe('BUILD §6.2: "render a no-AI-answer question as a muted cell, never as a miss."', () => {
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

describe('BUILD §2.5: "Rival strength is neutral gray, never red — rivals are context, not alarms."', () => {
  it("no rival mark in any story reaches a status colour", () => {
    for (const [name, story] of SVG_STORIES) {
      const svg = svgOf(story());
      const painted = [...svg.querySelectorAll("rect, polyline, path, circle")]
        .flatMap((n) => [n.getAttribute("fill"), n.getAttribute("stroke")])
        .filter((v): v is string => v !== null);
      expect(painted.filter((v) => v === "var(--ok)" || v === "var(--warn)"), name).toEqual([]);
    }
  });

  it("the growth line never joins a measurement to one taken after a change", () => {
    const svg = svgOf(STORIES.GrowthLine?.() as React.JSX.Element);
    // Three measured weeks, then a change, then three: two runs, never one.
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

/* ── every group inside its own box (issue #490) ─────────────────────── */

// The layout sweep's check 2 asks that every element's box sit inside its
// parent's, and an `<svg>` is the parent of every group a chart draws. The
// browser is not here, so these read the drawing's own coordinates, and
// every width a chart reserves for its text is estimated the way the
// charts estimate it: `CHART.labelCharAdvance` is the mono advance at
// `CHART.labelSize`, so the advance at any size is that share of the size.
// Approved copy is never shortened to fit, so the cases carry it at full
// length: the growth line's unmeasured-week account, the sentence that
// broke the sweep on #480.
const APPROVED_ACCOUNT = "This week hasn’t been measured. The next pass is due Monday.";
const ADVANCE_PER_UNIT = CHART.labelCharAdvance / CHART.labelSize;
/** `round()`'s own precision: every coordinate is written to two decimals,
 *  so a sum of rounded widths may land a hundredth past an edge. That is
 *  about a fiftieth of a pixel at any band — the sweep's tolerance is half
 *  a pixel — and is not a mark outside its box. */
const ROUNDING = 0.01;

function viewBoxOf(svg: Element): { width: number; height: number } {
  const [, , width, height] = (svg.getAttribute("viewBox") ?? "").split(" ").map(Number);
  return { width: width ?? 0, height: height ?? 0 };
}

function num(el: Element, attr: string): number {
  return Number(el.getAttribute(attr) ?? 0);
}

/** Every rect and every text of a drawing, as the horizontal span it
 *  takes — a text's from its anchor and its estimated advance. */
function spans(svg: Element): { what: string; left: number; right: number; top: number; bottom: number }[] {
  const out: { what: string; left: number; right: number; top: number; bottom: number }[] = [];
  for (const rect of svg.querySelectorAll("rect")) {
    const x = num(rect, "x");
    const y = num(rect, "y");
    out.push({ what: `rect@${x}`, left: x, right: x + num(rect, "width"), top: y, bottom: y + num(rect, "height") });
  }
  for (const text of svg.querySelectorAll("text")) {
    const x = num(text, "x");
    const size = num(text, "font-size");
    const fitted = text.getAttribute("textLength");
    const width =
      fitted === null ? (text.textContent ?? "").length * size * ADVANCE_PER_UNIT : Number(fitted);
    const anchor = text.getAttribute("text-anchor");
    const left = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
    const y = num(text, "y");
    out.push({ what: `text "${text.textContent ?? ""}"`, left, right: left + width, top: y - size, bottom: y });
  }
  return out;
}

function escapees(el: React.JSX.Element): string[] {
  const svg = svgOf(el);
  const box = viewBoxOf(svg);
  return spans(svg)
    .filter(
      (s) =>
        s.left < -ROUNDING ||
        s.right > box.width + ROUNDING ||
        s.top < -ROUNDING ||
        s.bottom > box.height + ROUNDING,
    )
    .map((s) => `${s.what} [${s.left.toFixed(2)}, ${s.right.toFixed(2)}] in 0..${box.width}`);
}

describe("issue #490: a chart's groups stay inside its own box, at every length the copy can take", () => {
  it("a tooltip chip wraps a long tip inside the box, and never shortens it", () => {
    const boxes = [
      { width: 300, height: 80 },
      { width: 300, height: 64 },
      { width: 132, height: 44 },
      { width: 300, height: 42 },
    ];
    for (const box of boxes) {
      for (let n = 1; n <= APPROVED_ACCOUNT.length * 3; n += 1) {
        const text = `Aug 24 · ${APPROVED_ACCOUNT} ${APPROVED_ACCOUNT} ${APPROVED_ACCOUNT}`.slice(0, n);
        const chip = tooltipBox(text, box);
        const where = `${n} chars in ${box.width}×${box.height}`;
        expect(chip.x, where).toBeGreaterThanOrEqual(0);
        expect(chip.x + chip.width, where).toBeLessThanOrEqual(box.width);
        expect(chip.y + chip.height, where).toBeLessThanOrEqual(box.height);
        for (const line of chip.lines) {
          expect(line.x + line.length, where).toBeLessThanOrEqual(chip.x + chip.width);
        }
        expect(chip.lines.map((l) => l.text).join(" "), where).toBe(text);
      }
    }
  });

  it("the growth line carries the approved unmeasured-week account inside its box", () => {
    const weeks: readonly [GrowthWeek, ...GrowthWeek[]] = [
      { name: "Aug 10", value: 0 },
      { name: "Aug 17", value: 36 },
      { name: "Aug 24", value: null, account: APPROVED_ACCOUNT, cuts: false },
      { name: "Aug 31", value: 81 },
    ];
    const el = <GrowthLine weeks={weeks} label="growth" />;
    expect(escapees(el)).toEqual([]);
    // The whole sentence is in the chip, across its lines.
    const tip = [...svgOf(el).querySelectorAll(".rk-tip")].find((t) => (t.textContent ?? "").includes("Aug 24"));
    const lines = [...(tip?.querySelectorAll("text") ?? [])].map((t) => t.textContent ?? "");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe(`Aug 24 · ${APPROVED_ACCOUNT}`);
  });

  // One test per row count and length band, so no single test renders
  // more than a third of the sentence's lengths and each stays well inside
  // the runner's timeout (#497 review) — the same cases as one sweep over
  // all four row counts and every length.
  const MATRIX_WEEKS = ["15", "22", "29", "6", "13", "20", "27", "3", "10", "17", "24", "31"];
  const MATRIX_CELLS = MATRIX_WEEKS.map((_, i): AiDotMatrixRow["cells"][number] =>
    i % 3 === 0 ? "cited" : i % 3 === 1 ? "not-cited" : "muted",
  );
  const BAND = Math.ceil(APPROVED_ACCOUNT.length / 3);
  const MATRIX_CASES = [1, 2, 3, 4].flatMap((rows) =>
    [0, 1, 2].map((band) => ({
      rows,
      from: band * BAND + 1,
      to: Math.min(APPROVED_ACCOUNT.length, (band + 1) * BAND),
    })),
  );
  it.each(MATRIX_CASES)(
    "the AI dot matrix at $rows row(s) keeps every rect and text inside its viewBox for names of $from to $to characters",
    ({ rows, from, to }) => {
      for (let n = from; n <= to; n += 1) {
        const matrix: AiDotMatrixRow[] = Array.from({ length: rows }, (_, r) => ({
          name: `${r}${APPROVED_ACCOUNT}`.slice(0, n),
          identity: r === 0 ? "you" : "rival",
          cells: MATRIX_CELLS,
          count: "12/12",
        }));
        const found = escapees(
          <AiDotMatrixChart rows={matrix} questions={MATRIX_WEEKS} goal={{ count: 6, name: "goal: 6" }} label="matrix" />,
        );
        expect(found, `${rows} row(s), names of ${n}`).toEqual([]);
      }
    },
  );

  it.each(SVG_STORIES)("%s draws nothing outside its viewBox", (_name, story) => {
    expect(escapees(story())).toEqual([]);
  });
});

/* ── the week strip, as the set draws it (#521) ──────────────────────── */

describe("set §2 WeekStrip: \"seven cells, states done / today / unmeasured / to-come\" (set `.week .day`)", () => {
  const root = rootOf(STORIES.WeekStrip?.() as React.JSX.Element);
  const cells = [...root.querySelectorAll("li.rk-week-day")];
  const css = readFileSync(path.join(CHARTS_DIR, "week-strip.css"), "utf8");

  it("is one named list of seven cells, each carrying its state", () => {
    expect(root.tagName.toLowerCase()).toBe("ol");
    expect(root.getAttribute("aria-label")).toBe("week");
    expect(cells).toHaveLength(7);
    expect(cells.map((c) => c.getAttribute("data-state"))).toEqual(DAYS.map((d) => d.state));
  });

  it("draws the date in mono and a rule under it, and no visible word", () => {
    cells.forEach((cell, i) => {
      const n = cell.querySelector(".rk-week-n");
      expect(n?.classList.contains("num")).toBe(true);
      expect(n?.textContent).toBe(DAYS[i]?.date);
      expect(cell.querySelector(".rk-week-rule")?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("names each state to a screen reader and on hover — identity is never colour alone (§2.4)", () => {
    cells.forEach((cell, i) => {
      const day = DAYS[i];
      // An attribute, never an `sr-only` span: the layout sweep's check 3
      // reads that clipped box as text cut off.
      const n = cell.querySelector(".rk-week-n");
      expect(n?.getAttribute("role")).toBe("img");
      expect(n?.getAttribute("aria-label")).toBe(`${day?.date} · ${day?.mark}`);
      expect(cell.querySelector(".sr-only")).toBeNull();
      expect(cell.getAttribute("title")).toBe(`${day?.date} · ${day?.mark}`);
    });
  });

  it("paints the set's rule colours — states, never a series (§2.4)", () => {
    const rule = (state: string, part: string): string =>
      new RegExp(`\\.rk-week-day\\[data-state="${state}"\\]${part}\\s*\\{[^}]*\\}`).exec(css)?.[0] ?? "";
    expect(rule("done", " \\.rk-week-rule")).toContain("var(--ok)");
    expect(rule("nothing-measured", " \\.rk-week-rule")).toContain("var(--warn)");
    expect(rule("today", " \\.rk-week-rule")).toContain("var(--accent)");
    expect(rule("today", "")).toContain("var(--accent-bg)");
    expect(rule("to-come", "")).toContain("opacity");
    expect(css).not.toMatch(/--chart-(you|rival)|var\(--bad\)/);
  });
});
