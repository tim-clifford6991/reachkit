/** @vitest-environment jsdom */
// Every number Overview's tiles, the Monday mail and the free report show has
// one entry in src/lib/measure/registry.ts, and the registry names nothing
// that is not shown. The tiles are read off the rendered Overview, the mail
// rows off the block list `buildWeekly` composes with every number present,
// and the report's figures off the rendered fixture report.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { applyEnvFixture } from "../mail/env-fixture";
import type { WeeklyNumbers } from "@/lib/mail/templates/weekly";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app",
  redirect: vi.fn(),
}));

applyEnvFixture();

const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { buildWeekly } = await import("@/lib/mail/templates/weekly");
const { measured } = await import("@/lib/measure/measured");
const { MEASURES } = await import("@/lib/measure/registry");
const { ReportView } = await import("@/app/(public)/scan/[domain]/_address/report-view");
const { FIXTURE_REPORT } = await import("@/app/(public)/scan/[domain]/_fixture/states");
const { copy } = await import("@/lib/presentation/copy");
const { resetAccount, signedInAs } = await import("../app/account-door");

beforeEach(() => signedInAs());
afterEach(() => resetAccount());

const AT = new Date("2026-10-19T06:00:00.000Z");

const registered = (on: "tile" | "mail" | "report") =>
  MEASURES.filter((measure) => measure.shown.on === on)
    .map((measure) => measure.shown.key)
    .sort();

async function shownTiles(): Promise<string[]> {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(await OverviewPage());
  // Board Main draws no tile row (Q12); a tile added later is a test id here.
  return [...container.querySelectorAll('[data-testid^="overview-tile-"]')]
    .map((tile) => tile.getAttribute("data-testid") ?? "(a tile with no test id)")
    .sort();
}

function shownMailRows(): string[] {
  // Every optional number present, each its own value, so every row the mail
  // can carry is drawn and a sentence restating a figure is not a second row.
  const v = (value: number) => measured(value, AT);
  const numbers: WeeklyNumbers = {
    live: v(11),
    planned: v(12),
    google: {
      steps: (["draft.ladder.found", "draft.ladder.showing", "draft.ladder.first-page"] as const).map((name, i) => ({ name, count: v(13 + i), of: 5 })),
      early: false,
      visits: v(16),
    },
    ai: { linked: v(17), asked: 5, reads: v(18) },
    month: { score: { value: v(19) }, market: { value: v(20), of: 12 }, reputation: { value: v(21), answers: 40, weeks: 4 } },
  };
  const mail = buildWeekly({ numbers, pages: measured([], AT), next: measured([], AT) });
  // A row is the first block to state a figure: a number tile, a line of the month's table, or a sentence.
  const seen = new Set<string>();
  const first = (key: string, figures: readonly string[]): string[] => {
    const fresh = figures.filter((f) => /^\d+$/.test(f) && Number(f) >= 11 && !seen.has(f));
    figures.forEach((f) => seen.add(f));
    return fresh.length > 0 ? [key] : [];
  };
  return mail.blocks
    .flatMap((block) => {
      if (block.block === "stats") return block.items.flatMap((row) => first(row.label, [String(row.value.kind === "unmeasured" ? "" : row.value.value)]));
      if (block.block === "facts") return block.items.flatMap((row) => first(row.label, [row.value.split(" ")[0]!]));
      if (block.block === "paragraph") return first(block.text, Object.values(block.vars ?? {}).map(String));
      return [];
    })
    .sort();
}

/** A header bar's `n/10`, or a card's "x of N". */
const FIGURE = /^(\d+\/10|\d+ of \d+)$/;

/** The name each figure on the rendered report is shown under: the rest of
 *  the smallest element around the figure that says anything else. */
function reportFigureNames(report: typeof FIXTURE_REPORT): string[] {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    React.createElement(ReportView, {
      state: { report, notice: null, control: { kind: "none" }, correction: { offered: true, as: "first" } },
    })
  );
  const names: string[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const figure = (node.textContent ?? "").trim();
    if (!FIGURE.test(figure)) continue;
    let around = node.parentElement;
    while (around !== null && (around.textContent ?? "").trim() === figure) around = around.parentElement;
    names.push((around?.textContent ?? "").replace(figure, "").trim() || `(${figure} under no name)`);
  }
  return names;
}

/** Every figure the report can draw: a stored report showing Presence whole,
 *  and one that kept its Google and AI halves apart. */
function shownReportFigures(): string[] {
  const at = FIXTURE_REPORT.verdict.measuredAt;
  const whole = { ...FIXTURE_REPORT, verdict: { ...FIXTURE_REPORT.verdict, halves: undefined } };
  const halves = {
    ...FIXTURE_REPORT,
    verdict: { ...FIXTURE_REPORT.verdict, halves: { google: measured(30, at), ai: measured(50, at) } },
  };
  return [...new Set([...reportFigureNames(whole), ...reportFigureNames(halves)])].sort();
}

describe("the measurement registry", () => {
  it("holds every Overview tile, and no tile Overview does not draw", async () => {
    expect(await shownTiles()).toEqual(registered("tile"));
  });

  it("holds every Monday mail number, and no row the mail does not draw", () => {
    const rows = shownMailRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows).toEqual(registered("mail"));
  });

  it("holds every n/10 bar and x of N figure the free report draws, and none it does not", () => {
    const figures = shownReportFigures();
    expect(figures.length).toBeGreaterThan(0);
    expect(figures).toEqual(registered("report").map((key) => copy(key as Parameters<typeof copy>[0])).sort());
  });
});
