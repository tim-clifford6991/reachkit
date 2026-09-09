// UI-SPEC S16 — the Decide rail's Checks list, and the one rule that keeps
// it honest.
//
// S16 names four of §8's ten hard rules: "grounded · do-not-claim ·
// near-duplicate · no invented author". They are not this screen's
// invention and they are not a fifth vocabulary — `HardRule`
// (`src/lib/generate/rules/types.ts`) is the closed list §8 runs, and the
// four below are members of it, so a rule renamed there is a compile error
// here rather than a row that quietly means something else.
//
// **A row is drawn only for a check this product actually decided.** The
// rail states outcomes; it never states that a check ran. Two of the four
// are decided from facts this view already holds and therefore always have
// an answer:
//
//   `grounding`    — the recorded passage still occurs in the body as it
//                    now stands. The same question the highlight asks
//                    (`grounded.ts`), asked once and answered in both
//                    places, so a marked fact and a passed grounding row
//                    cannot disagree.
//   `do_not_claim` — the claim check's own state, which the badge at the
//                    head of the card already carries. Read from the same
//                    value for the same reason.
//
// The other two are §8's, recorded at generation and read back — never
// inferred from the draft's state. It is true that a draft in review
// passed the battery (§8 stops one that did not), but "it must have
// passed" is not "it passed": the row would then be a deduction the screen
// made about a run it never saw, and the first time the pipeline changed
// it would be a false one. Where generation has recorded nothing, the row
// is absent. Absent is not a failure and is not a pass; it is the screen
// declining to speak for a check it has no result for, which is §2.5's
// rule applied to a list of results.
//
// A rule that did **not** pass is likewise not drawn as a row. For
// `near_duplicate` and `no_invented_people` a failure is unreachable here
// — §8 refuses the draft and it never reaches review — and for the two
// live ones the failure is already stated where the customer is looking:
// the claim badge turns and names the entry it matched (c11), and the
// grounded block prints the fact that is no longer in the body (c8, c2).
// A red row repeating either would be the same fact twice in one screen.
import type { CopyKey } from "@/lib/presentation/copy";
import type { HardRule } from "@/lib/generate/rules/types";
import type { ClaimState } from "./model";

/** The four §8 rules S16 names, in the order the set lists them. A member
 *  outside `HardRule` does not compile. */
export const RAIL_CHECKS = [
  "grounding",
  "do_not_claim",
  "near_duplicate",
  "no_invented_people",
] as const satisfies readonly HardRule[];

export type RailCheck = (typeof RAIL_CHECKS)[number];

/** The two §8 rules whose outcome this view cannot compute and must read
 *  from what generation recorded. */
export const RECORDED_CHECKS: readonly RailCheck[] = Object.freeze([
  "near_duplicate",
  "no_invented_people",
]);

/** One sentence per rule — the set's own, and the pass wording, because a
 *  row is only ever drawn for a pass. */
export const CHECK_COPY_KEY: Readonly<Record<RailCheck, CopyKey>> = Object.freeze({
  grounding: "draft.checks.grounded",
  do_not_claim: "draft.checks.do-not-claim",
  near_duplicate: "draft.checks.near-duplicate",
  no_invented_people: "draft.checks.no-invented-author",
});

/** A row the rail draws: the rule it speaks for and the slots its sentence
 *  needs. `grounding` is the one that carries any — the set writes it with
 *  the fact and the source it stands on. */
export interface CheckRow {
  rule: RailCheck;
  vars?: Record<string, string | number>;
}

/**
 * The rows to draw, for the draft as it now stands.
 *
 * `grounded` is the *live* answer against the buffer, not the stored flag,
 * so an edit that removed the fact removes this row in the same render that
 * removes the highlight. `sources` counts the address the fact was read
 * from: a grounding with no address recorded is one fact and no source, and
 * says so.
 */
export function checkRows(a: {
  grounded: boolean;
  groundedUrl: string;
  claim: ClaimState;
  /** The §8 rules generation recorded a pass for. Empty where it recorded
   *  nothing, which is every draft until the pipeline writes them. */
  recorded: readonly RailCheck[];
}): readonly CheckRow[] {
  const rows: CheckRow[] = [];
  if (a.grounded) {
    rows.push({ rule: "grounding", vars: { facts: 1, sources: a.groundedUrl === "" ? 0 : 1 } });
  }
  if (a.claim.state === "passed") rows.push({ rule: "do_not_claim" });
  for (const rule of RECORDED_CHECKS) {
    if (a.recorded.includes(rule)) rows.push({ rule });
  }
  return rows;
}
