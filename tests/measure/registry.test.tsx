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
  const tiles = container.querySelector('[data-testid="overview-tiles"]');
  if (tiles === null) throw new Error("no tiles on Overview");
  return [...tiles.children].map((tile) => tile.getAttribute("data-testid") ?? "(a tile with no test id)").sort();
}

function shownMailRows(): string[] {
  // Every optional number present, so every row the mail can carry is drawn.
  const numbers: WeeklyNumbers = {
    pageQuestions: { cited: measured(2, AT), asked: 5 },
    mentions: { kind: "rate", rate: measured(34, AT), low: 22, high: 48 },
    pagesCited: measured(3, AT),
    weeks: 4,
    top20: measured(5, AT),
    top20Change: measured(2, AT),
    aiVisits: { fetches: measured(12, AT), windowDays: 7 },
  };
  const mail = buildWeekly({ numbers, pages: measured([], AT), next: measured([], AT) });
  return mail.blocks.flatMap((block) => (block.block === "stats" ? block.items.map((row) => row.label) : [])).sort();
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
    const tiles = await shownTiles();
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles).toEqual(registered("tile"));
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
