// BUILD §4.2 — the one place this feature reaches Postgres.
//
// Every query the giveaway, the capture, the suppression store and the
// nurture job need, behind one declared interface. Two implementations:
// the Supabase-backed one this module exports as the default, and — in
// `tests/mail/leads/memory-store.ts` — an in-memory one the suites drive,
// because `tests/setup.ts` refuses a real network call and the `node`
// project has no database to reach.
//
// **The memory store mirrors the partial unique index deliberately.**
// `unique (lower(email), domain) where sequence_state is not null` is
// REQ-010 criterion 13's whole enforcement (ADR-041), so a fake that did
// not hold it would let the suites pass on behaviour Postgres would
// reject. `patchLead` reports a violation as `conflict: true` from both
// implementations, and `tests/mail/leads/migration.test.ts` asserts the
// real index's predicate against the migration on disk.
//
// **Schema-typing gap, flagged once** (the same class as
// `notifications/store.ts`'s): the columns this module reads land in
// `20260905120000_leads_sequence.sql` and are not in
// `src/lib/db/types.generated.ts`, which is stale and is BP-002's artifact
// to regenerate, not this module's file to widen. The table is reached
// through a narrow, explicitly cast query-builder subset rather than by
// losing typing anywhere else `dbAdmin()` reaches.
import { dbAdmin } from "@/lib/db";

/** REQ-010 criterion 12's four lifetimes plus the one a stop produces. Set
 *  once, when a sequence is created; every later value is terminal and none
 *  returns to null. */
export type SequenceState = "waiting" | "running" | "finished" | "dropped" | "stopped";

/** Criterion 8's two things a founder may be owed, the state in which each
 *  has been written but not yet sent, and the one terminal state in which
 *  neither arrived. */
export type FirstPageState = "pending" | "written" | "sent" | "notice_sent" | "abandoned";

export type SuppressionCause = "opt_out" | "subscribed";

export interface LeadRow {
  readonly id: string;
  readonly scan_id: string;
  readonly email: string;
  readonly domain: string;
  readonly converted_at: string | null;
  readonly sequence_state: SequenceState | null;
  readonly sequence_started_at: string | null;
  readonly next_touch_at: string | null;
  readonly touch_count: number;
  readonly dropped_at: string | null;
  readonly page_delivered_at: string | null;
  readonly first_page_state: FirstPageState;
  readonly first_page_first_attempt_at: string | null;
  readonly first_page_attempts: number;
  readonly first_page_failure: string | null;
  readonly first_page_title: string | null;
  readonly first_page_markdown: string | null;
}

/** Every column a caller in this feature ever writes. `email`, `domain` and
 *  `scan_id` are absent by construction: the first two are written once at
 *  capture and read-only thereafter (BP-029 decision 1), and the third is
 *  the row's own identity. */
export interface LeadPatch {
  readonly sequence_state?: SequenceState;
  readonly sequence_started_at?: string | null;
  readonly next_touch_at?: string | null;
  readonly touch_count?: number;
  readonly dropped_at?: string | null;
  readonly page_delivered_at?: string | null;
  readonly first_page_state?: FirstPageState;
  readonly first_page_first_attempt_at?: string | null;
  readonly first_page_attempts?: number;
  readonly first_page_failure?: string | null;
  readonly first_page_title?: string | null;
  readonly first_page_markdown?: string | null;
}

/** Nothing here throws. Every method answers with what it did, or says it
 *  could not — a store that cannot be read is a different fact from a store
 *  that holds nothing, and collapsing the two is what mails a person who
 *  opted out. */
export interface LeadStore {
  insertLead(a: {
    scanId: string;
    email: string;
    domain: string;
  }): Promise<{ ok: true; id: string } | { ok: false }>;

  readLead(id: string): Promise<{ ok: true; lead: LeadRow | null } | { ok: false }>;

  /** `conflict` is the partial unique index refusing a second sequence for
   *  an `(address, domain)` that already has one — REQ-010 criterion 13.
   *  It is a legal outcome, never an error to retry. */
  patchLead(
    id: string,
    patch: LeadPatch
  ): Promise<{ ok: true } | { ok: false; conflict: boolean }>;

  /** Every lead in any of the given sequence states. `null` selects the
   *  rows that have never had a sequence. */
  leadsInSequenceState(
    states: readonly (SequenceState | null)[]
  ): Promise<{ ok: true; leads: readonly LeadRow[] } | { ok: false }>;

  leadsInFirstPageState(
    states: readonly FirstPageState[]
  ): Promise<{ ok: true; leads: readonly LeadRow[] } | { ok: false }>;

  leadsForAddress(email: string): Promise<{ ok: true; leads: readonly LeadRow[] } | { ok: false }>;

  isSuppressed(email: string): Promise<{ ok: true; suppressed: boolean } | { ok: false }>;

  /** Idempotent on the primary key: a second opt-out click writes nothing
   *  and still succeeds. */
  addSuppression(
    email: string,
    cause: SuppressionCause
  ): Promise<{ ok: true } | { ok: false }>;

