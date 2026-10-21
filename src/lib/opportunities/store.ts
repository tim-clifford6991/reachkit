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
import type { RefreshInputs } from "./refresh";
import type { KnowledgeDigest } from "@/lib/site-profile/knowledge/read";
import { dbAdmin } from "@/lib/db";
import type { KnownPage } from "@/lib/known-content/types";
import type { Profile } from "@/lib/market/questions/profile";
import type { HostedOwnPages } from "@/lib/publish/destinations/hosted/own-page";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import type { InventoryRow } from "@/lib/site-profile/types";
import type { MarketConclusion } from "@/lib/market/infer/types";
import type {
  Acceptance,
  BusinessFit,
  Evidence,
  Family,
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  PlanReason,
  TopicSource,
  UnreadyReason,
  Winnability,
} from "./types";
import { OUTSIZED, type PageType } from "./types";
import { isPausedType } from "./paused";
import { topTenRowsOf, topTensOf } from "./cluster";
import type { TopTenRead } from "./derive/top-ten-kind";
import type { AskedBeside } from "./derive/topics";
import { earnGroundingOf, NO_EARN_GROUNDING, type EarnGrounding } from "./earn-grounding";
import type { NotWorkingVerdict } from "./suppression";

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
  business_fit?: number | null;
  source?: string | null;
  page_type?: string | null;
  effort: string | number;
  status: string;
  cluster_key: string | null;
  absorbed_queries: string[];
  ready: boolean;
  unready_reason: string | null;
  rest_until?: string | null;
  /** The week the last weekly pass committed (issue 1559): the row's place
   *  in it, 0 first, the site-local date it is planned for (none for a
   *  spare), and `qa` where it is written as a Q&A (issue 1455). */
  plan_place?: number | null;
  planned_for?: string | null;
  plan_write_as?: string | null;
  /** Why the commit placed it: its points, their parts and the rule. */
  plan_reason?: PlanReason | null;
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
  business_fit?: BusinessFit | null;
  source?: TopicSource | null;
  page_type?: PageType | null;
  effort: number;
  /** Optional because the database defaults both: a row nothing has
   *  clustered carries no cluster and no absorbed sibling. */
  cluster_key?: string | null;
  absorbed_queries?: readonly string[];
}

export type InsertOutcome =
  | { outcome: "created"; row: OpportunityRow }
  /** The partial unique index refused it: an equivalent open or queued
   *  opportunity already exists. A normal return, never an error — a
   *  weekly top-up re-deriving the same target must add nothing. */
  | { outcome: "duplicate" };

/** One row of a committed week (issue 1559). */
export interface PlanEntry {
  opportunityId: string;
  place: number;
  /** The site-local date, `YYYY-MM-DD`; `null` for a spare. */
  plannedFor: string | null;
  writeAs: "qa" | null;
  reason: PlanReason;
}

/** One of the site's own pages, as `draftedPages` returns it. */
export interface DraftedPage {
  /** The site-local date the page holds, `YYYY-MM-DD`. */
  date: string;
  state: string;
  title: string | null;
  row: OpportunityRow;
  /** The type the page was written as (`drafts.meta.contentType`), where
   *  the draft records one (issue 1455). */
  writtenAs?: string | null;
}

