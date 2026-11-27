// SPEC §7 *A page for what is new in the market*: the one judgement of an event, then the existing topic-fit judgement of
// its angles. Fit and whether the event changes a buyer's decision rank its page; fit 0 and a sensitive event stop it.
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { Locale } from "@/lib/locale/locales";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { namesAreReal, type TopicAngle } from "@/lib/market/questions/angle";
import type { Profile } from "@/lib/market/questions/profile";
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


/** Each angle the model gave and what came of it, which the judged log tells: kept, unjudged and kept unscored, or dropped for a name its sources lack or a fit of 0. */
export interface AngleRead {
  search: string;
  fit: number | null;
  why: "kept" | "fair" | "unjudged" | "fit";
  /** Whether the fit call gave it a title its sources carry; one without is still a topic, titled at the commit. */
  titled: boolean;
}

export interface HotAngle {
  search: string;
  title: string | null;
  angle: TopicAngle | null;
  fact: FitFact | null;
  /** `null` where the fit call did not judge it: it ranks as a 2, as an unscored row does, until a pass judges it. */
  fit: BusinessFit | null;
  /** Whether the event changes what a buyer decides or does, which its `timely` part reads. */
  changes: boolean;
  angles: AngleRead[];
}

/** Why an event gave no topic. */
export interface HotMiss {
  miss: "no_market" | "unmeasured" | "sensitive" | "no_angles" | "fair" | "cap" | "fit";
  angles: AngleRead[];
}

/** The event's best-fitting angle for this business; any angle not judged 0 is a topic, ranked by its fit, and only harm, a
 *  fit of 0 or a name its sources lack stops it. A miss says why there is none. */
export async function angleFor(
  c: CostContext,
  a: { event: HotEvent; locale: Locale; market: MarketConclusion | null; profile: Profile | null; domain: string; knowledge: KnowledgeDigest | null }
): Promise<HotAngle | HotMiss> {
  if (a.market === null && a.profile === null) return { miss: "no_market", angles: [] };
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
  if (answer.kind === "unmeasured" || answer.value.sensitive) return { miss: answer.kind === "unmeasured" ? "unmeasured" : "sensitive", angles: [] };
  const sources = [a.event.event, a.event.title, ...a.event.claims.map((claim) => claim.quote)];
  // News words are not a stop: the title rule repairs them in the page's own title.
  const fair = (text: string): boolean => text.trim() !== "" && namesAreReal(text, { search: "", sources, ranks: [] });
  const given = [...new Set(answer.value.angles.map((angle) => angle.trim()))], angles = given.filter(fair);
  const reads: AngleRead[] = given.filter((search) => !fair(search)).map((search) => ({ search, fit: null, why: "fair", titled: false }));
  if (angles.length === 0 || c.capHit()) return { miss: given.length === 0 ? "no_angles" : angles.length === 0 ? "fair" : "cap", angles: reads };
  const fits = await judgeFit(c, { searches: angles.map((query) => ({ query, source: "category", ranks: sources })), market: a.market, profile: a.profile, domain: a.domain, knowledge: a.knowledge, locale: a.locale });
  const best = angles.flatMap((search, i) => {
    const judged = fits.get(i), fit = judged?.fit ?? null, title = judged?.title != null && fair(judged.title) ? judged.title : null;
    reads.push({ search, fit, why: judged === undefined ? "unjudged" : fit === 0 ? "fit" : "kept", titled: title !== null });
    return fit === 0 ? [] : [{ search, title, angle: title === null ? null : (judged?.angle ?? null), fact: judged?.fact ?? null, fit, changes: answer.value.changes }];
  });
  const kept = best.sort((x, y) => (y.fit ?? 2) - (x.fit ?? 2) || Number(y.title !== null) - Number(x.title !== null))[0];
  return kept === undefined ? { miss: "fit", angles: reads } : { ...kept, angles: reads };
}
