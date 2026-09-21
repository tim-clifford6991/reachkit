// SPEC §4 (2026-09-20, #908) — a tab that has its address before it has its
// screen.
//
// The AI answers and Rivals tabs are #918 and #917. #915 opened each one's
// address, so the bar above them is real from the day it lands and every
// tile on the Overview has somewhere to go. What stands there until those
// issues land is this: the tab's own name, one honest line saying what will
// be here and that it is not built, and daisyUI `skeleton` blocks where the
// content will be. (Search had one of these until #916 built the screen.)
//
// **It claims nothing.** No number, no dash, no "loading": a skeleton over a
// screen that is not built is a shape, and the line beside it says so in
// words. That is the 2026-09-20 no-loading-screens rule read honestly —
// "a route paints its shell and daisyUI `skeleton` placeholders at once" —
// rather than a spinner over an empty promise.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { TAB_COPY_KEY, TAB_SOON_KEY, type OverviewTab } from "./tabs";

/** How many placeholder rows a tab draws. Enough to say "a list stands
 *  here", few enough that the screen is not a wall of grey. */
const ROWS = [0, 1, 2, 3] as const;

export function TabPlaceholder(p: {
  tab: Exclude<OverviewTab, "overview" | "search">;
}): React.JSX.Element {
  return (
    <section
      className="card card-border min-w-0 bg-base-100"
      data-testid={`overview-tab-placeholder-${p.tab}`}
    >
      <div className="card-body gap-4 p-5">
        <h1 className="card-title text-xl">{copy(TAB_COPY_KEY[p.tab])}</h1>
        <p className="max-w-prose text-sm text-base-content/70">{copy(TAB_SOON_KEY[p.tab])}</p>
        <div className="flex min-w-0 flex-col gap-3" aria-hidden>
          {ROWS.map((row) => (
            <div key={row} className="flex min-w-0 items-center gap-3">
              <div className="skeleton h-4 w-full min-w-0 flex-1" />
              <div className="skeleton h-4 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
