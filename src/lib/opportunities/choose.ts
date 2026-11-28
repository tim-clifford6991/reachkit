// SPEC §7: the week a pass commits, from stored rows alone and pure, so the golden plans can hold it.
import { KNOWN_CONTENT, WEEK_PLAN, WEEK_RESEARCH } from "@/lib/config/constants";
import { meetsStandard, mustShowDemand, typeTheResearchFills, type ResearchRead } from "@/lib/generate/standard";
import { closestKnown, pageScore } from "@/lib/known-content/match";
import type { KnownPage } from "@/lib/known-content/types";
import { SHAPES } from "@/lib/locale/language";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { oneHead, oneQuestion, queryKey, shareATopTen } from "./cluster";
import { asUpdate, tooYoungToRefresh, updateColumns } from "./derive/known";
import { placeFixPages, rankingOf, type RankLoad, type Rejection } from "./rank/open";
import { hotResearch, timelyFirst } from "@/lib/hot/timely";
import type { OwnLivePage } from "./refresh";
import { readOpportunity, type PlanEntry } from "./store";
import { PLAN_WRITE_AS, type Opportunity, type Ranked } from "./types";

const DAY_MS = 86_400_000;

export interface ChooseInput extends RankLoad {
  at: Date;
  /** The first date the week writes, `YYYY-MM-DD`. */
  from: string;
  days?: number; // dated days the week holds, `WEEK_PLAN.days` where absent
  /** The cached research of the best-ranked rows; absent, the order is the ranking's. */
  research?: ReadonlyMap<string, ResearchRead | null>;
  /** The committed week's stored verdicts, which a re-plan keeps for a row `research` does not hold. */
  verdicts?: ReadonlyMap<string, Pick<PlanEntry, "writeAs" | "reason">>;
  /** Committed dates by row: a row the rules still rank keeps its date (a short one does not), and only the other dates are filled. */
  keep?: ReadonlyMap<string, string>;
}

export interface Choice {
  committed: PlanEntry[];
  rejected: { opportunityId: string; reason: Rejection | "after_the_week" | "same_topic" | "live_twin" | "short"; short?: string[] }[];
}

const TIERS = ["met", "at_margin", "queued", "short"] as const;

export function choose(input: ChooseInput): Choice {
  const ranking = rankingOf(input);
  const rejected: Choice["rejected"] = [...ranking.rejected];
  const ranked = byResearch(oneTopicEach(placeFixPages(ranking.scored, ranking.fixes), input, rejected), input);
  const first = Math.floor(Date.parse(`${input.from}T00:00:00Z`) / DAY_MS);
  const days = input.days ?? WEEK_PLAN.days, dates = Array.from({ length: days }, (_, place) => new Date((first + place) * DAY_MS).toISOString().slice(0, 10));
  const kept = (entry: Joined) => dates.includes(input.keep?.get(entry.opportunityId) ?? "") && entry.reason.research?.state !== "short", pinned = new Map(ranked.filter(kept).map((entry) => [input.keep!.get(entry.opportunityId)!, entry]));
  const rest = ranked.filter((entry) => !kept(entry)), dated = timelyFirst(rest.splice(0, dates.length - pinned.size)), week = [...dates.map((date) => pinned.get(date) ?? dated.shift()), ...rest.splice(0, WEEK_PLAN.spares)];
  return {
    committed: week.flatMap((entry, place) => (entry === undefined ? [] : [{ opportunityId: entry.opportunityId, place, plannedFor: dates[place] ?? null, writeAs: entry.writeAs ?? null, reason: entry.reason, ...(entry.set === undefined ? {} : { set: entry.set }) }])),
    rejected: [...rejected, ...rest.map((entry) => ({ opportunityId: entry.opportunityId, ...(entry.reason.research?.state === "short" ? { reason: "short" as const, short: entry.reason.research.short ?? [] } : { reason: "after_the_week" as const }) }))],
  };
}

/** SPEC §7: the best-ranked rows in `TIERS` order of what their research holds, rank order inside each, each typed by
 *  what its research fills and storing that type where it is filled; a type with no pass mark at the commit is queued. */
function byResearch(ranked: Joined[], input: ChooseInput): Joined[] {
  if (input.research === undefined) return ranked;
  const rows = new Map(input.rows.map((row) => [row.id, readOpportunity(row)]));
  const stored = (entry: Joined, kept = input.research!.has(entry.opportunityId) ? undefined : input.verdicts?.get(entry.opportunityId)): Joined | undefined => (kept?.reason.research == null ? undefined : { ...entry, ...(kept.writeAs == null ? {} : { writeAs: kept.writeAs }), reason: { ...entry.reason, research: kept.reason.research } });
  const head = ranked.slice(0, WEEK_RESEARCH.rowsMax).map((entry): Joined => {
    if (stored(entry) !== undefined) return stored(entry)!;
    const o = rows.get(entry.opportunityId), read = input.research!.get(entry.opportunityId);
    const type = entry.set?.type === undefined && o !== undefined ? typeTheResearchFills(o, read ?? null) : null;
    const hot = o === undefined ? null : hotResearch(o), standard = hot?.standard ?? (read === undefined || type === null ? { parts: [], met: true, pending: false } : meetsStandard({ type, read, demand: mustShowDemand(o!, type) }));
    // The margin is the commit's alone: the draft and the rules hold a page to the pass mark.
    const roomy = standard.parts.every((part) => (part.part !== "sources" && (part.part !== "sections" || type !== "qa")) || part.have! - part.need >= WEEK_RESEARCH.margin);
    const state = standard.pending || "unchecked" in standard ? "queued" : !standard.met ? "short" : roomy ? "met" : "at_margin";
    const words = standard.parts.find((part) => part.part === "words")?.have ?? null;
    const filled = read != null && standard.met && PLAN_WRITE_AS.find((each) => each === type);
    return { ...entry, ...(filled ? { writeAs: filled } : {}), reason: { ...entry.reason, research: { state, ...(hot?.read ?? { R: read?.R ?? null, Q: read?.Q ?? null, F: read?.F ?? null, urls: read?.urls ?? [] }), estWords: words, ...(state === "short" ? { short: standard.parts.filter((part) => part.state === "short").map((part) => part.part) } : {}) } } };
  });
  const tier = (entry: Joined) => TIERS.indexOf(entry.reason.research?.state ?? "met");
  return [...head.sort((a, b) => tier(a) - tier(b)), ...ranked.slice(WEEK_RESEARCH.rowsMax).map((entry) => stored(entry) ?? entry)];
}

