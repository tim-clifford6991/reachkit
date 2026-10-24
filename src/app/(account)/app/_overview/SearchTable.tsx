// SPEC §4 (2026-09-20, #908) — every search ReachKit is going after, and
// where the customer stands on it.
//
// Board AppGoogle: "Search · A month · You · Best competitor · What we're
// doing", under its name and lead, the chips with their counts over it, nine
// rows and then *Show all*. Difficulty is on Review, not here.
//
// **`@tanstack/react-table` 8, rendered as a daisyUI `table`**
// (docs/DESIGN.md's library list, 2026-09-20 — "Sorting, filtering and
// paging of the Search and Rivals lists"). The library owns the column
// model, the filter and the paging; the markup is daisyUI's `table` inside
// its own `overflow-x-auto` wrap, which is the house rule for every table
// in this product and is the answer to "what does this do on a phone".
//
// **The order is not the table's.** "Closest to the first page" is product
// policy, not a UI preference: it is decided once in `search-model.ts`,
// over stored numbers, where a test with no browser can hold it. The table
// draws the rows in the order it is handed.
//
// **The chip is in the URL** (`?show=`, held by `nuqs` — the same library
// and the same reason as setup's `?step=`): a filtered view of this screen
// is a thing a founder can keep open in a tab and come back to. daisyUI's
// `filter` collapses to the chosen chip with a reset beside it, which is
// the component working rather than a departure from the board.
//
// **Two shapes, one DOM** (#963). The columns do not fit a 390px card, so
// below `sm` the row is a three-line grid — the search and its demand, then
// where you stand against the best competitor, then what we are doing — and
// the box does not scroll at all. From `sm` up it is the daisyUI `table`,
// scrolling sideways inside its own box so the page never does.
//
// The cells are rendered **once**. `SEARCH_CELL_CLASS` places each one
// on the phone shape (the table's column order is not the reading order) and
// `SEARCH_CELL_LABEL` gives the two that do not say what they are the
// column's own word beside them. No second markup, no content written twice.
//
// **Nothing is clamped and nothing is cut.** The search wraps and the row
// grows; every numeric cell is `whitespace-nowrap`, so the column changes
// rather than the value.
"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type Table,
} from "@tanstack/react-table";
import { Trophy } from "lucide-react";
import { FIRST_PAGE_PLACES } from "@/lib/measure/page-reading";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { FILTER_PILL, formatCount, renderValue } from "./present";
import { SEARCH_FILTERS, rowsFor, type Doing, type SearchModel, type SearchRow } from "./search-model";
import {
  COLUMN_COPY_KEY,
  DOING_BADGE,
  FILTER_COPY_KEY,
  SEARCH_CELL_CLASS,
  SEARCH_CELL_LABEL,
  STATUS_BADGE,
  STATUS_COPY_KEY,
  STATUS_ICON,
  type SearchColumn,
} from "./search-words";

/** SPEC §4 (2026-09-20): "nine rows then *Show all*." */
const FIRST_PAGE_ROWS = 9;

/** The query key the chip is held under. One word, because it is in a
 *  founder's address bar. */
const SHOW = "show";

/** A measured number in a cell: never clamped, and an unmeasured one is the
 *  dash carrying its own written line — on the element itself, so the line
 *  is in the document and reachable rather than lost with the number. */
function Value(p: { value: Parameters<typeof renderValue>[0]; subject: CopyKey }): React.JSX.Element {
  const rendered = renderValue(p.value, p.subject);
  return (
    <span
      className="num whitespace-nowrap"
      title={rendered.line}
      aria-label={rendered.isDash ? rendered.line : undefined}
    >
      {rendered.text}
    </span>
  );
}

/** A measured volume and its bar against the largest on screen; an unmeasured one draws no bar, because not measured is never 0. */
function VolumeCell(p: { row: SearchRow; table: Table<SearchRow> }): React.JSX.Element {
  const volume = p.row.target.volume;
  const largest = Math.max(
    0,
    ...p.table.getRowModel().rows.map(({ original }) => (original.target.volume.kind === "unmeasured" ? 0 : original.target.volume.value))
  );
  return (
    <span className="flex flex-col items-end gap-1">
      <Value value={volume} subject={COLUMN_COPY_KEY.volume} />
      {volume.kind === "unmeasured" || largest === 0 ? null : (
        <progress className="progress w-16" value={volume.value} max={largest} aria-hidden />
      )}
    </span>
  );
}

/** The site's own place, and the week's move beside it. The glyph is the
 *  registry's; the direction is the stored verdict's. */
