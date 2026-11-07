// BUILD §4.4 — the footer autopilot card's "next publish time", in the state
// where there is none.
//
// REQ-040 criterion 4: with no publish scheduled, in place of a time the
// card carries one written line naming which cause holds publishing back;
// where it was ReachKit that stopped, that line names ReachKit's stop as the
// reason no publish is scheduled (REQ-092 c7) and never one of the others.
// Where no cause holds, nothing is held back: the card names the next event
// instead (`Upcoming` in `model.ts`), never a line that says nothing is planned.
//
// ADR-011 (DECISIONS 2026-08-31), verbatim: "One arbiter decides a place's
// single empty-state line over a closed cause union with fixed precedence;
// ReachKit's own stop outranks every other cause that is also true." The
// precedence is data (`NO_PUBLISH_PRECEDENCE`) and the resolver is a
// first-match over it — not a chain of `if`s whose order is whichever one a
// later editor happens to leave on top.
import type { NextPublishCause } from "@/lib/presentation/stopped";

export type NoPublishReason = "reachkit_stopped" | "address_waiting" | "publishing_paused";

/** REQ-040 c4's causes in the one order they are ever resolved in.
 *  `reachkit_stopped` is first: REQ-092 c7 requires that where ReachKit
 *  stopped its own work, that is the reason stated, whatever else is also
 *  true. */
export const NO_PUBLISH_PRECEDENCE: readonly NoPublishReason[] = Object.freeze([
  "reachkit_stopped",
  "address_waiting",
  "publishing_paused",
] as const);

/** Which of the causes hold. Every member is required — a cause that
 *  was not established is `false`, stated, never an absent field that reads
 *  the same as "no". */
export type NoPublishCauses = Record<NoPublishReason, boolean>;

/** Which of `nextPublishStatement`'s `otherwise` causes each non-stop reason
 *  is. The *line* is not chosen here: REQ-092 c7 lives in one function
 *  (`src/lib/presentation/stopped/statement.ts`), and this map is the shell's
 *  vocabulary translated into that function's argument.
 *
 *  `reachkit_stopped` is deliberately absent: it is not an `otherwise`. A
 *  stop is passed as the `stopped` flag, and the flag is what the function
 *  reads. */
export const NEXT_PUBLISH_OTHERWISE: Record<Exclude<NoPublishReason, "reachkit_stopped">, NextPublishCause> = {
  address_waiting: "address-waiting",
  publishing_paused: "paused",
};

/** First match over `NO_PUBLISH_PRECEDENCE`. `undefined` means no cause
 *  holds at all: the caller carries the next page or the next event instead. */
export function resolveNoPublish(causes: NoPublishCauses): NoPublishReason | undefined {
  return NO_PUBLISH_PRECEDENCE.find((reason) => causes[reason]);
}
