// src/lib/market/questions/profile.ts — WO-071, BP-025 `## Public interface`
// (BUILD §6.7 step 1).
//
// **Risk: high — seams: money, and data leaving the system.** This is the
// order that turns a domain's own home (and optional pricing) text into a
// billable nano call, and decides which of that customer's own text
// crosses to the vendor. Mutation-tested (doctrine 0.13.2, rule 2b):
//   1. **Spend** — the call is issued through `llm()`, which is the one
//      seam every model call's cost passes through (`CostContext.
//      recordFetch`, BP-009/BP-007). This file makes no call of its own
//      outside `llm()` and opens no `fetch`.
//   2. **What crosses the boundary** — of the customer's, `input` carries
//      exactly `{ home, pricing }` as the caller supplied it, beside the
//      fixed `PROFILE_TASK` / `PROFILE_FIELDS` instruction: no keyword,
//      no search term, no selection state, nothing else in this module's
//      future siblings is read here. `deriveProfile` synthesises nothing: an `unmeasured`
//      `llm()` result is returned unaltered, with no default `Profile`
//      substituted for it — a test that survives deleting that pass-through
//      would turn an unreadable home page into a paid call over invented
//      output.
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import type { Measured } from "@/lib/measure/measured";
import { PROFILE_LIST_BOUNDS } from "@/lib/config/constants";
import { llm } from "@/lib/llm";

/** BP-025 `## Public interface`, verbatim. */
export interface Profile {
  category: string; // buyer vocabulary, never the site's marketing language
  job: string;
  offeringType: string;
  audienceTerms: readonly string[]; // 2–4
  namedRivals: readonly string[]; // rivals the site itself names
  vocabulary: readonly string[]; // the relevance guard's support set
  brandTokens: readonly string[]; // the own-brand drop set
}

/** A list of short strings bounded by its `PROFILE_LIST_BOUNDS` row. */
function boundedList(bounds: { readonly min: number; readonly max: number }) {
  return z.array(z.string()).min(bounds.min).max(bounds.max);
}

/** The model's output, parsed against exactly `Profile`'s seven fields —
 *  `.strictObject` so a response carrying an eighth field (a keyword, a
 *  selected search) does not parse (`## Steps` step 2). A response that
 *  does not parse is a failed call: `llm()`'s own seam already returns
 *  `unmeasured` for it, and no rescue path is added here.
 *
 *  Every list is bounded (issue #462): an unbounded `vocabulary` is what
 *  let one answer run to 888 tokens and the whole of the call's budget. */
export const PROFILE_SCHEMA = z.strictObject({
  category: z.string(),
  job: z.string(),
  offeringType: z.string(),
  audienceTerms: boundedList(PROFILE_LIST_BOUNDS.audienceTerms),
  namedRivals: boundedList(PROFILE_LIST_BOUNDS.namedRivals),
  vocabulary: boundedList(PROFILE_LIST_BOUNDS.vocabulary),
  brandTokens: boundedList(PROFILE_LIST_BOUNDS.brandTokens),
});

/** How a bounded list is described to the model — the same two numbers
 *  the schema enforces, read from the same pin. */
function listOf(bounds: { readonly min: number; readonly max: number }, what: string): string {
  const count = bounds.min > 0 ? `${bounds.min} to ${bounds.max}` : `at most ${bounds.max}`;
  return `${count} short strings: ${what}`;
}

/** What the model is asked for (BUILD §6.7 step 1). Before issue #462 the
 *  call carried the customer's pages and nothing else — the model was
 *  never told the seven fields `PROFILE_SCHEMA` requires, so a first
 *  attempt that parsed was luck. One key per schema field, in the
 *  schema's own order; `tests/market/questions/profile.test.ts` asserts
 *  the key set and every list's bounds against the schema itself. */
export const PROFILE_FIELDS: Readonly<Record<keyof Profile, string>> = Object.freeze({
  category:
    "one string: the product category in the words a buyer would type into Google, not the site's own marketing language",
  job: "one string: the job the product does for the person who buys it",
  offeringType: "one string: the kind of offering",
  audienceTerms: listOf(PROFILE_LIST_BOUNDS.audienceTerms, "the audiences or use cases it serves"),
  namedRivals: listOf(
    PROFILE_LIST_BOUNDS.namedRivals,
    "competitors the pages themselves name, as written there; none if they name none"
  ),
  vocabulary: listOf(PROFILE_LIST_BOUNDS.vocabulary, "the words and phrases a buyer uses for this kind of product"),
  brandTokens: listOf(PROFILE_LIST_BOUNDS.brandTokens, "the business's own brand and product names"),
});

export const PROFILE_TASK =
  "Describe the business whose home page (and pricing page, when given) follow, the way a buyer would. " +
  "Answer with one JSON object and nothing else: no prose, no code fence. It has exactly the fields " +
  "listed under `fields` and no other; each entry says what goes in that field.";

/** BP-025 `## Public interface`, verbatim signature. One `llm()` call,
 *  `site: 'profile'`, `tier: 'nano'`; the `CostContext` passed straight
 *  through and the `Measured<Profile>` `llm()` returns handed back
 *  unaltered — no default category, no fallback to the site's own
 *  marketing wording, no retry (`llm()` already retries once on a parse
 *  failure; this function does not retry again). */
export function deriveProfile(
  c: CostContext,
  a: { home: string; pricing?: string }
): Promise<Measured<Profile>> {
  return llm(c, {
    site: "profile",
    // The fixed instruction, then the customer's own two pages and nothing
    // else of theirs: no keyword, no search term, no selection state.
    input: { task: PROFILE_TASK, fields: PROFILE_FIELDS, home: a.home, pricing: a.pricing },
    schema: PROFILE_SCHEMA,
    tier: "nano",
  }).then((result) => {
    logProfileOutcome(result);
    return result;
  });
}

/** BP-025 `## NFR budget`: "Observability: profile outcome kind, …" — the
 *  outcome kind (`measured` / `zero` / `unmeasured` + reason) and nothing
 *  else. Never the profile's own fields: `category`, `vocabulary` and the
 *  rest are the customer's own derived text and have no seam that permits
 *  them into a log line. */
function logProfileOutcome(result: Measured<Profile>): void {
  console.log(
    JSON.stringify(
      result.kind === "unmeasured"
        ? { event: "profile_outcome", kind: result.kind, reason: result.reason }
        : { event: "profile_outcome", kind: result.kind }
    )
  );
}
