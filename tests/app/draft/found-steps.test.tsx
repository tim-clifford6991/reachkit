/** @vitest-environment jsdom */
// Issue 1553 — the ladder on the page screen and on Overview's Content tile.
//
// published → crawled → indexed → shown → placed → cited. A step proved is
// marked, a step a source read but has not seen is drawn plain, and a step
// nothing can read is not drawn. The tile counts the live pages at each
// step, and those counts are the pages' own ladders.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/app",
  redirect: vi.fn(),
}));

import { FoundSteps } from "@/app/(account)/app/draft/[draftId]/FoundSteps";
import OverviewPage from "@/app/(account)/app/(tabs)/page";
import { contentOf } from "@/app/(account)/app/_overview/content";
import type { Ladder } from "@/lib/measure/ladder";
import { resetAccount, signedInAs } from "../account-door";

function dom(tree: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(tree);
  return container;
}

function steps(ladder: Ladder): [string, string][] {
  return Array.from(dom(<FoundSteps ladder={ladder} />).querySelectorAll("li.step")).map((li) => [
    li.textContent ?? "",
    li.getAttribute("data-reached") ?? "",
  ]);
}

describe("issue 1553 — the page screen's ladder", () => {
  it("draws each step a stored row proves, in the ladder's order", () => {
    expect(steps({ crawled: true, indexed: true, impressions: 37, showing: true, bestPlace: 34, placeSource: "serp", cited: false })).toEqual([
      ["Published", "yes"],
      ["Crawled", "yes"],
      ["Indexed", "yes"],
      ["Shown", "yes"],
      ["Placed", "yes"],
      ["Cited", "not-yet"],
    ]);
  });

  it("without Search Console or Bing, draws no impressions or place, and never 'not indexed' for unverified", () => {
    expect(steps({ crawled: false, indexed: null, impressions: null, showing: null, bestPlace: null, placeSource: null, cited: null })).toEqual([
      ["Published", "yes"],
      ["Crawled", "not-yet"],
    ]);
  });
});

describe("issue 1553 — Overview's Content tile counts the pages at each step", () => {
  beforeEach(() => signedInAs());
  afterEach(() => resetAccount());

  it("states crawled, indexed, impressions, best place and cited from the pages' own ladders", async () => {
    const tile = dom(await OverviewPage()).querySelector('[data-testid="overview-tile-content"]');
    // The reserved account's seventeen pages (`content-fixture.ts`): fifteen
    // crawled, thirteen indexed, eleven shown 9, 18 … 99 times, the best at
    // place 20, and one cited.
    expect(tile?.textContent).toContain("15 crawled · 13 indexed · 594 impressions · best place 20 · 1 cited by AI");
  });

  it("leaves out every step nothing can read", () => {
    const ladder = (over: Partial<Ladder>): Ladder => ({ crawled: false, indexed: null, impressions: null, showing: null, bestPlace: null, placeSource: null, cited: null, ...over });
    const page = (id: string, l: Ladder) => ({ id, title: id, url: null, publishedAt: new Date(Date.UTC(2026, 9, 10)), ladder: l });
    const content = contentOf({ pages: [page("a", ladder({ crawled: true })), page("b", ladder({}))], now: new Date(Date.UTC(2026, 9, 19)) });
    expect(content?.found).toEqual({ crawled: 1, indexed: null, impressions: null, bestPlace: null, cited: null });
  });
});
