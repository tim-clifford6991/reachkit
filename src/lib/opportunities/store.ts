// BUILD §7 — the one door between the opportunity engine and Postgres.
//
// Every read and write in this directory goes through `OpportunityStore`,
// and the default implementation is the only place in the engine that
// names a table or a column. Two reasons, and neither is testing
// convenience: the row shape is §10's and belongs in one file, and the
// suites in `tests/opportunities/**` run in the `node` project, which has
// no database (adding a live-schema suite means an entry in
// `vitest.config.ts`'s `LIVE_SCHEMA_TESTS`, and that file is the owner's).
//
// **`dbAdmin()`, not `db()`.** The shipped RLS (`00000000000002_rls.sql`)
// gives `opportunities` a select policy for the owning site's user and no
// insert or update policy at all, with the comment "derived and written by
// the opportunity engine through `dbAdmin()`". The engine runs inside jobs
// (§11's `scan/run` and `weekly/refresh`), not inside a customer's
// request, so there is no `auth.uid()` for a row policy to match. Every
// call below is site-scoped by an explicit `site_id` predicate — the
// scoping the policy would have applied, applied here instead.
import { dbAdmin } from "@/lib/db";
import type { Profile } from "@/lib/market/questions/profile";
import { readStoredReport } from "@/lib/scan/report";
import type {
  Acceptance,
  Evidence,
  Family,
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  Winnability,
} from "./types";

/** The row as `opportunities` stores it. `jsonb` members arrive parsed and
 *  with their dates still ISO strings — `readOpportunity` revives them. */
export interface OpportunityRow {
  id: string;
  site_id: string;
  scan_id: string;
  type: string;
  family: string;
  target_query: string | null;
  target_ref: string;
  proposed_slug: string | null;
  title: string | null;
  /** §10's denormalised integer, for the surfaces and the sorts that read
   *  one. The *measurement* — the value with its arm and its date — lives
   *  in `evidence`, which is where `readOpportunity` takes it from: one
   *  measurement, one home, and a column that cannot drift from it because
   *  nothing derives the measurement back out of it. */
  volume: number | null;
  evidence: unknown;
  acceptance: unknown;
  fit_band: string | null;
  effort: string | number;
  status: string;
  created_at: string;
}

/** What `persist` writes. Not `Opportunity`: `id`, `status` and
 *  `createdAt` are the database's to assign, and `status_changed_at` is
 *  its default. */
export interface OpportunityInsert {
  site_id: string;
  scan_id: string;
  type: OpportunityType;
  family: Family;
  target_query: string | null;
  target_ref: string;
  proposed_slug: string | null;
  title: string | null;
  volume: number | null;
  evidence: Evidence;
  acceptance: Acceptance;
  fit_band: Winnability | null;
  effort: number;
}

export type InsertOutcome =
  | { outcome: "created"; row: OpportunityRow }
  /** The partial unique index refused it: an equivalent open or queued
   *  opportunity already exists. A normal return, never an error — a
   *  weekly top-up re-deriving the same target must add nothing. */
  | { outcome: "duplicate" };

export interface OpportunityStore {
  insert(row: OpportunityInsert): Promise<InsertOutcome>;
  /** Open, non-`fix` rows for one site — the unused-supply set, and the
   *  set the ranking orders. `unblock` is excluded here, once, so no
   *  caller downstream has to restate the predicate. */
  openRankable(siteId: string): Promise<readonly OpportunityRow[]>;
  /** The count behind supply depth: `status = 'open' and family <> 'fix'`. */
  countUnused(siteId: string): Promise<number>;
  /** The moment the site's last non-`fix` opportunity left `open`, which is
   *  the moment supply hit zero. `null` where the site has never held one. */
  lastStatusChangeAt(siteId: string): Promise<Date | null>;
  /** Fallback for `exhaustedSince` on a site that has never held an
   *  opportunity: the completion time of its most recent completed scan. */
  latestCompletedScanAt(siteId: string): Promise<Date | null>;
  byId(opportunityId: string): Promise<OpportunityRow | null>;
  /** The profile the ranking's intent term is classified against — §6.7's
   *  own, read out of the site's current stored report rather than derived
   *  a second time. `null` where the site has no readable report, which
   *  makes the ranking empty rather than guessed. */
  profileForSite(siteId: string): Promise<Profile | null>;
}

// ── Reviving a row ──────────────────────────────────────────────────────

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

/**
 * The row as the engine reads it. The database's check constraints are
 * what make the casts below sound: `type`, `family`, `fit_band` and
 * `status` are constrained to their closed sets in the schema, so a value
 * outside one cannot be on disk to be read. Dates inside `evidence` and
 * `volume` are revived, so an explanation reads back with the dates it was
 * measured on and not with strings.
 */
