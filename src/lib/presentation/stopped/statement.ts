// BUILD §6.5, §11 — the one statement that ReachKit did not do the work,
// and the one statement of when the next page publishes.
//
// ADR-011 (DECISIONS 2026-08-31): "ReachKit's own stop outranks every other
// cause that is also true." Point 5 of that decision is implemented
// literally below — `nextPublishStatement` **ignores** `otherwise` while a
// stop is present. Not "prefers": ignores. The other causes are not
// consulted, not appended, not shown as secondary text.
//
// **The early return reads like a missing `else if`, and is not one.** A
// customer whose publishing is paused *and* whose account ReachKit stopped
// is told about the stop only; the paused line appears when the stop
// clears. ADR-011 `## Consequences` says in as many words that this will be
// reported as a bug at least once. Read that file before "fixing" it: the
// cost of the fix is REQ-092's user story — the customer told to fix
// something that was never theirs, who fixes it and still gets no page.
//
// Every line here is a registry key. This module writes no sentence, reads
// no clock, takes no session, reader or persona argument, and names no
// internal cause: `WorkStop` has no field one could travel in (see
// `stop.ts`).
import { copy, type CopyKey } from "../copy/index.ts";
import type { Cause } from "../place/index.ts";
import type { WorkStop } from "./stop.ts";

/** REQ-092 c1, c2, c4 and c8. The one statement that ReachKit did not do
 *  the work. Every surface that says so says it through this function, and
 *  all three fields are always returned — none is conditional, none is
 *  `undefined`. `formatDate` is the caller's zone-aware formatter: a date
 *  with no zone beside it is a guess, and this module holds no zone. */
export function stoppedWorkStatement(
  stop: WorkStop,
  o: { formatDate: (on: Date) => string }
): { line: string; needsLine: string; resumesLine: string } {
  return {
    // "ReachKit stopped its own work" — never "there was nothing worth
    // publishing", which is REQ-043 c3's reserved sentence.
    line: copy("stopped.work.line"),
    needsLine:
      stop.needs.kind === "action"
        ? copy(stop.needs.key)
        : copy("stopped.work.needs-nothing"),
    resumesLine:
      "on" in stop.resumes
        ? copy("stopped.work.resumes-on", { date: o.formatDate(stop.resumes.on) })
        : copy("stopped.work.no-time-promised"),
  };
}

/** The causes REQ-040 c4 admits when ReachKit has not stopped. This module
 *  adds none: the set is that criterion's and is closed there. */
export type NextPublishCause = "paused" | "nothing-approved" | "none-planned";

export type NextPublishOtherwise = { tag: NextPublishCause } | { tag: "scheduled"; at: string };

const OTHERWISE_KEY = {
  scheduled: "next-publish.scheduled",
  paused: "next-publish.paused",
  "nothing-approved": "next-publish.nothing-approved",
  "none-planned": "next-publish.none-planned",
} as const satisfies Record<NextPublishOtherwise["tag"], CopyKey>;

/** REQ-092 c7. Every statement of when the next page publishes — the
 *  navigation's, the footer autopilot card's next-publish time, a mail's
 *  statement of what publishes next — renders through this one function.
 *
 *  `stopped` is the fact of a stop, not the `WorkStop` itself. BP-054
 *  declared `stop: WorkStop | null`; the object cannot express ADR-061's
 *  unattributed empty ("an unattributed empty day is ReachKit's own stop"),
 *  which is a stop with no `WorkStop` behind it, and handing the object to
 *  a renderer that needs only the fact is how a field gets read. Cost of
 *  reversing: one parameter and its two call sites. */
export function nextPublishStatement(a: {
  stopped: boolean;
  /** Ignored entirely when `stopped` is true. That is the point, and it is
   *  asserted in `statement.test.ts`, not merely documented. */
  otherwise: NextPublishOtherwise;
}): { line: string; key: CopyKey } {
  // ADR-011 point 5 — "Not 'prefers'; ignores". `a.otherwise` is read
  // nowhere on this path. Do not add an `else if`, do not append a second
  // clause, do not pass `otherwise` as a slot.
  if (a.stopped) return { line: copy("next-publish.stopped"), key: "next-publish.stopped" };

  const key: CopyKey = OTHERWISE_KEY[a.otherwise.tag];
  if (a.otherwise.tag === "scheduled") {
    return { line: copy(key, { at: a.otherwise.at }), key };
  }
  return { line: copy(key), key };
}

/** REQ-092 c1 and c6, as the single account a date carries. Returns the
 *  `Cause` the place module's `account()` arbitrates — never a line placed
 *  directly on a screen, so a stopped day cannot end up with two accounts.
 *
 *  `instructionOutstanding` is the third parameter BP-054's declared
 *  signature does not carry and ADR-011 point 4 makes load-bearing: the
 *  stop outranks the customer's outstanding instruction *and carries it*,
 *  inside `needs`. A stop arbitrated over an outstanding instruction while
 *  `needs.kind === 'nothing'` would drop that instruction, so it throws —
 *  an assertion, not a silent merge, because a silent merge is how the
 *  instruction disappears. The message names neither the instruction's text
 *  nor any internal cause. */
export function dayAccount(
  stop: WorkStop,
  pageProduced: boolean,
  instructionOutstanding: boolean
): (Cause & { tag: "reachkit-stopped" }) | { tag: "reachkit-stopped"; line: string; partialPass: true } {
  if (instructionOutstanding && stop.needs.kind === "nothing") {
    throw new Error(
      "dayAccount(): a stop arbitrated over an outstanding customer instruction must carry it " +
        "in its own needs arm (ADR-011 point 4); this stop needs nothing, so the instruction would be lost."
    );
  }
  if (pageProduced && stop.partial) {
    return { tag: "reachkit-stopped", line: copy("stopped.work.partial-pass"), partialPass: true };
  }
  return { tag: "reachkit-stopped", line: copy("stopped.work.line") };
}
