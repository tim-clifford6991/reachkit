// BUILD §8 — the one door between the generation engine and Postgres.
//
// Every read and write in `src/lib/generate/` goes through `GenerateStore`,
// and the default implementation is the only place in the engine that names
// a table or a column. Two reasons, and neither is testing convenience: the
// row shape is BUILD §10's and belongs in one file, and the suites in
// `tests/generate/**` run in the `node` project, which has no database.
//
// **`dbAdmin()`, not `db()`.** The shipped RLS gives `drafts` a select and
// an update policy for the owning site's user and no insert policy at all,
// with creation and removal recorded as system operations. Generation runs
// inside a job (§11's `draft/generate`), not inside a customer's request,
// so there is no `auth.uid()` for a row policy to match. Every call below
// is site-scoped by an explicit `site_id` predicate — the scoping the
// policy would have applied, applied here instead.
//
// **The voice text is read and never written.** `sites.voice_text` is the
// customer's field; nothing here copies it onto a draft, caches it, or
// carries an earlier version of it. See `voice/inputs.ts`.
import { dbAdmin } from "@/lib/db";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";

/** The `drafts` row, as §10 and this issue's two migrations leave it. */
export interface DraftRow {
  id: string;
  site_id: string;
  opportunity_id: string;
  state: string;
  title: string | null;
  body_md: string | null;
  meta: unknown;
  grounded_fact: unknown;
  attribution: string | null;
  hard_rule_attempts: number;
  rule_failures: unknown;
  claim_check: unknown;
  cost_cents: number;
  scheduled_for: string | null;
  veto_deadline: string | null;
  created_at: string;
}

/** What the engine writes when it starts a page. `id`, `hard_rule_attempts`
 *  and `created_at` are the database's to assign. */
export interface DraftInsert {
  site_id: string;
  opportunity_id: string;
  state: string;
  title: string | null;
  body_md: string | null;
  grounded_fact: unknown;
  attribution: string | null;
  scheduled_for: string | null;
  cost_cents: number;
}

/** The columns one run may change. Every one is written by the engine and
 *  none by a customer; `grounded_fact`'s passage is frozen by a trigger the
 *  moment the row exists, so a patch that tried to rewrite it would raise
 *  rather than succeed quietly. */
export interface DraftPatch {
  state?: string;
  title?: string | null;
  body_md?: string | null;
  rule_failures?: unknown;
  hard_rule_attempts?: number;
  claim_check?: unknown;
  cost_cents?: number;
  /** The publishing engine's own column (`_drafts_publishing`), and the
   *  guard on its `generating → in_review` edge. It is written **here**
   *  because §8 owns the battery: "a failing draft is never queued" is a
   *  fact about what the rules decided, and the engine that decided them
   *  is the only one that may assert it. */
  hard_rules_passed?: boolean;
}

/** The site fields generation reads. `voiceText` is carried to the prompt
 *  and nowhere else; `doNotClaim` is hashed and matched against. */
export interface SiteFacts {
  id: string;
  domain: string;
  category: string | null;
  voiceText: string | null;
  doNotClaim: string[];
  rivals: string[];
}

/** A page of the customer's own, as the near-duplicate gate compares it. */
export interface StoredPage {
  ref: string;
  title: string;
  markdown: string;
}

export interface GenerateStore {
  siteFacts(siteId: string): Promise<SiteFacts | null>;
  /** The freshest stored report for the site — the scan a day's page is
   *  generated from (§8: "from the freshest scan"). `null` where the site
   *  has none, which stops generation rather than guessing one. */
  latestReport(siteId: string): Promise<StoredReport | null>;
  insertDraft(row: DraftInsert): Promise<string>;
  patchDraft(draftId: string, patch: DraftPatch): Promise<void>;
  draftById(draftId: string): Promise<DraftRow | null>;
  /** This site's published pages, and this site's queued-not-yet-published
   *  drafts, for the near-duplicate gate. Site-scoped by predicate: no code
   *  path here takes a site id other than the one it was called with. */
  publishedPages(siteId: string): Promise<StoredPage[]>;
  queuedPages(siteId: string, exceptDraftId: string | null): Promise<StoredPage[]>;
  /** Drafts short of hand-off, for the claim sweep — never one already
   *  handed to a destination or already live. */
  draftsShortOfHandOff(siteId: string, limit: number): Promise<DraftRow[]>;
  /** How many of them there are, so a truncated sweep can report the rest
   *  as deferred rather than as finished. */
  countShortOfHandOff(siteId: string): Promise<number>;
}

// ── The states this module has to name ──────────────────────────────────
//
// §9's transition table belongs to the publishing engine; these are the two
// readings of it the store needs to build a query, and they are named here
// once rather than repeated in four predicates.

/** The states a page has left the product's hands in. A draft in one of
 *  these is never re-checked and never compared against: §8's gates reach
 *  every page short of delivery and no further. */
const HANDED_OVER = ["publishing", "published", "unpublished"] as const;

/** The states a draft occupies while it is still ours: written, waiting to
 *  be read, read and approved, or stopped. `skipped` is not among them — a
 *  vetoed page will not go anywhere and holds nothing back. */
const SHORT_OF_HAND_OFF = ["generating", "in_review", "approved", "failed", "needs_attention"] as const;

