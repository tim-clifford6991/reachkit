// BUILD §4.1, §6.3 — the stored report, declared, and the one read of it
//
// `ARCHITECTURE.md` gives `src/lib/scan/**` "the stored report" and names
// `readCurrentReport()` as its entry point. This file is both halves of
// that row: the blob `/scan/{domain}` renders, declared once so the screen
// has one type to read and the pipeline one type to write (issue #13), and
// the read itself (issue #25, which also supplies `runScan`,
// `assembleReport` and `storeCurrentReport` against this shape).
//
// **The blob is what the screen renders *and* what the pipeline recorded.**
// Issue #13 declared the seven members `/scan/{domain}` reads; issue #25
// adds the record beside them — which scan this was, when, at which tier,
// how it ended, and the market set, twelve questions, bought SERPs, rival
// derivation and coherence verdict it measured on the way. Nothing on the
// screen reads that second half, and it is not there for the screen: the
// correction reads its own category out of it (`readCorrectionFacts`), the
// paid deep pass reuses a fresh free scan's questions, market set and
// SERPs inside their cache windows (§6.4), and a report nobody can
// reproduce is not a measurement. A section that could not be produced is
// present and says so — `null` for the screen's sections (which the screen
// renders as a named absent section with one written line), the
// `unmeasured` arm for the record's — because an absent key and a
// `not_attempted` value read the same to a consumer and §5's trichotomy
// forbids that.
//
// **Two members of BP-012's own list are not here, and this says why.**
// `rivalSizes` needs `RivalSize`, which the rival-sizing module (issue #37)
// declares and nothing yet does; inventing a shape for a type another
// module owns is the second copy rule 2.4 exists to prevent, and §6.6's
// non-goal keeps sizing off the free path, so nothing reads it. `answers`
// is `aiAnswers` below — issue #13's section, which is #27's
// `AiAnswersCard` plus the three things the screen needs and the engine's
// card does not carry. The blob is versioned: adding either is a version
// bump, not a migration.
//
// **The market sections belong to the market leaves, and one of them is
// now theirs.** #27 landed `buildPresenceCard` while this branch was open,
// and its `PresenceCard` is member-for-member what this file had declared,
// so `PresenceSection` is that type and no longer a second copy of it.
//
// `AiAnswersSection` is still declared here, and deliberately: #27's
// `AiAnswersCard` is the *engine's* output and this is what the screen
// stores, and they differ in three ways that are decisions, not drift.
// Its `AnswerRow` carries the question as a plain `text: string`, which
// would reach the screen without passing `renderQuestion` — the gate
// REQ-093 c3 exists to hold — so this keeps a `GeneratedText`. It carries
// no `rivals`, and the dot matrix `BUILD.md` §4.1 draws is one row per
// rival. And it carries no `measuredAt`, which the card's source chip
// shows. Reconciling the two is `assembleReport`'s job (#25) and the
// first of the three is the owner's call; flagged there rather than
// settled quietly here by adopting a shape that drops a promise.
//
// Nothing here is optional-by-accident: a section that could not be
// produced is `null`, which the screen renders as a named absent section
// with one written line (REQ-004 c10/c11), never as an empty card and
// never as a spinner.
import type { AI_READER_AGENTS } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { CoherenceVerdict } from "@/lib/market/coherence/check";
import type { CorrectionState } from "@/lib/market/coherence/state";
import type { MarketSet } from "@/lib/market/questions/market-set";
import type { Question } from "@/lib/market/questions/phrase";
import type { RivalCandidate } from "@/lib/market/rivals/derive";
import type { PresenceCard } from "@/lib/market/rivals/presence";
import type { Measured } from "@/lib/measure/measured";
import type { OnPageFacts } from "@/lib/measure/parse";
import type { GeneratedText } from "@/lib/presentation/generated";
import type { Verdict } from "@/lib/measure/verdict";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import type { CanonicalDomain } from "./domain";

export type Tier = "free" | "deep" | "weekly";

/** How a pass ended — the four values `scans.stopped_reason` is
 *  constrained to by the migration that added the column. */
export type StoppedReason = "complete" | "time_ceiling" | "spend_ceiling" | "failed";

/** The one blob version this build writes. A reader that meets a version
 *  it does not know throws rather than returning a partially-populated
 *  value: `null` would be indistinguishable from "no report" at every call
 *  site. */
export const REPORT_VERSION = 1;

/** One cell of the AI-answers matrix — one question, one measured SERP.
 *  BP-025 `## Public interface` (issue #26's `matrix.ts` owns it). An
 *  `unmeasured` cell lowers the denominator and is never counted as a
 *  place the customer was ignored. */
