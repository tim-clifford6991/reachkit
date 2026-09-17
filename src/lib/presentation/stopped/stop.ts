// BUILD §6.5, §11 — the fact that ReachKit stopped its own work, in the
// only shape this module accepts.
//
// §6.5: "Caps degrade (skip remaining optional work, mark scan `degraded`),
// never throw". §11: "kill switch env var stops scan+generate+publish".
// REQ-092 is what the customer is owed when either happens.
//
// `WorkStop` carries **no cause field of any kind** — no cap, no spend
// amount, no error text, no system status, no HTTP code. REQ-092 c8 ("it
// names no internal cause") is unrepresentable here rather than tested for:
// there is nothing in this shape for a renderer to leak. Do not add one;
// `stop.test.ts` asserts the key set by name.
import type { CopyKey } from "../copy/index.ts";

export interface WorkStop {
  /** When ReachKit stopped. Used for "which days does this account for",
   *  never rendered as a cause. */
  since: Date;
  /** REQ-092 c4: the date the work is expected to resume, or an explicit
   *  statement that no time is promised. Not optional — "never neither" is
   *  the criterion, and an optional field is exactly how neither happens. */
  resumes: { on: Date } | { promised: false };
  /** REQ-092 c2: whether anything is needed from the customer. The
   *  'nothing' arm is what makes "and when nothing is, says so" a rendered
   *  sentence rather than an omission. */
  needs: { kind: "nothing" } | { kind: "action"; key: CopyKey };
  /** REQ-092 c6: the work was cut short but a page was still produced, so
   *  the day states that part of the measurement behind it was not done
   *  and is never presented as a complete pass. */
  partial: boolean;
}

/** The two stop shapes that are real stops (issue 841, owner 2026-09-17):
 *  the kill switch is engaged, or the day's spend ceiling is reached.
 *  Internal only — the returned handle is never rendered, never reaches a
 *  `CopyKey`, and is never placed in a `WorkStop`. It exists so a
 *  resumption date can be derived per shape and so a stop can be logged
 *  where logging is allowed.
 *
 *  **There is no third shape for a pass that ended `degraded` or `failed`.**
 *  A pass that found too little market is stored `degraded` (its SERPs and
 *  rivals sections are missing), and reading that as "ReachKit stopped its
 *  own work" told a founder whose kill switch was off, and whose day had
 *  spent 4.41¢ of its ceiling, something false. A thin market is the
 *  market-too-small state; a pass that failed is the pass's own record. */
export type StopShape = "spend-ceiling" | "halted";

/** Classification order: the strongest fact wins. A kill switch is a
 *  halt whatever else is true; a ceiling reached is a spend ceiling.
 *  `null` is "ReachKit has not stopped", the value that makes every
 *  downstream statement render from the other cause set. */
export function stopCause(facts: { capHit: boolean; killSwitch: boolean }): StopShape | null {
  if (facts.killSwitch) return "halted";
  if (facts.capHit) return "spend-ceiling";
  return null;
}
