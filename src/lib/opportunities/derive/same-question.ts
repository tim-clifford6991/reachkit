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
  pairs: z.array(z.strictObject({ i: z.number().int(), sameAs: z.number().int() })),
});

const TASK = [
  "Each entry of `topics` is a search with its index `i`. For each one marked `ask`, name the index of one **other** topic that asks the same question in different words, so that one page answers both.",
  "Never pair a search with itself. Leave a search out when no other topic asks its question.",
  "A narrower audience, a different product or a comparison is a different question, and so is a thing's price against the thing itself.",
  "Two wordings of one price are the same question: 'acme pricing', 'acme cost' and 'how much is acme' are one.",
].join(" ");

/**
 * `search → sameAs`, by `queryKey`, for each of `searches` the model judged
 * to ask the same question as another of `topics`. No call where there is
 * nothing to compare.
 *
 * The topics are shown by index and a search is never offered itself (issue
 * 1208): shown as two lists of strings, the model paired every search with
 * its own copy among the topics — ten pairs on reachkit.app's pass of
 * 2026-10-03, all dropped — and "meltwater pricing" and "meltwater cost"
 * both became pages.
 */
export async function judgeSameQuestion(
  c: CostContext,
  a: { searches: readonly string[]; topics: readonly string[] }
): Promise<ReadonlyMap<string, string>> {
  const asked = new Set(a.searches.map(queryKey));
  const topics = [...new Set([...a.searches, ...a.topics].map(queryKey))];
  const judged = new Map<string, string>();
  if (asked.size === 0 || topics.length < 2) return judged;

  const answer = await llm(c, {
    site: SAME_QUESTION_CALL_SITE,
    input: {
      task: TASK,
      topics: topics.map((search, i) => (asked.has(search) ? { i, search, ask: true } : { i, search })),
    },
    schema: SAME_QUESTION_SCHEMA,
    tier: "haiku",
  });
  if (answer.kind === "unmeasured") return judged;

  for (const pair of answer.value.pairs) {
    const [search, sameAs] = [topics[pair.i], topics[pair.sameAs]];
    if (search !== undefined && sameAs !== undefined && search !== sameAs && asked.has(search)) judged.set(search, sameAs);
  }
  return judged;
}