export type AnswerCell =
  | { kind: "answered"; citedDomains: readonly string[]; namesCustomer: boolean }
  | { kind: "no_answer" }
  | { kind: "unmeasured"; reason: "undeterminable" | "not_attempted" };

/** One of the twelve tracked questions, as the report stores it. `wording`
 *  is model text and therefore a `GeneratedText`: the screen reaches it
 *  only through `renderQuestion`, which refuses to yield the wording
 *  without the search it came from (REQ-093 c3).
 *
 *  No `volume` member. The owner removed per-question `{vol}/mo` on
 *  2026-09-03; a field that does not exist cannot be rendered by mistake. */
export interface StoredQuestion {
  /** 1-based, the number the list shows beside the question. */
  n: number;
  wording: GeneratedText;
  /** The search this question was derived from (REQ-006 c9). */
  search: string;
  /** The brands the AI answer named, in the order the answer named them. */
  namedBrands: readonly string[];
}

/** BUILD §4.1 module 2, left card. BP-025's `AiAnswersCard`, plus the
 *  measurement date the source chip shows. */
export interface AiAnswersSection {
  /** n — the denominator: searches whose AI answer could be read at all. */
  measuredSearches: number;
  /** m of n — searches an AI answer actually appeared on. */
  answeredSearches: number;
  /** Counted over m, never over n. */
  customerCitations: number;
  measuredAt: Date;
  /** The customer's own domain, so the matrix can label its own row. */
  ownDomain: string;
  /** Rival rows of the dot matrix, in the order the presence card orders
   *  them; one cell per row per question. */
  rivals: readonly { domain: string; cells: readonly AnswerCell[] }[];
  rows: readonly { question: StoredQuestion; cell: AnswerCell }[];
}

/** BUILD §4.1 module 2, right card — #27's own `PresenceCard`, re-exported
 *  under the name the report blob uses for it rather than re-declared.
 *
 *  What it has no member for is the point of it: no rival ranked count,
 *  size, band, revenue, traffic value, funding, headcount or projected
 *  return, no severity, and no `totalMonthlyVolume` — the market-total
 *  footnote the owner removed on 2026-09-03, both halves. The card's
 *  honesty bound is the absence of anywhere to put a violation. */
export type PresenceSection = PresenceCard;

/** BUILD §4.1 module 3's two counts that are not on the verdict. The
 *  third, blocked readers, is `Verdict.blockedReaders` and is not
 *  duplicated here (one measurement, one home). */
export interface SupplySection {
  missingPages: Measured<number>;
  unquotablePages: Measured<number>;
}

/** BUILD §4.1 module 5 — page 1 of N, offered in exchange for an address.
 *  `title` is model text; the screen reaches it through `renderGenerated`
 *  with this page's own identity, never as a bare string. */
export interface FreePageSection {
  opportunityId: string;
  title: GeneratedText;
  slug: GeneratedText;
  /** The search the page targets, and its monthly volume. This volume is
   *  the *page's own target*, which §4.1 module 5 states as a row of the
   *  card; it is not the per-question volume the owner removed from the
   *  12-questions list on 2026-09-03. */
  target: { keyword: string; volume: number };
  /** The rival this page is written to overtake, where there is one. */
  beats: string | null;
  /** The opportunity type, rendered as written by the copy key for it. */
  format: string;
  /** How many pages the scan found in total — "page 1 of {N}". */
  totalPages: number;
}

/** What `GET /scan/{domain}` renders. One date governs the whole blob:
 *  `verdict.measuredAt` — every figure under it is that scan's. */
export interface StoredReport {
  /** The blob is versioned; readers branch on nothing else. */
  version: number;
  scanId: string;
  /** ADR-020's one canonical key. */
  domain: CanonicalDomain;
  tier: Tier;
  /** False where `stoppedReason` is a ceiling or a failure. */
  complete: boolean;
  stoppedReason: StoppedReason;
  /** REQ-001 c14's re-scan control reads this: an offer made once, which
   *  does not chain. */
  fromIncompleteRescan: boolean;

