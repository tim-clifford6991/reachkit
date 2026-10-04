// BUILD §8 hard rule 4 · SPEC §7 (owner, D45, 2026-10-04) — the never-claim
// list as a hard output filter.
//
// **A literal word match, and nothing else.** The list is matched by its own
// words, case- and spacing-insensitive (`./literal.ts`), in stage 4 and on
// every save; the same list goes into the writer's instructions. A paraphrase
// is not caught: the owner accepted that risk (D45), and the veto window and
// the owner alert are the backstop. The model-judged half this module used
// to carry is retired with D41 — it cost a call a page and was the one check
// that could be "unrun".
//
// **The words named back to the customer are their own.** The entry carried
// in a `failed` verdict is read out of the customer's own recorded list.
//
// Every verdict carries the hash of the list it was reached against. That
// is what makes "is this check still current?" answerable later without a
// stored flag.
import { listHash } from "./hash";
import { literalClaimMatch } from "./literal";

/** `unrun` is no longer reached by this check; it stays in the type because
 *  rows written before D45 record it, and a reader must still read them. */
export type ClaimVerdict =
  | { state: "passed"; listHash: string; at: Date }
  | { state: "failed"; listHash: string; at: Date; matchedEntry: string }
  | { state: "unrun"; reason: "llm_unavailable" | "cap_hit"; at: Date };

export function claimCheck(a: { text: string; list: readonly string[] }): ClaimVerdict {
  const at = new Date();
  const hash = listHash(a.list);
  const literal = literalClaimMatch(a.text, a.list);
  return literal === null
    ? { state: "passed", listHash: hash, at }
    : { state: "failed", listHash: hash, at, matchedEntry: literal };
}