export interface OpportunityStore {
  insert(row: OpportunityInsert): Promise<InsertOutcome>;
  /** Open, non-`fix` rows for one site — the unused-supply set, and the
   *  set the ranking orders. `unblock` is excluded here, once, so no
   *  caller downstream has to restate the predicate. */
  openRankable(siteId: string): Promise<readonly OpportunityRow[]>;
  /** The count behind supply depth: open, not the Fix family, and ready
   *  (SPEC §6 — an unready row is not a day of supply). */
  /** Ready, open, non-Fix rows a day may actually be filled from — the
   *  outsized ones excluded (issue 881). */
  countUnused(siteId: string): Promise<number>;
  /** Open, non-Fix rows this site holds that are outsized for it (issue
   *  881). What tells a zero count of supply apart from a market that is
   *  simply too big for the site today. */
  countOutsized(siteId: string): Promise<number>;
  /** Open, queued and done non-Fix rows — the set a cluster collapse runs
   *  over alongside a pass's new candidates. A published topic is in it
   *  (#1181), so a pass never plans a second page on it. */
  clusterable(siteId: string): Promise<readonly OpportunityRow[]>;
  /** The ids of this site's rows a draft was ever written from, published
   *  or not (SPEC §6, D59, issue 1287): the rows a pass's relevance prune
   *  never touches. Optional: a store that cannot answer prunes nothing. */
  draftedOpportunityIds?(siteId: string): Promise<ReadonlySet<string>>;
  /** The non-Fix row whose page was drafted or published last — the day
   *  before the first one the ranking plans (#1181). */
  latestPage(siteId: string): Promise<OpportunityRow | null>;
  /** The site's own pages that have a draft row, newest date first, at most
   *  `limit`: each with the date it holds, its state, its written title and
   *  the row it was written for (issue 1209). What the weekly mix counts and
   *  what a brief is told the site already covers. */
  draftedPages(siteId: string, limit: number): Promise<readonly DraftedPage[]>;
  /** The site's own pages an answer to a tracked prompt cited in the four
   *  weeks ending at `at` (SPEC §6, D15, issue 1146), read from the stored
   *  passes. Nothing is bought. */
  citedPages(siteId: string, at: Date): Promise<readonly string[]>;
  /** The top tens the given scans bought, by `queryKey`, a later scan's
   *  over an earlier one's (#1131) — what a held row's search is compared
   *  by. Only the questions and SERPs are read, never the whole report. */
  topTens(scanIds: readonly string[]): Promise<ReadonlyMap<string, readonly string[]>>;
  /** The same top tens with each result's domain, address and title, and
   *  when the scan bought them (issue 1506). Optional: a store that cannot
   *  answer reads no top ten, and no row is held for its make-up. */
  topTenRows?(scanIds: readonly string[]): Promise<ReadonlyMap<string, TopTenRead>>;
  /** D62's store (issue 1506): the "People also ask" and related searches
   *  of the SERPs this site's research read, each with its search, bought in
   *  the last `days`. Optional: a store that cannot answer reads none. */
  askedBeside?(siteId: string, days: number): Promise<readonly AskedBeside[]>;
  /** Issue 1549: the searches of this site's dismissed non-Fix rows, each
   *  with the volume it was dismissed at (`null` where none was measured).
   *  Optional: a store that cannot answer holds nothing back. */
  dismissedSearches?(siteId: string): Promise<readonly { query: string; volume: number | null }[]>;
  /** Issue 1559: replaces the site's committed week with `entries` — every
   *  row's place cleared first, then each entry's written. */
  commitPlan(siteId: string, entries: readonly PlanEntry[]): Promise<void>;
  /** The site's committed week, in place order, whatever each row's status
   *  is now. */
  plannedRows(siteId: string): Promise<readonly OpportunityRow[]>;
  /** Writes a row's cluster and the searches it absorbed. */
  setCluster(opportunityId: string, clusterKey: string, absorbedQueries: readonly string[]): Promise<void>;
  /** The site's current stored report, or `null` where it has no readable
   *  one. */
  currentReport(siteId: string): Promise<StoredReport | null>;
  /** SPEC §6 (2026-09-15): whether the site's own measured page text yields
   *  at least one grounding passage — the generator's own read. A read that
   *  fails is `false`: a row is never made ready on a guess. */
  hasGroundingFact(siteId: string): Promise<boolean>;
  /** SPEC §6 (2026-09-15), issue 478: which Earn assets the site's own
   *  measured pages hold a passage of the needed kind for. A read that fails
   *  grounds none. */
  earnGrounding(siteId: string): Promise<EarnGrounding>;
  /** The moment the site's last non-`fix` opportunity left `open`, which is
   *  the moment supply hit zero. `null` where the site has never held one. */
  lastStatusChangeAt(siteId: string): Promise<Date | null>;
  /** Fallback for `exhaustedSince` on a site that has never held an
   *  opportunity: the completion time of its most recent completed scan. */
  latestCompletedScanAt(siteId: string): Promise<Date | null>;
  byId(opportunityId: string): Promise<OpportunityRow | null>;
  /** Open `fix_page` rows for one site, ready or not, oldest first — the
   *  rows readiness assesses, the ranking places and a week's scan retires. */
  openFixPages(siteId: string): Promise<readonly OpportunityRow[]>;
  /** Records whether a row passes readiness, with its reason when it does
   *  not. The two are written together, as the schema's biconditional asks. */
  setReadiness(opportunityId: string, reason: UnreadyReason | null): Promise<void>;
  /** The band a row carries, brought up to today's right-sizing law from
   *  the evidence already on it (issue 884). Written only where it changed,
   *  and never from a new measurement — `rebandFor` is arithmetic over
   *  stored numbers. */
  setFitBand(opportunityId: string, band: Winnability): Promise<void>;
  /** The volume a pass read for a row it already held unmeasured (SPEC §6,
   *  D64, issue 1301): the column, and the same figure in its evidence.
   *  Optional: a store that cannot write it leaves the row unmeasured. */
  setVolume?(opportunityId: string, volume: number, evidence: Evidence): Promise<void>;
  /** The row's evidence with the shape its stored results page gives it
   *  (`readiness.ts`). Optional: a store that cannot write it keeps the
   *  shape the row was typed by. */
  setEvidence?(opportunityId: string, evidence: Evidence): Promise<void>;
  /** Stores the pass's business-fit judgement on a row it already held
   *  (issue 1134): judged once, read by readiness and the ranking. */
  setBusinessFit(
    opportunityId: string,
    fit: BusinessFit,
    source: TopicSource,
    pageType: PageType | null
  ): Promise<void>;
  /** The site's structured market in force (`null` where none has been
   *  concluded) — what the fit is judged against — and the rivals it is
   *  measured against, as registrable domains. */
  marketFor(siteId: string): Promise<{
    market: MarketConclusion | null;
    competitors: readonly string[];
    /** The site's tracked buyer prompts, the branded ones left out (issue
     *  1208). Absent reads as none. */
    prompts?: readonly string[];
    /** The site's knowledge base as fit is shown it (issue 1133). Absent
     *  or `null` reads as none. */
    knowledge?: KnowledgeDigest | null;
  }>;
  /** SPEC §6: every `not_working` verdict for one site, each joined through
   *  its publication to the opportunity the page was written for. One read
   *  on `page_verdicts (site_id, week_start)`; the window is applied by
   *  `suppressionOf`, because a retirement counts verdicts older than it. */
  notWorkingVerdicts(siteId: string): Promise<readonly NotWorkingVerdict[]>;
  /** A row whose acceptance test passed: its status moves to `done`. */
  markDone(opportunityId: string): Promise<void>;
  /** A row a draft was written from: `open` moves to `queued`, and no other
   *  status moves (SPEC §7, 2026-09-15 — issue 712). `true` says it moved. */
  markQueued(opportunityId: string): Promise<boolean>;
  /** A claim whose draft was never saved is given back: `queued` moves to
   *  `open` in one conditional update, and no other status moves. */
  reopenIfQueued(opportunityId: string): Promise<void>;
  /** A row whose draft the customer stopped: `open` or `queued` moves to
   *  `dismissed`, and `done` stays done (SPEC §7, 2026-09-15 — issue 712). */
  markDismissed(opportunityId: string): Promise<void>;
  /** A planned page the customer stopped: `open` moves to `dismissed` in one
   *  conditional update, and `true` says it moved. */
  dismissIfOpen(opportunityId: string): Promise<boolean>;
  /** A row whose draft the generator stopped for the last time, or whose
   *  stopped draft the founder skipped (SPEC §7, D26, issue 1179): it is
   *  `open` and not ready (`resting`) until `until`. `open` and `queued`
   *  move; `done` and `dismissed` stay. */
  rest(opportunityId: string, until: Date): Promise<void>;
  /** A planned new page that becomes an update of a page the site already
   *  has (SPEC §7, D12, issue 1143): the row keeps its search, its status
   *  and its cluster, and takes the update's type, target and evidence. */
  becomeUpdate(
    opportunityId: string,
    update: Pick<OpportunityInsert, "type" | "family" | "target_ref" | "proposed_slug" | "title" | "effort" | "evidence">
  ): Promise<void>;
  /** The host the site's live hosted destination serves at, or `null`. */
  hostedHostFor(siteId: string): Promise<string | null>;
  /** The pages the site's hosted destination could update — its host and
   *  the slugs of ReachKit's live publications there (issue 781) — or `null`
   *  where the site's destination is not hosted. A read that fails updates
   *  nothing: an update is never made ready on a guess. */
  hostedOwnPages(siteId: string): Promise<HostedOwnPages | null>;
  /** The pages the crawl read of this domain (`site_profiles.inventory`) —
   *  the update candidates the Improve family matches to the market's
   *  questions (SPEC §7, 2026-09-16). Empty where no profile could be read:
   *  Improve then reads only the ranked urls, never a guessed page. */
  inventoryFor(domain: string): Promise<readonly InventoryRow[]>;
  /** The profile the ranking's intent term is classified against — §6.7's
   *  own, read out of the site's current stored report rather than derived
   *  a second time. `null` where the site has no readable report, which
   *  makes the ranking empty rather than guessed. */
  profileForSite(siteId: string): Promise<Profile | null>;
  /** SPEC §7 (2026-09-20, #928): the pages this site already has that are
   *  worth scoring against one planned topic — the database's own narrowing
   *  (full text, then trigram) over `known_content`. Empty where the index
   *  could not be read, which reads as "nothing is covered": an index that
   *  did not answer must never refuse a topic. */
  knownContentNear(a: { siteId: string; query: string }): Promise<readonly KnownPage[]>;
  /** SPEC §7 (2026-09-20, #928): re-reads the three sources of known content
   *  and writes what they say, before a pass derives. Never throws — a
   *  source that could not be read leaves its own rows as they were. */
  refreshKnownContent(a: {
    siteId: string;
    domain: string;
    inventory: readonly InventoryRow[];
  }): Promise<void>;
  /** SPEC §7 (*Pace*, issue 1139): the live pages ReachKit wrote for this
   *  site, each at its current version, and the two pools a newer fact is
   *  read from. Optional: a store that holds no published pages has nothing
   *  to answer, and `planRefreshes` then plans nothing. */
  refreshInputs?(siteId: string): Promise<RefreshInputs>;
  /** SPEC §6 (D60, issue 1288): the prompts the site tracks today, which a
   *  topic's intent is matched against. Optional: a double without it
   *  answers none, and no topic is held for lacking a prompt. */
  trackedPrompts?(siteId: string): Promise<readonly { id: string; text: string }[]>;
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
    businessFit: (row.business_fit ?? null) as BusinessFit | null,
    source: (row.source ?? null) as TopicSource | null,
    pageType: (row.page_type ?? null) as PageType | null,
    effort: typeof row.effort === "number" ? row.effort : Number(row.effort),
    status: row.status as OpportunityStatus,
    clusterKey: row.cluster_key,
    absorbedQueries: row.absorbed_queries ?? [],
    ready: row.ready,
    unreadyReason: row.unready_reason as UnreadyReason | null,
    restUntil: typeof row.rest_until === "string" ? new Date(row.rest_until) : null,
    createdAt: new Date(row.created_at),
    ...(row.plan_reason == null ? {} : { planReason: row.plan_reason }),
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

export interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  insert(rows: object): MinimalQueryBuilder<T>;
  update(values: object): MinimalQueryBuilder<T>;
  eq(column: string, value: string | boolean): MinimalQueryBuilder<T>;
  neq(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: boolean | null): MinimalQueryBuilder<T>;
  not(column: string, operator: string, value: null): MinimalQueryBuilder<T>;
  in(column: string, values: readonly unknown[]): MinimalQueryBuilder<T>;
  like(column: string, pattern: string): MinimalQueryBuilder<T>;
  gte(column: string, value: string): MinimalQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
}

