// BUILD §7 — the closed opportunity surface.
//
// Ten kinds, four families, one evidence shape per family (two for Fix),
// four acceptance forms, three winnability handles. Nothing here computes and
// nothing here speaks: this file is types plus one frozen lookup table, so
// that a tenth kind, a fifth family or a fourth acceptance form is a
// compile error at every call site rather than a value some module has to
// remember to reject.
//
// The customer-facing words for the three winnability handles are not
// here and are not this module's: they are `BAND_LABELS.winnability` in
// `src/lib/presentation/bands.ts` (ADR-001). This engine emits handles.
import type { Measured } from "@/lib/measure/measured";
import type { SiteCheck } from "@/lib/site-issues/types";

/** §7's table, read down the `Type` column, plus SPEC §0's Earn family: a
 *  source names a rival and not the customer, and the answer is a citable
 *  asset on the customer's own domain. Four Write, three Improve, one Fix,
 *  one Earn — and no tenth, which is what makes `FAMILY_OF` below total. */
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

/** The one mapping. `Readonly<Record<OpportunityType, Family>>` is the
 *  annotation and not `satisfies`: totality over the enum is the property
 *  that matters, so a missing member is a compile error here rather than a
 *  runtime `undefined` somewhere downstream. The database mirrors this map
 *  in a check constraint — a constrained mirror, never a second source of
 *  truth. */
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

/** §7's three asset kinds: "a new post, a new page, or an update to an
 *  existing page". Declared here beside `FAMILY_OF` because it is the same
 *  sort of fact — a closed vocabulary the database mirrors and never owns. */
export type AssetKind = "post" | "page" | "update";

/** The citable asset an Earn row asks for, chosen from its query's shape
 *  (`derive/earn.ts`, issue 478). */
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

/** The day's asset kind, read off the opportunity it was picked for. */
export function assetKindOf(type: OpportunityType): AssetKind | null {
  return ASSET_KIND_OF[type];
}

/** §7's Improve triggers, as the measurement that shows the shortfall:
 *  "Customer ranks 4–30" · "page thin" · "Ranking page stale vs rivals'".
 *  Every arm carries a `Measured`, so a shortfall the scan could not
 *  measure cannot be constructed. */
export type Shortfall =
  | { kind: "position"; position: Measured<number> }
  | { kind: "thin"; words: Measured<number> }
  | { kind: "stale"; lastSeenChanged: Measured<Date> };

/** §7's Fix trigger — "any access gate fails" — as the closed set of gates
 *  the measurement engine can actually report. A sixth barrier is a change
 *  to what the product measures, not a string a caller may pass. */
export type Barrier =
  | "robots_disallow"
  | "noindex"
  | "login_wall"
  | "js_only"
  | "blocked_ai_agent";

/** SPEC §9's checks ReachKit fixes on a page itself (owner ruling
 *  2026-09-14): the ones whose who-does-it is ReachKit's. A `fix_page`
 *  opportunity names which of them its page failed. */
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

/** §7: "Every opportunity: trigger · evidence (query, volume, rival, URL,
 *  position) · target · demand · effort · acceptance test." This is the
 *  evidence half, discriminated by family so the shape a consumer must
 *  handle follows from the row it read.
 *
 *  Every value in here is **copied at creation**, never a reference read
 *  back later: the day panel's explanation must still read correctly after
 *  the next weekly scan has moved the numbers. */
/** SPEC §6.2's three answer columns, by the handles `matrix.ts` names them
 *  with. Spelled out rather than imported so this leaf, which every screen
 *  reads, keeps no edge into the market leaf (issue 867). `BATTERY_ENGINES`
 *  is the list; a fourth engine would have to be added in both, which §6.2
 *  and §6.4's never-pull list already gate. */
export type AnswerEngine = "ai_overview" | "ai_mode" | "chatgpt";

/** Where one engine stood on this target's question when the pass measured
 *  it (issue 867): it named this site, it answered and named others, it
 *  served no answer, or nobody asked it. Four states and no number — the
 *  screen states which, and never counts them into a figure. */
