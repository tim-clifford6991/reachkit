// BUILD §9 — the state machine as frozen data.
//
// §9's diagram, verbatim:
//
//     planned → generating → in_review → approved → publishing → published
//                               ↓ veto                  ↓ fail
//                            skipped            failed → retry ×3 → needs_attention
//     published → unpublished (always available)
//
// Fifteen edges, ten states, two terminal. The table is data and nothing
// else — no function, no clock, no row read — so it can be asserted member
// by member without a database. `transition()` (`./index.ts`) is the only
// thing that moves a page along it.
//
// The archived plan is WO-207.
import type { State } from "../types";

/** The ten states, in the order §9 draws them. */
export const STATES: readonly State[] = Object.freeze([
  "planned",
  "generating",
  "in_review",
  "approved",
  "publishing",
  "published",
  "skipped",
  "failed",
  "needs_attention",
  "unpublished",
] as const);

/**
 * The fifteen edges, transcribed — not derived, not sorted, not generated.
 *
 * Five are implied by §9's prose rather than drawn by its diagram, and each
 * is stated with its source:
 *
 *  - `planned → skipped` — §9's draft-by-default: the customer may stop a
 *    page before anything is generated for it, and there is no other state
 *    for a page taken off its date.
 *  - `generating → needs_attention` — §8 rule 4: "failure = regenerate,
 *    twice = needs-attention", so no failure leaves a page resting in
 *    `generating`.
 *  - `needs_attention → publishing` — §9 makes an expired credential "a
 *    **state** (reconnect prompt, queue holds), not an error loop"; the
 *    queue that holds resumes into the publish it was holding.
 *  - `needs_attention → generating` — the customer's own restart, which is
 *    why §8's bound on *automatic* regeneration is not raised by it.
 *  - `needs_attention → skipped` — §9 c3's promise that no page is left in
 *    a state it has no way out of.
 *
 * There is no edge back out of `skipped` or `unpublished`, and none into
 * `planned`: a page the customer stopped or took down is never returned to
 * a destination by any later attempt.
 */
export const TRANSITIONS: readonly (readonly [State, State])[] = Object.freeze([
  Object.freeze(["planned", "generating"] as const),
  Object.freeze(["planned", "skipped"] as const),
  Object.freeze(["generating", "in_review"] as const),
  Object.freeze(["generating", "needs_attention"] as const),
  Object.freeze(["in_review", "approved"] as const),
  Object.freeze(["in_review", "skipped"] as const),
  Object.freeze(["approved", "publishing"] as const),
  Object.freeze(["publishing", "published"] as const),
  Object.freeze(["publishing", "failed"] as const),
  Object.freeze(["failed", "publishing"] as const),
  Object.freeze(["failed", "needs_attention"] as const),
  Object.freeze(["needs_attention", "publishing"] as const),
  Object.freeze(["needs_attention", "generating"] as const),
  Object.freeze(["needs_attention", "skipped"] as const),
  Object.freeze(["published", "unpublished"] as const),
] as const);

/** The two states no edge leaves. Written once and asserted against
 *  `TRANSITIONS` rather than maintained as a second list. */
export const TERMINAL: readonly State[] = Object.freeze(["skipped", "unpublished"] as const);

/** Why a move was refused. Two members: the move is not one of the fifteen,
 *  or it is and a named guard said no. A refusal is never an exception and
 *  never leaves the page somewhere else. */
export type Refusal = "not_a_transition" | "guard";

/** The eight named guards. A guard is a condition on an *edge*, evaluated
 *  in list order; the first that fails names itself in the refusal. */
export type GuardId =
  /** needs_attention → publishing: only a draft that passed every
   *  generation hard rule, so a draft one of those rules stopped is never
   *  published by starting an attempt. */
  | "draft_passed_hard_rules"
  /** needs_attention → generating: only a page whose draft never entered
   *  review, so §8's bound on automatic regeneration is never raised. */
  | "never_entered_review"
  /** needs_attention → generating: and only when the customer starts it. */
  | "customer_initiated"
  /** approved/failed → publishing: the publishable rule (#46). */
  | "publishable_and_due"
  /** approved → publishing: the customer was told, on the pair actually in
   *  force, either the interval they have to stop it or that none exists
   *  (#46). */
  | "customer_told"
  /** every edge whose target is `publishing`. */
  | "publishing_switch_on"
  /** every edge whose target is `publishing`. */
  | "within_ceilings"
  /** every edge whose target is `publishing`. */
  | "destination_working";

/** The key an edge is looked up under. One spelling, written once, so the
 *  table and every lookup cannot disagree. */
export function edgeKey(from: State, to: State): string {
  return `${from}→${to}`;
}

/**
 * Is this pair one of the fifteen? The one membership question about the
 * table, answered here beside it rather than at each caller — and answered
 * in the leaf that reaches nothing, so a surface may ask it without
 * pulling `transition()`'s database in behind the answer.
 */
export function isTransition(from: State, to: State): boolean {
  return TRANSITIONS.some(([f, t]) => f === from && t === to);
}

/**
 * The guards each edge carries, keyed `'from→to'`. An absent key means no
 * guard: the move is open the moment it is one of the fifteen.
 *
 * Every edge whose target is `publishing` carries the same three
 * ambient guards — the switch, the ceilings and the destination — because
 * "no publish attempt begins" has to be true of every route into an
 * attempt, not of the ordinary one only.
 */
export const GUARDS: Readonly<Record<string, readonly GuardId[]>> = Object.freeze({
  [edgeKey("approved", "publishing")]: Object.freeze([
    "publishable_and_due",
    "customer_told",
    "publishing_switch_on",
    "within_ceilings",
    "destination_working",
  ] as const),
  [edgeKey("failed", "publishing")]: Object.freeze([
    "publishable_and_due",
    "customer_told",
    "publishing_switch_on",
    "within_ceilings",
    "destination_working",
  ] as const),
  [edgeKey("needs_attention", "publishing")]: Object.freeze([
    "draft_passed_hard_rules",
    "publishing_switch_on",
    "within_ceilings",
    "destination_working",
  ] as const),
  [edgeKey("needs_attention", "generating")]: Object.freeze([
    "never_entered_review",
    "customer_initiated",
  ] as const),
});