// ── The default, Postgres-backed store ──────────────────────────────────
//
// The generated `Database` type predates this issue's columns
// (`attribution`, `hard_rule_attempts`, `rule_failures`, `claim_check`), so
// the reads and writes below go through one narrow, explicitly cast
// boundary — the same worked-around gap `src/lib/scan/report.ts` and
// `src/lib/measure/text.ts` already carry. Regenerating
// `types.generated.ts` is not this change's to do.

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string, options?: { count: "exact"; head: true }): MinimalQueryBuilder<T>;
  insert(rows: object): MinimalQueryBuilder<T>;
  update(values: object): MinimalQueryBuilder<T>;
  eq(column: string, value: string | number): MinimalQueryBuilder<T>;
  neq(column: string, value: string): MinimalQueryBuilder<T>;
  not(column: string, operator: string, value: unknown): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const DRAFT_COLUMNS =
  "id, site_id, opportunity_id, state, title, body_md, meta, grounded_fact, " +
  "attribution, hard_rule_attempts, rule_failures, claim_check, cost_cents, " +
  "scheduled_for, veto_deadline, created_at";

function pageOf(row: DraftRow): StoredPage {
  return { ref: row.id, title: row.title ?? "", markdown: row.body_md ?? "" };
}

export function supabaseGenerateStore(): GenerateStore {
  return {
    async siteFacts(siteId) {
      const result = await untyped()
        .from<{
          id: string;
          domain: string | null;
          category: string | null;
          voice_text: string | null;
          do_not_claim: unknown;
          competitors: unknown;
        }>("sites")
        .select("id, domain, category, voice_text, do_not_claim, competitors")
        .eq("id", siteId)
        .limit(1);
      if (result.error) throw new Error(`generate/store: read from sites failed: ${result.error.message}`);
      const row = (result.data ?? [])[0];
      if (row === undefined) return null;
      return {
        id: row.id,
        domain: row.domain ?? "",
        category: row.category,
        voiceText: row.voice_text,
        doNotClaim: stringsOf(row.do_not_claim),
        rivals: stringsOf(row.competitors),
      };
    },

    async latestReport(siteId) {
      const result = await untyped()
        .from<{ report: unknown }>("scans")
        .select("report, created_at")
        .eq("site_id", siteId)
        .not("report", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (result.error) throw new Error(`generate/store: read from scans failed: ${result.error.message}`);
      const row = (result.data ?? [])[0];
      if (row === undefined) return null;
      return readStoredReport(row.report);
    },

    async insertDraft(row) {
      const result = await untyped()
        .from<{ id: string }>("drafts")
        .insert(row)
        .select("id");
      if (result.error) throw new Error(`generate/store: insert into drafts failed: ${result.error.message}`);
      const created = (result.data ?? [])[0];
      if (created === undefined) throw new Error("generate/store: insert into drafts returned no row");
      return created.id;
    },

    async patchDraft(draftId, patch) {
      const result = await untyped().from("drafts").update(patch).eq("id", draftId);
      if (result.error) throw new Error(`generate/store: update of drafts failed: ${result.error.message}`);
    },

    async draftById(draftId) {
      const result = await untyped()
        .from<DraftRow>("drafts")
        .select(DRAFT_COLUMNS)
        .eq("id", draftId)
        .limit(1);
      if (result.error) throw new Error(`generate/store: read from drafts failed: ${result.error.message}`);
      return (result.data ?? [])[0] ?? null;
    },

    async publishedPages(siteId) {
      const result = await untyped()
        .from<DraftRow>("drafts")
        .select(DRAFT_COLUMNS)
        .eq("site_id", siteId)
        .in("state", ["published", "unpublished"]);
      if (result.error) throw new Error(`generate/store: read from drafts failed: ${result.error.message}`);
      return (result.data ?? []).map(pageOf);
    },

    async queuedPages(siteId, exceptDraftId) {
      let query = untyped()
        .from<DraftRow>("drafts")
        .select(DRAFT_COLUMNS)
        .eq("site_id", siteId)
        .in("state", [...SHORT_OF_HAND_OFF]);
      if (exceptDraftId !== null) query = query.neq("id", exceptDraftId);
      const result = await query;
      if (result.error) throw new Error(`generate/store: read from drafts failed: ${result.error.message}`);
      return (result.data ?? []).map(pageOf);
    },

    async draftsShortOfHandOff(siteId, limit) {
      const result = await untyped()
        .from<DraftRow>("drafts")
        .select(DRAFT_COLUMNS)
        .eq("site_id", siteId)
        .in("state", [...SHORT_OF_HAND_OFF])
        .order("created_at", { ascending: true })
        .limit(limit);
      if (result.error) throw new Error(`generate/store: read from drafts failed: ${result.error.message}`);
      return result.data ?? [];
    },

    async countShortOfHandOff(siteId) {
      const result = await untyped()
        .from<DraftRow>("drafts")
        .select("id")
        .eq("site_id", siteId)
        .in("state", [...SHORT_OF_HAND_OFF]);
      if (result.error) throw new Error(`generate/store: read from drafts failed: ${result.error.message}`);
      return (result.data ?? []).length;
    },
  };
}

/** A `jsonb` array of strings, read defensively: a member that is not a
 *  string is skipped rather than coerced, and a payload that is not an
 *  array is an empty list. */
function stringsOf(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter((member): member is string => typeof member === "string");
}

// ── The port ────────────────────────────────────────────────────────────

let override: GenerateStore | null = null;

/** Test seam. Production callers never call this; `generateStore()` returns
 *  the Postgres-backed implementation above unless a test has replaced it. */
export function setGenerateStore(store: GenerateStore | null): void {
  override = store;
}

export function generateStore(): GenerateStore {
  return override ?? supabaseGenerateStore();
}

export { HANDED_OVER, SHORT_OF_HAND_OFF };
