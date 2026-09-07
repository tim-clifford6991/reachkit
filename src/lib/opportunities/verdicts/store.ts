// BUILD §9, §10 — the one door between the weekly judgement and Postgres.
//
// Every read and write this leaf makes goes through `VerdictStore`, and
// the default implementation is the only place here that names a table or
// a column — the same shape `src/lib/opportunities/store.ts` already
// carries, and for the same two reasons: the row shapes are §10's and
// belong in one file, and the suites in `tests/opportunities/**` run in
// the `node` project, which has no database.
//
// `dbAdmin()`, not `db()`. The judgement runs inside §11's `weekly/refresh`
// job and not inside a customer's request, so there is no `auth.uid()` for
// a row policy to match; `page_verdicts`' own policy grants the owning
// site's user `select` and nobody `update` or `delete`. Every call below is
// site- or publication-scoped by an explicit predicate — the scoping the
// policy would have applied, applied here instead.
//
// **This module reaches no network.** There is no `fetch` here and no
// import from `src/lib/egress/**`, in this file or anywhere under
// `verdicts/`: REQ-063's non-goal is "any look at a published page's
// address", and the only look there has ever been is the one check at 24
// hours, whose *record* is read below (`publications.verify`) and never
// re-taken. `no-look.test.ts` asserts it at source level.
import { dbAdmin } from "@/lib/db";
import type { Measured } from "@/lib/measure/measured";
// The shapes the one check at 24 hours records, declared by the publishing
// module that owns them (#45's `src/lib/publish/types.ts`) and read here,
// never re-declared: `page_not_found` and `could_not_confirm` carry
// different payloads there precisely so they cannot be given one shape,
// and a projection of my own would have thrown that separation away. The
// direction `src/lib/opportunities -> src/lib/publish` closes no cycle —
// nothing under `src/lib/publish/` imports this module.
import type { VerifyOutcome } from "@/lib/publish/types";
import { readStoredCheck } from "@/lib/publish/verify/stored";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import type { Acceptance } from "../types";
import type { CheckId, Movement, NotJudgeableCause, Verdict, VerifyNote, WeekStart } from "./types";

/**
 * One published page, as the judgement needs it.
 *
 * **No destination kind.** ADR-084 made `servesPublicly` true at both
 * destinations, so the judged population is every publication that has
 * been published, and there is no `kind === 'hosted'` test anywhere in
 * this directory: a third adapter could not join the population by
 * defaulting into it, and could not be excluded from it by an omission
 * here either. `judge.test.ts` asserts a WordPress page is judged exactly
 * as a hosted one is.
 */
export interface PublishedPage {
  readonly publicationId: string;
  /** The recorded acceptance test — §7's, written once at the
   *  opportunity's creation and never rewritten. */
  readonly acceptance: Acceptance;
  readonly publishedAt: Date;
  /** Non-null once the customer unpublished it (REQ-056 c7). */
  readonly unpublishedAt: Date | null;
  /** The domain this page was published under, compared with the week's
   *  (REQ-071 c14). */
  readonly domain: string;
  /** What the one check at 24 hours recorded, or `null` where it has not
   *  run — which is neither a failure nor a confirmation and qualifies
   *  nothing. There is no "pending" arm to read: a check that has not run
   *  is a `VerifyDisposition`, which `src/lib/publish/verify/due.ts`
   *  decides and this node does not. */
  readonly verification: VerifyOutcome | null;
  /** The address the page is served at. It is what makes the page a
   *  member of the judged population — ADR-084 made `servesPublicly` true
   *  at both destinations, and it is the field that governs whether
   *  `publications.live_url` is set — so the population is read off this
   *  and there is no `kind === 'hosted'` test anywhere in this directory.
   *  It is also how a mail names the page: an address is measured fact,
   *  where a page's title is model-written text a mail may not speak in
   *  ReachKit's own voice (§8, REQ-093). */
  readonly liveUrl: string;
}

/** One row of `page_verdicts`, as this module reads it back. */
export interface VerdictRecord {
  readonly publicationId: string;
  readonly week: WeekStart;
  readonly verdict: Verdict | "not_judgeable";
  readonly cause: NotJudgeableCause | null;
  readonly measuredAt: Date | null;
  readonly measured: Measured<number> | null;
  readonly movement: Movement | null;
}

/** What one insert writes. `id` and `created_at` are the database's. */
export interface VerdictInsert {
  readonly publicationId: string;
  readonly siteId: string;
  readonly week: WeekStart;
  readonly verdict: Verdict | "not_judgeable";
  readonly cause: NotJudgeableCause | null;
  readonly measuredAt: Date | null;
  readonly scanId: string | null;
  readonly measured: Measured<number> | null;
  readonly movement: Movement | null;
}