function YouCell(p: { row: SearchRow }): React.JSX.Element {
  const place = renderValue(p.row.position, COLUMN_COPY_KEY.you);
  const change = p.row.change;
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="num" title={place.line} aria-label={place.isDash ? place.line : undefined}>
        {place.isDash ? place.text : copy("overview.search.position", { position: place.text })}
      </span>
      {p.row.position.kind === "measured" && p.row.position.value <= FIRST_PAGE_PLACES ? (
        <Trophy className="size-3.5 text-success" aria-hidden />
      ) : null}
      {change.kind === "moved" ? (
        <span className={change.better ? "badge badge-success badge-soft" : "badge badge-ghost"}>
          <span className="num">{copy(change.better ? "overview.delta.up" : "overview.delta.down")}</span>
          <span className="num">{formatCount(change.places)}</span>
        </span>
      ) : change.kind === "first" && !place.isDash ? (
        <span className="badge badge-ghost">{copy("overview.search.you.first")}</span>
      ) : null}
    </span>
  );
}

function RivalCell(p: { row: SearchRow }): React.JSX.Element {
  const rival = p.row.rival;
  if (rival === null) {
    return <span className="text-sm text-base-content/70">{copy("overview.search.rival.yours")}</span>;
  }
  const place = renderValue(rival.position, COLUMN_COPY_KEY.rival);
  return (
    <span className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="num text-sm">{rival.domain}</span>
      {place.isDash ? null : (
        <span className="num text-xs text-base-content/70">
          {copy("overview.search.position", { position: place.text })}
        </span>
      )}
    </span>
  );
}

const column = createColumnHelper<SearchRow>();

const STATUS_ONLY: Doing = { kind: "status" };
const NOWRAP = "max-sm:h-auto max-sm:whitespace-normal sm:whitespace-nowrap";

/** What is done about the search this week, else its status word. */
function DoingCell(p: { row: SearchRow; doing: Doing }): React.JSX.Element {
  const { doing } = p;
  if (doing.kind === "status") {
    const Icon = STATUS_ICON[p.row.status];
    return (
      <span className={`${STATUS_BADGE[p.row.status]} ${NOWRAP}`}>
        <Icon className="size-3.5" aria-hidden />
        {copy(STATUS_COPY_KEY[p.row.status])}
      </span>
    );
  }
  const text =
    doing.kind === "today"
      ? copy("overview.search.doing.today")
      : doing.kind === "climbing"
        ? copy("overview.search.doing.climbing")
        : copy(doing.kind === "update" ? "overview.search.doing.update" : "overview.search.doing.page", { day: doing.day });
  return <span className={`${DOING_BADGE[doing.kind]} ${NOWRAP}`}>{text}</span>;
}

