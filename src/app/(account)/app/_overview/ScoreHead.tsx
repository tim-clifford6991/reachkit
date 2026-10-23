// SPEC §4 (2026-10-07, issue 1319; 2026-10-09, issue 1362) — the Overview
// tab's header, when no page is in review.
//
// Today's date, the line that says what autopilot is doing (`autopilot.ts`)
// and, under it, what went live last or why nothing is planned. While a
// page is in review, `WaitingPageCard` carries the head instead. The
// Discoverability Score that stood beside this until D22 (2026-10-02) is
// the free report's alone, and the name of this file is all that is left of
// it.
//
// **It cannot overflow.** The head line and the lines under it are
// `min-w-0` blocks that wrap.
import type React from "react";
import { formatDay } from "../_shell/format";

const TEST_ID = "overview-head";

/** A quiet line under the head: why nothing is planned (the one supply
 *  statement, under the id it carries wherever it stands), or what went
 *  live last. */
export interface HeadNote {
  testId: "overview-supply" | "overview-head-note";
  line: string;
}

export function ScoreHead(p: {
  /** The head line, already written. */
  line: string;
  /** The quiet lines under it, already written. */
  notes: readonly HeadNote[];
  today: Date;
  timeZone: string;
}): React.JSX.Element {
  return (
    <header className="flex min-w-0 flex-col gap-1" data-testid={TEST_ID}>
      <p className="num text-xs font-semibold uppercase tracking-wide text-base-content/70">
        {formatDay(p.today, p.timeZone)}
      </p>
      <h1 className="min-w-0">{p.line}</h1>
      {p.notes.map((note) => (
        <p key={note.testId} className="min-w-0 text-sm text-base-content/70" data-testid={note.testId}>
          {note.line}
        </p>
      ))}
    </header>
  );
}