  verdict: Verdict;
  /** Which AI readers the home document's access rules block, in the
   *  pinned list's own order. Derived from `AI_READER_AGENTS` here for the
   *  same reason `_problems/unblock.ts` derives its own alias from it: the
   *  type follows the pin, so a seventh agent needs no edit in either
   *  place. `Verdict.blockedReaders` is the *count* of these and stays
   *  where it is — one measurement, two readings, no second count. */
  blockedAgents: readonly (typeof AI_READER_AGENTS)[number][];
  /** The market category the profile inferred, shown beside the score. */
  category: string | null;
  aiAnswers: AiAnswersSection | null;
  presence: PresenceSection | null;
  supply: SupplySection;
  freePage: FreePageSection | null;

  // ── The record (issue #25) — what the pass measured, not what the
  // screen renders. Read by the correction, by the paid pass's reuse of a
  // fresh free scan (§6.4) and by anyone asked to reproduce a report.

  /** §6.7 steps 1–2: the profile, the measured market and its size. The
   *  three fail together and never apart, which is why one `Measured`
   *  wraps the whole set (ADR-095). */
  market: Measured<MarketSet>;
  /** The twelve, or as many as the market yielded, with the selected
   *  search each was phrased from. Not `aiAnswers.rows[].question`, which
   *  is the same twelve as the *screen* stores them: gated behind
   *  `GeneratedText`, numbered, and carrying no volume (owner ruling
   *  2026-09-03). Two readers, two shapes, one measurement. */
  questions: Measured<Question[]>;
  /** The bought top-tens, one per question, in question order. Every card
   *  above was counted over exactly these. */
  serps: readonly Measured<SerpResult>[];
  rivals: Measured<RivalCandidate[]>;
  /** §6.6's platform partition — the "sources" half. Stored, not rendered
   *  in MVP. */
  sources: readonly string[];
  onPage: Measured<OnPageFacts>;
  robots: Measured<RobotsPolicy>;
  /** §6.7 step 5. A total union, unwrapped: it already carries its own
   *  failure arm, and a wrapper would give a consumer two `unknown`s to
   *  branch on (ADR-095 decision 3). */
  coherence: CoherenceVerdict;
  /** BP-028's value domain, stored on the scan row too. */
  correctionState: CorrectionState;
}

// ── Reading a stored blob (issue #25) ───────────────────────────────────

/** A strict ISO-8601 instant, exactly as `Date.prototype.toJSON` writes
 *  one. Narrow on purpose: a customer's own keyword or heading cannot
 *  match it by accident. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** Rebuilds a parsed `jsonb` value with every ISO instant back as a
 *  `Date` — `measuredAt` and every `Measured.at` under it. Total: it never
 *  throws and never drops a key. */
function reviveDates(value: unknown): unknown {
  if (typeof value === "string") {
    return ISO_INSTANT.test(value) ? new Date(value) : value;
  }
  if (Array.isArray(value)) return value.map(reviveDates);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, member] of Object.entries(value as Record<string, unknown>)) {
      out[key] = reviveDates(member);
    }
    return out;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The version guard. Throws — loudly — on a blob this build cannot read,
 *  because `null` reads as "this domain has no report" at every call site
 *  and would quietly take a customer's report off its own address. */
export function readStoredReport(blob: unknown): StoredReport {
  if (!isRecord(blob)) {
    throw new Error("readCurrentReport: the stored report is not an object");
  }
  if (blob.version !== REPORT_VERSION) {
    throw new Error(
      `readCurrentReport: stored report version ${String(blob.version)} is not readable by this build (expected ${REPORT_VERSION})`
    );
  }
  return reviveDates(blob) as StoredReport;
}

// `scans.is_current` is on disk (`20260904110000_scans_current.sql`) and
// not yet in the generated `Database` type, so this one query goes through
// a narrow, explicitly cast builder — the same worked-around gap
// `admission.ts` and `correction.ts` already carry. Nothing else in this
// file bypasses the generated type.

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: boolean): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

interface CurrentReportRow {
  report: unknown;
}

/**
 * The domain's one current report, or `null` where it has none.
 *
 * One indexed read off the partial unique index that makes two current
 * reports for one domain unrepresentable — never a "latest scan wins"
 * query, which would make a failed re-scan the report. Writes nothing,
 * opens no transaction, and takes no tier and no `forFree` parameter:
 * there is one report and everyone sees all of it.
 */
export async function readCurrentReport(domain: string): Promise<StoredReport | null> {
  const { data, error } = await untyped(dbAdmin())
    .from<CurrentReportRow>("scans")
    .select("report")
    .eq("domain", domain)
    .is("is_current", true)
    .limit(1);
  if (error) throw new Error(`readCurrentReport: ${error.message}`);

  const row = data?.[0];
  if (!row || row.report === null || row.report === undefined) return null;
  return readStoredReport(row.report);
}
