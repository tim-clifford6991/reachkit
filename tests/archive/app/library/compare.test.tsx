// `/compare` and `/compare/{tool}` against boards PubCompare and PubCompareTool:
// each board section's strings are read from the board file and held against
// the page as it renders, with the parity check's matcher, and the sections
// arrive in the board's order. Every comparison keeps the tool page's pattern.
import "../../generate/env";
import { readFileSync } from "node:fs";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
import { describe, expect, it, vi } from "vitest";
import { boardFile, boardStrings, compare, matches, readAllow, segments, shipIndex } from "../../../scripts/design/parity.mjs";

vi.mock("@/app/(public)/_how/examples", () => ({
  readLiveExamples: async () => ({ report: null, page: null, founder: null }),
}));

const { default: ComparePage } = await import("@/app/(public)/compare/page");
const { default: ComparisonPage } = await import("@/app/(public)/compare/[tool]/page");
const { cardLines, COMPARISONS, COMPARISON_GROUPS, JOBS } = await import("@/app/(public)/_library");
const { copy } = await import("@/lib/presentation/copy");

/** The tool the PubCompareTool board draws. */
const BOARD_TOOL = "chatgpt";

async function tool(slug: string): Promise<string> {
  return renderToStaticMarkup((await ComparisonPage({ params: Promise.resolve({ tool: slug }) })) as React.ReactElement);
}

/** A board's page sections, in its order, named as the board labels them. */
function sectionsOf(board: string): { name: string; html: string }[] {
  const root = parse(readFileSync(boardFile(board), "utf8"));
  return root
    .querySelectorAll("main > section, main > div > section")
    .map((s) => ({ name: s.getAttribute("aria-labelledby") ?? s.getAttribute("aria-label") ?? "", html: s.outerHTML }));
}

/** Where a board string first lands among the page's segments. */
function positionOf(text: string, ship: string[]): number {
  return ship.findIndex((segment) => matches(text, shipIndex([segment])));
}

const PAGES = [
  { board: "PubCompare", render: async (): Promise<string> => renderToStaticMarkup(ComparePage()) },
  { board: "PubCompareTool", render: (): Promise<string> => tool(BOARD_TOOL) },
];

describe.each(PAGES)("$board: each section, in the board's order and words", ({ board, render }) => {
  const sections = sectionsOf(board);

  it.each(sections.map((s) => [s.name, s.html] as const))("section %s carries every board string", async (_name, html) => {
    const { missing } = compare(html, segments(await render()), readAllow(board));
    expect(missing).toEqual([]);
  });

  it("the sections arrive in the board's order", async () => {
    const ship = segments(await render());
    const allowed = new Set(readAllow(board).map((a: { string: string }) => a.string));
    const strings = sections.map(({ html }) => boardStrings(html).filter((s) => !allowed.has(s)));
    // Each section is placed by the last string no other section draws.
    const positions = strings.map((own, i) => {
      const elsewhere = new Set(strings.filter((_, j) => j !== i).flat());
      return positionOf(own.filter((s) => !elsewhere.has(s)).at(-1)!, ship);
    });
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe("the index: the five jobs, the fork, and a chip and a heading per kind of tool", () => {
  const html = renderToStaticMarkup(ComparePage());
  const root = parse(html);

  it("each chip and each heading counts the comparisons of its kind, and the chips total them all", () => {
    const counts = COMPARISON_GROUPS.map((g) => COMPARISONS.filter((c) => c.group === g.group).length);
    const chips = root.querySelectorAll('[data-testid="compare-jump"] a').map((a) => a.text.replace(/\s+/g, " ").trim());
    expect(chips).toEqual(COMPARISON_GROUPS.map((g, i) => `${copy(g.name)} ${counts[i]}`));
    expect(segments(html)).toContain(copy("compare.jump", { count: COMPARISONS.length }));
    for (const [i, g] of COMPARISON_GROUPS.entries()) {
      expect(root.querySelector(`#${g.group}-h`)?.text.replace(/\s+/g, " ").trim()).toBe(`${copy(g.name)} ${counts[i]}`);
    }
  });

  it("each card is one row: its title, then what the other tool is, and no second line about ReachKit", () => {
    for (const c of COMPARISONS) {
      const { them, us } = cardLines(c.summary);
      const card = root.querySelector(`a[href="/compare/${c.slug}"]`)!;
      const text = segments(card.outerHTML).join(" ");
      expect(text, c.slug).toBe([c.name.charAt(0), c.title, ...(c.badge === undefined ? [] : [c.badge]), them].join(" "));
      expect(text, c.slug).not.toContain(us);
    }
  });
});

describe("one scan form per page, and no hero button on either compare page", () => {
  it.each([
    ["/compare", (): Promise<string> | string => renderToStaticMarkup(ComparePage())],
    ["/compare/chatgpt", (): Promise<string> => tool(BOARD_TOOL)],
  ] as const)("%s", async (_path, render) => {
    const root = parse(await render());
    expect(root.querySelectorAll("form")).toHaveLength(1);
    expect(root.querySelectorAll('a[href="#start"]')).toHaveLength(0);
  });
});

describe("every comparison follows the tool page's pattern", () => {
  it.each(COMPARISONS.map((c) => [c.slug, c] as const))("%s: who does each job, once, then what ReachKit does instead", async (slug, c) => {
    const root = parse(await tool(slug));
    const yours = JOBS.filter((job) => !c.does.includes(job));
    const rows = root.querySelectorAll('[data-testid="comparison-jobs"] [role="row"]');
    expect(rows).toHaveLength(1 + JOBS.length);
    const doer = rows.slice(1).map((row) => row.querySelectorAll('[role="cell"]')[0]!.text.trim());
    expect(doer).toEqual(JOBS.map((job) => (yours.includes(job) ? copy("compare.item.jobs.you") : c.name)));
    // The jobs table is the one list of what is left to you: no second card, no second table.
    expect(root.querySelector('[data-testid="comparison-still"]')).toBeNull();
    expect(root.querySelectorAll("table")).toHaveLength(1);
    expect(root.text).toContain(copy("compare.item.jobs.count", { count: yours.length }));
    expect(root.querySelector("h1")?.text).toBe(c.heading ?? c.title);
  });
});
