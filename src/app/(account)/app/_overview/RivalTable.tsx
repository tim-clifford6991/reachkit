// SPEC §4 (2026-09-20, #908) — every search a rival wins and the customer
// does not.
//
// "search · a month · who wins it and position · what we're doing (Page in
// your review / Up next / Needs a page on your main site / Too big for
// now), filterable by rival."
//
// **`@tanstack/react-table` 8, rendered as a daisyUI `table`**
// (docs/DESIGN.md's library list, 2026-09-20 — "Sorting, filtering and
// paging of the Search and Rivals lists"). The library owns the column
// model, the filter and the paging; the markup is daisyUI's `table` inside
// its own `overflow-x-auto` wrap, which is the house rule for every table
// in this product and is the answer to "what does this do on a phone".
//
// **The order is not the table's.** "What the plan reaches first" is
// product policy, not a UI preference: it is decided once in
// `rivals-model.ts`, over stored numbers, where a test with no browser can
// hold it. The table draws the rows in the order it is handed.
//
// **The chip is in the URL** (`?rival=`, held by `nuqs` — the same library
// and the same reason as the Search tab's `?show=`): a founder looking at
// one rival's searches can keep that open in a tab and come back to it.
//
// **It cannot overflow.** The table scrolls sideways inside its own box, so
// a phone never scrolls the page sideways; the search is clamped to one
// line with the whole of it on the cell's own `title`; and no number is
// clamped anywhere — every numeric cell is `whitespace-nowrap`, so the
// column changes rather than the value.
"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { copy } from "@/lib/presentation/copy";
import { CLOSED, FILTER_PILL, formatCount, renderValue } from "./present";
import { ALL_RIVALS, type RivalSearchRow, type RivalsModel } from "./rivals-model";
import {
  RIVAL_CELL_CLASS,
  RIVAL_COLUMN_COPY_KEY,
  RIVAL_STATUS_BADGE,
  RIVAL_STATUS_COPY_KEY,
  type RivalColumn,
} from "./rivals-words";

/** SPEC §4 (2026-09-20) gives the Search table "nine rows then *Show all*";
 *  this one is the same list read the other way round, and keeps it. */
const FIRST_PAGE_ROWS = 9;

/** The query key the chip is held under. One word, because it is in a
 *  founder's address bar. */
const RIVAL = "rival";

const column = createColumnHelper<RivalSearchRow>();

/** Who wins the search, and where they stand on it where the pass bought a
 *  top ten. The domain is set in the mono face — docs/DESIGN.md reserves it
 *  for numerals, domains and code, and this is a domain.
 *
 *  A domain is never broken mid-word (`type.css`, `.num`), so on the phone
 *  shape the cell has the row's whole width (`RIVAL_CELL_CLASS`) and the
 *  place folds under the domain rather than pushing it out of the cell
 *  (#1040). From `sm` the pair stays on one line, as before. */
function WinnerCell(p: { row: RivalSearchRow }): React.JSX.Element {
  const place = renderValue(p.row.position, RIVAL_COLUMN_COPY_KEY.winner);
  return (
    <span className="flex items-baseline gap-x-2 whitespace-nowrap max-sm:flex-wrap">
      <span className="num text-sm">{p.row.rival}</span>
      {place.isDash ? null : (
        <span className="num text-xs text-base-content/70">
          {copy("overview.search.position", { position: place.text })}
        </span>
      )}
    </span>
  );
}

