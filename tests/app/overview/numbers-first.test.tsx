/** @vitest-environment jsdom */
// SPEC §4 (2026-10-07, issue 1324) — Search, AI answers and Rivals lead with
// their numbers, and wait in the same shape.
//
// What a founder meets, on each of the three routes: the screen's name and
// the day it was measured, then the numbers, then the table or grid — and
// no sentence above them. What a number means is on its own tile, closed.
// The waiting state holds the same regions in the same order.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/search",
  redirect: vi.fn(),
}));

import SearchPage from "@/app/(account)/app/(tabs)/search/page";
import SearchLoading from "@/app/(account)/app/(tabs)/search/loading";
import AnswersPage from "@/app/(account)/app/(tabs)/ai-answers/page";
import AnswersLoading from "@/app/(account)/app/(tabs)/ai-answers/loading";
import RivalsPage from "@/app/(account)/app/(tabs)/rivals/page";
import RivalsLoading from "@/app/(account)/app/(tabs)/rivals/loading";
import { SearchTableSkeleton } from "@/app/(account)/app/_overview/skeletons";
import { resetAccount, signedInAs } from "../account-door";

beforeEach(() => signedInAs());
afterEach(() => resetAccount());

const ROUTES = [
  {
    name: "/app/search",
    Page: SearchPage,
    Loading: SearchLoading,
    head: "search",
    // Board AppGoogle: the week over the name, and each page in Google between the tiles and the table.
    lines: ["search-eyebrow", "search-measured"],
    loaded: ["search-tiles", "search-pages", "search-table"],
    waiting: ["tiles-skeleton", "search-pages-skeleton", "search-table-skeleton"],
  },
  {
    name: "/app/ai-answers",
    Page: AnswersPage,
    Loading: AnswersLoading,
    head: "ai-answers",
    // Board AppAI: the week over the name; the tiles, then each page in AI answers.
    lines: ["ai-answers-eyebrow", "ai-answers-measured"],
    loaded: ["ai-tiles", "ai-pages"],
    waiting: ["tiles-skeleton", "ai-pages-skeleton"],
  },
  {
    name: "/app/rivals",
    Page: RivalsPage,
    Loading: RivalsLoading,
    head: "rivals",
    // Board AppCompetitors: the week over the name; its cards hold no tiles, so their leads stand open.
    lines: ["rivals-eyebrow", "rivals-measured"],
    loaded: ["rivals-presence", "rivals-table"],
    waiting: ["rival-top-skeleton", "rival-presence-skeleton", "rival-table-skeleton"],
  },
];

function dom(tree: React.ReactNode): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<NuqsTestingAdapter>{tree}</NuqsTestingAdapter>);
  return container.firstElementChild ?? container;
}

/** The screen's own regions, top to bottom, by test id. */
function regions(screen: Element): (string | null)[] {
  return [...screen.children].map((child) =>
    child.tagName === "HEADER"
      ? (child.querySelector("h1")?.getAttribute("data-testid") ?? null)
      : child.getAttribute("data-testid")
  );
}

describe.each(ROUTES)("$name", ({ Page, Loading, head, lines, loaded, waiting }) => {
  it("opens on its name, then the numbers, then the table or grid", async () => {
    const screen = dom(await Page());
    expect(regions(screen).slice(0, 1 + loaded.length)).toEqual([`${head}-title`, ...loaded]);
    // The head says the name and the day (and the week, where its board draws it), and nothing else.
    const header = screen.querySelector("header");
    expect([...(header?.querySelectorAll("p") ?? [])].map((p) => p.getAttribute("data-testid"))).toEqual(lines);
  });

  it("keeps every sentence on a number tile or under a card's name closed", async () => {
    const screen = dom(await Page());
    const closed = [...screen.querySelectorAll("details")];
    expect(closed.length).toBeGreaterThan(0);
    for (const details of closed) expect(details.hasAttribute("open")).toBe(false);
    // The numbers region shows a figure, and no sentence outside a closed
    // one — but for where the site stood when it started, which is a
    // second number and not a sentence about the first.
    if (head === "rivals") return;
    const numbers = screen.querySelector(`[data-testid="${loaded[0]}"]`);
    const open = [...(numbers?.querySelectorAll("p") ?? [])].filter((p) => p.closest("details") === null);
    expect(open.map((p) => p.getAttribute("data-testid"))).toEqual([]);
  });

  it("waits in the same regions, under the same name", async () => {
    const screen = dom(await Page());
    const wait = dom(<Loading />);
    expect(regions(wait).slice(0, 1 + waiting.length)).toEqual([`${head}-title`, ...waiting]);
    expect(wait.querySelector("h1")?.textContent).toBe(screen.querySelector("h1")?.textContent);
  });
});

describe("the parts that are one shape in two places", () => {
  it("draws the Search table's fallback as the waiting screen draws it", () => {
    expect(renderToStaticMarkup(<SearchLoading />)).toContain(renderToStaticMarkup(<SearchTableSkeleton />));
  });

  it("keeps the rows of rivals on Rivals, under the table", async () => {
    const screen = dom(await RivalsPage());
    const order = regions(screen);
    expect(order.indexOf("overview-rivals")).toBeGreaterThan(order.indexOf("rivals-table"));
    expect(screen.querySelectorAll('[data-testid="overview-rivals"] li').length).toBeGreaterThan(0);
  });
});

describe("/app/ai-answers in board AppAI's order", () => {
  it("draws the head, the tiles, each page, who read and sent visits, and the reputation, and no mention card", async () => {
    const screen = dom(await AnswersPage());
    expect(regions(screen)).toEqual(["ai-answers-title", "ai-tiles", "ai-pages", "ai-who", "ai-reputation"]);
    expect(screen.querySelector('[data-testid^="mentions-"]')).toBeNull();
  });
});
