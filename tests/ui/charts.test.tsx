// tests/ui/charts.test.tsx
//
// §2.4's rules, each asserted against the clause it comes from, over a
// fixture story per chart. Criterion source: `BUILD.md` and the archived
// WO-035/WO-036 test plans, not a requirement — the design system has no
// requirement ancestor.
//
// The stories are rendered to static markup and read back in jsdom: these
// are server-renderable SVG, so what the browser gets is what the string
// says.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHART, CHART_INK, tooltipBox } from "@/ui/charts/chart-primitives";
import { SERIES_COLOR } from "@/ui/charts/series";
import { GrowthLine } from "@/ui/charts/GrowthLine";
import { RivalSparkline } from "@/ui/charts/RivalSparkline";
import { AiDotMatrixChart, type AiDotMatrixRow } from "@/ui/charts/AiDotMatrixChart";

const CHARTS_DIR = path.resolve(__dirname, "../../src/ui/charts");

/* ── the fixture stories ─────────────────────────────────────────────── */

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

const STORIES: Record<string, () => React.JSX.Element> = {
  AiDotMatrixChart: () => <AiDotMatrixChart rows={MATRIX_ROWS} questions={QUESTIONS} label="matrix" />,
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

/** The hand-drawn SVG chart. The growth line, presence bars and sparkline
 *  are Recharts since #550 (`recharts-charts.test.tsx`), and the week strip
 *  is a CSS grid in its route (issue 729). */
const SVG_STORIES = ALL_STORIES;

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

});

/* ── §2.4's labelling rule ───────────────────────────────────────────── */

describe('BUILD §2.4: "Every bar/point is direct-labelled (name + value) — identity is never color-alone."', () => {
  it("AiDotMatrixChart writes every row's name and count, and every column's label", () => {
    const text = svgOf(STORIES.AiDotMatrixChart?.() as React.JSX.Element).textContent ?? "";
    for (const row of MATRIX_ROWS) {
      expect(text).toContain(row.name);
      expect(text).toContain(row.count);
    }
    for (const q of QUESTIONS) expect(text).toContain(q);
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

/* ── §2.4's tooltip ──────────────────────────────────────────────────── */

describe('BUILD §2.4: "hover tooltip on every mark (fixed-position, ink-on-bg, mono)."', () => {
  const MARKS: Record<string, number> = {
    AiDotMatrixChart: MATRIX_ROWS.length * QUESTIONS.length,
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
    // "No measurement yet" is a written line in place of the chart, never
    // an empty frame: axes over nothing read as a measurement of zero.
    // @ts-expect-error — `weeks` is non-empty
    void <GrowthLine weeks={[]} label="growth" />;
  }

  it("compiles only because those three shapes are refused", () => {
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

