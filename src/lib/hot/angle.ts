// SPEC §7 *A page for what is new in the market*: the one judgement of an event, then the existing topic-fit judgement of
// its angles. Fit and whether the event changes a buyer's decision rank its page; fit 0 and a sensitive event stop it.
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { Locale } from "@/lib/locale/locales";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { namesAreReal, type TopicAngle } from "@/lib/market/questions/angle";
import type { Profile } from "@/lib/market/questions/profile";
import { newsWords } from "@/lib/generate/rules/title";
import { judgeFit } from "@/lib/opportunities/derive/fit";
import type { BusinessFit } from "@/lib/opportunities/types";
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


export interface HotAngle {
  search: string;
  title: string;
  angle: TopicAngle;
  fact: FitFact | null;
  fit: BusinessFit;
  /** Whether the event changes what a buyer decides or does, which its `timely` part reads. */
  changes: boolean;
}

/** The event's best-fitting angle for this business, or `null` where the event is sensitive, no angle fits above 0, or
 *  the cap or the model left no answer. */
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
  if (answer.kind === "unmeasured" || answer.value.sensitive) return null;
  const sources = [a.event.event, a.event.title, ...a.event.claims.map((claim) => claim.quote)];
  // The language's news words, which the page's own title is held to as well.
  const news = newsWords(a.locale.language);
  const fair = (text: string): boolean => text.trim() !== "" && !news.test(text) && namesAreReal(text, { search: "", sources, ranks: [] });
  const angles = [...new Set(answer.value.angles.map((angle) => angle.trim()))].filter(fair);
  if (angles.length === 0 || c.capHit()) return null;
  const fits = await judgeFit(c, { searches: angles.map((query) => ({ query, source: "category", ranks: sources })), market: a.market, profile: a.profile, domain: a.domain, knowledge: a.knowledge, locale: a.locale });
  const best = [...angles.entries()].flatMap(([i, search]) => {
    const judged = fits.get(i);
    return judged === undefined || judged.fit < 1 || judged.angle === null || judged.title === null || !fair(judged.title) ? [] : [{ search, title: judged.title, angle: judged.angle, fact: judged.fact, fit: judged.fit, changes: answer.value.changes }];
  });
  return best.sort((a, b) => b.fit - a.fit)[0] ?? null;
}