/** `page_verdicts` embedded through `publications → drafts → opportunities`,
 *  the three foreign keys the baseline declares. */
interface NotWorkingRow {
  week_start: string;
  publications: {
    drafts: { opportunities: { cluster_key: string | null; family: string; target_ref: string } | null } | null;
  } | null;
}

export interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** The cast client, for the reads of this directory that are not the
 *  store's own (`refresh.ts`). */
export function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** Postgres' unique-violation class. The partial unique index raises it,
 *  and it is the one error this module reports as an outcome. */
const UNIQUE_VIOLATION = "23505";

/**
 * The rows, with an update's page named at the address it answers at **now**
 * (SPEC §7, 2026-09-18; issue 1182).
 *
 * An Improve row's `target_ref` — and the page its evidence names — is an
 * address copied off a page on the day the row was derived. Where that page
 * is one of the site's own hosted publications and its host has moved
 * since, the stored address names a host that serves nothing: readiness
 * would refuse the row as a page the destination cannot address, and the
 * calendar would name a dead link. So every read of a row goes through
 * here, and the address stays stored as it was written.
 *
 * A site with no Improve row costs no read, and a failure moves nothing.
 */
async function atCurrentHost<T extends { family: string; target_ref: string; evidence?: unknown }>(
  siteId: string,
  rows: readonly T[]
): Promise<T[]> {
  if (!rows.some((row) => row.family === "improve")) return [...rows];
  let now: (url: string) => string;
  try {
    const { storedAddressesNow } = await import("@/lib/publish/destinations/hosted/store");
    now = await storedAddressesNow(siteId);
  } catch {
    return [...rows];
  }
  return rows.map((row) => {
    if (row.family !== "improve") return row;
    const targetRef = now(row.target_ref);
    if (targetRef === row.target_ref) return row;
    return { ...row, target_ref: targetRef, evidence: evidenceAt(row.evidence, now) };
  });
}

