"use client";

/**
 * KeywordGapTable — the Search-Gap §2.3 view: queries rivals rank for that you
 * don't, as a sortable table with an inline volume bar and a color-coded
 * opportunity cell. Sort + filter sync to the URL via nuqs (params kg, kgq).
 * Supersedes the plain keyword-gap list with the analytical table the research
 * prescribes.
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
import type { KeywordGapRow } from "@/lib/scan/gap/types";

type Opportunity = "High" | "Medium" | "Low";
function opportunityOf(volume: number): Opportunity {
  if (volume >= 2000) return "High";
  if (volume >= 500) return "Medium";
  return "Low";
}
const OPP_STYLE: Record<Opportunity, { bg: string; fg: string }> = {
  High: { bg: "color-mix(in oklch, var(--color-success) 14%, transparent)", fg: "var(--color-success)" },
  Medium: { bg: "var(--color-accent-subtle)", fg: "var(--color-accent-400)" },
  Low: { bg: "var(--fill-subtle)", fg: "var(--color-muted)" },
};

const col = createColumnHelper<KeywordGapRow>();

export function KeywordGapTable({ rows }: { rows: KeywordGapRow[] }) {
  const [sortParam, setSortParam] = useQueryState("kg", parseAsString.withDefault("volume:desc"));
  const [filter, setFilter] = useQueryState("kgq", parseAsString.withDefault(""));
  const parts = (sortParam || "volume:desc").split(":");
  const sid = parts[0] ?? "volume";
  const sdir = parts[1] ?? "desc";
  const sorting: SortingState = [{ id: sid, desc: sdir !== "asc" }];

  const maxVolume = Math.max(1, ...rows.map((r) => r.volume));

  const columns = [
    col.accessor("keyword", { id: "keyword", header: "Query", cell: (c) => c.getValue() }),
    col.accessor("volume", {
      id: "volume",
      header: "Volume",
      cell: (c) => {
        const v = c.getValue();
        return (
          <div className="flex items-center justify-end gap-2">
            <span className="h-1.5 w-10 overflow-hidden rounded-full" style={{ background: "var(--fill-subtle)" }}>
              <span className="block h-full rounded-full" style={{ width: `${(v / maxVolume) * 100}%`, background: "var(--color-accent-400)" }} />
            </span>
            <span>{v.toLocaleString()}/mo</span>
          </div>
        );
      },
    }),
    col.accessor("rivalsRanking", { id: "rivalsRanking", header: "Rivals", cell: (c) => String(c.getValue()) }),
    col.accessor("bestRivalPosition", { id: "bestRivalPosition", header: "Best rank", cell: (c) => `#${c.getValue()}` }),
    col.accessor((r) => r.volume, {
      id: "opportunity",
      header: "Opportunity",
      cell: (c) => {
        const opp = opportunityOf(c.row.original.volume);
        const s = OPP_STYLE[opp];
        return (
          <span className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ background: s.bg, color: s.fg }}>
            {opp}
          </span>
        );
      },
    }),
  ];

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
    globalFilterFn: (row, _id, value) => row.original.keyword.toLowerCase().includes(String(value).toLowerCase()),
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
        placeholder="Filter queries…"
        aria-label="Filter keyword gaps"
        className="mb-2 h-8 w-full rounded-lg border bg-transparent px-3 text-xs outline-none transition-colors focus-visible:ring-2"
        style={{ borderColor: "var(--hairline-strong)", color: "var(--color-fg)" }}
      />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const numeric = header.column.id !== "keyword";
                  return (
                    <th key={header.id} className={`pb-2 font-mono text-[10px] uppercase tracking-widest ${numeric ? "text-right" : "text-left"}`} style={{ color: "var(--color-muted)" }}>
                      <button type="button" onClick={header.column.getToggleSortingHandler()} className={`inline-flex items-center gap-1 transition-colors hover:text-(--color-fg) ${numeric ? "flex-row-reverse" : ""}`}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span aria-hidden style={{ opacity: sorted ? 1 : 0.25 }}>{sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "↕"}</span>
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
                  No queries match &ldquo;{filter}&rdquo;.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                  {row.getVisibleCells().map((cell) => {
                    const numeric = cell.column.id !== "keyword";
                    return (
                      <td key={cell.id} className={`max-w-0 py-2.5 ${numeric ? "whitespace-nowrap pl-3 text-right font-mono text-[11px] tabular-nums" : "truncate pr-3"}`} style={{ color: numeric ? "var(--color-muted)" : "var(--color-fg)" }}>
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
    </div>
  );
}
