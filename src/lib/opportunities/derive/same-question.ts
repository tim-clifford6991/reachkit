// SPEC §6 *One URL per question*: one small-tier call a pass names which planned searches ask another's question in
// other words; the collapse joins by it. It cannot add, drop or re-target a search, and no answer is no judgement.
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
  "An audience that is the market's own buyer (`buyer`, where given) is the same question; a different audience, a different product or a comparison is a different question, and so is a thing's price against the thing itself.",
  "Two wordings of one price are the same question: 'acme pricing', 'acme cost' and 'how much is acme' are one.",
  "Where a topic has an `angle`, the page it would be, judge by what that page answers for the buyer: two angles that answer one question are the same question however their searches are worded, and a list of tools, a page of software and a 'best' page for one category are one.",
].join(" ");

/** `search → sameAs`, by `queryKey`, for each of `searches` judged to ask another topic's question. Topics are shown by
 *  index and a search is never offered itself, as two lists of strings drew self-pairs. */
export async function judgeSameQuestion(
  c: CostContext,
  a: { searches: readonly string[]; topics: readonly string[]; buyer?: string | null; angles?: ReadonlyMap<string, string> }
): Promise<ReadonlyMap<string, string>> {
  const asked = new Set(a.searches.map(queryKey));
  const topics = [...new Set([...a.searches, ...a.topics].map(queryKey))];
  const judged = new Map<string, string>();
  if (asked.size === 0 || topics.length < 2) return judged;

  const answer = await llm(c, {
    site: SAME_QUESTION_CALL_SITE,
    input: {
      task: TASK,
      ...((a.buyer ?? "").trim() === "" ? {} : { buyer: a.buyer }),
      topics: topics.map((search, i) => ({ i, search, ...(a.angles?.has(search) ? { angle: a.angles.get(search) } : {}), ...(asked.has(search) ? { ask: true } : {}) })),
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
