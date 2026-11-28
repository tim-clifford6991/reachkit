// BUILD §7 — the closed opportunity surface: types and one frozen table, so a new kind, family or acceptance form is a
// compile error at every call site. The words for the winnability handles are `BAND_LABELS.winnability`'s (ADR-001).
import type { Measured } from "@/lib/measure/measured";
import type { KnownSource } from "@/lib/known-content/types";
import type { SiteCheck } from "@/lib/site-issues/types";
import type { FitFact } from "@/lib/site-profile/knowledge/read";
import type { TopicAngle } from "@/lib/market/questions/angle";
import type { HotClaim, HotEvent, HotReason } from "@/lib/hot/detect";
import type { SearchTrend } from "@/lib/vendors/dataforseo/types";

/** §7's table, read down the `Type` column, plus SPEC §0's Earn family: a source names a rival and not the customer,
 *  and the answer is a citable asset on the customer's own domain. Four Write, three Improve, one Fix, one Earn — and
 *  no tenth, which is what makes `FAMILY_OF` below total. */
export type OpportunityType =
  | "answer_page"
  | "keyword_page"
  | "comparison_page"
  | "format_page"
  | "expand_page"
  | "answerable_page"
  | "refresh_page"
  | "unblock"
  | "fix_page"
  | "listed_page";

export type Family = "write" | "improve" | "fix" | "earn";

/** The one mapping. `Readonly<Record<OpportunityType, Family>>` is the annotation and not `satisfies`: totality over
 *  the enum is the property that matters, so a missing member is a compile error here rather than a runtime
 *  `undefined` somewhere downstream. The database mirrors this map in a check constraint — a constrained mirror,
 *  never a second source of truth. */
export const FAMILY_OF: Readonly<Record<OpportunityType, Family>> = Object.freeze({
  answer_page: "write",
  keyword_page: "write",
  comparison_page: "write",
  format_page: "write",
  expand_page: "improve",
  answerable_page: "improve",
  refresh_page: "improve",
  unblock: "fix",
  fix_page: "fix",
  listed_page: "earn",
});

export const OPPORTUNITY_TYPES: readonly OpportunityType[] = Object.freeze(
  Object.keys(FAMILY_OF) as OpportunityType[]
);

/** §7's three asset kinds: "a new post, a new page, or an update to an existing page". Declared here beside
 *  `FAMILY_OF` because it is the same sort of fact — a closed vocabulary the database mirrors and never owns. */
export type AssetKind = "post" | "page" | "update";

/** The citable asset an Earn row asks for, chosen from its query's shape (`derive/earn.ts`, issue 478). */
export type EarnAsset = "comparison_table" | "integration_page" | "original_data_page";

/** Which kind of asset a day publishes for each opportunity type.
 *
 *  `null` is the Fix family and not an omission: clearing an access barrier
 *  changes a page's headers, and publishes no asset of its own. Earn writes
 *  a citable page the same way Write does. No type yields `post` — the
 *  surface has no post-shaped opportunity to derive one from, and choosing
 *  which Write type is a post is the owner's, not a mapping's. Total over
 *  the enum, so a new type is a compile error here. */
export const ASSET_KIND_OF: Readonly<Record<OpportunityType, AssetKind | null>> = Object.freeze({
  answer_page: "page",
  keyword_page: "page",
  comparison_page: "page",
  format_page: "page",
  expand_page: "update",
  answerable_page: "update",
  refresh_page: "update",
  unblock: null,
  // SPEC §9 (#690): ReachKit's fix of a page's own metadata publishes as an
  // update to that page — its title and description, its content untouched.
  fix_page: "update",
  listed_page: "page",
});

/** §7's Improve triggers, as the measurement that shows the shortfall: "Customer ranks 4–30" · "page thin" · "Ranking
 *  page stale vs rivals'". Every arm carries a `Measured`, so a shortfall the scan could not measure cannot be
 *  constructed. */
