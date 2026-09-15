// tests/ui/charts.test.tsx
//
// §2.4's rules over the chart inventory, each asserted against the clause it
// comes from. Criterion source: `BUILD.md` and the archived WO-035/WO-036
// test plans, not a requirement — the design system has no requirement
// ancestor.
//
// The inventory is Recharts now (#550, `recharts-charts.test.tsx` draws
// them). The hand-drawn grids are gone into their routes as CSS grid — the
// week strip (issue 729) and the AI-answers matrix (issue 730), whose
// meaning rules are asserted beside those routes. What stays here is what
// holds over every chart file: the two series colours, no legend, and the
// prop shapes the types refuse.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SERIES_COLOR } from "@/ui/charts/series";
import { GrowthLine } from "@/ui/charts/GrowthLine";
import { RivalSparkline } from "@/ui/charts/RivalSparkline";

const CHARTS_DIR = path.resolve(__dirname, "../../src/ui/charts");

function sources(): { file: string; text: string }[] {
  return readdirSync(CHARTS_DIR)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => ({ file: f, text: readFileSync(path.join(CHARTS_DIR, f), "utf8") }));
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

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
  it("no chart declares a legend prop — the labels are in the drawing, not in a key beside it", () => {
    for (const { file, text } of sources()) {
      // A prop or type member called `legend…`, i.e. the identifier
      // followed by `?:` or `:`. The word in a comment is prose.
      expect(text.match(/\blegend\w*\s*\??:/i), file).toBeNull();
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
