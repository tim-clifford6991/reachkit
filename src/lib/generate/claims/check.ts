// BUILD §8 hard rule 4 — the do-not-claim list as a hard output filter.
//
// "String + semantic match." Both halves, in that order and for a reason:
// the deterministic pass is free and catches the literal statement, so an
// empty list and an obvious match both cost nothing, and the model is asked
// only about what the string match could not decide.
//
// **The words named back to the customer are their own.** The nano pass
// returns a boolean and the index of the entry it matched — never a
// sentence, never a paraphrase, never anything the model wrote. The entry
// carried in a `failed` verdict is read out of the customer's own recorded
// list by that index. Model prose does not reach a customer here.
//
// **"We could not check" is not "it passed."** A model that did not answer,
// a response that did not parse, and the spend ceiling all resolve to
// `unrun` with the reason. A draft whose check is `unrun` is not queued and
// is not handed to a destination: the check has to happen before queuing,
// so an unrun one holds the page.
//
// Every verdict carries the hash of the list it was reached against. That
// is what makes "is this check still current?" answerable later without a
// stored flag.
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import { listHash, normaliseList } from "./hash";

export type ClaimVerdict =
  | { state: "passed"; listHash: string; at: Date }
  | { state: "failed"; listHash: string; at: Date; matchedEntry: string }
  | { state: "unrun"; reason: "llm_unavailable" | "cap_hit"; at: Date };

/** The one call site this module reaches the model at. */
export const CLAIM_CHECK_CALL_SITE = "generate.claim_check";

/** The nano pass answers two things and nothing else: whether the text
 *  states one of the numbered entries, and which one. `matchedIndex` is an
 *  index into the list the caller sent, so the customer's own words come
 *  back out of their own list rather than out of the response. */
const CLAIM_CHECK_SCHEMA = z.strictObject({
  matches: z.boolean(),
  matchedIndex: z.number().int().nullable(),
});

/** The same normalisation the hash uses, applied to the draft's text, so
 *  the literal pass is case- and spacing-insensitive in exactly the way
 *  the list is. */
function normaliseText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

/** The literal half. Returns the customer's own entry — the one they
 *  recorded, in the case and spacing they recorded it in — never the
 *  normalised form the match was made on. */
function literalMatch(text: string, list: readonly string[]): string | null {
  const haystack = normaliseText(text);
  for (const entry of list) {
    const needle = normaliseText(entry);
    if (needle.length === 0) continue;
    if (haystack.includes(needle)) return entry;
  }
  return null;
}

export async function claimCheck(
  c: CostContext,
  a: { text: string; list: readonly string[] }
): Promise<ClaimVerdict> {
  const at = new Date();
  const hash = listHash(a.list);

  // An empty list passes at zero cost — and goes stale the moment the
  // customer adds their first entry, which is exactly right.
  if (normaliseList(a.list).length === 0) {
    return { state: "passed", listHash: hash, at };
  }

  const literal = literalMatch(a.text, a.list);
  if (literal !== null) {
    return { state: "failed", listHash: hash, at, matchedEntry: literal };
  }

  // The ceiling is read before the call, never after: a check we could not
  // afford is `unrun`, and `unrun` holds the page.
  if (c.capHit()) {
    return { state: "unrun", reason: "cap_hit", at };
  }

  const verdict = await llm(c, {
    site: CLAIM_CHECK_CALL_SITE,
    tier: "nano",
    schema: CLAIM_CHECK_SCHEMA,
    input: {
      task:
        "Decide whether the page states any of the numbered claims, either in " +
        "those words or as a paraphrase of them. Answer only with the JSON " +
        "object {matches, matchedIndex}; matchedIndex is the 0-based index of " +
        "the claim stated, or null.",
      claims: a.list.map((entry, index) => ({ index, claim: entry })),
      page: a.text,
    },
  });

  if (verdict.kind === "unmeasured") {
    return {
      state: "unrun",
      reason: verdict.reason === "not_attempted" ? "cap_hit" : "llm_unavailable",
      at,
    };
  }

  const answer = verdict.value;
  if (!answer.matches) return { state: "passed", listHash: hash, at };

  const index = answer.matchedIndex;
  const matched = index === null ? undefined : a.list[index];
  if (matched === undefined) {
    // It said the page states a claim but named no entry we hold. That is
    // an answer we cannot report to the customer in their own words, and
    // reporting it in the model's would break the one promise this module
    // makes — so it is unrun, and the page is held rather than released.
    return { state: "unrun", reason: "llm_unavailable", at };
  }
  return { state: "failed", listHash: hash, at, matchedEntry: matched };
}