export type Shortfall =
  | { kind: "position"; position: Measured<number> }
  | { kind: "thin"; words: Measured<number> }
  | { kind: "stale"; lastSeenChanged: Measured<Date> }
  /** SPEC §7 (2026-09-20, #928): the site already has a page on this topic, and this row is the update of it rather
   *  than a second page about the same thing. `similarity` is the number that matched them — the one
   *  `known-content/similarity.ts` recorded, measured when the pass ran — and `page` is the page it matched, so the
   *  row carries what it acted on and the draft's checks can name it. */
  | {
      kind: "covered";
      page: { url: string; title: string; source: KnownSource };
      similarity: Measured<number>;
    }
  /** SPEC §7 (2026-09-29, *Pace*; issue 1139): one of ReachKit's own live pages is due a refresh. `since` is the day
   *  its current version went live, which is what the cause was measured against. */
  | {
      kind: "due";
      cause: RefreshCause;
      since: Measured<Date>;
      /** SPEC §7 (2026-10-10, issue 1391): the newer live page this refresh links to. Present where `cause` is
       *  `link`, and only there. `replaces` (issue 1487) is the address that page moved from, which this page links:
       *  the update points that link at `url`. */
      link?: { url: string; title: string; replaces?: string };
      /** Issue 1507: what the live page breaks of the consistency rules,
       *  by handle. Present where `cause` is `structure`, and only there. */
      defects?: string[];
      /** The page's own place for its search when planned, where one was
       *  read; a growing refresh adds sections only near page one. */
      place?: number;
      /** Google impressions over 28 days, on a `snippet` refresh only. */
      shown?: number;
    }
  /** SPEC §7 (D53, issue 1268): one of ReachKit's own live pages is rewritten for a new search, at its own address.
   *  The row's `targetQuery` is the new search, and the page is written as that search's own type, not as a refresh
   *  of what is live. */
  | { kind: "retarget" };

/** Why a live page of ours is due: its version is 90 days old, the Monday verdict found it in a worse place, a pool
 *  holds a fact newer than it, eight weekly verdicts found it neither ranking nor cited (D60, issue 1288), a newer
 *  related page went live that it does not link (issue 1391), it breaks a consistency rule of issue 1507
 *  (`structure`), no stored search result has held it and D13's check finds it close to a page written for another
 *  site (`unseen`, issue 1538), its own address ranks 4–20 for its search (`close`), or a comparison's rival prices
 *  are older than D59's 30 days (`stale_prices`), Google kept it out of the index four weeks running (`not_indexed`),
 *  Google showed it 100 times in 28 days with no click or visit from it (`snippet`), or its customer saved changed
 *  words for it (`edited`). */
export type RefreshCause =
  | "aged"
  | "lost_position"
  | "newer_fact"
  | "unmet"
  | "link"
  | "own_figures"
  | "structure"
  | "unseen"
  | "close"
  | "stale_prices"
  | "not_indexed"
  | "snippet"
  | "edited";

/** §7's Fix trigger — "any access gate fails" — as the closed set of gates the measurement engine can actually
 *  report. A sixth barrier is a change to what the product measures, not a string a caller may pass. */
export type Barrier =
  | "robots_disallow"
  | "noindex"
  | "login_wall"
  | "js_only"
  | "blocked_ai_agent";

/** SPEC §9's checks ReachKit fixes on a page itself (owner ruling 2026-09-14): the ones whose who-does-it is
 *  ReachKit's. A `fix_page` opportunity names which of them its page failed. */
export type PageFix = Extract<SiteCheck, "page_titles" | "meta_descriptions" | "structured_data">;

export const PAGE_FIXES: readonly PageFix[] = Object.freeze([
  "page_titles",
  "meta_descriptions",
  "structured_data",
]);

export const BARRIERS: readonly Barrier[] = Object.freeze([
  "robots_disallow",
  "noindex",
  "login_wall",
  "js_only",
  "blocked_ai_agent",
]);

/** SPEC §6.2's three answer columns, by the handles `matrix.ts` names them with. Spelled out rather than imported so
 *  this leaf, which every screen reads, keeps no edge into the market leaf (issue 867). `BATTERY_ENGINES` is the
 *  list; a fourth engine would have to be added in both, which §6.2 and §6.4's never-pull list already gate. */
export type AnswerEngine = "ai_overview" | "ai_mode" | "chatgpt";

/** Where one engine stood on this target's question when the pass measured it (issue 867): it named this site, it
 *  answered and named others, it answered and named no one, it served no answer, or nobody asked it. Five states and
 *  no number — the screen states which, and never counts them into a figure. A row stored before `names_no_one`
 *  existed keeps its `names_others`, so readers accept both. */
export type EngineStanding = "names_you" | "names_others" | "names_no_one" | "no_answer" | "unmeasured";

export interface TargetEngine {
  engine: AnswerEngine;
  standing: EngineStanding;
}

/** What this page is optimising for beyond its search and volume, copied at creation so the screens still read right
 *  after the next Monday: the search's difficulty, the ceiling the site was judged against, and each engine's standing. */
