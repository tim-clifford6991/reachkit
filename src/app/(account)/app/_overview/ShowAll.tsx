// SPEC §4 *Overview's four tiles* — the foot of a detail's list: its first rows
// (`ROWS`), then one control that opens the rest, held in the address as `?all=1`.
"use client";

import type React from "react";
import { parseAsBoolean, useQueryState } from "nuqs";

export function ShowAll(p: { label: string }): React.JSX.Element | null {
  const [all, setAll] = useQueryState("all", parseAsBoolean.withDefault(false));
  if (all) return null;
  return (
    <button type="button" className="btn btn-soft btn-sm min-h-11 w-full sm:w-auto" onClick={() => void setAll(true)}>
      {p.label}
    </button>
  );
}
