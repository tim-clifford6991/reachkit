// SPEC §5 (2026-09-20, #908, #923) — the rivals step's right-hand side.
//
// "The searches measured so far × you and each rival, dots for
// first-two-pages presence, as CSS grid."
//
// **CSS grid, not a chart** (docs/DESIGN.md rule 2: "grids that are not
// series … are CSS grid"). It is the same shape the AI answers tab draws
// its question × engine grid in, and for the same reason — a presence
// matrix is not a series.
//
// **Every dot is named, and no dot is colour alone** (§2.4). Each cell
// carries an `aria-label` saying whose row it is, which search it is, and
// whether that site holds a place; the row header is the domain itself; the
// line under the grid states the customer's own count in words. A reader
// who sees neither colour nor shape still reads it.
//
// **Nothing measured is nothing drawn** (REQ-004). With no grid the panel
// shows a daisyUI `skeleton` and one written line — never a grid of empty
// dots, which would say every rival beat this customer on searches nobody
// measured. `_setup/panel-rivals.ts` decides when there is nothing to draw;
// this file only draws it.
//
// **The rows are subgrid.** A `display: contents` row generates no box, so
// every cell inside one measures as escaping a parent that is 0×0 — which
// is what `tests/ui/layout/checks.ts`'s containment check reports, and
// rightly (the same finding #952 records for its own grid).
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { formatCount } from "../app/_overview/present";
import type { RivalGrid } from "./_setup/panel-rivals";

/** How many placeholder rows stand in for a grid nobody has measured yet.
 *  A count, not a sentence: it says nothing to a reader. */
const PLACEHOLDER_ROWS = 4;

export function RivalsPanel(p: { grid: RivalGrid | null }): React.JSX.Element {
  if (p.grid === null) {
    return (
      <div className="grid min-w-0 gap-3" data-testid="setup-rivals-panel">
        <div className="grid min-w-0 gap-2" aria-hidden>
          {Array.from({ length: PLACEHOLDER_ROWS }, (_, row) => (
            <div key={row} className="skeleton h-5 w-full min-w-0" />
          ))}
        </div>
        <p className="text-sm text-base-content/70" data-testid="setup-rivals-pending">
          {copy("setup.panel.rivals.pending")}
        </p>
      </div>
    );
  }

  const grid = p.grid;
  return (
    <div className="grid min-w-0 gap-3" data-testid="setup-rivals-panel">
      <div
        role="table"
        aria-label={copy("setup.panel.rivals.grid.label")}
        // The domain column takes what is left and each search is one fixed
        // narrow column, so the grid is exactly as wide as its panel at
        // every width and nothing scrolls sideways.
        className="grid min-w-0 items-center gap-y-1"
        style={{
          gridTemplateColumns: `minmax(0,1fr) repeat(${Math.max(grid.searches.length, 1)}, 1.25rem)`,
        }}
        data-testid="setup-rivals-grid"
      >
        {grid.rows.map((row) => (
          <div
            key={row.domain}
            role="row"
            className="col-span-full grid grid-cols-subgrid py-0.5"
            data-testid="setup-rivals-row"
          >
            <span
              role="rowheader"
              className={`num min-w-0 truncate pr-2 text-xs ${
                row.you ? "font-semibold text-(--chart-you)" : "text-base-content/70"
              }`}
              title={row.domain}
            >
              {row.domain}
            </span>
            {row.present.map((present, column) => (
              <span
                key={column}
                role="cell"
                data-present={present}
                aria-label={copy("setup.panel.rivals.cell", {
                  site: row.domain,
                  search: grid.searches[column] ?? "",
                  state: copy(
                    present ? "setup.panel.rivals.present" : "setup.panel.rivals.absent"
                  ),
                })}
                className="flex items-center justify-center"
              >
                <span
                  aria-hidden
                  className={`block size-2.5 rounded-full ${
                    present
                      ? row.you
                        ? "bg-(--chart-you)"
                        : "bg-(--chart-rival)"
                      : "border border-base-300 bg-base-100"
                  }`}
                />
              </span>
            ))}
          </div>
        ))}
      </div>

      <p className="text-sm text-base-content/70" data-testid="setup-rivals-line">
        {copy("setup.panel.rivals.line", {
          n: formatCount(grid.yours),
          m: formatCount(grid.of),
        })}
      </p>
    </div>
  );
}
