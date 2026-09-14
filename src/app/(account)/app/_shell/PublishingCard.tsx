// SPEC §4 and §7 — the publishing state, visible from every /app screen: the
// mode's word, what it is doing, and when the next page goes live.
//
// REQ-040 c3: the next scheduled publish, in the customer's zone. REQ-040 c4:
// with no publish scheduled, one written line naming which cause it is —
// resolved by `NO_PUBLISH_PRECEDENCE`, never by this renderer.
//
// A small daisyUI card. **No toggle**: SPEC §7 (2026-09-11) — "No Copilot, no
// mode picker, on no screen and in no mail." The switch this card used to
// draw wrote nothing and was a mode picker all the same.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { nextPublishStatement } from "@/lib/presentation/stopped";
import { NEXT_PUBLISH_OTHERWISE } from "./nopublish";
import { formatDateTime } from "./format";
import { writtenLine } from "./written";
import type { ShellModel } from "./model";

const MODE_COPY_KEY = {
  autopilot: "shell.publishing.mode.autopilot",
  copilot: "shell.publishing.mode.copilot",
} as const;

/** What the mode is doing. A `Record` over the same two modes, so a mode with
 *  no sentence is a compile error. */
const STATE_COPY_KEY = {
  autopilot: "shell.publishing.state.autopilot",
  copilot: "shell.publishing.state.copilot",
} as const;

export function PublishingCard(p: { shell: ShellModel }): React.JSX.Element {
  const { publishing, timeZone } = p.shell;

  // REQ-040 c3's time, or c4's line for the resolved reason — both through
  // `nextPublishStatement`, REQ-092 c7's one home: while ReachKit has stopped
  // its own work, the statement names the stop and gives no other reason.
  // `otherwise` still carries whichever other cause the shell resolved, and
  // the statement ignores it when stopped (ADR-011 point 5).
  const statement = nextPublishStatement({
    stopped: publishing.next === null && publishing.because === "reachkit_stopped",
    otherwise:
      publishing.next !== null
        ? { tag: "scheduled", at: formatDateTime(publishing.next, timeZone) }
        : {
            tag:
              publishing.because === "reachkit_stopped"
                ? "none-planned"
                : NEXT_PUBLISH_OTHERWISE[publishing.because],
          },
  });
  // Before the first weekly pass the card states that it is waiting on the
  // deep pass. The arm is the shell's own `WeekCount` — the same fact the
  // domain block reads — so the two cannot disagree. An unwritten sentence
  // renders as nothing.
  const state =
    p.shell.weeks.kind === "counted"
      ? writtenLine(STATE_COPY_KEY[publishing.mode])
      : writtenLine("shell.publishing.state.week-zero");

  return (
    <section className="card card-sm bg-base-200 min-w-0" data-testid="shell-publishing">
      <div className="card-body min-w-0 gap-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {copy(MODE_COPY_KEY[publishing.mode])}
        </h2>
        {state === null ? null : (
          <p className="text-sm font-semibold" data-testid="shell-publishing-state">
            {state}
          </p>
        )}
        <p className="text-xs opacity-70" data-testid="shell-publishing-line">
          {statement.line}
        </p>
      </div>
    </section>
  );
}
