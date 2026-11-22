// SPEC §4 (plate O4) — On Google's three pills. The choice is `?show=`, so the server draws the rows it names.
"use client";

import type React from "react";
import { useQueryStates } from "nuqs";
import { copy } from "@/lib/presentation/copy";
import { GOOGLE_SHOWN, SHOW_GOOGLE } from "./frame";
import { FILTER_PILL } from "./present";

export function GoogleFilter(p: { labels: Readonly<Record<(typeof GOOGLE_SHOWN)[number], string>> }): React.JSX.Element {
  const [{ show }, set] = useQueryStates(SHOW_GOOGLE, { shallow: false });
  return (
    <div className="flex min-w-0 flex-wrap gap-2" role="radiogroup" aria-label={copy("overview.google.filter.label")} data-testid="google-filter">
      {(["all", "showing", "not-yet"] as const).map((id) => (
        <input
          key={id}
          type="radio"
          name="google-show"
          className={FILTER_PILL}
          aria-label={p.labels[id]}
          checked={show === id}
          onChange={() => void set({ show: id })}
        />
      ))}
    </div>
  );
}
