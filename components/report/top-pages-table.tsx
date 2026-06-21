"use client";

/**
 * TopPagesTable — your strongest organic pages as a sortable, filterable table.
 *
 * TanStack Table (headless) styled to the Almanac tokens; sort column/direction
 * and the path filter are synced to the URL via nuqs (params `tp`, `tpq`) so a
 * sorted/filtered view is shareable and survives the back button. The server
 * section passes the already-extracted rows; this is the interactive island.
 */

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useQueryState, parseAsString } from "nuqs";

export interface TopPageRow {
  url: string;
  keywordCount: number;
  etv: number;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

const col = createColumnHelper<TopPageRow>();

const columns = [
  col.accessor("url", {
    id: "path",
    header: "Page",
    sortingFn: (a, b) => pathOf(a.original.url).localeCompare(pathOf(b.original.url)),
    cell: (c) => (
      <a
        href={c.getValue()}
        target="_blank"
        rel="noopener noreferrer"
        className="block min-w-0 truncate"
        style={{ color: "var(--color-accent-400)" }}
      >
        {pathOf(c.getValue())}
      </a>
    ),
  }),
  col.accessor("keywordCount", {
    id: "keywordCount",
    header: "Keywords",
    cell: (c) => `${c.getValue().toLocaleString()} kw`,
  }),
  col.accessor("etv", {
    id: "etv",
    header: "ETV",
    cell: (c) => Math.round(c.getValue()).toLocaleString(),
  }),
];

export function TopPagesTable({ rows }: { rows: TopPageRow[] }) {
  const [sortParam, setSortParam] = useQueryState("tp", parseAsString.withDefault("etv:desc"));
  const [filter, setFilter] = useQueryState("tpq", parseAsString.withDefault(""));

  const parts = (sortParam || "etv:desc").split(":");
  const sid = parts[0] ?? "etv";
  const sdir = parts[1] ?? "desc";
  const sorting: SortingState = [{ id: sid, desc: sdir !== "asc" }];

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: filter ?? "" },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const s = next[0];
      void setSortParam(s ? `${s.id}:${s.desc ? "desc" : "asc"}` : null);
    },
    onGlobalFilterChange: (v) => void setFilter((v as string) || null),
    globalFilterFn: (row, _id, value) =>
      pathOf(row.original.url).toLowerCase().includes(String(value).toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filtered = table.getRowModel().rows;

  return (
    <div>
      <input
        type="text"
        value={filter ?? ""}
        onChange={(e) => void setFilter(e.target.value || null)}
        placeholder="Filter pages…"
        aria-label="Filter top pages by path"
        className="mb-2 h-8 w-full rounded-lg border bg-transparent px-3 text-xs outline-none transition-colors focus-visible:ring-2"
        style={{ borderColor: "var(--hairline-strong)", color: "var(--color-fg)" }}
      />
      <table className="w-full border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const numeric = header.column.id !== "path";
                return (
                  <th
                    key={header.id}
                    className={`pb-2 font-mono text-[10px] uppercase tracking-widest ${numeric ? "text-right" : "text-left"}`}
                    style={{ color: "var(--color-muted)" }}
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className={`inline-flex items-center gap-1 transition-colors hover:text-(--color-fg) ${numeric ? "flex-row-reverse" : ""}`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span aria-hidden style={{ opacity: sorted ? 1 : 0.25 }}>
                        {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-4 text-center text-xs" style={{ color: "var(--color-muted)" }}>
                No pages match &ldquo;{filter}&rdquo;.
              </td>
            </tr>
          ) : (
            filtered.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                {row.getVisibleCells().map((cell) => {
                  const numeric = cell.column.id !== "path";
                  return (
                    <td
                      key={cell.id}
                      className={`max-w-0 py-2.5 ${numeric ? "whitespace-nowrap pl-3 text-right font-mono text-[11px] tabular-nums" : "pr-3"}`}
                      style={{ color: numeric ? "var(--color-muted)" : "var(--color-fg)" }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
