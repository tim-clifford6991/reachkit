// scripts/eval-content/adds.ts — the non-commodity test, code first (#1158).
//
// Round 1's test (#1153) was one small-tier call that listed a page's "new"
// claims and labelled each. It miscounted three ways: it read 2,500 words of
// each top result where the writer had read 4,000, so claims quoted from the
// rest of a result counted as new; it compared against the filtered
// knowledge base and not the site's pages, so claims that are on the site
// counted as new; and it let the model say which claims are about the
// business, which it got wrong for rivals' claims.
//
// Here every sentence of the page is placed by code first:
//
//   * **commodity** — it cites one of the target's top results, or shares a
//     run of words with one;
//   * **on the site** — it shares a run of words with one of the site's own
//     pages, read whole;
//   * **a new business fact** — it shares a run of words with a founder's
//     answer, or cites the business's own report. Nothing else is one.
//
// Only the sentences code could not place go to the model, which is asked
// one thing: is this stated by the top results, by the site, or by neither.
// It reads the top results to the depth the writer read them and the site's
// pages whole. A sentence it places with neither is new; whether it is
// about the business is never its call.
import Anthropic from "@anthropic-ai/sdk";
import { ADDS } from "@/lib/config/constants";
import { sentencesOf, withoutReferenceLists } from "@/lib/generate/rules/text";
import { costCentsFor, tierBinding } from "@/lib/llm/tiers";
import { grams, sharesRun } from "./grade";

/** A run of this many words in common is the same statement. */
const RUN = 6;
const MIN_WORDS = 6;

export type Placed = "commodity" | "site" | "business" | "new" | "unsupported" | "no_claim";

export interface PlacedSentence {
  sentence: string;
  placed: Placed;
  by: "code" | "model";
  /** What placed it: the page cited or matched. */
  from: string;
}

export interface AddsInputs {
  markdown: string;
  domain: string;
  business: string;
  /** The target's top results, as deep as the writer read them. */
  topResults: readonly { url: string; text: string }[];
  /** The site's own pages, whole. */
  sitePages: readonly { url: string; text: string }[];
  founderFacts: readonly string[];
}