export type EngineStanding = "names_you" | "names_others" | "no_answer" | "unmeasured";

export interface TargetEngine {
  engine: AnswerEngine;
  standing: EngineStanding;
}

/**
 * What this page is optimising for, beyond its search and volume (issue
 * 867): the vendor's keyword difficulty for the search, the difficulty
 * ceiling this site was judged against when the target was chosen (SPEC §6,
 * issue 858), and where each answer engine stood.
 *
 * Copied at creation like every other member of `Evidence`, so the draft
 * screen and the day panel still read correctly after the next Monday has
 * moved the numbers. Absent on a row derived before issue 867: `difficulty`
 * then has no value to render, and the screens show its unmeasured arm
 * rather than a zero.
 */
export interface TargetFacts {
  /** The search's own difficulty, 0–100. `unmeasured` where the vendor gave
   *  none — the honest arm, never a 0, which reads as "nothing to beat". */
  difficulty: Measured<number>;
  /** `difficultyCeiling(ownRanked)` at creation — what the number above is
   *  judged against. */
  ceiling: number;
  /** One entry per engine the pass carried, in `BATTERY_ENGINES` order. */
  engines: readonly TargetEngine[];
}

export type Evidence =
  | {
      family: "write";
      query: string;
      volume: Measured<number>;
      rival: { domain: string; url: Measured<string>; position: Measured<number> };
      /** issue 867. Absent on a row derived before it. */
      target?: TargetFacts;
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
  /** SPEC §9 (#690): a crawled page failed checks ReachKit fixes. `pageUrl`
   *  is the page the update changes; `issues` are the checks it failed in
   *  the scan that derived it, copied at creation. */
  | { family: "fix"; issues: readonly PageFix[]; pageUrl: string }
  | {
      /** SPEC §0's Earn trigger: a source named a rival and not the
       *  customer. `source` is the surface that did so, copied at creation
       *  like every other value here — never a party anyone writes to. */
      family: "earn";
      query: string;
      volume: Measured<number>;
      source: { surface: "ai_answer" | "search_result"; ref: string };
      rival: { domain: string };
      asset: EarnAsset;
      /** issue 867. Absent on a row derived before it. */
      target?: TargetFacts;
    };

/** §7's acceptance test, verbatim: "top 20 for Q" / "named on question P" /
 *  "gate passes". Written once at creation and never rewritten — the
 *  database's `before update` trigger is that invariant, not this type. */
export type Acceptance =
  | { form: "top20"; query: string }
  | { form: "named_on"; question: string }
  | { form: "gate_cleared"; gate: Barrier }
  /** SPEC §9: "Fixing one drops it next Monday" — every named check passes
   *  for this page in a week's scan. */
  | { form: "issues_cleared"; issues: readonly PageFix[]; pageUrl: string };

/** §7's three bands. Internal handles; the words are `BAND_LABELS`'. */
export type Winnability = "winnable" | "reach" | "not-yet";

/** The band a target outsized for this site carries (SPEC §6's right-sizing
 *  law). Named once, because three things read it: the ranking, which never
 *  offers one as the day's page; the supply count, which does not count one
 *  as a day of pages; and the cluster collapse, where a right-sized
 *  candidate takes the place of one already on file (issue 881). */
export const OUTSIZED: Winnability = "not-yet";

/**
 * Whether a target may fill a publishing day at all (issue 881).
 *
 * SPEC §6's right-sizing law, as a predicate rather than a weight. It was a
 * weight — `FIT_WEIGHT["not-yet"]` is 0, "so the formula cannot surface a
 * target the winnability rule bars" — and a weight does not bar anything:
 * on the owner's own site every candidate scored 0, the order was a tie,
 * the tie-break took the biggest keyword, and ReachKit wrote "best seo
 * software" (1 000/mo) for a site ranking for three. A zero multiplicand
 * orders; it does not exclude. This does.
 *
 * A `not-yet` row still stays on file: the site may grow into it, and the
 * next pass re-derives it with a band of its own. It is simply never the
 * day's page and never counted as a day of supply.
 */
export function qualifiesForADay(fitBand: Winnability | null): boolean {
  return fitBand !== null && fitBand !== OUTSIZED;
}

export type OpportunityStatus = "open" | "queued" | "done" | "dismissed";

/** Why a row has not passed readiness, as handles — SPEC §6's clauses, one
 *  each, plus the state of a row nothing has assessed yet. The database
 *  mirrors this set in a check constraint, and the words a screen shows are
 *  the copy registry's, never these. */
export type UnreadyReason =
  | "not_assessed"
  | "cluster_suppressed"
  | "url_retired"
  | "keyword_gate"
  | "format_not_allowed"
  | "no_grounding_fact"
  /** A `fix_page` the site's destination cannot update: not a WordPress
   *  destination, a page on another host, a site root, or a fix that
   *  destination has no field for. Or an Improve row on a hosted destination
   *  whose page is not one of ReachKit's own live publications there
   *  (issue 781). */
  | "destination_cannot_address";

export const UNREADY_REASONS: readonly UnreadyReason[] = Object.freeze([
  "not_assessed",
  "cluster_suppressed",
  "url_retired",
  "keyword_gate",
  "format_not_allowed",
  "no_grounding_fact",
  "destination_cannot_address",
]);

export interface Opportunity {
  id: string;
  siteId: string;
  scanId: string;
  type: OpportunityType;
  family: Family;
  /** Null only for `unblock`: a Fix targets no search. That is a shape, not
   *  a policy, which is what makes "never generated" unrepresentable rather
   *  than merely forbidden. */
  targetQuery: string | null;
  /** Proposed slug (write) · the page's own URL (improve) · the URL the
   *  barrier was found on (fix). */
  targetRef: string;
  /** The proposed title, for a Write target that has one. Model-labelled
   *  through `refineType`, and therefore never rendered raw — a surface
   *  reaches it through `GeneratedText`. */
  title: string | null;
  volume: Measured<number> | null;
  evidence: Evidence;
  acceptance: Acceptance;
  /** Null only for `unblock`, which is unranked and unbanded. */
  fitBand: Winnability | null;
  /** 0..1, from `EFFORT_BY_TYPE`. */
  effort: number;
  status: OpportunityStatus;
  /** §6's parent topic: the calendar's unit is one cluster-day, not one
   *  keyword-day. Null until the cluster step derives one. */
  clusterKey: string | null;
  /** The sibling searches this row absorbed when its cluster collapsed, so
   *  several queries sharing a parent produce at most one target. */
  absorbedQueries: readonly string[];
  /** §6: "A day is filled only by an opportunity that passes readiness."
   *  Stored, so the reason a row was passed over survives the pass that
   *  decided it; exactly one of these two carries the answer. */
  ready: boolean;
  unreadyReason: UnreadyReason | null;
  createdAt: Date;
}

/** Why a candidate did not become an opportunity. Three counters, and the
 *  third is how a silent supply drought is told apart from a market with
 *  nothing in it. */
export interface RejectionCount {
  /** The winnability bar was not cleared. */
  not_yet: number;
  /** No top-ten domain had a ranked count we could read. */
  unmeasured_top10: number;
  /** An equivalent open or queued opportunity already exists. */
  duplicate_open: number;
}

export function noRejections(): RejectionCount {
  return { not_yet: 0, unmeasured_top10: 0, duplicate_open: 0 };
}

export function addRejections(a: RejectionCount, b: RejectionCount): RejectionCount {
  return {
    not_yet: a.not_yet + b.not_yet,
    unmeasured_top10: a.unmeasured_top10 + b.unmeasured_top10,
    duplicate_open: a.duplicate_open + b.duplicate_open,
  };
}

export interface Ranked {
  opportunityId: string;
  score: number;
}