export function readOpportunity(row: OpportunityRow): Opportunity {
  const evidence = reviveDates(row.evidence) as Evidence;
  return {
    id: row.id,
    siteId: row.site_id,
    scanId: row.scan_id,
    type: row.type as OpportunityType,
    family: row.family as Family,
    targetQuery: row.target_query,
    targetRef: row.target_ref,
    title: row.title,
    volume: evidence.family === "fix" ? null : evidence.volume,
    evidence,
    acceptance: reviveDates(row.acceptance) as Acceptance,
    fitBand: row.fit_band as Winnability | null,
    effort: typeof row.effort === "number" ? row.effort : Number(row.effort),
    status: row.status as OpportunityStatus,
    createdAt: new Date(row.created_at),
  };
}

// ── The default, Postgres-backed store ──────────────────────────────────
//
// The generated `Database` type predates this node's columns (`target_ref`,
// `status_changed_at`) and types `opportunities.target_query` as
// non-nullable, which the core migration relaxes for the Fix family. One
// narrow, explicitly cast boundary — the same worked-around gap
// `src/lib/scan/report.ts` and `store.ts` already carry; regenerating
// `types.generated.ts` is not this change's to do.

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  insert(rows: object): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  neq(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: boolean | null): MinimalQueryBuilder<T>;
  in(column: string, values: readonly unknown[]): MinimalQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** Postgres' unique-violation class. The partial unique index raises it,
 *  and it is the one error this module reports as an outcome. */
const UNIQUE_VIOLATION = "23505";

const COLUMNS =
  "id, site_id, scan_id, type, family, target_query, target_ref, proposed_slug, " +
  "title, volume, evidence, acceptance, fit_band, effort, status, created_at";

export function supabaseOpportunityStore(): OpportunityStore {
  return {
    async insert(row) {
      const { data, error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .insert(row)
        .select(COLUMNS);
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return { outcome: "duplicate" };
        throw new Error(`opportunities.insert: ${error.message}`);
      }
      const created = data?.[0];
      if (!created) throw new Error("opportunities.insert: the insert returned no row");
      return { outcome: "created", row: created };
    },

    async openRankable(siteId) {
      const { data, error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .select(COLUMNS)
        .eq("site_id", siteId)
        .eq("status", "open")
        .neq("family", "fix")
        .order("created_at", { ascending: true });
      if (error) throw new Error(`opportunities.openRankable: ${error.message}`);
      return data ?? [];
    },

    async countUnused(siteId) {
      const { data, error } = await untyped()
        .from<{ id: string }>("opportunities")
        .select("id")
        .eq("site_id", siteId)
        .eq("status", "open")
        .neq("family", "fix");
      if (error) throw new Error(`opportunities.countUnused: ${error.message}`);
      return data?.length ?? 0;
    },

    async lastStatusChangeAt(siteId) {
      const { data, error } = await untyped()
        .from<{ status_changed_at: string }>("opportunities")
        .select("status_changed_at")
        .eq("site_id", siteId)
        .neq("family", "fix")
        .order("status_changed_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(`opportunities.lastStatusChangeAt: ${error.message}`);
      const at = data?.[0]?.status_changed_at;
      return at === undefined ? null : new Date(at);
    },

    async latestCompletedScanAt(siteId) {
      const { data, error } = await untyped()
        .from<{ created_at: string }>("scans")
        .select("created_at")
        .eq("site_id", siteId)
        .in("status", ["done", "degraded"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(`opportunities.latestCompletedScanAt: ${error.message}`);
      const at = data?.[0]?.created_at;
      return at === undefined ? null : new Date(at);
    },

    async byId(opportunityId) {
      const { data, error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .select(COLUMNS)
        .eq("id", opportunityId)
        .limit(1);
      if (error) throw new Error(`opportunities.byId: ${error.message}`);
      return data?.[0] ?? null;
    },

    async profileForSite(siteId) {
      const { data, error } = await untyped()
        .from<{ report: unknown }>("scans")
        .select("report")
        .eq("site_id", siteId)
        .is("is_current", true)
        .limit(1);
      if (error) throw new Error(`opportunities.profileForSite: ${error.message}`);
      const blob = data?.[0]?.report;
      if (blob === undefined || blob === null) return null;
      const report = readStoredReport(blob);
      return report.market.kind === "unmeasured" ? null : report.market.value.profile;
    },
  };
}

let store: OpportunityStore | null = null;

/** Lazily constructed, so importing this module does not construct a
 *  database client. */
export function opportunityStore(): OpportunityStore {
  if (store === null) store = supabaseOpportunityStore();
  return store;
}

/** The suites' one door in; `null` restores the real one. */
export function setOpportunityStore(next: OpportunityStore | null): void {
  store = next;
}
