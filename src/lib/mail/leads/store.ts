// BUILD §4.2 — the one place this feature reaches Postgres. Suites drive `tests/mail/leads/memory-store.ts`, which mirrors the partial
// unique index on `(lower(email), domain)`, criterion 13's whole enforcement (ADR-041); `patchLead` reports it as `conflict: true`.
// The leads columns are missing from the stale `src/lib/db/types.generated.ts`, so the table is reached through one narrow cast.
import { dbAdmin } from "@/lib/db";

/** Criterion 12's four lifetimes plus a stop. Set when a sequence is created; every later value is terminal. */
export type SequenceState = "waiting" | "running" | "finished" | "dropped" | "stopped";

/** Criterion 8's two owed things, each written-but-unsent state, and the terminal state where neither arrived. */
export type FirstPageState = "pending" | "written" | "sent" | "notice_sent" | "abandoned";

export type SuppressionCause = "opt_out" | "subscribed";

/** The report's one free page, on the scan. `writing` is a claim, `written` carries the page, `refused` is recorded once; unclaimed is `null`. */
export type ScanFirstPage =
  | { readonly state: "writing"; readonly claimedAt: Date }
  | { readonly state: "written"; readonly title: string; readonly markdown: string }
  | { readonly state: "refused" };

/** How a claimed write ends: the page, the refusal, or the claim released. */
export type ScanFirstPageSettlement =
  | { readonly state: "written"; readonly title: string; readonly markdown: string }
  | { readonly state: "refused" }
  | { readonly state: "released" };

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

/** Every column a caller writes. `email` and `domain` are written once at capture; `scan_id` is the row's identity. */
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

/** Nothing throws: an unreadable store is a different fact from an empty one, and collapsing them mails someone who opted out. */
export interface LeadStore {
  insertLead(a: {
    scanId: string;
    email: string;
    domain: string;
  }): Promise<{ ok: true; id: string } | { ok: false }>;

  readLead(id: string): Promise<{ ok: true; lead: LeadRow | null } | { ok: false }>;

  /** `conflict` is criterion 13's index refusing a second sequence: a legal outcome, never retried. */
  patchLead(
    id: string,
    patch: LeadPatch
  ): Promise<{ ok: true } | { ok: false; conflict: boolean }>;

  /** Leads in any given sequence state; `null` selects rows never sequenced. */
  leadsInSequenceState(
    states: readonly (SequenceState | null)[]
  ): Promise<{ ok: true; leads: readonly LeadRow[] } | { ok: false }>;

  leadsInFirstPageState(
    states: readonly FirstPageState[]
  ): Promise<{ ok: true; leads: readonly LeadRow[] } | { ok: false }>;

  leadsForAddress(email: string): Promise<{ ok: true; leads: readonly LeadRow[] } | { ok: false }>;

  isSuppressed(email: string): Promise<{ ok: true; suppressed: boolean } | { ok: false }>;

  /** Idempotent on the primary key: a second opt-out writes nothing and succeeds. */
  addSuppression(
    email: string,
    cause: SuppressionCause
  ): Promise<{ ok: true } | { ok: false }>;

  /** Written onto the lead at capture, since a unique index cannot reach through `scan_id` to `scans.domain`. */
  scanDomain(scanId: string): Promise<{ ok: true; domain: string | null } | { ok: false }>;

  /** The scan's report blob, untyped; `ports.ts` reads it. `null` with no report yet. */
  scanReport(scanId: string): Promise<{ ok: true; report: unknown } | { ok: false }>;

  /** The report's stored free page, or `null` where no writer holds it. */
  scanFirstPage(scanId: string): Promise<{ ok: true; page: ScanFirstPage | null } | { ok: false }>;

  /** Claims the scan for one write when unheld or held since before `staleBefore`; a conditional update, so two ticks cannot both win. */
  claimScanFirstPage(
    scanId: string,
    now: Date,
    staleBefore: Date
  ): Promise<{ ok: true; claimed: boolean } | { ok: false }>;

  settleScanFirstPage(
    scanId: string,
    settlement: ScanFirstPageSettlement
  ): Promise<{ ok: true } | { ok: false }>;
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
  lt(column: string, value: string): MinimalQueryBuilder<T>;
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

/** Postgres' unique-violation class: criterion 13's index, reported as an outcome, not a failure. */
const UNIQUE_VIOLATION = "23505";

interface ScanFirstPageRow {
  readonly free_page_state: "writing" | "written" | "refused" | null;
  readonly free_page_claimed_at: string | null;
  readonly free_page_title: string | null;
  readonly free_page_markdown: string | null;
}

/** The four columns as one union; a `written` row without its page reads as unclaimed, never mailed empty. */
function firstPageOf(row: ScanFirstPageRow): ScanFirstPage | null {
  switch (row.free_page_state) {
    case "writing":
      return { state: "writing", claimedAt: new Date(row.free_page_claimed_at ?? 0) };
    case "written":
      return row.free_page_title === null || row.free_page_markdown === null
        ? null
        : { state: "written", title: row.free_page_title, markdown: row.free_page_markdown };
    case "refused":
      return { state: "refused" };
    default:
      return null;
  }
}

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
      // Idempotent on the primary key, so an old opt-out link is safe to press twice.
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

    async scanFirstPage(scanId) {
      const { data, error } = await untyped()
        .from<ScanFirstPageRow>("scans")
        .select("free_page_state, free_page_claimed_at, free_page_title, free_page_markdown")
        .eq("id", scanId)
        .limit(1);
      if (error) return { ok: false };
      const row = data?.[0];
      return { ok: true, page: row === undefined ? null : firstPageOf(row) };
    },

    async claimScanFirstPage(scanId, now, staleBefore) {
      const claim = { free_page_state: "writing", free_page_claimed_at: now.toISOString() };
      const fresh = await untyped()
        .from<{ id: string }>("scans")
        .update(claim)
        .eq("id", scanId)
        .is("free_page_state", null)
        .select("id");
      if (fresh.error) return { ok: false };
      if ((fresh.data?.length ?? 0) > 0) return { ok: true, claimed: true };
      const stale = await untyped()
        .from<{ id: string }>("scans")
        .update(claim)
        .eq("id", scanId)
        .eq("free_page_state", "writing")
        .lt("free_page_claimed_at", staleBefore.toISOString())
        .select("id");
      if (stale.error) return { ok: false };
      return { ok: true, claimed: (stale.data?.length ?? 0) > 0 };
    },

    async settleScanFirstPage(scanId, settlement) {
      const patch =
        settlement.state === "written"
          ? { free_page_state: "written", free_page_title: settlement.title, free_page_markdown: settlement.markdown }
          : settlement.state === "refused"
            ? { free_page_state: "refused" }
            : { free_page_state: null, free_page_claimed_at: null };
      const { error } = await untyped().from<{ id: string }>("scans").update(patch).eq("id", scanId);
      return error ? { ok: false } : { ok: true };
    },
  };
}

let store: LeadStore | null = null;

/** Built lazily, so importing this module constructs no database client. */
export function leadStore(): LeadStore {
  if (store === null) store = supabaseLeadStore();
  return store;
}

/** Swaps the store. The suites' one door in; `null` restores the real one. */
export function setLeadStore(next: LeadStore | null): void {
  store = next;
}
