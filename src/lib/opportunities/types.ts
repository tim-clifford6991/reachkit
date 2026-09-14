// BUILD §7 — the closed opportunity surface.
//
// Nine kinds, four families, one evidence shape per family, three
// acceptance forms, three winnability handles. Nothing here computes and
// nothing here speaks: this file is types plus one frozen lookup table, so
// that a tenth kind, a fifth family or a fourth acceptance form is a
// compile error at every call site rather than a value some module has to
// remember to reject.
//
// The customer-facing words for the three winnability handles are not
// here and are not this module's: they are `BAND_LABELS.winnability` in
// `src/lib/presentation/bands.ts` (ADR-001). This engine emits handles.
import type { Measured } from "@/lib/measure/measured";

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
  listed_page: "earn",
});

export const OPPORTUNITY_TYPES: readonly OpportunityType[] = Object.freeze(
  Object.keys(FAMILY_OF) as OpportunityType[]
);

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
export type Evidence =
  | {
      family: "write";
      query: string;
      volume: Measured<number>;
      rival: { domain: string; url: Measured<string>; position: Measured<number> };
    }
  | {
      family: "improve";
      query: string;
      volume: Measured<number>;
      pageUrl: string;
      shortfall: Shortfall;
    }
  | { family: "fix"; barrier: Barrier; foundOnUrl: string }
  | {
      /** SPEC §0's Earn trigger: a source named a rival and not the
       *  customer. `source` is the surface that did so, copied at creation
       *  like every other value here — never a party anyone writes to. */
      family: "earn";
      query: string;
      volume: Measured<number>;
      source: { surface: "ai_answer" | "search_result"; ref: string };
      rival: { domain: string };
    };

/** §7's acceptance test, verbatim: "top 20 for Q" / "named on question P" /
 *  "gate passes". Written once at creation and never rewritten — the
 *  database's `before update` trigger is that invariant, not this type. */
export type Acceptance =
  | { form: "top20"; query: string }
  | { form: "named_on"; question: string }
  | { form: "gate_cleared"; gate: Barrier };

/** §7's three bands. Internal handles; the words are `BAND_LABELS`'. */
export type Winnability = "winnable" | "reach" | "not-yet";

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
  | "no_grounding_fact";

export const UNREADY_REASONS: readonly UnreadyReason[] = Object.freeze([
  "not_assessed",
  "cluster_suppressed",
  "url_retired",
  "keyword_gate",
  "format_not_allowed",
  "no_grounding_fact",
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
