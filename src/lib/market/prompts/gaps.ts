// SPEC §6 *Comparisons need demand* (owner, 2026-11-16): a tracked buyer prompt whose answer mentions a
// competitor and not the site is demand for the search buyers were seen asking closest to it. Pure, 0¢:
// the answers are a healthy pass's stored reading, the wordings the site's own stored SERPs.
import type { MarketConclusion } from "@/lib/market/infer/types";
import { malformedSearch } from "@/lib/market/questions/well-formed";
import { registrableDomain } from "@/lib/market/rivals/domains";
import type { PromptAnswer, PromptsSection } from "@/lib/scan/report";
import { queryKey } from "@/lib/opportunities/cluster";
import { closestPrompt } from "@/lib/opportunities/intent";
import { askedOnMarket, rivalBrandOnly, type AskedTopic, type ProposedTopic } from "@/lib/opportunities/derive/topics";

/** The rival an answer mentioned or linked while it neither named nor linked the site; `null` where it did not. */
function rivalOverSite(answer: PromptAnswer, competitors: ReadonlySet<string>): string | null {
  if (answer.named || answer.linked || answer.ownUrls.length > 0) return null;
  const linked = (answer.cited ?? []).map((url) => registrableDomain(URL.canParse(url) ? new URL(url).hostname : url)).find((domain) => domain !== null && competitors.has(domain));
  return answer.rivals[0] ?? linked ?? null;
}

/**
 * The unbranded prompts an answer gave a competitor and not the site, each as the "People also ask" question or
 * related search closest to it (`closestPrompt`, the prompt as the search). A prompt with no close wording proposes
 * nothing and counts as `unworded`; an ask that did not answer is absent, so it never proposes.
 */
export function promptGaps(a: {
  section: PromptsSection | null;
  /** Search and business competitors, as registrable domains. */
  competitors: readonly string[];
  asked: readonly AskedTopic[];
  taken: readonly string[];
  market: MarketConclusion | null;
  own: readonly string[];
  rivals: readonly string[];
  max: number;
}): { gaps: ProposedTopic[]; unworded: number } {
  const competitors = new Set(a.competitors.flatMap((domain) => registrableDomain(domain) ?? []));
  const seen = new Set(a.taken.map(queryKey));
  const gaps: ProposedTopic[] = [];
  let unworded = 0;
  for (const prompt of a.section?.asked ?? []) {
    if (prompt.kind === "branded") continue;
    const answers = (a.section?.answers ?? []).filter((answer) => answer.promptId === prompt.id);
    const rival = answers.map((answer) => rivalOverSite(answer, competitors)).find((domain) => domain !== null);
    if (rival === undefined) continue;
    const wordings = a.asked.filter((topic) => queryKey(topic.query) !== queryKey(prompt.text)).map((topic) => ({ id: topic.query, text: topic.query, topic }));
    const wording = closestPrompt(prompt.text, wordings);
    if (wording === null) {
      unworded += 1;
      continue;
    }
    const query = queryKey(wording.text);
    if (gaps.length >= a.max || seen.has(query) || malformedSearch(query, a.market?.rivals) !== null) continue;
    if (!askedOnMarket(query, a) || rivalBrandOnly(query, a)) continue;
    seen.add(query);
    gaps.push({ query, source: "ai_gap", volume: null, rival, asked: { term: wording.topic.term, serpAt: wording.topic.serpAt }, prompt: { id: prompt.id, text: prompt.text } });
  }
  return { gaps, unworded };
}