export interface TargetFacts {
  /** The search's own difficulty, 0–100. `unmeasured` where the vendor gave
   *  none — the honest arm, never a 0, which reads as "nothing to beat". */
  difficulty: Measured<number>;
  /** `difficultyCeiling(ownRanked)` at creation — what the number above is judged against. */
  ceiling: number;
  /** One entry per engine the pass carried, in `BATTERY_ENGINES` order. */
  engines: readonly TargetEngine[];
  /** Present where no ranked count and no difficulty sized the top ten: it ranks last, and is never read as a size. */
  topTen?: Extract<Measured<number>, { kind: "unmeasured" }>;
}

/** The search's trend as the vendor gave it, and when it was read. Absent where it gave none: never a 0. */
export type ReadTrend = SearchTrend & { at: Date };

/** The business a Write page is written to overtake; `null` where only sources hold its search. */
export type WriteRival = { domain: string; url: Measured<string>; position: Measured<number> };

/** What a draft's research read: the top-result addresses it quoted, the rivals in force whose pages it read, and its searches. */
export type StoppedInputs = { topResults: string[]; rivals: string[]; searches: string[] };

/** §7's evidence, by family; every value is copied at creation, so an explanation still reads right after the next pass. */
export type Evidence =
  | {
      family: "write";
      query: string;
      volume: Measured<number>;
      rival: WriteRival | null;
      /** issue 867. Absent on a row derived before it. */
      target?: TargetFacts;
      /** A "People also ask" question or related search the site's stored SERP for `term` showed, bought at `serpAt`:
       *  demand observed, not measured. `newSince` is the earlier week's read of `term` that did not show it. */
      askedBeside?: { term: string; serpAt: Date; newSince?: Date };
      trend?: ReadTrend;
      /** Issue 1520: a search ReachKit composed from the market's own words, which needs a buyer seen asking it.
       *  Absent on every other topic, and on a composed one derived before. */
      composed?: true;
      topUp?: true; // the week's top-up added it, which the commit's record counts
      /** The tracked prompt whose answer gave a competitor and not the site, which this search words (`ai_gap`). */
      prompt?: { id: string; text: string };
      /** SPEC §6 *A competitor wins, the site is absent*: which signal found it, the competitor, and the stored row that shows the site absent. */
      win?: { signal: "answer" | "prompt" | "cited" | "ranked"; competitor: string; absent: string };
      /** The search's stored results page asks for a provider's own page (`derive/top-ten-kind.ts` `offeringTopTen`),
       *  so it is written as an offering page. Absent where it does not, or no fresh one is stored. */
      shape?: "offering";
      /** `null` once judged with no passage; absent where not judged since the call named one. */
      fitFact?: FitFact | null;
      /** The angle the topic keeps (`market/questions/angle.ts`); `null` where none passed, absent where judged before. */
      angle?: TopicAngle | null;
      hot?: { claims: HotClaim[]; reason?: HotReason; changes?: boolean; weak?: HotEvent["weak"] }; // A timely page's event: the reports its pack cites, its reason, whether it changes what a buyer does, why it ranks lower.
    }
  | {
      family: "improve";
      query: string;
      volume: Measured<number>;
      pageUrl: string;
      shortfall: Shortfall;
      /** issue 867. Absent on a row derived before it. */
      target?: TargetFacts;
    }
  | { family: "fix"; barrier: Barrier; foundOnUrl: string }
  /** SPEC §9 (#690): a crawled page failed checks ReachKit fixes. `pageUrl` is the page the update changes; `issues`
   *  are the checks it failed in the scan that derived it, copied at creation. */
  | { family: "fix"; issues: readonly PageFix[]; pageUrl: string }
  | {
      /** SPEC §0's Earn trigger: a source named a rival and not the customer. `source` is the surface that did so,
       *  copied at creation like every other value here — never a party anyone writes to. */
      family: "earn";
      query: string;
      volume: Measured<number>;
      source: { surface: "ai_answer" | "search_result"; ref: string };
      rival: { domain: string };
      asset: EarnAsset;
      /** issue 867. Absent on a row derived before it. */
      target?: TargetFacts;
      /** As a Write row's. */
      shape?: "offering";
      trend?: ReadTrend;
      fitFact?: FitFact | null;
      angle?: TopicAngle | null;
    };

/** §7's acceptance test, verbatim: "top 20 for Q" / "named on question P" / "gate passes". Written once at creation
 *  and never rewritten — the database's `before update` trigger is that invariant, not this type. */
export type Acceptance =
  | { form: "top20"; query: string }
  | { form: "named_on"; question: string }
  | { form: "gate_cleared"; gate: Barrier }
  /** SPEC §9: "Fixing one drops it next Monday" — every named check passes for this page in a week's scan. */
  | { form: "issues_cleared"; issues: readonly PageFix[]; pageUrl: string };

