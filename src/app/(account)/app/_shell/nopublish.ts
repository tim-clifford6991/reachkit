// BUILD §4.4 — the footer autopilot card's "next publish time", in the state
// where there is none.
//
// REQ-040 criterion 4: "no publish is scheduled — publishing is paused,
// nothing is approved, no page is planned, or ReachKit itself stopped the
// work … in place of a time it carries one written line naming which of
// those is the case; where it was ReachKit that stopped, that line names
// ReachKit's stop as the reason no publish is scheduled (REQ-092 c7) and
// never one of the other three."
//
// ADR-011 (DECISIONS 2026-08-31), verbatim: "One arbiter decides a place's
// single empty-state line over a closed cause union with fixed precedence;
// ReachKit's own stop outranks every other cause that is also true." The
// precedence is data (`NO_PUBLISH_PRECEDENCE`) and the resolver is a
// first-match over it — not a chain of `if`s whose order is whichever one a
// later editor happens to leave on top.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-06: `nextPublishStatement(stopped: boolean)` rather than BP-054's `stop:
//   WorkStop | null`: the shell states that ReachKit stopped, never why; ADR-061's
//   unattributed empty day belongs to the calendar's empty-date resolver, not to the shell's
//   next-publish line. — #115

import type { NextPublishCause } from "@/lib/presentation/stopped";

export type NoPublishReason =
  | "reachkit_stopped"
  | "publishing_paused"
  | "nothing_approved"
  | "nothing_planned";

/** REQ-040 c4's four causes in the one order they are ever resolved in.
 *  `reachkit_stopped` is first: REQ-092 c7 requires that where ReachKit
 *  stopped its own work, that is the reason stated, whatever else is also
 *  true. */
export const NO_PUBLISH_PRECEDENCE: readonly NoPublishReason[] = Object.freeze([
  "reachkit_stopped",
  "publishing_paused",
  "nothing_approved",
  "nothing_planned",
] as const);

/** Which of the four causes hold. Every member is required — a cause that
 *  was not established is `false`, stated, never an absent field that reads
 *  the same as "no". */
export type NoPublishCauses = Record<NoPublishReason, boolean>;

/** Which of `nextPublishStatement`'s `otherwise` causes each of the three
 *  non-stop reasons is. The *line* is not chosen here: REQ-092 c7 lives in
 *  one function (`src/lib/presentation/stopped/statement.ts`), and this map
 *  is the shell's four-boolean vocabulary translated into that function's
 *  argument — never a second key table beside it (ADR-011: the precedence
 *  and the mapping have one home each, and duplicating either re-opens
 *  every failure the decision names).
 *
 *  `reachkit_stopped` is deliberately absent: it is not an `otherwise`. A
 *  stop is passed as the `stopped` flag, and the flag is what the function
 *  reads. */
export const NEXT_PUBLISH_OTHERWISE: Record<
  Exclude<NoPublishReason, "reachkit_stopped">,
  NextPublishCause
> = {
  publishing_paused: "paused",
  nothing_approved: "nothing-approved",
  nothing_planned: "none-planned",
};

/** First match over `NO_PUBLISH_PRECEDENCE`. `undefined` means no cause
 *  holds at all — which is not "no reason to show" but "a publish is
 *  scheduled", and the caller carries the time instead. */
export function resolveNoPublish(causes: NoPublishCauses): NoPublishReason | undefined {
  return NO_PUBLISH_PRECEDENCE.find((reason) => causes[reason]);
}