export function RivalTable(p: {
  model: RivalsModel;
  /** Plan's page or update for a row's search this week, by search; the status word elsewhere. */
  doing: Readonly<Record<string, string>>;
}): React.JSX.Element {
  const { doing } = p;
  const [rival, setRival] = useQueryState(RIVAL, parseAsString.withDefault(ALL_RIVALS));
  const [showAll, setShowAll] = useState(false);

  const columns = useMemo(
    () => [
      column.accessor((row) => row.search, {
        id: "search",
        header: () => copy(RIVAL_COLUMN_COPY_KEY.search),
        // The UI face, not the mono one: a search phrase is not a numeral,
        // a domain or code, and the approved board draws it in Plus Jakarta
        // Sans at semibold.
        //
        // **It is not clamped at any width.** It was, inside the scroller,
        // until the phone shape made that wrap `sm:overflow-x-auto` — and
        // `checks.ts`'s allow-list selects `.overflow-x-auto`, which does
        // not match the responsive variant's class. A clamp that is no
        // longer inside a declared scroll container is a clipped value,
        // which is what the proof then reported at 1280. So the search
        // wraps, the column keeps its cap, and the row grows: the box
        // changing rather than the value.
        cell: (ctx) => (
          <span
            className="block font-semibold sm:max-w-[16rem]"
            title={ctx.getValue()}
            data-testid="rivals-search"
          >
            {ctx.getValue()}
          </span>
        ),
      }),
      column.accessor((row) => row.volume, {
        id: "volume",
        header: () => copy(RIVAL_COLUMN_COPY_KEY.volume),
        cell: (ctx) => {
          const value = renderValue(ctx.getValue(), RIVAL_COLUMN_COPY_KEY.volume);
          return (
            <span
              className="num whitespace-nowrap"
              title={value.line}
              aria-label={value.isDash ? value.line : undefined}
            >
              {value.text}
            </span>
          );
        },
      }),
      // The accessor is the **domain**, not the row: the chip filters on
      // this column, and a filter compares the accessor's value. Handing it
      // the whole row would compare an object with a string and quietly
      // match nothing. The cell still draws from the row it belongs to.
      column.accessor((row) => row.rival, {
        id: "winner",
        header: () => copy(RIVAL_COLUMN_COPY_KEY.winner),
        filterFn: "equalsString",
        cell: (ctx) => <WinnerCell row={ctx.row.original} />,
      }),
      column.accessor((row) => row.status, {
        id: "doing",
        header: () => copy(RIVAL_COLUMN_COPY_KEY.doing),
        cell: (ctx) => {
          const planned = doing[ctx.row.original.search];
          return (
            <span
              className={`${planned === undefined ? RIVAL_STATUS_BADGE[ctx.getValue()] : "badge badge-primary badge-soft"} h-auto whitespace-normal sm:whitespace-nowrap`}
            >
              {planned ?? copy(RIVAL_STATUS_COPY_KEY[ctx.getValue()])}
            </span>
          );
        },
      }),
    ],
    [doing]
  );

  // The library takes a mutable array; the model hands out a readonly one,
  // because nothing on this screen may reorder it. One copy, memoised on
  // the model, rather than a cast that would let a cell write to it.
  const rows = useMemo(() => [...p.model.rows], [p.model.rows]);

  const columnFilters: ColumnFiltersState = useMemo(
    () => (rival === ALL_RIVALS ? [] : [{ id: "winner", value: rival }]),
    [rival]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      columnFilters,
      pagination: {
        pageIndex: 0,
        // `Show all` is one page holding everything, not a pager: a founder
        // reading down a list of searches is not paging through it.
        pageSize: showAll ? Math.max(p.model.rows.length, 1) : FIRST_PAGE_ROWS,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: () => undefined,
    onPaginationChange: () => undefined,
  });

  const shown = table.getRowModel().rows.length;
  const total = table.getFilteredRowModel().rows.length;

  if (p.model.rows.length === 0) {
    return (
      <section className="card card-border min-w-0 bg-base-100" data-testid="rivals-table">
        <div className="flex min-w-0 flex-col gap-2 p-5">
          <h2 className="card-title text-base">{copy("overview.rivals.table.title")}</h2>
          <p className="max-w-prose text-sm text-base-content/70">
            {copy("overview.rivals.table.empty")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="card card-border min-w-0 overflow-hidden bg-base-100"
      data-testid="rivals-table"
    >
      <div className="flex min-w-0 flex-col gap-3 p-4">
        {/* What the table lists, closed under its own name (SPEC §4,
            2026-10-07, issue 1324). */}
        <details className={CLOSED.root}>
          <summary className={CLOSED.head}>
            <h2 className="card-title text-base">{copy("overview.rivals.table.title")}</h2>
          </summary>
          <div className={CLOSED.body}>
            <p className="max-w-prose text-sm text-base-content/70">
              {copy("overview.rivals.table.lead")}
            </p>
          </div>
        </details>

        {/* daisyUI `filter`: one chip per rival with its count, and a reset
            beside the chosen one. `All rivals` is that reset — it is the
            state in which no chip is chosen, which is what the component
            already means by unchecked. Its accessible name is still the
            registry's word; the × over it is daisyUI's own. */}
        <span id="rivals-filter-label" className="text-xs font-semibold text-base-content/70">
          {copy("overview.rivals.filter.label")}
        </span>
        <div
          className="filter"
          role="radiogroup"
          aria-labelledby="rivals-filter-label"
          data-testid="rivals-filters"
        >
          <input
            type="radio"
            name={RIVAL}
            className={`${FILTER_PILL} filter-reset`}
            data-testid="rivals-chip-all"
            aria-label={copy("overview.rivals.filter.all")}
            checked={rival === ALL_RIVALS}
            onChange={() => void setRival(null)}
          />
          {p.model.rivals.map((domain) => (
            <input
              key={domain}
              type="radio"
              name={RIVAL}
              className={FILTER_PILL}
              data-testid={`rivals-chip-${domain}`}
              aria-label={copy("overview.rivals.chip", {
                rival: domain,
                count: formatCount(p.model.counts[domain] ?? 0),
              })}
              checked={rival === domain}
              onChange={() => void setRival(domain)}
            />
          ))}
        </div>
      </div>

      {/* **Two shapes, one DOM** (owner's review of #958).
          Below `sm` the row is a two-column grid — the search and its
          demand, then the winner and the status on a second line — and this
          box does not scroll at all, because four columns do not fit 390px
          and the two that fell off the scroller's right edge are the whole
          point of the table. From `sm` it is the four-column daisyUI
          `table` again, scrolling sideways inside this box so the page
          never does (BUILD §2.2, docs/DESIGN.md's no-overflow rule).

          **The box is reachable from a keyboard**, because it is a box that
          can scroll. axe's `scrollable-region-focusable` is a serious
          finding and the CI gate reported it here. Measured after the phone
          shape landed, the four columns fit with nothing to scroll at 768,
          1024 and 1280 — but they are 7px over at 640, the first width this
          shape applies at, and a scrollable region no keyboard can enter is
          a defect at the widths nobody measures too. So the box keeps
          `tabIndex`, its role and its name. (#947 is rk-903's, on older
          screens; nothing here touches those.) */}
      <div
        className="min-w-0 sm:overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={copy("overview.rivals.table.label")}
        data-testid="rivals-table-scroll"
      >
        <table className="table table-sm" aria-label={copy("overview.rivals.table.label")}>
          {/* The heads belong to the four-column shape. On the phone shape
              each value states itself, so they are not drawn rather than
              drawn and read out over a list that does not have them. */}
          <thead className="hidden sm:table-header-group text-base-content/70">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} scope="col" className="whitespace-nowrap">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                data-testid="rivals-row"
                // daisyUI rules each cell at the foot; on the phone shape
                // that draws a line across the middle of a row that is one
                // block. Below `sm` the cells carry none and the row itself
                // carries one. `sm:` and above is untouched.
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] items-baseline gap-x-3 gap-y-1 p-3 max-sm:border-b max-sm:border-base-300 max-sm:[&>td]:border-0 sm:table-row sm:p-0"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`block p-0 align-middle sm:table-cell sm:px-3 sm:py-2 ${
                      RIVAL_CELL_CLASS[cell.column.id as RivalColumn] ?? ""
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3 border-t border-base-300 p-4">
        {/* A sentence, not a value: it folds. `.num` is `white-space:
            nowrap`, and a line of five words is not one value. */}
        <p className="min-w-0 flex-1 text-xs text-base-content/70" data-testid="rivals-showing">
          {copy("overview.rivals.showing", {
            shown: formatCount(shown),
            total: formatCount(total),
          })}
        </p>
        {shown < total ? (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            data-testid="rivals-show-all"
            onClick={() => setShowAll(true)}
          >
            {copy("overview.rivals.show-all", { total: formatCount(total) })}
          </button>
        ) : null}
      </div>
    </section>
  );
}
