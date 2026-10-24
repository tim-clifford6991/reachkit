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
import { assembleSearch, type SearchModel, type SearchRow } from "@/app/(account)/app/_overview/search-model";
import { FIXTURE_SEARCH_FACTS } from "@/app/(account)/app/_overview/search-fixture";
import { measured, unmeasured } from "@/lib/measure/measured";
import { copy } from "@/lib/presentation/copy";

const AT = FIXTURE_SEARCH_FACTS.measuredAt ?? new Date(0);
const MODEL = assembleSearch(FIXTURE_SEARCH_FACTS, AT);

function table(searchParams: Record<string, string> = {}, model: SearchModel = MODEL): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <NuqsTestingAdapter searchParams={searchParams}>
      <SearchTable model={model} doing={{}} lead={copy("overview.search.table.lead.anywhere")} />
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

/** Four rows, one per status: volumes 1,300, 650 and two not measured; places 7, 11 and two not in the top 100. */
const NOT_MEASURED = unmeasured<number>("not_attempted", AT);
const ROWS: SearchRow[] = [
  { status: "live", volume: measured(1300, AT), position: measured(7, AT) },
  { status: "your_review", volume: measured(650, AT), position: measured(11, AT) },
  { status: "up_next", volume: NOT_MEASURED, position: NOT_MEASURED },
  { status: "too_big", volume: NOT_MEASURED, position: NOT_MEASURED },
].map(({ status, volume, position }, i) => ({
  ...MODEL.rows[0]!,
  id: `row-${i}`,
  status: status as SearchRow["status"],
  target: { ...MODEL.rows[0]!.target, search: `search ${i}`, volume },
  position,
}));
const FOUR: SearchModel = { ...MODEL, rows: ROWS };
const rowsOf = (): Element[] => [...table({}, FOUR).querySelectorAll('[data-testid="search-row"]')];

describe("what each row draws beside its words", () => {
  it("each status badge carries its icon", () => {
    const icons = rowsOf().map((row) => row.querySelector('.badge svg[aria-hidden="true"]:not(.lucide-trophy)')?.getAttribute("class") ?? "");
    expect(icons.map((c) => c.split(" ").find((name) => name.startsWith("lucide-")))).toEqual([
      "lucide-circle-check",
      "lucide-clock",
      "lucide-list",
      "lucide-circle-minus",
    ]);
  });

  it("volume bars at volume of largest; unmeasured, none", () => {
    const bars = rowsOf().map((row) => row.querySelector("progress"));
    expect(bars.map((bar) => (bar === null ? null : [bar.getAttribute("value"), bar.getAttribute("max")]))).toEqual([
      ["1300", "1300"],
      ["650", "1300"],
      null,
      null,
    ]);
    expect(bars[0]?.getAttribute("aria-hidden")).toBe("true");
  });

  it("trophy only on the first page", () => {
    expect(rowsOf().map((row) => row.querySelector("svg.lucide-trophy") !== null)).toEqual([true, false, false, false]);
    const badge = rowsOf()[0]?.querySelector("svg.lucide-trophy")?.parentElement;
    expect(badge?.className).toBe("badge badge-success badge-soft");
    expect(badge?.firstElementChild?.matches("svg.lucide-trophy")).toBe(true);
    expect(badge?.children[1]?.textContent).toBe("#7");
    const eleventh = [...(rowsOf()[1]?.querySelectorAll("span.num") ?? [])].find((n) => n.textContent === "#11");
    expect(eleventh?.parentElement?.classList.contains("badge")).toBe(false);
  });
});

/** One element by its test id. */
function el(root: Element, testId: string): Element | null {
  return root.querySelector(`[data-testid="${testId}"]`);
}

