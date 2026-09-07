// BUILD §2.2 — daisyUI `table`, always inside its scroll wrap.
// src/ui/components/Table.tsx
//
// `components.md` §1, verbatim: "`table` (+`zebra`), **always inside an
// `overflow-x-auto` wrap** — the wrap is part of the component, not the
// caller's job" | "rows · empty (caller-supplied written line) · **never a
// skeleton**".
//
// The `overflow-x-auto` wrap has no prop to omit it — it is always the
// outer element this component renders, never left to the caller. There is
// no loading prop at all: the contract admits no skeleton state, so one is
// not built for a caller to reach. `emptyMessage` is required (no fallback)
// even when `rows` is non-empty, so the string can never be a silent
// default supplied only when needed.
import type React from "react";

export interface TableColumn {
  key: string;
  /** Required — column headers are caller copy, never invented here. */
  header: React.ReactNode;
}

export function Table(p: {
  columns: TableColumn[];
  rows: Array<Record<string, React.ReactNode>>;
  zebra?: boolean;
  /** Required — the caller-supplied written line for the empty state. No
   * fallback exists, even though it is only rendered when `rows` is empty. */
  emptyMessage: React.ReactNode;
}): React.JSX.Element {
  const classes = ["table"];
  if (p.zebra) classes.push("table-zebra");

  return (
    // `min-w-0` alongside the wrap, added 2026-09-05 (issue #13): a flex
    // or grid child defaults to `min-width: auto`, so inside a `card-body`
    // — which is a flex column, and where §2.2 puts most tables — this
    // wrapper refused to narrow past the table's own content width and
    // pushed the document sideways instead of scrolling. An
    // `overflow-x-auto` box that cannot shrink never scrolls, so the wrap
    // was not doing the job §2.2 gives it. Caught by the layout
    // conformance sweep at 320px on the first route to render a table.
    <div className="min-w-0 overflow-x-auto">
      <table className={classes.join(" ")}>
        <thead>
          <tr>
            {p.columns.map((col) => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.rows.length === 0 ? (
            <tr>
              <td colSpan={p.columns.length}>{p.emptyMessage}</td>
            </tr>
          ) : (
            p.rows.map((row, i) => (
              <tr key={`${i}-${p.columns[0]?.key ?? "row"}`}>
                {p.columns.map((col) => (
                  <td key={col.key}>{row[col.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
