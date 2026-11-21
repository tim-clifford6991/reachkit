// SPEC §7 *This week* — the head: the week of service, how many pages it
// holds, and one quiet line of when they were chosen, go live and are
// checked next. One function for the loaded screen and its waiting state,
// so the two are one shape.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { Box } from "../_shell/skeletons";
import type { ScreenHead } from "./week-screen";

/** `null` draws the waiting state: the name, then boxes for the two lines read from the week. */
export function PlanHead(p: { words: ScreenHead | null }): React.JSX.Element {
  const w = p.words;
  return (
    <header className="flex min-w-0 shrink-0 flex-col gap-1" data-testid="plan-head">
      {/* The screen's name needs no read, so the waiting state already says it. */}
      <span className="eyebrow">{w === null ? copy("shell.nav.plan") : w.eyebrow}</span>
      {w === null ? <Box className="h-8 w-60 max-w-full" /> : <h1 className="text-2xl font-semibold">{w.title}</h1>}
      {w === null ? (
        <Box className="h-5 w-96 max-w-full" />
      ) : (
        <>
          {w.line === null ? null : (
            // The line carries the publish time only where one is promised.
            <p className="min-w-0 text-sm text-base-content/70 wrap-anywhere" data-testid={w.timed ? "plan-week-time" : "plan-head-line"}>
              {w.line}
            </p>
          )}
          {w.paused === null ? null : <p className="min-w-0 text-sm wrap-anywhere" data-testid="plan-head-paused">{w.paused}</p>}
        </>
      )}
    </header>
  );
}
