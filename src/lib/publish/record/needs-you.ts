// BUILD §9, §4.6 — why a page needs the customer, from the page's own
// record (issue 880).
//
// **The fault this module answers.** Every page whose stage is `needs_you`
// was offered "Reconnect WordPress", whatever put it there and whatever
// the site publishes to. The owner's dogfood page (2026-09-18) rests in
// `needs_attention` because three §8 hard rules stopped the writing —
// `rules:no_private_figure,no_unsourced_testimonial,honest_row` — on a site
// whose destination is hosted, healthy and live. The founder was told to
// fix a connection that is not broken and never told the real reason,
// which was on the row the whole time.
//
// **The cause is read, never guessed.** `needs_attention` is reached by
// four different movers and each records why on the transition it takes:
//
//   `rules:<rule,rule>`      §8 rule 4 — the hard rules stopped the writing
//                            (`src/lib/generate/index.ts`'s `rulesReason`)
//   `step_failed:<step>`     issue 813 — a step could not run twice
//   `step_failed:adds`       issue 1143 — the page adds too little
//   `step_failed:elsewhere`  issue 1144 — too close to a page elsewhere
//   `reason_needs_customer`  §9 — a publish failure no retry could clear
//                            (`attempt/retry.ts`'s `decideRetry`)
//   `retries_exhausted`      §9 — the publish was tried ×3 and did not go
//
// So the cause is the last `→ needs_attention` transition's own `reason`,
// parsed here and nowhere else. A reason this build does not recognise, or
// a row with none, is `unknown` — which states that the page needs them and
// claims nothing about why, rather than borrowing the loudest of the four.
//
// **Pure, and in the record's pure leaf beside `lines.ts`.** The day panel,
// the Overview alert and any later surface read the same derivation, so
// they cannot disagree about one page; and none of them pays for a
// database client to ask.
import type { State } from "../types";

/** Why a page rests in `needs_attention`. Closed, and each member carries
 *  what its own sentence and its own action need — nothing more. */
export type NeedsYouCause =
  /** §8's hard rules stopped the writing. The rules are the pipeline's own
   *  handles (`brand_gap`, …), never sentences: the draft screen
   *  lists them as its rails, and the panel states the cause. */
  | { kind: "rules"; rules: readonly string[] }
  /** A step of the pipeline could not run, twice (issue 813). */
  | { kind: "step"; step: string }
  /** A new page was written and adds too little that the web and the site
   *  do not already say (SPEC §7, D12, issue 1143). It waits on a fact only
   *  the founder has. */
  | { kind: "adds" }
  /** The page was written, and written again, and still reads almost the
   *  same as a page ReachKit wrote for another site (SPEC §7, D13, issue
   *  1144). The cause carries nothing about that page: the founder is told
   *  only that this one was held. */
  | { kind: "elsewhere" }
  /** The page could not be delivered, for a reason no retry clears — an
   *  expired or invalid credential, a record that does not point here, a
   *  destination that refused it, or no destination at all. Which of those
   *  is the destination's own state to state, on the destination; what this
   *  says is that the page is waiting on it. */
  | { kind: "destination" }
  /** The publish was attempted the full three times and did not go. */
  | { kind: "delivery" }
  /** The row records no reason this build can read. */
  | { kind: "unknown" };

export type NeedsYouKind = NeedsYouCause["kind"];

interface TransitionLike {
  to?: unknown;
  from?: unknown;
  reason?: unknown;
}

/** The reason recorded on the page's last move into `needs_attention`, or
 *  `null` where it has never taken one. Defensive over the stored column:
 *  a malformed transitions blob is a page with no stated cause, never a
 *  throw on a route the customer reads. */
export function restedReasonOf(transitions: unknown): string | null {
  if (!Array.isArray(transitions)) return null;
  const rested = [...(transitions as TransitionLike[])]
    .reverse()
    .find((move) => move !== null && typeof move === "object" && move.to === "needs_attention");
  return typeof rested?.reason === "string" && rested.reason !== "" ? rested.reason : null;
}

/** The cause a recorded reason names. `null` reason, or one this build does
 *  not know, is `unknown`. */
export function needsYouCauseOf(reason: string | null): NeedsYouCause {
  if (reason === null) return { kind: "unknown" };
  if (reason.startsWith("rules:")) {
    const rules = reason
      .slice("rules:".length)
      .split(",")
      .map((rule) => rule.trim())
      .filter((rule) => rule !== "");
    return { kind: "rules", rules };
  }
  if (reason.startsWith("step_failed:")) {
    const step = reason.slice("step_failed:".length).trim();
    if (step === "adds") return { kind: "adds" };
    if (step === "elsewhere") return { kind: "elsewhere" };
    return { kind: "step", step };
  }
  if (reason === "reason_needs_customer") return { kind: "destination" };
  if (reason === "retries_exhausted") return { kind: "delivery" };
  return { kind: "unknown" };
}

/** The cause a page's own record states, for a page that rests needing the
 *  customer — and `null` for a page in any other state, which needs nothing
 *  of them and has no cause to state. */
export function needsYouOf(a: { state: State; transitions: unknown }): NeedsYouCause | null {
  if (a.state !== "needs_attention") return null;
  return needsYouCauseOf(restedReasonOf(a.transitions));
}

/**
 * Whether a page waiting on the customer is waiting on the **destination**.
 *
 * The two delivery causes and no other: a page the hard rules stopped was
 * never sent anywhere, so nothing about the destination is true of it. This
 * is the one question the reconnect control turns on, asked once here so
 * that no surface answers it with a stage.
 */
export function waitsOnDestination(cause: NeedsYouCause | null): boolean {
  return cause !== null && (cause.kind === "destination" || cause.kind === "delivery");
}