export function SearchTable(p: {
  model: SearchModel;
  /** Per row id; a row absent here shows its status word. */
  doing: Readonly<Record<string, Doing>>;
  lead: string;
}): React.JSX.Element {
  const [filter, setFilter] = useQueryState(
    SHOW,
    parseAsStringLiteral(SEARCH_FILTERS).withDefault("all")
  );
  const [showAll, setShowAll] = useState(false);
  const doing = p.doing;

  const columns = useMemo(
    () => [
      column.accessor((row) => row.target.search, {
        id: "search",
        header: () => copy(COLUMN_COPY_KEY.search),
        // **The UI face, not the mono one** (owner's review of #948).
        // docs/DESIGN.md reserves JetBrains Mono for numerals, domains and
        // code; a search phrase is none of those, and the approved board
        // draws it in Plus Jakarta Sans at semibold.
        //
        // **It no longer clamps** (#963). On the phone shape there is no
        // scroller to reach the rest of a clipped value through, and
        // `checks.ts` reports a clamp outside a declared scroll container
        // as a value cut in half. So it wraps at every width and the row
        // grows — the box changing rather than the value. The column keeps
        // its cap and the cell keeps its `title`.
        cell: (ctx) => (
          <span
            className="block max-w-[14rem] font-semibold"
            title={ctx.getValue()}
            data-testid="search-query"
          >
            {ctx.getValue()}
          </span>
        ),
      }),
      column.accessor((row) => row.target.volume, {
        id: "volume",
        header: () => copy(COLUMN_COPY_KEY.volume),
        cell: (ctx) => <VolumeCell row={ctx.row.original} table={ctx.table} />,
      }),
      column.accessor((row) => row, {
        id: "you",
        header: () => copy(COLUMN_COPY_KEY.you),
        cell: (ctx) => <YouCell row={ctx.getValue()} />,
      }),
      column.accessor((row) => row, {
        id: "rival",
        header: () => copy(COLUMN_COPY_KEY.rival),
        cell: (ctx) => <RivalCell row={ctx.getValue()} />,
      }),
      column.accessor((row) => row, {
        id: "status",
        header: () => copy(COLUMN_COPY_KEY.status),
        cell: (ctx) => <DoingCell row={ctx.getValue()} doing={doing[ctx.getValue().id] ?? STATUS_ONLY} />,
      }),
    ],
    [doing]
  );

  // The library takes a mutable array; the model hands out a readonly one,
  // because nothing on this screen may reorder it. The chip's rows come
  // from the model's own `rowsFor` — the selector Overview's Google tile
  // counts with (issue 1457) — so a tile and the rows it opens cannot
  // disagree.
  const rows = useMemo(() => [...rowsFor(p.model.rows, filter)], [p.model.rows, filter]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      pagination: {
        pageIndex: 0,
        // `Show all` is one page holding everything, not a pager: a founder
        // reading down a list of searches is not paging through it.
        pageSize: showAll ? Math.max(p.model.rows.length, 1) : FIRST_PAGE_ROWS,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: () => undefined,
  });

  const shown = table.getRowModel().rows.length;
  const total = rows.length;
  const head = (
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="text-lg font-semibold">{copy("overview.search.table.title")}</h2>
      <p className="text-sm text-base-content/70" data-testid="search-lead">
        {p.lead}
      </p>
    </div>
  );

  if (p.model.rows.length === 0) {
    return (
      <section className="card card-border min-w-0 bg-base-100" data-testid="search-table">
        <div className="card-body gap-3 p-4">
          {head}
          <p className="text-sm text-base-content/70">{copy("overview.search.empty")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card card-border min-w-0 overflow-hidden bg-base-100" data-testid="search-table">
      <div className="flex min-w-0 flex-col gap-3 p-4">
        {head}
        {/* daisyUI `filter`: the four statuses with their counts, and a
            reset beside the chosen one. `all` is that reset — it is the
            state in which no chip is chosen, which is what the component
            already means by unchecked, so there is no extra chip standing
            for "no filter". Its accessible name is still the registry's
            word; the × over it is daisyUI's own. */}
        <div
          className="filter"
          role="radiogroup"
          aria-label={copy("overview.search.filter.label")}
          data-testid="search-filters"
        >
          {SEARCH_FILTERS.map((id) => (
            <input
              key={id}
              type="radio"
              name={SHOW}
              className={`${FILTER_PILL} ${id === "all" ? "filter-reset" : ""}`}
              data-testid={`search-chip-${id}`}
              aria-label={
                id === "all"
                  ? copy(FILTER_COPY_KEY[id])
                  : copy("overview.search.chip", {
                      status: copy(FILTER_COPY_KEY[id]),
                      count: formatCount(p.model.counts[id]),
                    })
              }
              checked={filter === id}
              onChange={() => void setFilter(id === "all" ? null : id)}
            />
          ))}
        </div>
      </div>

      {/* BUILD §2.2's own rule, and docs/DESIGN.md's no-overflow rule read
          for a table: the table scrolls sideways inside this box, so the
          page never does — and because it scrolls, a keyboard has to be
          able to reach it (#947). The region takes the table's own name
          rather than a second one. */}
      <div
        className="min-w-0 sm:overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={copy("overview.search.table.label")}
        data-testid="search-table-scroll"
      >
        <table className="table table-sm" aria-label={copy("overview.search.table.label")}>
          {/* The heads belong to the table shape. On the phone shape
              each value carries the head's own word beside it instead, so
              they are not drawn rather than drawn and read out over a list
              that no longer has columns. */}
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
                data-testid="search-row"
                // daisyUI rules each cell at the foot; on the phone shape
                // that draws lines across the middle of a row that is one
                // block, so below `sm` the cells carry none and the row
                // itself carries one.
                className="max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)] max-sm:items-baseline max-sm:gap-x-3 max-sm:gap-y-1 max-sm:border-b max-sm:border-base-300 max-sm:p-3 max-sm:[&>td]:border-0 sm:table-row"
              >
                {row.getVisibleCells().map((cell) => {
                  const id = cell.column.id as SearchColumn;
                  const label = SEARCH_CELL_LABEL[id];
                  return (
                    <td
                      key={cell.id}
                      className={`flex items-baseline gap-1.5 p-0 align-middle sm:table-cell sm:px-3 sm:py-2 ${SEARCH_CELL_CLASS[id]}`}
                    >
                      {label === null ? null : (
                        <span className="shrink-0 text-xs text-base-content/70 sm:hidden">
                          {copy(label)}
                        </span>
                      )}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3 border-t border-base-300 p-4">
        {/* A sentence, not a value: it folds. `.num` is `white-space:
            nowrap` — "a value has no boundaries" — and a line of nine words
            is not one value, so mono here is a line that cannot fold and is
            clipped at 390 (`src/ui/type.css` records the same reasoning for
            the editor's textarea and for `pre`). */}
        <p className="min-w-0 flex-1 text-xs text-base-content/70" data-testid="search-showing">
          {copy("overview.search.showing", { shown: formatCount(shown), total: formatCount(total) })}
        </p>
        {shown < total ? (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            data-testid="search-show-all"
            onClick={() => setShowAll(true)}
          >
            {copy("overview.search.show-all", { total: formatCount(total) })}
          </button>
        ) : null}
      </div>
    </section>
  );
}
