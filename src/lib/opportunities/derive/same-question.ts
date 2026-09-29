// SPEC §6 (2026-09-29, #1131) — one URL per question.
//
// Two searches whose top tens barely overlap can still ask one question in
// different words, and Google's guide calls a page per wording scaled
// content abuse. The pass asks the small tier **once**: of the searches this
// pass would write, which asks the same question as another search already
// planned, live or proposed? The answer is a map the collapse joins topics
// by (`cluster.ts`), and it is stored as the survivor's `cluster_key` and
// `absorbed_queries` — nothing downstream asks again.
//
// The model names pairs; it cannot add a search, drop one, or re-target
// one. A pair naming a search it was not shown does not count. An
// unavailable model or a reached cap is no judgement at all, and the
// overlap rule stands alone.
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import { queryKey } from "../cluster";

export const SAME_QUESTION_CALL_SITE = "topic-same-question";

const SAME_QUESTION_SCHEMA = z.strictObject({
  pairs: z.array(z.strictObject({ search: z.string(), sameAs: z.string() })),
});

/**
 * `search → sameAs`, by `queryKey`, for each of `searches` the model judged
 * to ask the same question as one of `topics`. No call where there is
 * nothing to compare.
 */
export async function judgeSameQuestion(
  c: CostContext,
  a: { searches: readonly string[]; topics: readonly string[] }
): Promise<ReadonlyMap<string, string>> {
  const searches = [...new Set(a.searches.map(queryKey))];
  const topics = [...new Set([...a.topics, ...a.searches].map(queryKey))];
  const judged = new Map<string, string>();
  if (searches.length === 0 || topics.length < 2) return judged;

  const answer = await llm(c, {
    site: SAME_QUESTION_CALL_SITE,
    input: {
      task: "For each search in `searches`, name the one search in `topics` that asks the same question in different words, so that one page answers both. Leave a search out when no topic asks its question. A narrower audience, a different product, a price or a comparison is a different question.",
      searches,
      topics,
    },
    schema: SAME_QUESTION_SCHEMA,
    tier: "haiku",
  });
  if (answer.kind === "unmeasured") return judged;

  const shown = new Set(topics);
  const asked = new Set(searches);
  for (const pair of answer.value.pairs) {
    const [search, sameAs] = [queryKey(pair.search), queryKey(pair.sameAs)];
    if (asked.has(search) && shown.has(sameAs) && search !== sameAs) judged.set(search, sameAs);
  }
  return judged;
}
