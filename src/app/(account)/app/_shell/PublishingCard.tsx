// SPEC §4 and §7 — the publishing state, visible from every /app screen:
// whether publishing is on, and what happens next.
//
// REQ-040 c3: the next page, in the customer's zone, with its title. REQ-040
// c4: with none, one written line naming the cause that holds publishing back
// — resolved by `NO_PUBLISH_PRECEDENCE`, never by this renderer — or the one
// next event `nextEvent` picked: a page, a planned topic or the Monday check.
//
// A small daisyUI card. **No toggle**: SPEC §7 (2026-09-11) — "No Copilot, no
// mode picker, on no screen and in no mail." The switch this card used to
// draw wrote nothing and was a mode picker all the same. Nor does it read
// `sites.mode` (#476): Autopilot is the only mode, so the card states it and
// has no second arm to name.
import type React from "react";
import { nextPublishStatement, type NextPublishOtherwise } from "@/lib/presentation/stopped";
import { NEXT_PUBLISH_OTHERWISE } from "./nopublish";
import { formatDateTime, formatShortDay } from "./format";
import { writtenLine } from "./written";
import type { PublishingState, ShellModel } from "./model";

/** The card's one statement, which the phone's top bar states too (SPEC §4,
 *  2026-10-08, issue 1339): one sentence, resolved in one place. */
export function publishingStatement(shell: ShellModel): { line: string } {
  const { publishing, timeZone } = shell;

  // Through `nextPublishStatement`, REQ-092 c7's one home: while ReachKit has
  // stopped its own work, the statement names the stop and ignores `otherwise`
  // (ADR-011 point 5).
  return nextPublishStatement({
    stopped: publishing.next === null && publishing.because === "reachkit_stopped",
    otherwise: otherwiseOf(publishing, timeZone),
  });
}

function otherwiseOf(publishing: PublishingState, timeZone: string): NextPublishOtherwise {
  if ("because" in publishing && publishing.because !== null) {
    // A stop's line is chosen by `stopped`, which ignores this tag.
    return publishing.because === "reachkit_stopped" ? { tag: "paused" } : { tag: NEXT_PUBLISH_OTHERWISE[publishing.because] };
  }
  const { upcoming } = publishing;
  // A planned date is a site-local calendar day, so it is drawn at noon UTC in UTC and no zone can move it a day.
  const day = (on: string): string => formatShortDay(new Date(`${on}T12:00:00Z`), "UTC");
  if (upcoming.kind === "monday-check") return { tag: "monday-check", on: formatShortDay(upcoming.on, timeZone) };
  if (upcoming.kind === "topic") return { tag: "topic", on: day(upcoming.on), topic: upcoming.topic };
  if (upcoming.at !== null) return { tag: "page", at: formatDateTime(upcoming.at, timeZone), title: upcoming.title };
  return { tag: upcoming.writing ? "writing" : "ready", on: day(upcoming.on), title: upcoming.title };
}

export function PublishingCard(p: { shell: ShellModel }): React.JSX.Element {
  const statement = publishingStatement(p.shell);
  // Before the first weekly pass the card states that it is waiting on the
  // deep pass. The arm is the shell's own `WeekCount` — the same fact the
  // domain block reads — so the two cannot disagree. An unwritten sentence
  // renders as nothing.
  const state =
    p.shell.weeks.kind === "counted"
      ? writtenLine("shell.publishing.state.autopilot")
      : writtenLine("shell.publishing.state.week-zero");

  return (
    <section className="card card-sm bg-base-200 min-w-0" data-testid="shell-publishing">
      <div className="card-body min-w-0 gap-1">
        {/* Board Main states the mode once, as "Publishing on"; an "Autopilot" eyebrow above it said it twice. */}
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