/** §7's three bands. Internal handles; the words are `BAND_LABELS`'. */
export type Winnability = "winnable" | "reach" | "not-yet";

/** The band a target outsized for this site carries (SPEC §6's right-sizing law). It holds nothing: the ranking
 *  scores it lower (`rank/points.ts`), and the cluster collapse keeps a right-sized candidate over it (issue 881). */
export const OUTSIZED: Winnability = "not-yet";

/** Whether a target is right-sized for the site today. */
export function qualifiesForADay(fitBand: Winnability | null): boolean {
  return fitBand !== null && fitBand !== OUTSIZED;
}

/** SPEC §0 *Business fit*: 0–3, how much the business's own offering is the
 *  answer to a search. Judged once by the pass and stored (§6, 2026-09-29). */
export type BusinessFit = 0 | 1 | 2 | 3;

/** Where a topic came from, in the order SPEC §6 offers them (2026-09-29): an AI answer that names a rival and not
 *  the site; a search anchored on the product; a problem it solves; a plain category search; and a category's "best
 *  X", which ranks last. Decided in code from the search and its evidence — never by the model, and never from an
 *  intent kind. */
export type TopicSource = "ai_gap" | "product" | "problem" | "category" | "best_x" | "earned";

/** SPEC §7 *honesty by page type* (2026-09-29; D20, 2026-10-02): how the business may appear on a Write or an Earn
 *  page. `./page-type.ts` decides it; the database mirrors the set in a check constraint. */
export type PageType = "product" | "market_comparison" | "answer";

export type OpportunityStatus = "open" | "queued" | "done" | "dismissed";

/** Why a row may not fill a day, as handles: the six `eligible()` answers (owner ruling C6, 2026-10-19), plus the
 *  state of a row nothing has assessed yet. The database's check constraint still admits the handles merged away,
 *  which only rows not assessed since keep. The words a screen shows are the copy registry's, never these. */
export type UnreadyReason =
  | "not_assessed"
  /** Held back by its own record: its draft was stopped for the last time or skipped (D26), its cluster was judged
   *  not working, or its URL was retired. Absorbs `cluster_suppressed` and `url_retired`. */
  | "resting"
  /** The site's destination cannot publish this page: an update of a page it does not write to, or a topic one of the
   *  site's own pages already covers (#928). Absorbs `already_covered`. */
  | "destination_cannot_address"
  /** The business is not the answer: a stored fit below the gate. */
  | "low_fit"
  /** No longer assigned: an unscored row is ready and ranks as a 2. */
  | "fit_unscored"
  /** No longer assigned: a closed footprint is the `no_footprint` points part. */
  | "out_of_reach"
  /** No longer assigned: a site whose pages ground no fact is written from research (owner, #2511). */
  | "no_grounding_fact";

export const UNREADY_REASONS: readonly UnreadyReason[] = Object.freeze([
  "not_assessed", "resting", "destination_cannot_address",
  "low_fit", "fit_unscored",
  "out_of_reach",
  "no_grounding_fact",
]);

export interface Opportunity {
  id: string;
  siteId: string;
  scanId: string;
  type: OpportunityType;
  family: Family;
  /** Null only for `unblock`: a Fix targets no search. That is a shape, not a policy, which is what makes "never
   *  generated" unrepresentable rather than merely forbidden. */
  targetQuery: string | null;
  /** Proposed slug (write) · the page's own URL (improve) · the URL the barrier was found on (fix). */
  targetRef: string;
  /** The proposed title, for a Write target that has one. Model-labelled through `refineType`, and therefore never
   *  rendered raw — a surface reaches it through `GeneratedText`. */
  title: string | null;
  volume: Measured<number> | null;
  evidence: Evidence;
  acceptance: Acceptance;
  /** Null only for `unblock`, which is unranked and unbanded. */
  fitBand: Winnability | null;
  /** SPEC §0 business fit, as the pass that judged it stored it. Absent or `null` on a row no pass has judged — a Fix
   *  row, or one from before issue 1134 — which the gates read as they did before. */
  businessFit?: BusinessFit | null;
  /** Where the topic came from. Absent or `null` as above. */
  source?: TopicSource | null;
  /** SPEC §7 *honesty by page type* (issue 1136): how the business may appear on the page, as stored. Absent or
   *  `null` on a row that writes no new page, or one from before the column — `pageTypeOf` then reads it off the
   *  type, the search and the source. */
  pageType?: PageType | null;
  /** 0..1, from `EFFORT_BY_TYPE`. */
  effort: number;
  status: OpportunityStatus;
  /** §6's parent topic: the calendar's unit is one cluster-day, not one
   *  keyword-day. Null until the cluster step derives one. */
  clusterKey: string | null;
  /** The sibling searches this row absorbed when its cluster collapsed, so
   *  several queries sharing a parent produce at most one target. */
  absorbedQueries: readonly string[];
  /** §6: "A day is filled only by an opportunity that passes readiness." Stored, so the reason a row was passed over
   *  survives the pass that decided it; exactly one of these two carries the answer. */
  ready: boolean;
  unreadyReason: UnreadyReason | null;
  /** SPEC §7 (D26, issue 1179): the moment a rested topic may fill a day again. Absent or past: it is not resting. */
  restUntil?: Date | null;
  createdAt: Date;
  /** SPEC §7: the type the day's page is written as where it is not the row's own; the commit stores it as `plan_write_as`. */
  writeAs?: PlanWriteAs;
  /** Why the week committed it, where it is in the committed week. */
  planReason?: PlanReason | null;
}

