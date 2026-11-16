// SPEC §7 (owner, 2026-10-19, issue 1559) — the week a weekly pass commits,
// chosen from what the store holds and nothing else. Pure: the same rows
// choose the same week, which is what the golden plans hold it to.
import { WEEK_PLAN } from "@/lib/config/constants";
import { pageScore } from "@/lib/known-content/match";
import type { KnownPage } from "@/lib/known-content/types";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { clusterKey, queryKey, sameTopic } from "./cluster";
import { asUpdate, tooYoungToRefresh, updateColumns } from "./derive/known";
import { placeFixPages, rankingOf, type RankLoad, type Rejection } from "./rank/open";
import { readOpportunity, type PlanEntry } from "./store";
import type { Opportunity, Ranked } from "./types";

const DAY_MS = 86_400_000;

export interface ChooseInput extends RankLoad {
  at: Date;
  /** The first date the week writes, `YYYY-MM-DD`. */
  from: string;
  days?: number; // dated days the week holds, `WEEK_PLAN.days` where absent
}

export interface Choice {
  /** The next `WEEK_PLAN.days` pages, one a day from `from`, then
   *  `WEEK_PLAN.spares` spares, each with its points and the rule that placed it. */
  committed: PlanEntry[];
  /** Every other open row, with why it is not in the week. */
  rejected: { opportunityId: string; reason: Rejection | "after_the_week" | "same_topic" | "live_twin" }[];
}

export function choose(input: ChooseInput): Choice {
  const ranking = rankingOf(input);
  const rejected: Choice["rejected"] = [...ranking.rejected];
  const ranked = oneTopicEach(placeFixPages(ranking.scored, ranking.fixes, ranking.rotation), input, rejected);
  const first = Math.floor(Date.parse(`${input.from}T00:00:00Z`) / DAY_MS);
  const days = input.days ?? WEEK_PLAN.days, depth = days + WEEK_PLAN.spares;
  return {
    committed: ranked.slice(0, depth).map((entry, place) => ({
      opportunityId: entry.opportunityId,
      place,
      plannedFor: place < days ? new Date((first + place) * DAY_MS).toISOString().slice(0, 10) : null,
      writeAs: entry.writeAs ?? null,
      reason: entry.reason,
      ...(entry.set === undefined ? {} : { set: entry.set }),
    })),
    rejected: [...rejected, ...ranked.slice(depth).map((entry) => ({ opportunityId: entry.opportunityId, reason: "after_the_week" as const }))],
  };
}

type Joined = Ranked & Pick<PlanEntry, "set">;

/**
 * SPEC §6 *One URL per question*, at the commit and from stored rows: of two open rows of one topic only the
 * higher-ranked is a new page, and it absorbs the other's search; a twin of a live page of ours is that page's update,
 * and waits while the page is younger than the refresh floor. Given neither the market nor the live pages, the order is
 * the ranking's.
 */
function oneTopicEach(ranked: readonly Ranked[], input: ChooseInput, rejected: Choice["rejected"]): Joined[] {
  if (input.market === undefined && input.live === undefined) return [...ranked];
  const market = input.market ?? null;
  const rivals = (market?.rivals ?? []).map((rival) => (registrableDomain(rival.domain) ?? rival.domain).split(".")[0] ?? "");
  const brands = [...(input.profile?.brandTokens ?? []), ...rivals];
  const keys = new Map<Opportunity, string | null>();
  const keyOf = (o: Opportunity) => keys.get(o) ?? keys.set(o, market === null ? null : clusterKey(o.targetQuery, brands, market)).get(o)!;
  const joined = (a: Opportunity, b: Opportunity) => sameTopic(a, b, input.topTens) || (keyOf(a) !== null && keyOf(a) === keyOf(b));
  const rows = new Map(input.rows.map((row) => [row.id, readOpportunity(row)]));
  // A page an open refresh already updates takes no second update.
  const updated = new Set([...rows.values()].flatMap((o) => (o.type === "refresh_page" && o.targetRef !== null ? [canonicalUrl(o.targetRef)] : [])));
  const kept: { o: Opportunity; entry: Joined }[] = [];
  const out: Joined[] = [];
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
    const live = (input.live ?? []).find((page) => joined(page.row, o));
    const page: KnownPage | null =
      live === undefined
        ? null
        : { source: "reachkit", ref: live.row.id, url: live.url, title: live.title ?? live.row.title ?? "", headings: [], live: true, publishedAt: live.publishedAt };
    if (page !== null && (tooYoungToRefresh(page, input.at) || updated.has(canonicalUrl(page.url!)))) {
      rejected.push({ opportunityId: o.id, reason: "live_twin" });
      continue;
    }
    const held: Joined =
      page === null
        ? { ...entry }
        : { opportunityId: entry.opportunityId, reason: entry.reason, set: updateColumns(asUpdate(o, { page, score: pageScore({ query: o.targetQuery, title: o.title }, page, market) }, input.at)) };
    if (page !== null) updated.add(canonicalUrl(page.url!));
    kept.push({ o, entry: held });
    out.push(held);
  }
  return out;
}
