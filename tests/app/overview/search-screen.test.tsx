/** @vitest-environment jsdom */
// SPEC §4 (2026-09-20, #908), #916 — the Search tab as a reader meets it.
//
// **Rendering convention.** `tests/app/**` runs under the `node` project,
// whose environment has no `document`; this file declares `jsdom` for
// itself and renders with `react-dom/server`'s `renderToStaticMarkup`. The
// chosen chip is the URL's, so the table renders through `nuqs`'s own
// testing adapter — the same fact the browser reads, supplied the way the
// library supplies it.
//
// **`copy()` is not mocked.** Every assertion below is about what a reader
// sees, so the real registry has to be what renders.
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/search",
  redirect: vi.fn(),
}));

import { SearchTable } from "@/app/(account)/app/_overview/SearchTable";
import { SearchTiles } from "@/app/(account)/app/_overview/SearchTiles";
import { assembleSearch } from "@/app/(account)/app/_overview/search-model";
import { FIXTURE_SEARCH_FACTS } from "@/app/(account)/app/_overview/search-fixture";
import { copy } from "@/lib/presentation/copy";

const AT = FIXTURE_SEARCH_FACTS.measuredAt ?? new Date(0);
const MODEL = assembleSearch(FIXTURE_SEARCH_FACTS, AT);

function table(searchParams: Record<string, string> = {}): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <NuqsTestingAdapter searchParams={searchParams}>
      <SearchTable model={MODEL} />
    </NuqsTestingAdapter>
  );
  return container;
}

describe("the table", () => {
  it("draws nine rows, and offers the rest", () => {
    const el = table();
    expect(el.querySelectorAll('[data-testid="search-row"]')).toHaveLength(9);
    expect(el.querySelector('[data-testid="search-show-all"]')?.textContent).toBe(
      copy("overview.search.show-all", { total: String(MODEL.counts.all) })
    );
  });

  it("says how much of it is on screen and in what order", () => {
    expect(el(table(), "search-showing")?.textContent).toBe(
      copy("overview.search.showing", { shown: "9", total: String(MODEL.counts.all) })
    );
  });

  it("holds SPEC §4's six columns, in its order", () => {
    const heads = [...table().querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads).toEqual([
      copy("overview.search.column.search"),
      copy("overview.search.column.volume"),
      copy("overview.search.column.difficulty"),
      copy("overview.search.column.you"),
      copy("overview.search.column.rival"),
      copy("overview.search.column.status"),
    ]);
  });

  it("scrolls sideways inside its own box, so a phone never scrolls the page", () => {
    // docs/DESIGN.md's no-overflow rule, and BUILD §2.2's own rule for a
    // table. The wrap is also what makes the clamped search reachable.
    const wrap = table().querySelector("table")?.parentElement;
    expect(wrap?.className).toContain("overflow-x-auto");
  });

  it("clamps a long search to one line and keeps the whole of it in the document", () => {
    const longest = [...MODEL.rows].sort(
      (a, b) => b.target.search.length - a.target.search.length
    )[0];
    const cells = [...table().querySelectorAll('[data-testid="search-query"]')];
    const clamped = cells.find((cell) => cell.getAttribute("title") === longest?.target.search);
    // Every clamp is registered: the class cuts the line, the title carries
    // the value, and a value cut in half is a different value.
    for (const cell of cells) {
      expect(cell.className).toContain("truncate");
      expect(cell.getAttribute("title")).toBe(cell.textContent);
    }
    expect(clamped ?? cells[0]).toBeDefined();
  });

  it("never clamps a number", () => {
    // Every cell but the first: the search is the one value on this screen
    // the owner ruled may be clamped, and a number never is — the column
    // changes instead (docs/DESIGN.md's no-overflow rule).
    const rows = [...table().querySelectorAll('[data-testid="search-row"]')];
    for (const cell of rows.flatMap((row) => [...row.querySelectorAll("td")].slice(1))) {
      expect(cell.innerHTML).not.toContain("truncate");
      expect(cell.innerHTML).not.toContain("line-clamp");
    }
  });

  it("renders no placeholder in place of a sentence", () => {
    expect(table().innerHTML).not.toContain("TODO(copy)");
  });
});

describe("the chips", () => {
  it("are one per status, each carrying its own count, plus the reset that clears them", () => {
    const chips = [...table().querySelectorAll('[data-testid^="search-chip-"]')];
    expect(chips).toHaveLength(5);
    for (const status of ["live", "your_review", "up_next", "too_big"] as const) {
      const chip = chips.find((c) => c.getAttribute("data-testid") === `search-chip-${status}`);
      expect(chip?.getAttribute("aria-label"), status).toContain(String(MODEL.counts[status]));
    }
  });

  it("the chip in the address is the one the table is narrowed to", () => {
    const el = table({ show: "too_big" });
    const rows = [...el.querySelectorAll('[data-testid="search-row"]')];
    expect(rows).toHaveLength(MODEL.counts.too_big);
    for (const row of rows) {
      expect(row.textContent).toContain(copy("overview.search.status.too-big"));
    }
  });

  it("and the chip that is chosen says so to a screen reader", () => {
    const chosen = el(table({ show: "live" }), "search-chip-live");
    expect(chosen?.hasAttribute("checked")).toBe(true);
  });
});

describe("difficulty against the site's ceiling", () => {
  it("every measured difficulty draws a bar with the ceiling marked on it", () => {
    const el = table();
    const bars = [...el.querySelectorAll('[data-testid="difficulty-bar"]')];
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(bar.querySelector("progress")).not.toBeNull();
      expect(bar.querySelector('[data-testid="difficulty-ceiling-mark"]')).not.toBeNull();
      expect(bar.getAttribute("aria-label")).toContain(String(MODEL.ceiling));
    }
  });

  it("and the line over the table says where the mark stands and that it moves", () => {
    expect(el(table(), "search-ceiling")?.textContent).toBe(
      copy("overview.search.ceiling", { ceiling: String(MODEL.ceiling) })
    );
  });
});

describe("the four tiles", () => {
  it("each carry a denominator or a goal beside the number", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<SearchTiles tiles={MODEL.tiles} />);
    for (const id of [
      "search-tile-going-after",
      "search-tile-first-two-pages",
      "search-tile-first-page",
      "search-tile-appear-for",
    ]) {
      const tile = container.querySelector(`[data-testid="${id}"]`);
      expect(tile, id).not.toBeNull();
      // The figure, then what it is read against: two values, never one.
      expect(tile?.querySelectorAll("span.num").length, id).toBeGreaterThanOrEqual(2);
    }
    expect(container.innerHTML).not.toContain("TODO(copy)");
  });
});

/** One element by its test id. */
function el(root: Element, testId: string): Element | null {
  return root.querySelector(`[data-testid="${testId}"]`);
}
