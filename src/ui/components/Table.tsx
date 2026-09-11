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
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-07: A two-column data listing on a screen is the registered Table inside
//   its overflow-x-auto wrap, never a hand-built grid; module grids align cards to the start;
//   a domain is a value and is never wrapped mid-word. — #244

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
            {/* The header may fold; a cell never does (issue #307).
                A header is a label — the caller's word for what the column
                holds — and a label that cannot fold sets the column's
                minimum from its longest token. That is how a 32px column
                of counts came to demand 119px and pushed the report's
                three-column table to 455px inside a 430px card at 1024.

                **Both properties, because daisyUI sets `white-space:
                nowrap` on `thead th` itself.** `wrap-anywhere` alone
                changed nothing and measured as if it had: `overflow-wrap`
                has nothing to act on while the line cannot break at all,
                so the column minimum stayed exactly where it was and the
                first two attempts at this fix were invisible.

                A value in a cell still never folds — that rule is
                `.num`'s, and nothing here reaches it.

                **`break-words`, not `wrap-anywhere` (issue #352).** The
                stronger property also lets a header break *inside* a word
                where the column is narrower than it, and the approved copy
                landing on the report's own table showed what that reads
                like: `Volume` drawn as `Volum` / `e` above a column of
                four-digit counts. `break-word` keeps the fold — a header
                still wraps at its spaces and still sets its column's
                minimum from its longest *word* rather than its longest
                line — and refuses the break that rewrites the word. The
                two are the same wherever a header holds no word longer
                than its column, which is every table in the product. */}
            {p.columns.map((col) => (
              <th key={col.key} className="whitespace-normal break-words">
                {col.header}
              </th>
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
