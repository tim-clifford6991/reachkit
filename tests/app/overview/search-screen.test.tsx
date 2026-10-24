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
import { assembleSearch } from "@/app/(account)/app/_overview/search-model";
import { FIXTURE_SEARCH_FACTS } from "@/app/(account)/app/_overview/search-fixture";
import { copy } from "@/lib/presentation/copy";

const AT = FIXTURE_SEARCH_FACTS.measuredAt ?? new Date(0);
const MODEL = assembleSearch(FIXTURE_SEARCH_FACTS, AT);

function table(searchParams: Record<string, string> = {}): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <NuqsTestingAdapter searchParams={searchParams}>
      <SearchTable model={MODEL} doing={{}} lead={copy("overview.search.table.lead.anywhere")} />
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

  it("holds the board's five columns, in its order, and no difficulty", () => {
    const heads = [...table().querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads).toEqual([
      copy("overview.search.column.search"),
      copy("overview.search.column.volume"),
      copy("overview.search.column.you"),
      copy("overview.search.column.rival"),
      copy("overview.search.column.status"),
    ]);
  });

  it("is two shapes in one DOM: stacked rows below `sm`, columns above", () => {
    // #963: at 390 four of the six columns were off the right edge of the
    // scroller. Below `sm` the row is a three-line grid and the box does
    // not scroll at all; nothing is written twice.
    const node = table();
    const wrap = node.querySelector('[data-testid="search-table-scroll"]');
    expect(wrap?.className).toBe("min-w-0 sm:overflow-x-auto");
    expect(node.querySelector("thead")?.className).toContain("hidden");
    const row = node.querySelector('[data-testid="search-row"]');
    expect(row?.className).toContain("max-sm:grid");
    expect(row?.className).toContain("sm:table-row");
    // Five cells, once — the phone shape re-places them, it adds none.
    expect(row?.querySelectorAll("td")).toHaveLength(5);
  });

  it("the box that can scroll is still reachable from a keyboard (#947)", () => {
    const wrap = table().querySelector('[data-testid="search-table-scroll"]');
    expect(wrap?.getAttribute("tabindex")).toBe("0");
    expect(wrap?.getAttribute("role")).toBe("region");
    expect(wrap?.getAttribute("aria-label")).toBe(copy("overview.search.table.label"));
  });

  it("says what each value is on the phone shape, in the column's own word", () => {
    // The heads are not drawn below `sm`, so `#14` would not say "where you
    // stand". Every label is the column's own key — no new sentence.
    const row = table().querySelector('[data-testid="search-row"]');
    const spoken = [...(row?.querySelectorAll("td > span.sm\\:hidden") ?? [])].map(
      (el) => el.textContent
    );
    expect(spoken).toEqual([
      copy("overview.search.column.you"),
      copy("overview.search.column.rival"),
    ]);
  });

  it("cuts no search off at any width, and keeps the whole of it on the cell", () => {
    // #963: the search used to clamp inside the scroller. The phone shape
    // has no scroller to reach the rest of a clipped value through, and
    // `checks.ts` reports a clamp outside a declared scroll container as a
    // value cut in half — so it wraps at every width and the row grows.
    const cells = [...table().querySelectorAll('[data-testid="search-query"]')];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.className).not.toMatch(/truncate|line-clamp/);
      expect(cell.getAttribute("title")).toBe(cell.textContent);
    }
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

/** One element by its test id. */
function el(root: Element, testId: string): Element | null {
  return root.querySelector(`[data-testid="${testId}"]`);
}

