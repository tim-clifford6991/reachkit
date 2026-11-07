// SPEC §4 and §7 — the publishing state, visible from every /app screen:
// Autopilot, what it is doing, and when the next page goes live.
//
// REQ-040 c3: the next page, in the customer's zone, with its title. REQ-040
// c4: with none, one written line naming the cause that holds publishing back
// — resolved by `NO_PUBLISH_PRECEDENCE`, never by this renderer — or, with no
// cause, what happens next: the next planned topic, else the Monday check.
//
// A small daisyUI card. **No toggle**: SPEC §7 (2026-09-11) — "No Copilot, no
// mode picker, on no screen and in no mail." The switch this card used to
// draw wrote nothing and was a mode picker all the same. Nor does it read
// `sites.mode` (#476): Autopilot is the only mode, so the card states it and
// has no second arm to name.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
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
  if (publishing.next !== null) return { tag: "page", at: formatDateTime(publishing.next, timeZone), title: publishing.title };
  // A stop's line is chosen by `stopped`, which ignores this tag.
  if (publishing.because === "reachkit_stopped") return { tag: "paused" };
  if (publishing.because !== null) return { tag: NEXT_PUBLISH_OTHERWISE[publishing.because] };
  const { upcoming } = publishing;
  // A planned date is a site-local calendar day, so it is drawn at noon UTC in UTC and no zone can move it a day.
  return upcoming.kind === "topic"
    ? { tag: "topic", on: formatShortDay(new Date(`${upcoming.on}T12:00:00Z`), "UTC"), topic: upcoming.topic }
    : { tag: "monday-check", on: formatShortDay(upcoming.on, timeZone) };
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
        {/* `.eyebrow` rather than the utilities: it is the ruled rung and
            carries case, weight and ink with the size. See `layout.tsx`. */}
        <h2 className="eyebrow">{copy("shell.publishing.mode.autopilot")}</h2>
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