type Joined = Ranked & Pick<PlanEntry, "set">;

/** SPEC §6 *One URL per question*, from stored rows: of two open rows of one topic the higher-ranked is the new page and
 *  absorbs the other's search, and one naming a kept row's product ranks after the rest; a twin of a live page of ours is
 *  its update, waiting while the page is younger than the refresh floor. Given no market nor live pages, the ranking's order. */
function oneTopicEach(ranked: readonly Ranked[], input: ChooseInput, rejected: Choice["rejected"]): Joined[] {
  if (input.market === undefined && input.live === undefined) return [...ranked];
  const market = input.market ?? null;
  const joined = oneQuestion({ topTens: input.topTens, market, brandTokens: input.profile?.brandTokens ?? [] });
  const rows = new Map(input.rows.map((row) => [row.id, readOpportunity(row)]));
  // A page an open refresh already updates takes no second update.
  const updated = new Set([...rows.values()].flatMap((o) => (o.type === "refresh_page" && o.targetRef !== null ? [canonicalUrl(o.targetRef)] : [])));
  const kept: { o: Opportunity; entry: Joined }[] = [];
  const out: Joined[] = [], later: Joined[] = [], first: Opportunity[] = [];
  for (const entry of ranked) {
    const o = rows.get(entry.opportunityId);
    if (o === undefined || (o.family !== "write" && o.family !== "earn")) {
      out.push(entry);
      continue;
    }
    const twin = kept.find((held) => joined(held.o, o));
    if (twin !== undefined) {
      const own = queryKey(twin.o.targetQuery ?? "");
      const searches = [...(twin.entry.set?.absorbed_queries ?? twin.o.absorbedQueries), ...[o.targetQuery ?? [], ...o.absorbedQueries].flat()];
      twin.entry.set = { ...twin.entry.set, absorbed_queries: [...new Set(searches.filter((q) => queryKey(q) !== own))].sort() };
      rejected.push({ opportunityId: o.id, reason: "same_topic" });
      continue;
    }
    const live = (input.live ?? []).find((page) => joined(page.row, o) || liveTwin(page, o, input.topTens));
    const page: KnownPage | null = live === undefined ? null : { source: "reachkit", ref: live.row.id, url: live.url, title: live.title ?? live.row.title ?? "", headings: [], live: true, publishedAt: live.publishedAt };
    if (page !== null && (tooYoungToRefresh(page, input.at) || updated.has(canonicalUrl(page.url!)))) {
      rejected.push({ opportunityId: o.id, reason: "live_twin" });
      continue;
    }
    const held: Joined = page === null ? { ...entry } : { opportunityId: entry.opportunityId, reason: entry.reason, set: updateColumns(asUpdate(o, { page, score: pageScore({ query: o.targetQuery, title: o.title }, page, market) }, input.at)) };
    if (page !== null) updated.add(canonicalUrl(page.url!));
    // Only a row placed in `out` ranks another down, so a ranked-down row never chains a third.
    const named = first.some((k) => oneHead([k.targetQuery, k.title], [o.targetQuery, o.title]));
    (named ? later : out).push(held);
    if (!named) first.push(o);
    kept.push({ o, entry: held });
  }
  return [...out, ...later];
}

const searchesOf = (o: Opportunity): string[] => [o.targetQuery ?? [], ...o.absorbedQueries].flat().map(queryKey);

/** Beside B1's join, a live page of ours answers a row's question where either holds a search of the other, two of their
 *  searches share a top ten, they name one product (`oneHead`), or its title or answer-box question is the row's topic by
 *  its own words at `LIVE_TWIN_MIN` (the market's words make one market's titles alike). Every live page is compared. */
export function liveTwin(page: OwnLivePage, o: Opportunity, topTens: ReadonlyMap<string, readonly string[]>): boolean {
  const [mine, theirs] = [searchesOf(o), searchesOf(page.row)];
  if (mine.some((q) => theirs.includes(q))) return true;
  const tens = (qs: string[]) => qs.flatMap((q) => (topTens.has(q) ? [topTens.get(q)!] : []));
  if (tens(mine).some((a) => tens(theirs).some((b) => shareATopTen(a, b)))) return true;
  // A comparison is one question only with the same products, which the keys above already read.
  if ([o.targetQuery ?? "", page.row.targetQuery ?? "", page.title ?? ""].some((text) => SHAPES.comparison.test(text.toLowerCase()))) return false;
  const question = /^##\s+(.+)$/m.exec(page.markdown ?? "")?.[1]?.trim();
  if (oneHead([o.targetQuery, o.title], [page.row.targetQuery, page.title, question])) return true;
  const known: KnownPage = { source: "reachkit", ref: page.row.id, url: page.url, title: page.title ?? "", headings: question === undefined ? [] : [question], live: true, publishedAt: page.publishedAt };
  return (closestKnown({ query: o.targetQuery, title: o.title }, [known])?.score ?? 0) >= KNOWN_CONTENT.LIVE_TWIN_MIN;
}
