// BUILD §7 — the closed opportunity surface.
//
// Eight kinds, three families, one evidence shape per family, three
// acceptance forms, three winnability handles. Nothing here computes and
// nothing here speaks: this file is types plus one frozen lookup table, so
// that a ninth kind, a fourth family or a fourth acceptance form is a
// compile error at every call site rather than a value some module has to
// remember to reject.
//
// The customer-facing words for the three winnability handles are not
// here and are not this module's: they are `BAND_LABELS.winnability` in
// `src/lib/presentation/bands.ts` (ADR-001). This engine emits handles.
import type { Measured } from "@/lib/measure/measured";

/** §7's table, read down the `Type` column. Four Write, three Improve, one
 *  Fix — and no ninth, which is what makes `FAMILY_OF` below total. */
export type OpportunityType =
  | "answer_page"
  | "keyword_page"
  | "comparison_page"
  | "format_page"
  | "expand_page"
  | "answerable_page"
  | "refresh_page"
  | "unblock";

export type Family = "write" | "improve" | "fix";

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
  | { family: "fix"; barrier: Barrier; foundOnUrl: string };

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
