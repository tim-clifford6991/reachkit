// SPEC §7 *A page for what is new in the market*: the one judgement of an event, then the existing topic-fit judgement of
// its angles. A page is written only on an angle of fit 3 with the passage of the site that answers it.
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { Locale } from "@/lib/locale/locales";
import type { MarketConclusion } from "@/lib/market/infer/types";
import type { Profile } from "@/lib/market/questions/profile";
import { newsWords } from "@/lib/generate/rules/title";
import { judgeFit } from "@/lib/opportunities/derive/fit";
import type { FitFact, KnowledgeDigest } from "@/lib/site-profile/knowledge/read";
import type { HotEvent } from "./detect";

const ANGLE_SCHEMA = z.strictObject({
  changes: z.boolean(),
  sensitive: z.boolean(),
  angles: z.array(z.string()).max(3),
});

const TASK = [
  "`event` is something new in this business's market, as the publishers in `event.reports` reported it.",
  "`changes`: does it change what a buyer of `business.category` decides or does? True only where a buyer would now act differently.",
  "`sensitive`: is it about a disaster, a death, a crime, an election, a political event or a tragedy?",
  "`angles`: two or three searches a buyer of this business would now type because of it, each joining the event to what this business sells and does: the question the buyer now asks, never the event's headline or a summary of the news.",
  "For a tax adviser and a new filing rule, one is 'what the filing deadline change means for small business tax returns'.",
  "Write names exactly as `event.name` and the reports write them, and name no product, model, version, figure or date they do not.",
  "Where no honest angle joins the event to what this business sells, give no angles.",
].join(" ");


/** Whether `text` names only what the event's sources do: every token with a digit is theirs. Pure. */
export function namesOnlySourced(text: string, sources: string): boolean {
  const said = sources.toLowerCase();
  return (text.match(/[\p{L}\p{N}.\-]*\p{N}[\p{L}\p{N}.\-]*/gu) ?? []).every((token) => said.includes(token.toLowerCase().replace(/\.$/, "")));
}

export interface HotAngle {
  search: string;
  title: string;
  fact: FitFact;
}

/** The event's angle for this business, or `null` where the event does not change a buyer's decision, is sensitive, has
 *  no angle of fit 3 with a passage of the site, or the cap or the model left no answer. */
export async function angleFor(
  c: CostContext,
  a: { event: HotEvent; locale: Locale; market: MarketConclusion | null; profile: Profile | null; domain: string; knowledge: KnowledgeDigest | null }
): Promise<HotAngle | null> {
  if (a.market === null && a.profile === null) return null;
  const answer = await llm(c, {
    site: "generate.hot_angle",
    tier: "research",
    locale: a.locale,
    schema: ANGLE_SCHEMA,
    instructions: ["task", "locale"],
    input: {
      task: TASK,
      event: { name: a.event.event, title: a.event.title, reports: a.event.claims.map((claim) => ({ publisher: claim.publisher, date: claim.publishedAt, quote: claim.quote })) },
      business: {
        category: a.market?.category ?? a.profile?.category ?? "",
        job: a.market?.job ?? a.profile?.job ?? null,
        buyer: a.market?.buyer ?? null,
        ...(a.knowledge == null ? {} : { knowledge: a.knowledge.map((passage) => passage.text) }),
      },
    },
  });
  if (answer.kind === "unmeasured" || !answer.value.changes || answer.value.sensitive) return null;
  const sources = [a.event.event, a.event.title, ...a.event.claims.map((claim) => claim.quote)].join(" ");
  // The language's news words, which the page's own title is held to as well.
  const news = newsWords(a.locale.language);
  const fair = (text: string): boolean => text.trim() !== "" && !news.test(text) && namesOnlySourced(text, sources);
  const angles = [...new Set(answer.value.angles.map((angle) => angle.trim()))].filter(fair);
  if (angles.length === 0 || c.capHit()) return null;
  const fits = await judgeFit(c, { searches: angles.map((query) => ({ query, source: "category" })), market: a.market, profile: a.profile, domain: a.domain, knowledge: a.knowledge, locale: a.locale });
  for (const [i, search] of angles.entries()) {
    const judged = fits.get(i);
    if (judged?.fit !== 3 || judged.fact === null) continue;
    return { search, title: judged.title !== null && fair(judged.title) ? judged.title : search, fact: judged.fact };
  }
  return null;
}
