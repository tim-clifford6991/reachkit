// SPEC §4 *Overview's four tiles* — the foot of a detail's list. Every row is
// drawn (`rowClass`), so it is not shown where every row already fits, and
// pressing it re-reads the screen with `?all=true` so a reload keeps the rest.
"use client";

import type React from "react";
import { useQueryStates } from "nuqs";
import { ROWS, SHOW_ALL } from "./frame";

export function ShowAll(p: { total: number; label: string }): React.JSX.Element | null {
  const [{ all }, set] = useQueryStates(SHOW_ALL, { shallow: false });
  if (all || p.total <= ROWS.below) return null;
  return (
    <button
      type="button"
      className={`btn btn-soft btn-sm min-h-11 w-full sm:w-auto ${p.total <= ROWS.lg ? "lg:hidden" : ""}`}
      onClick={() => void set({ all: true })}
    >
      {p.label}
    </button>
  );
}
