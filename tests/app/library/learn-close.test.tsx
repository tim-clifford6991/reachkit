// Every Learn page closes with one shared block (boards PubAbout … PubScans):
// what ReachKit does for your site, the weekly loop, your part, the scan
// field and the free report's three figures. Each board's own closing
// sections are read from the board file and held against the page as it
// renders, with the parity check's matcher; no board string is copied here.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
import { describe, expect, it, vi } from "vitest";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";

vi.mock("@/app/(public)/_how/examples", () => ({
  readLiveExamples: async () => ({ report: null, page: null, founder: null }),
}));
vi.mock("@/lib/scan/gallery", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readGallery: async () => ({ entries: [], total: 0, categories: [], all: 0 }),
}));

const { checkedDomain, LearnClose } = await import("@/app/(public)/_library/parts");
const { copy } = await import("@/lib/presentation/copy");

type Render = () => Promise<unknown> | unknown;
const PAGES: readonly { board: string; variant: string; render: Render }[] = [
  { board: "PubAbout", variant: "about", render: async () => (await import("@/app/(public)/about/page")).default() },
  { board: "PubCompare", variant: "compare", render: async () => (await import("@/app/(public)/compare/page")).default() },
  {
    board: "PubCompareTool",
    variant: "compare-tool",
    render: async () =>
      (await import("@/app/(public)/compare/[tool]/page")).default({ params: Promise.resolve({ tool: "chatgpt" }) }),
  },
  { board: "PubTeardowns", variant: "teardowns", render: async () => (await import("@/app/(public)/teardowns/page")).default() },
  {
    board: "PubTeardown",
    variant: "teardown",
    render: async () =>
      (await import("@/app/(public)/teardowns/[site]/page")).default({ params: Promise.resolve({ site: "plausible" }) }),
  },
  {
    board: "PubAnswer",
    variant: "answer",
    render: async () =>
      (await import("@/app/(public)/answers/[question]/page")).default({
        params: Promise.resolve({ question: "free-seo-competitor-analysis-tool" }),
      }),
  },
  { board: "PubTools", variant: "tools", render: async () => (await import("@/app/(public)/tools/page")).default() },
  {
    board: "PubToolMeta",
    variant: "tool-meta",
    render: async () => (await import("@/app/(public)/tools/meta-preview/page")).default({ searchParams: Promise.resolve({}) }),
  },
  {
    board: "PubToolOnPage",
    variant: "tool-on-page",
    render: async () => (await import("@/app/(public)/tools/on-page-check/page")).default({ searchParams: Promise.resolve({}) }),
  },
  {
    board: "PubScans",
    variant: "scans",
    render: async () => (await import("@/app/(public)/scans/page")).default({ searchParams: Promise.resolve({}) }),
  },
];

/** The board's closing block: its weekly section, the loop figure, the part
 *  well that links to How it works, and the call to scan. */
function closingOf(board: string): string {
  const root = parse(readFileSync(boardFile(board), "utf8"));
  const nodes = [
    ...root.querySelectorAll(
      'section[aria-labelledby="weekly-h"], section[aria-labelledby="instead-h"], section[aria-labelledby="start-h"], section[aria-labelledby="after-h"]'
    ),
    ...root.querySelectorAll('figure[aria-label="The weekly loop ReachKit runs for you"]'),
    ...root.querySelectorAll(".well").filter((well) => well.querySelector('a[href="PubHowItWorks.dc.html"]') !== null),
  ];
  return nodes.map((node) => node.outerHTML).join("\n");
}

async function html(render: Render): Promise<string> {
  return renderToStaticMarkup((await render()) as React.ReactElement);
}

describe.each(PAGES)("$board closes with the shared Learn block", ({ board, variant, render }) => {
  it("carries every string of the board's closing block", async () => {
    const closing = closingOf(board);
    expect(closing).not.toBe("");
    const { missing } = compare(closing, segments(await html(render)), readAllow(board));
    expect(missing).toEqual([]);
  });

  it("renders the one shared component, in its variant, once", async () => {
    const page = await html(render);
    expect(page.match(/data-testid="learn-close"/g)).toHaveLength(1);
    expect(page).toContain(`data-variant="${variant}"`);
  });
});

describe("a tool's close offers to scan the site it just read", () => {
  it("reads the checked address as the scan field would", () => {
    expect(checkedDomain("https://www.example.com/water-heater-repair")).toBe("example.com");
    expect(checkedDomain("")).toBeUndefined();
    expect(checkedDomain("not a site")).toBeUndefined();
  });

  it("prefills the field and names the site on the button", () => {
    const page = renderToStaticMarkup(createElement(LearnClose, { variant: "tool-meta", domain: "example.com" }));
    const field = parse(page).querySelector('input[name="value"]');
    expect(field?.getAttribute("value")).toBe("example.com");
    expect(segments(page)).toContain(copy("library.close.scan.domain", { domain: "example.com" }));
  });

  it("without a checked site, the button is the plain scan", () => {
    const page = renderToStaticMarkup(createElement(LearnClose, { variant: "tool-meta" }));
    expect(parse(page).querySelector('input[name="value"]')?.getAttribute("value")).toBe("");
    expect(segments(page)).toContain(copy("landing.start.cta"));
  });
});
