// BUILD §8 hard rule 5 — the near-duplicate gate.
//
// BUILD §14 guardrail 3 — the near-duplicate gate, before queueing.
//
// "≥85% similarity vs the customer's published set = never queued." The set
// is three sets in practice, and each is this customer's: the pages they
// have published, the pages the product measured on their site, and the
// drafts already queued for them and not yet published. No member of
// `ComparisonSet` is built in this file and no code path in it takes a site id.
//
// The queued set is included on purpose: a page must not compete with one
// the customer already has waiting, which is why the gate runs at queue
// time rather than at derivation time. It also means the answer depends on
// what else is waiting, and that is the rule's intent.
//
// D13 (issue 1144): the fourth set is the pages written for other sites, by
// the same measure and bar. Its members carry text alone, so a failure on one
// names no page and no site.
//
// The failure carries the member it duplicated, so the day's line has a
// cause — a handle and stored values, never a composed sentence.
import { NEAR_DUPLICATE_MAX } from "@/lib/config/constants";
import { similarity } from "./similarity";
import type { ComparisonSet, DuplicateKind, RuleFailure } from "./types";

/** Fixed order, the customer's own first, so a candidate that duplicates a
 *  member of two sets always reports the same one. */
const SET_ORDER: readonly DuplicateKind[] = Object.freeze(["published", "measured", "queued", "elsewhere"] as const);

export function checkNearDuplicate(a: {
  rendered: string;
  comparison: ComparisonSet;
}): RuleFailure | null {
  for (const kind of SET_ORDER) {
    for (const member of a.comparison[kind] ?? []) {
      const score = similarity(a.rendered, member.rendered);
      if (score >= NEAR_DUPLICATE_MAX) {
        return {
          rule: "near_duplicate",
          detail: {
            rule: "near_duplicate",
            duplicateOf: { kind, ref: member.ref, title: member.title },
            similarity: score,
          },
        };
      }
    }
  }
  return null;
}