/** Why a candidate did not become an opportunity, so a silent supply drought is told apart from a market with nothing in it. */
export interface RejectionCount {
  /** An equivalent open or queued opportunity already exists. */
  duplicate_open: number;
  /** A new page on a search naming the business itself, which wants its own site. */
  own_brand: number;
}

export function noRejections(): RejectionCount {
  return { duplicate_open: 0, own_brand: 0 };
}

export function addRejections(a: RejectionCount, b: RejectionCount): RejectionCount {
  return Object.fromEntries((Object.keys(a) as (keyof RejectionCount)[]).map((key) => [key, a[key] + b[key]])) as unknown as RejectionCount;
}

/** Which of the one list's rules placed a row, so a plan can say why. */
export type PlaceRule =
  | "best"
  | "fix ahead of its cluster"
  | "fix, no page to precede"
  // What a page's own results planned (issue 1611), named in place of the tier.
  | "stalled near page one: gap refresh"
  | "not moving: refreshed once"
  | "linked by AI: one more in its cluster";

/** One part of a row's points, as the plan stores it. */
export type PointPart = "fit" | "demand" | "ai_gap" | "rising" | "timely" | "near_page_one" | "linked_by_ai" | "not_moving" | "shown_no_visits" | "new_site" | "outsized" | "no_demand" | "no_footprint" | "not_working";

/** `opportunities.plan_reason`: the points a committed row ranked by, the parts they sum from, and the rule that placed it. */
export interface PlanReason {
  points: number;
  /** `shown` is the Google impressions a `shown_no_visits` part's sentence states. */
  parts: { part: PointPart; n: number; shown?: number }[];
  rule: PlaceRule | null;
  /** What the commit read of its research: `queued` where none is cached, `short` under its type's pass mark, by part. */
  research?: { state: "met" | "at_margin" | "queued" | "short"; R: number | null; Q: number | null; F: number | null; estWords: number | null; urls: string[]; short?: string[] };
  /** The dated event a timely page ranked for (SPEC §7 *A page for what is new in the market*); from an earlier daily placement, a page's first day before one moved it, and the pages it moved out of the week. */
  hot?: HotReason;
  moved?: { from: string; search: string };
  movedOut?: { search: string; day: string }[];
}

export interface Ranked {
  opportunityId: string;
  reason: PlanReason;
  /** Where the day writes the topic as another type (issue 1455). */
  writeAs?: PlanWriteAs;
}

export const PLAN_WRITE_AS = ["listicle", "how_to", "qa", "documentation", "offering"] as const; // the five `plan_write_as`'s check allows
export type PlanWriteAs = (typeof PLAN_WRITE_AS)[number];

/** Whether a rested topic is still inside its rest at `now` (SPEC §7, D26). */
export function isResting(o: Pick<Opportunity, "restUntil">, now: Date): boolean {
  return o.restUntil != null && now.getTime() < o.restUntil.getTime();
}

/** A refresh of one of ReachKit's own live pages (SPEC §7, *Pace*, issue
 *  1139): the update a day takes first once the week's new pages are in. */
export function isOwnRefresh(o: Pick<Opportunity, "evidence">): boolean {
  return o.evidence.family === "improve" && (o.evidence.shortfall.kind === "due" || isRetarget(o));
}

/** A live page of ours rewritten for a new search (D53, issue 1268). The
 *  evidence is stored jsonb, so a row without one is read as not one. */
export function isRetarget(o: { evidence?: Evidence | null }): boolean {
  const evidence = o.evidence as { family?: unknown; shortfall?: { kind?: unknown } } | null | undefined;
  return evidence?.family === "improve" && evidence.shortfall?.kind === "retarget";
}