  /** The scan's own domain — written onto the lead at capture and
   *  read-only thereafter (BP-029 decision 1), because the sequence's
   *  natural key is `(lower(email), domain)` and a unique index cannot
   *  reach through `scan_id` to `scans.domain`. */
  scanDomain(scanId: string): Promise<{ ok: true; domain: string | null } | { ok: false }>;

  /** The scan's stored report blob, untyped — its shape is the scan's, and
   *  `ports.ts` reads it through `readStoredReport`. `null` where the scan
   *  has no report (yet). */
  scanReport(scanId: string): Promise<{ ok: true; report: unknown } | { ok: false }>;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  insert(rows: object): MinimalQueryBuilder<T>;
  update(patch: object): MinimalQueryBuilder<T>;
  upsert(rows: object, options: object): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  in(column: string, values: readonly unknown[]): MinimalQueryBuilder<T>;
  is(column: string, value: null): MinimalQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** The one cast boundary in this module. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const LEAD_COLUMNS =
  "id, scan_id, email, domain, converted_at, sequence_state, sequence_started_at, " +
  "next_touch_at, touch_count, dropped_at, page_delivered_at, first_page_state, " +
  "first_page_first_attempt_at, first_page_attempts, first_page_failure, " +
  "first_page_title, first_page_markdown";

/** Postgres' unique-violation class. A patch rejected by the criterion-13
 *  index carries it, and it is the one error this module reports as an
 *  outcome rather than a failure. */
const UNIQUE_VIOLATION = "23505";

export function supabaseLeadStore(): LeadStore {
  return {
    async insertLead(a) {
      const { data, error } = await untyped()
        .from<{ id: string }>("leads")
        .insert({
          scan_id: a.scanId,
          email: a.email,
          domain: a.domain,
          first_page_state: "pending",
        })
        .select("id");
      if (error) return { ok: false };
      const row = data?.[0];
      return row === undefined ? { ok: false } : { ok: true, id: row.id };
    },

    async readLead(id) {
      const { data, error } = await untyped()
        .from<LeadRow>("leads")
        .select(LEAD_COLUMNS)
        .eq("id", id)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, lead: data?.[0] ?? null };
    },

    async patchLead(id, patch) {
      const { error } = await untyped().from<LeadRow>("leads").update(patch).eq("id", id);
      if (!error) return { ok: true };
      return { ok: false, conflict: error.code === UNIQUE_VIOLATION };
    },

    async leadsInSequenceState(states) {
      const named = states.filter((state): state is SequenceState => state !== null);
      const wantsNull = states.some((state) => state === null);
      const query = untyped().from<LeadRow>("leads").select(LEAD_COLUMNS);
      const { data, error } = await (wantsNull && named.length === 0
        ? query.is("sequence_state", null)
        : query.in("sequence_state", named));
      if (error) return { ok: false };
      return { ok: true, leads: data ?? [] };
    },

    async leadsInFirstPageState(states) {
      const { data, error } = await untyped()
        .from<LeadRow>("leads")
        .select(LEAD_COLUMNS)
        .in("first_page_state", states);
      if (error) return { ok: false };
      return { ok: true, leads: data ?? [] };
    },

    async leadsForAddress(email) {
      const { data, error } = await untyped()
        .from<LeadRow>("leads")
        .select(LEAD_COLUMNS)
        .eq("email", email);
      if (error) return { ok: false };
      return { ok: true, leads: data ?? [] };
    },

    async isSuppressed(email) {
      const { data, error } = await untyped()
        .from<{ email: string }>("email_suppressions")
        .select("email")
        .eq("email", email)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, suppressed: (data?.length ?? 0) > 0 };
    },

    async addSuppression(email, cause) {
      // Idempotent on the primary key: a second click writes nothing and
      // still confirms, which is what makes an opt-out link a person finds
      // a year later safe to press twice.
      const { error } = await untyped()
        .from<{ email: string }>("email_suppressions")
        .upsert({ email, cause }, { onConflict: "email", ignoreDuplicates: true });
      return error ? { ok: false } : { ok: true };
    },

    async scanDomain(scanId) {
      const { data, error } = await untyped()
        .from<{ domain: string }>("scans")
        .select("domain")
        .eq("id", scanId)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, domain: data?.[0]?.domain ?? null };
    },

    async scanReport(scanId) {
      const { data, error } = await untyped()
        .from<{ report: unknown }>("scans")
        .select("report")
        .eq("id", scanId)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, report: data?.[0]?.report ?? null };
    },
  };
}

let store: LeadStore | null = null;

/** The store every entry point in this feature reads. Lazily constructed so
 *  importing this module does not construct a database client. */
export function leadStore(): LeadStore {
  if (store === null) store = supabaseLeadStore();
  return store;
}

/** Swaps the store. The suites' one door in; `null` restores the real one. */
export function setLeadStore(next: LeadStore | null): void {
  store = next;
}