/** The two places an Improve row's evidence repeats its page's address. */
function evidenceAt(evidence: unknown, now: (url: string) => string): unknown {
  if (typeof evidence !== "object" || evidence === null) return evidence;
  const held = evidence as { pageUrl?: unknown; shortfall?: { page?: { url?: unknown } } };
  const page = held.shortfall?.page;
  return {
    ...held,
    ...(typeof held.pageUrl === "string" ? { pageUrl: now(held.pageUrl) } : {}),
    ...(typeof page?.url === "string"
      ? { shortfall: { ...held.shortfall, page: { ...page, url: now(page.url) } } }
      : {}),
  };
}

export const COLUMNS =
  "id, site_id, scan_id, type, family, target_query, target_ref, proposed_slug, " +
  "title, volume, evidence, acceptance, fit_band, business_fit, source, page_type, effort, status, cluster_key, " +
  "absorbed_queries, ready, unready_reason, rest_until, plan_place, planned_for, plan_write_as, plan_reason, created_at";

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
      return atCurrentHost(siteId, data ?? []);
    },

    async countUnused(siteId) {
      const { data, error } = await untyped()
        .from<{ id: string; type: string; target_query: string | null }>("opportunities")
        .select("id, type, target_query")
        .eq("site_id", siteId)
        .eq("status", "open")
        .eq("ready", true)
        .neq("family", "fix");
      // No second rule here (issue 884): an outsized row is stored
      // `ready: false` with its own reason by `readiness.ts`, so counting
      // ready rows already excludes it. The `fit_band` filter issue 881 put
      // here was the third home of one decision.
      if (error) throw new Error(`opportunities.countUnused: ${error.message}`);
      // SPEC §7 (owner, D46): a topic of a paused type fills no day, so it is
      // not a day of supply either — the ranking and this count read the one
      // predicate.
      return (data ?? []).filter(
        (row) => !isPausedType({ type: row.type as OpportunityType, targetQuery: row.target_query })
      ).length;
    },

    async countOutsized(siteId) {
      const { data, error } = await untyped()
        .from<{ id: string }>("opportunities")
        .select("id")
        .eq("site_id", siteId)
        .eq("status", "open")
        .neq("family", "fix")
        .eq("fit_band", OUTSIZED);
      if (error) throw new Error(`opportunities.countOutsized: ${error.message}`);
      return data?.length ?? 0;
    },

    async clusterable(siteId) {
      const { data, error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .select(COLUMNS)
        .eq("site_id", siteId)
        .in("status", ["open", "queued", "done"])
        .neq("family", "fix")
        .order("created_at", { ascending: true });
      if (error) throw new Error(`opportunities.clusterable: ${error.message}`);
      return atCurrentHost(siteId, data ?? []);
    },

    async latestPage(siteId) {
      const { data, error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .select(COLUMNS)
        .eq("site_id", siteId)
        .in("status", ["queued", "done"])
        .neq("family", "fix")
        .order("status_changed_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(`opportunities.latestPage: ${error.message}`);
      return (await atCurrentHost(siteId, data ?? []))[0] ?? null;
    },

    async draftedOpportunityIds(siteId) {
      const { data, error } = await untyped()
        .from<{ opportunity_id: string | null }>("drafts")
        .select("opportunity_id")
        .eq("site_id", siteId);
      if (error) throw new Error(`opportunities.draftedOpportunityIds: ${error.message}`);
      return new Set((data ?? []).flatMap((draft) => (draft.opportunity_id === null ? [] : [draft.opportunity_id])));
    },

    async draftedPages(siteId, limit) {
      const { data, error } = await untyped()
        .from<{
          scheduled_for: string | null;
          state: string;
          title: string | null;
          written_as: string | null;
          opportunities: OpportunityRow | null;
        }>("drafts")
        .select(`scheduled_for, state, title, written_as:meta->>contentType, opportunities(${COLUMNS})`)
        .eq("site_id", siteId)
        // A descending order puts a row with no date first.
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`opportunities.draftedPages: ${error.message}`);
      const pages = (data ?? []).flatMap((draft) =>
        draft.scheduled_for === null || draft.opportunities === null
          ? []
          : [{ date: draft.scheduled_for, state: draft.state, title: draft.title, writtenAs: draft.written_as ?? null, row: draft.opportunities }]
      );
      const rows = await atCurrentHost(
        siteId,
        pages.map((page) => page.row)
      );
      return pages.map((page, index) => ({ ...page, row: rows[index] ?? page.row }));
    },

    async citedPages(siteId, at) {
      // Lazy: the weekly reader reaches the db and the report module.
      const [{ readPromptWindow }, { weekStartFor }, { readSiteZone }] = await Promise.all([
        import("@/lib/scan/weekly/prompts"),
        import("@/lib/scan/weekly/week"),
        import("@/lib/scan/weekly/store"),
      ]);
      const zone = await readSiteZone(siteId);
      if (zone === null) return [];
      const window = await readPromptWindow({ siteId, zone, weekStart: weekStartFor({ at, zone }) });
      return [...new Set(window.weeks.flatMap((week) => week.samples.flatMap((sample) => sample.ownUrls)))];
    },

    async topTens(scanIds) {
      const topTens = new Map<string, readonly string[]>();
      if (scanIds.length === 0) return topTens;
      const { data, error } = await untyped()
        .from<Pick<StoredReport, "questions" | "serps">>("scans")
        .select("questions:report->questions, serps:report->serps")
        .in("id", [...scanIds])
        .order("created_at", { ascending: true });
      if (error) throw new Error(`opportunities.topTens: ${error.message}`);
      for (const report of data ?? []) for (const [query, urls] of topTensOf(report)) topTens.set(query, urls);
      return topTens;
    },

    async topTenRows(scanIds) {
      const topTens = new Map<string, TopTenRead>();
      if (scanIds.length === 0) return topTens;
      const { data, error } = await untyped()
        .from<Pick<StoredReport, "questions" | "serps"> & { created_at: string }>("scans")
        .select("questions:report->questions, serps:report->serps, created_at")
        .in("id", [...scanIds])
        .order("created_at", { ascending: true });
      if (error) throw new Error(`opportunities.topTenRows: ${error.message}`);
      for (const report of data ?? []) {
        const at = new Date(report.created_at);
        for (const [query, read] of topTenRowsOf(report)) topTens.set(query, { at, ...read });
      }
      return topTens;
    },

    async askedBeside(siteId, days) {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await untyped()
        .from<{ cache_key: string; payload: unknown; created_at: string }>("fetches")
        .select("cache_key, payload, created_at")
        .like("cache_key", `%|site:${siteId}|paa`)
        .gte("created_at", since);
      if (error) throw new Error(`opportunities.askedBeside: ${error.message}`);
      return (data ?? []).flatMap((row) => {
        const serp = (Array.isArray(row.payload) ? row.payload[0] : row.payload) as
          | { peopleAlsoAsk?: unknown; relatedSearches?: unknown }
          | null
          | undefined;
        const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
        const term = row.cache_key.split("|")[0] ?? "";
        return term === ""
          ? []
          : [{ term, peopleAlsoAsk: strings(serp?.peopleAlsoAsk), related: strings(serp?.relatedSearches), at: new Date(row.created_at) }];
      });
    },

    async dismissedSearches(siteId) {
      const { data, error } = await untyped()
        .from<{ target_query: string | null; volume: number | null }>("opportunities")
        .select("target_query, volume")
        .eq("site_id", siteId)
        .eq("status", "dismissed")
        .neq("family", "fix");
      if (error) throw new Error(`opportunities.dismissedSearches: ${error.message}`);
      return (data ?? []).flatMap((row) => (row.target_query === null ? [] : [{ query: row.target_query, volume: row.volume }]));
    },

    async setCluster(opportunityId, clusterKey, absorbedQueries) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ cluster_key: clusterKey, absorbed_queries: [...absorbedQueries] })
        .eq("id", opportunityId);
      if (error) throw new Error(`opportunities.setCluster: ${error.message}`);
    },

    async hasGroundingFact(siteId) {
      try {
        const { readGroundingFact } = await import("@/lib/generate/pipeline/grounding");
        return !("failed" in (await readGroundingFact({ siteId })));
      } catch {
        return false;
      }
    },

    async earnGrounding(siteId) {
      try {
        const [{ readMeasuredText }, { sitePassages }, { readSiteProfile }, report] = await Promise.all([
          import("@/lib/measure/text"),
          import("@/lib/generate/pipeline/grounding"),
          import("@/lib/site-profile/store"),
          currentReportOf(siteId),
        ]);
        const [measuredPages, profile] = await Promise.all([
          readMeasuredText({ siteId, customerOnly: true }),
          report === null ? Promise.resolve(null) : readSiteProfile(report.domain),
        ]);
        return earnGroundingOf({
          pages: sitePassages(measuredPages).map(({ page, passages }) => ({ url: page.url, passages })),
          inventory: profile?.inventory ?? [],
        });
      } catch {
        return NO_EARN_GROUNDING;
      }
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
      const row = data?.[0] ?? null;
      return row === null ? null : ((await atCurrentHost(row.site_id, [row]))[0] ?? row);
    },

    async openFixPages(siteId) {
      const { data, error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .select(COLUMNS)
        .eq("site_id", siteId)
        .eq("status", "open")
        .eq("type", "fix_page")
        .order("created_at", { ascending: true });
      if (error) throw new Error(`opportunities.openFixPages: ${error.message}`);
      return data ?? [];
    },

    async setFitBand(opportunityId, band) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ fit_band: band })
        .eq("id", opportunityId);
      if (error) throw new Error(`opportunities.setFitBand: ${error.message}`);
    },

    async setVolume(opportunityId, volume, evidence) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ volume, evidence })
        .eq("id", opportunityId);
      if (error) throw new Error(`opportunities.setVolume: ${error.message}`);
    },

    async setEvidence(opportunityId, evidence) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ evidence })
        .eq("id", opportunityId);
      if (error) throw new Error(`opportunities.setEvidence: ${error.message}`);
    },

    async setBusinessFit(opportunityId, fit, source, pageType) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ business_fit: fit, source, page_type: pageType })
        .eq("id", opportunityId);
      if (error) throw new Error(`opportunities.setBusinessFit: ${error.message}`);
    },

    async marketFor(siteId) {
      const { readSiteMarket } = await import("@/lib/market/infer/stored");
      const site = await readSiteMarket(siteId);
      const { readPromptSet } = await import("@/lib/market/prompts/store");
      // A site with no set yet, or one that could not be read, has none.
      const prompts = await readPromptSet(siteId)
        .then((set) => set.prompts.filter((prompt) => prompt.kind !== "branded").map((prompt) => prompt.text))
        .catch(() => []);
      // SPEC §6 (2026-09-29, issue 1133): the knowledge base beside it. A
      // read that fails is `null` (`readKnowledgeBase` never throws).
      const { readKnowledgeBase, knowledgeDigest } = await import("@/lib/site-profile/knowledge/read");
      const base = site == null ? null : await readKnowledgeBase({ siteId, domain: site.domain });
      const knowledge = base === null ? null : knowledgeDigest(base);
      // SPEC §6 (D49, issue 1270): topics are derived from the market's
      // searched terms and the founder's own answer about who buys, so a
      // label nobody searches never reaches a page's subject.
      const current = site?.stored.current ?? null;
      const { spokenMarket } = await import("@/lib/market/infer/terms");
      const { readBusinessEdits } = await import("@/lib/site-profile/business/edits");
      const buyers = current === null ? null : await readBusinessEdits(siteId).then((edits) => edits.answers.buyers ?? null).catch(() => null);
      const market = current === null ? null : spokenMarket(current, buyers);
      return { market, competitors: site?.competitors ?? [], prompts, knowledge };
    },

    async commitPlan(siteId, entries) {
      const cleared = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ plan_place: null, planned_for: null, plan_write_as: null, plan_reason: null })
        .eq("site_id", siteId)
        .not("plan_place", "is", null);
      if (cleared.error) throw new Error(`opportunities.commitPlan: ${cleared.error.message}`);
      for (const entry of entries) {
        const { error } = await untyped()
          .from<OpportunityRow>("opportunities")
          .update({ plan_place: entry.place, planned_for: entry.plannedFor, plan_write_as: entry.writeAs, plan_reason: entry.reason })
          .eq("id", entry.opportunityId)
          .eq("site_id", siteId);
        if (error) throw new Error(`opportunities.commitPlan: ${error.message}`);
      }
    },

    async plannedRows(siteId) {
      const { data, error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .select(COLUMNS)
        .eq("site_id", siteId)
        .not("plan_place", "is", null)
        .order("plan_place", { ascending: true });
      if (error) throw new Error(`opportunities.plannedRows: ${error.message}`);
      return atCurrentHost(siteId, data ?? []);
    },

    async setReadiness(opportunityId, reason) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ ready: reason === null, unready_reason: reason })
        .eq("id", opportunityId);
      if (error) throw new Error(`opportunities.setReadiness: ${error.message}`);
    },

    async notWorkingVerdicts(siteId) {
      const { data, error } = await untyped()
        .from<NotWorkingRow>("page_verdicts")
        .select("week_start, publications(drafts(opportunities(cluster_key, family, target_ref)))")
        .eq("site_id", siteId)
        .eq("verdict", "not_working")
        .order("week_start", { ascending: false });
      if (error) throw new Error(`opportunities.notWorkingVerdicts: ${error.message}`);
      const judged = (data ?? []).map((row) => ({
        week: row.week_start,
        o: row.publications?.drafts?.opportunities ?? null,
      }));
      // A retired page is compared with a row's own target, and the rows
      // are read at the current host — so this one is too.
      const held = judged.flatMap(({ o }) => (o === null ? [] : [o]));
      const now = await atCurrentHost(siteId, held);
      const targetOf = new Map(held.map((o, index) => [o, now[index]?.target_ref ?? o.target_ref]));
      return judged.map(({ week, o }) => ({
        week,
        clusterKey: o?.cluster_key ?? null,
        family: (o?.family as Family | undefined) ?? null,
        targetRef: o === null ? null : (targetOf.get(o) ?? null),
      }));
    },

    async markDone(opportunityId) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ status: "done" })
        .eq("id", opportunityId);
      if (error) throw new Error(`opportunities.markDone: ${error.message}`);
    },

    async markQueued(opportunityId) {
      const { data, error } = await untyped()
        .from<{ id: string }>("opportunities")
        .update({ status: "queued" })
        .eq("id", opportunityId)
        .eq("status", "open")
        .select("id");
      if (error) throw new Error(`opportunities.markQueued: ${error.message}`);
      return (data ?? []).length > 0;
    },

    async reopenIfQueued(opportunityId) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ status: "open" })
        .eq("id", opportunityId)
        .eq("status", "queued");
      if (error) throw new Error(`opportunities.reopenIfQueued: ${error.message}`);
    },

    async markDismissed(opportunityId) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ status: "dismissed" })
        .eq("id", opportunityId)
        .in("status", ["open", "queued"]);
      if (error) throw new Error(`opportunities.markDismissed: ${error.message}`);
    },

    async dismissIfOpen(opportunityId) {
      const { data, error } = await untyped()
        .from<{ id: string }>("opportunities")
        .update({ status: "dismissed" })
        .eq("id", opportunityId)
        .eq("status", "open")
        .select("id");
      if (error) throw new Error(`opportunities.dismissIfOpen: ${error.message}`);
      return (data ?? []).length > 0;
    },

    async rest(opportunityId, until) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update({ status: "open", rest_until: until.toISOString(), ready: false, unready_reason: "resting" })
        .eq("id", opportunityId)
        .in("status", ["open", "queued"]);
      if (error) throw new Error(`opportunities.rest: ${error.message}`);
    },

    async becomeUpdate(opportunityId, update) {
      const { error } = await untyped()
        .from<OpportunityRow>("opportunities")
        .update(update)
        .eq("id", opportunityId);
      if (error) throw new Error(`opportunities.becomeUpdate: ${error.message}`);
    },

    async hostedHostFor(siteId) {
      const { data, error } = await untyped()
        .from<{ hostname: string | null }>("destinations")
        .select("hostname")
        .eq("site_id", siteId)
        .eq("kind", "hosted")
        .is("deleted_at", null)
        .limit(1);
      if (error) throw new Error(`opportunities.hostedHostFor: ${error.message}`);
      return data?.[0]?.hostname ?? null;
    },

    async hostedOwnPages(siteId) {
      try {
        const { hostedOwnPagesOfSite } = await import("@/lib/publish/destinations/hosted/store");
        return await hostedOwnPagesOfSite(siteId);
      } catch {
        return { host: "", slugs: [] };
      }
    },

    async knownContentNear(a) {
      try {
        const { knownContentNear } = await import("@/lib/known-content");
        return await knownContentNear(a);
      } catch {
        // Nothing is covered, rather than everything refused: see the
        // interface's own note.
        return [];
      }
    },

    async refreshKnownContent(a) {
      try {
        const { refreshKnownContentFor } = await import("@/lib/known-content");
        await refreshKnownContentFor(a);
      } catch {
        // `refreshKnownContentFor` logs what it could not read; a pass does
        // not fail because a customer's blog did not answer.
      }
    },

    async refreshInputs(siteId) {
      const { readRefreshInputs } = await import("./refresh");
      return readRefreshInputs(siteId);
    },

    async trackedPrompts(siteId) {
      const { readPromptSet } = await import("@/lib/market/prompts/store");
      return (await readPromptSet(siteId)).prompts;
    },

    async inventoryFor(domain) {
      try {
        const { readSiteProfile } = await import("@/lib/site-profile/store");
        return (await readSiteProfile(domain))?.inventory ?? [];
      } catch {
        return [];
      }
    },

    async profileForSite(siteId) {
      const report = await currentReportOf(siteId);
      return report === null || report.market.kind === "unmeasured" ? null : report.market.value.profile;
    },

    currentReport: currentReportOf,
  };
}

async function currentReportOf(siteId: string): Promise<StoredReport | null> {
  const { data, error } = await untyped()
    .from<{ report: unknown }>("scans")
    .select("report")
    .eq("site_id", siteId)
    .is("is_current", true)
    .limit(1);
  if (error) throw new Error(`opportunities.currentReport: ${error.message}`);
  const blob = data?.[0]?.report;
  return blob === undefined || blob === null ? null : readStoredReport(blob);
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