export interface VerdictStore {
  /** Every published page of one site — the judged population. */
  publishedPages(siteId: string): Promise<readonly PublishedPage[]>;
  /** The weekly scan stamped with this week, and no other week's. `null`
   *  where the week carries no measurement at all, which is `no_week`. */
  weekReport(a: { siteId: string; week: WeekStart }): Promise<{ scanId: string; report: StoredReport } | null>;
  /** Every verdict row already written for one site's week. One indexed
   *  read; the digest and the surfaces read through it and recompute
   *  nothing. */
  verdictsForWeek(a: { siteId: string; week: WeekStart }): Promise<readonly VerdictRecord[]>;
  /** The history behind the terminality short-circuit, `lastJudgedWeek`
   *  and the previous recorded measurement: every row for these pages
   *  written strictly before `week`, newest first. One read for the whole
   *  site, never one per page. */
  historyBefore(a: {
    siteId: string;
    week: WeekStart;
  }): Promise<readonly VerdictRecord[]>;
  /** Inserts this week's rows. A row the unique key already holds is
   *  skipped rather than raised: idempotency is the index, not a guard. */
  insert(rows: readonly VerdictInsert[]): Promise<void>;
}

// ── Reading the two stored blobs ────────────────────────────────────────

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function reviveDates(value: unknown): unknown {
  if (typeof value === "string") return ISO_INSTANT.test(value) ? new Date(value) : value;
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

const CHECK_IDS: readonly CheckId[] = Object.freeze(["reachable", "indexable", "sitemap", "aiReadable"]);

/**
 * REQ-063 c1's note, composed by **destructuring the stored outcome** —
 * never by testing a boolean or a date, which could not tell "the page
 * failed a check" from "the check did not settle at all".
 *
 * `page_not_found` gives no note at all: it is a `NotJudgeableCause`, and
 * the page carries `not_judgeable` instead. `could_not_confirm` gives a
 * note and leaves the page **fully judged** — the two arms come from the
 * same fetch, render as the same grey line, and go opposite ways (ADR-085
 * decision 4). One home for the composition, so the judge and the digest
 * cannot come to differ about it.
 *
 * A check whose flag is `unmeasured` has not failed: it said nothing, and
 * naming it would state a failure that was never recorded.
 */
export function noteFor(verification: VerifyOutcome | null): VerifyNote | null {
  if (verification === null) return null;
  switch (verification.outcome) {
    case "found": {
      const failed = CHECK_IDS.filter((id) => {
        const flag = verification.checks[id];
        return flag.kind !== "unmeasured" && flag.value === false;
      });
      return failed.length === 0
        ? null
        : { note: "checks_failed", failed, checkedAt: verification.checkedAt };
    }
    case "could_not_confirm":
      return { note: "could_not_confirm", checkedAt: verification.checkedAt };
    case "page_not_found":
      return null;
  }
}

/**
 * `publications.verify`, read as the three outcomes REQ-062 records.
 *
 * **One reader, and it is the writer's own** (issue #50). The column is
 * written by `src/lib/publish/verify/` and `readStoredCheck` is that
 * module's projection of it, so the shape is stated once and a reader here
 * cannot come to disagree with the writer about it. Before #50 landed this
 * function guessed the on-disk shape — it read the four flags as bare
 * booleans at the top level, in two spellings — and the writer stores them
 * as `Measured<boolean>` under `checks`, which that guess would have read
 * as four checks that said nothing on every page ever published. The
 * failure would have been silent: every verdict still computed, every
 * screen still correct, and the four outcomes permanently unmeasured.
 *
 * Total and unguessing: a blob this function cannot read is `null` — the
 * check has said nothing — and never `page_not_found`, which is terminal.
 * A row that does not say a page was missing must never be read as saying
 * it was.
 *
 * The direction `src/lib/opportunities -> src/lib/publish` closes no
 * cycle: nothing under `src/lib/publish/` imports this module, and
 * `stored.ts` reaches no database.
 */
export function readVerification(blob: unknown): VerifyOutcome | null {
  return readStoredCheck(blob)?.result ?? null;
}

// ── The default, Postgres-backed store ──────────────────────────────────
//
// The generated `Database` type predates `page_verdicts` and
// `scans.week_start` (issue #41's migration). One narrow, explicitly cast
// boundary — the same worked-around gap `src/lib/scan/report.ts` and
// `src/lib/opportunities/store.ts` already carry.

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  insert(rows: object): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  lt(column: string, value: string): MinimalQueryBuilder<T>;
  not(column: string, operator: string, value: unknown): MinimalQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** Postgres' unique-violation class. The one rejection this module reads
 *  as an answer — "this week is already judged" — rather than a fault. */
const UNIQUE_VIOLATION = "23505";

interface PublicationRow {
  id: string;
  live_url: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  verify: unknown;
  drafts: { opportunities: { acceptance: unknown } | null } | null;
  sites: { domain: string } | null;
}

interface VerdictRow {
  publication_id: string;
  week_start: string;
  verdict: string;
  cause: string | null;
  measured_at: string | null;
  measured: unknown;
  movement: unknown;
}

function readRecord(row: VerdictRow): VerdictRecord {
  return {
    publicationId: row.publication_id,
    week: row.week_start,
    verdict: row.verdict as Verdict | "not_judgeable",
    cause: row.cause as NotJudgeableCause | null,
    measuredAt: row.measured_at === null ? null : new Date(row.measured_at),
    measured: row.measured === null || row.measured === undefined
      ? null
      : (reviveDates(row.measured) as Measured<number>),
    movement: row.movement === null || row.movement === undefined
      ? null
      : (reviveDates(row.movement) as Movement),
  };
}

const VERDICT_COLUMNS = "publication_id, week_start, verdict, cause, measured_at, measured, movement";

export function supabaseVerdictStore(): VerdictStore {
  return {
    async publishedPages(siteId) {
      const { data, error } = await untyped()
        .from<PublicationRow>("publications")
        .select(
          "id, live_url, published_at, unpublished_at, verify, " +
            "drafts(opportunities(acceptance)), sites(domain)"
        )
        .eq("site_id", siteId)
        .not("published_at", "is", null)
        .not("live_url", "is", null);
      if (error) throw new Error(`page_verdicts.publishedPages: ${error.message}`);
      const pages: PublishedPage[] = [];
      for (const row of data ?? []) {
        const acceptance = row.drafts?.opportunities?.acceptance;
        const domain = row.sites?.domain;
        // A publication with no opportunity behind it has no recorded
        // test, and a page with no site has no domain to compare: neither
        // is a page this node may judge, and neither is invented here.
        if (row.published_at === null || row.live_url === null) continue;
        if (acceptance == null || domain === undefined) continue;
        pages.push({
          publicationId: row.id,
          acceptance: reviveDates(acceptance) as Acceptance,
          publishedAt: new Date(row.published_at),
          unpublishedAt: row.unpublished_at === null ? null : new Date(row.unpublished_at),
          domain,
          liveUrl: row.live_url,
          verification: readVerification(row.verify),
        });
      }
      return pages;
    },

    async weekReport(a) {
      const { data, error } = await untyped()
        .from<{ id: string; report: unknown }>("scans")
        .select("id, report")
        .eq("site_id", a.siteId)
        .eq("tier", "weekly")
        .eq("week_start", a.week)
        .limit(1);
      if (error) throw new Error(`page_verdicts.weekReport: ${error.message}`);
      const row = data?.[0];
      if (row === undefined || row.report === null || row.report === undefined) return null;
      return { scanId: row.id, report: readStoredReport(row.report) };
    },

    async verdictsForWeek(a) {
      const { data, error } = await untyped()
        .from<VerdictRow>("page_verdicts")
        .select(VERDICT_COLUMNS)
        .eq("site_id", a.siteId)
        .eq("week_start", a.week);
      if (error) throw new Error(`page_verdicts.verdictsForWeek: ${error.message}`);
      return (data ?? []).map(readRecord);
    },

    async historyBefore(a) {
      const { data, error } = await untyped()
        .from<VerdictRow>("page_verdicts")
        .select(VERDICT_COLUMNS)
        .eq("site_id", a.siteId)
        .lt("week_start", a.week)
        .order("week_start", { ascending: false });
      if (error) throw new Error(`page_verdicts.historyBefore: ${error.message}`);
      return (data ?? []).map(readRecord);
    },

    async insert(rows) {
      if (rows.length === 0) return;
      for (const row of rows) {
        const { error } = await untyped()
          .from<VerdictRow>("page_verdicts")
          .insert({
            publication_id: row.publicationId,
            site_id: row.siteId,
            week_start: row.week,
            verdict: row.verdict,
            cause: row.cause,
            measured_at: row.measuredAt?.toISOString() ?? null,
            scan_id: row.scanId,
            measured: row.measured,
            movement: row.movement,
          });
        // The week is already judged for this page. The unique key is the
        // idempotency, so its rejection is the answer and not an error —
        // a second delivery of the weekly tick mints no second verdict.
        if (error !== null && error.code !== UNIQUE_VIOLATION) {
          throw new Error(`page_verdicts.insert: ${error.message}`);
        }
      }
    },
  };
}

let store: VerdictStore | null = null;

/** Lazily constructed, so importing this module constructs no database
 *  client. */
export function verdictStore(): VerdictStore {
  if (store === null) store = supabaseVerdictStore();
  return store;
}

/** The suites' one door in; `null` restores the real one. */
export function setVerdictStore(next: VerdictStore | null): void {
  store = next;
}
