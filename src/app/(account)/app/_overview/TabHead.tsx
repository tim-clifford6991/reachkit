// SPEC §4 (2026-10-07, issue 1324) — the head of Search, AI answers and
// Rivals: the screen's name, and the day its numbers were measured.
//
// One row, and nothing under it: the numbers are the first region of each
// of the three screens, so the head carries no sentence. The route and its
// waiting state both draw it, so the two cannot drift — the name needs no
// read and is there from the first paint; the date is the caller's, a line
// once it is known and a box until then. The date wraps under the name
// only where the two do not fit one line.
import type React from "react";

export function TabHead(p: {
  title: string;
  testId: string;
  /** "Measured 1 Oct 2026." — or its box, or nothing where no pass ran. */
  measured: React.ReactNode;
}): React.JSX.Element {
  return (
    <header className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h1 className="card-title text-base" data-testid={`${p.testId}-title`}>
        {p.title}
      </h1>
      {p.measured}
    </header>
  );
}