const hostOf = (href: string): string => {
  try {
    return new URL(href).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

const wordsIn = (text: string): number => (text.match(/\S+/g) ?? []).length;

/**
 * Every sentence of the page that states something, placed by code where
 * code can place it. `placed: null` is a sentence for the model.
 */
export function placeInCode(a: AddsInputs): { sentence: string; placed: Placed | null; from: string }[] {
  const own = a.domain.replace(/^www\./, "").toLowerCase();
  const isOwn = (host: string) => host === own || host.endsWith(`.${own}`);
  const top = a.topResults.map((each) => ({ host: hostOf(each.url), url: each.url, grams: grams(each.text, RUN) }));
  const site = a.sitePages.map((each) => ({ url: each.url, grams: grams(each.text, RUN) }));
  const founder = grams(a.founderFacts.join(" . "), RUN);
  const seen = new Set<string>();
  const out: { sentence: string; placed: Placed | null; from: string }[] = [];
  for (const each of sentencesOf(withoutReferenceLists(a.markdown))) {
    const sentence = each.text;
    // A heading, a label, a question, a lead-in to a list: nothing is
    // claimed. A table row is not a sentence, and splitting one makes none.
    if (/^\s*[#|]/.test(each.raw) || wordsIn(sentence) < MIN_WORDS || /[?:]$/.test(sentence) || seen.has(sentence)) continue;
    seen.add(sentence);
    const hosts = (each.links ?? []).map(hostOf);
    const cited = top.find((result) => hosts.includes(result.host));
    const quoted = top.find((result) => sharesRun(sentence, result.grams, RUN));
    const onSite = site.find((page) => sharesRun(sentence, page.grams, RUN));
    if (cited !== undefined) out.push({ sentence, placed: "commodity", from: `cites ${cited.url}` });
    else if (quoted !== undefined) out.push({ sentence, placed: "commodity", from: `words of ${quoted.url}` });
    else if (onSite !== undefined) out.push({ sentence, placed: "site", from: `words of ${onSite.url}` });
    else if (sharesRun(sentence, founder, RUN)) out.push({ sentence, placed: "business", from: "a founder's answer" });
    else if ((each.links ?? []).some((href) => isOwn(hostOf(href)) && /\/scan\//.test(href))) out.push({ sentence, placed: "business", from: "the business's own report" });
    else out.push({ sentence, placed: null, from: "" });
  }
  return out;
}

/** D12's bar, counted from the placed sentences: `ADDS.min` new, at least
 *  `ADDS.businessMin` of them a business fact. */
export function addsVerdict(rows: readonly PlacedSentence[]): { fresh: number; business: number; passes: boolean } {
  const business = rows.filter((row) => row.placed === "business").length;
  const fresh = business + rows.filter((row) => row.placed === "new").length;
  return { fresh, business, passes: fresh >= ADDS.min && business >= ADDS.businessMin };
}

const MATCH_TOOL: Anthropic.Tool = {
  name: "place",
  description: "Record, for each numbered sentence, where its claim is stated.",
  input_schema: {
    type: "object",
    properties: {
      placed: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "The sentence's number." },
            where: {
              type: "string",
              enum: ["results", "site", "neither", "no_claim"],
              description:
                "results: a top result states or plainly implies it. site: the business's site does. neither: neither does. no_claim: the sentence states no fact, figure, finding or specific recommendation a reader could check or act on by itself — a transition, a lead-in, a restatement of its heading, advice any page gives.",
            },
          },
          required: ["n", "where"],
        },
      },
    },
    required: ["placed"],
  },
};

export interface AddsCall {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cents: number;
}

/** What the model answered for a sentence, kept so it is bought once. */
export type Where = "results" | "site" | "neither" | "no_claim";
const WHERE: readonly string[] = ["results", "site", "neither", "no_claim"];

/**
 * The page's sentences, each placed. The model sees only what code left
 * over and `held` does not already answer. `spend` is asked before the call
 * and told after; without one nothing is bought, and a sentence with no
 * answer stays unplaced. What was bought is added to `held`.
 */
export async function placeSentences(
  a: AddsInputs & { search: string; held: Record<string, Where> },
  spend: { guard(reserveCents: number): void; record(call: AddsCall): void } | null
): Promise<{ rows: PlacedSentence[]; unplaced: number }> {
  const coded = placeInCode(a);
  const rows: PlacedSentence[] = coded.flatMap((row) => (row.placed === null ? [] : [{ sentence: row.sentence, placed: row.placed, by: "code" as const, from: row.from }]));
  const names = new RegExp(`\\b(${a.business.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${a.domain.replace(/\./g, "\\.")})\\b`, "i");
  const settle = (): { rows: PlacedSentence[]; unplaced: number } => {
    let unplaced = 0;
    for (const row of coded) {
      if (row.placed !== null) continue;
      const where = a.held[row.sentence];
      if (where === undefined) {
        unplaced++;
        continue;
      }
      // A claim about the business that neither its site nor its founder
      // states is not a business fact: nothing stands behind it.
      const placed: Placed =
        where === "results" ? "commodity" : where === "site" ? "site" : where === "neither" ? (names.test(row.sentence) ? "unsupported" : "new") : "no_claim";
      rows.push({ sentence: row.sentence, placed, by: "model", from: where === "results" ? "a top result" : where === "site" ? "the site" : "" });
    }
    return { rows, unplaced };
  };
  const left = coded.filter((row) => row.placed === null && a.held[row.sentence] === undefined);
  if (left.length === 0 || spend === null) return settle();

  const binding = tierBinding("haiku");
  const prompt = [
    `A page was written for the search "${a.search}" on behalf of ${a.business} (${a.domain}). Below are (1) the text of that search's top results, (2) the text of the business's own site, and (3) numbered sentences of the page.`,
    "For each numbered sentence, say where its claim is stated: by a top result, by the site, or by neither. Judge the claim, not the wording — a paraphrase of what a result or the site says is stated there. Answer for every number.",
    "",
    "=== (1) THE TOP RESULTS",
    ...a.topResults.flatMap((each, i) => [`--- Result ${i + 1}: ${each.url}`, each.text]),
    "",
    "=== (2) THE BUSINESS'S SITE",
    ...a.sitePages.flatMap((each) => [`--- ${each.url}`, each.text]),
    "",
    "=== (3) THE PAGE'S SENTENCES",
    ...left.map((row, i) => `${i + 1}. ${row.sentence}`),
  ].join("\n");
  const maxTokens = 200 + left.length * 24;
  spend.guard(costCentsFor("haiku", Math.ceil(prompt.length / 3), maxTokens));
  const message = await new Anthropic({ apiKey: binding.apiKey, timeout: 120_000, maxRetries: 2 }).messages.create({
    model: binding.modelId,
    max_tokens: maxTokens,
    tools: [MATCH_TOOL],
    tool_choice: { type: "tool", name: MATCH_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });
  spend.record({
    model: binding.modelId,
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
    cents: costCentsFor("haiku", message.usage.input_tokens, message.usage.output_tokens),
  });
  const use = message.content.find((block) => block.type === "tool_use");
  let placed: unknown = use?.type === "tool_use" ? (use.input as { placed?: unknown }).placed : null;
  // The small tier sometimes sends a nested array as a JSON string.
  if (typeof placed === "string") {
    try {
      placed = JSON.parse(placed) as unknown;
    } catch {
      placed = null;
    }
  }
  for (const each of Array.isArray(placed) ? placed : []) {
    if (typeof each !== "object" || each === null) continue;
    const row = left[Number((each as { n?: unknown }).n) - 1];
    const where = String((each as { where?: unknown }).where);
    if (row !== undefined && WHERE.includes(where)) a.held[row.sentence] = where as Where;
  }
  return settle();
}
