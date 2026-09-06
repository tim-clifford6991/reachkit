// BUILD §8 hard rule 4 · DECISIONS 2026-08-31 ADR-070 — the one recovery
// rule, as a pure function.
//
// "Failure = regenerate; twice = needs-attention", and ADR-070 states the
// half §8 leaves implicit: **one automatic regeneration; a draft that has
// entered review is never regenerated.**
//
// Pure: it takes what happened and returns what happens next, and it
// performs neither. It reaches no database, reads no clock and makes no
// I/O. It imports nothing from the pipeline and nothing from the publishing
// engine — that absence is what keeps the dependency one-way, since the
// pipeline calls this and this calls nothing back.
//
// The case that matters most is the one that looks identical in the data to
// the ordinary one: a draft already in review that fails a re-check against
// a changed do-not-claim list has a failed hard rule and may well have zero
// automatic attempts. Regenerating it would destroy text the customer has
// already read and may have edited. `enteredReview` is therefore checked
// first, and it outranks everything.
import { GENERATION } from "@/lib/config/constants";
import type { HardRule } from "../rules/types";

export type Recovery = "regenerate_once" | "rest";

export function recoveryOutcome(a: {
  /** Non-empty: this function is only asked about a draft something stopped. */
  failed: readonly HardRule[];
  /** `drafts.hard_rule_attempts` — **automatic** attempts only. */
  automaticAttempts: number;
  /** ADR-070: post-review never regenerates, whatever stopped it. */
  enteredReview: boolean;
}): Recovery {
  if (a.failed.length === 0) return "rest";
  if (a.enteredReview) return "rest";
  return a.automaticAttempts < GENERATION.regenerations ? "regenerate_once" : "rest";
}
