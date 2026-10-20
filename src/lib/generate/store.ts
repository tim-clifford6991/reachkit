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
import type { KnownPage } from "@/lib/known-content/types";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { readStoredCheck } from "@/lib/publish/verify/stored";
import { parseStoredMarket } from "@/lib/market/infer/stored";
import { isWritingVoice, type WritingVoice } from "./voice/register";
import { parsePromptSet } from "@/lib/market/prompts/set";
import type { StoredMarket } from "@/lib/market/infer/types";
import { readSiteProfile } from "@/lib/site-profile/store";
import type { InventoryRow } from "@/lib/site-profile/types";
import type { ClusterPage } from "./links/select";
import { withheldReportPassages } from "./pipeline/report-scope";

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
  /** §9's append-only record of moves; read for whether the page ever
   *  entered review (#1180). */
  transitions?: unknown;
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
  /** The page's head facts. A written page stores the description its
   *  draft step wrote (`{ description }`), which the hosted template reads
   *  (issue 697); a `fix_page` draft (#690) stores the metadata the update
   *  carries. */
  meta?: unknown;
}

/** The columns one run may change. Every one is written by the engine and
 *  none by a customer; `grounded_fact`'s passage is frozen by a trigger the
 *  moment the row exists, so a patch that tried to rewrite it would raise
 *  rather than succeed quietly. */
export interface DraftPatch {
  state?: string;
  title?: string | null;
  body_md?: string | null;
  /** A regeneration rewrites the page on the date's one row (#788). */
  meta?: unknown;
  /** Rewritten only with the passage it already holds — the trigger
   *  refuses any other — so the source's address and read date can move to
   *  the read this run made. */
  grounded_fact?: unknown;
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
  /** SPEC §7 (D26, issue 1179): only ever set to `null`, and only on a row
   *  the generator stopped — the stopped draft keeps its row and gives up
   *  its date, so the same run can write the next topic for it. */
  scheduled_for?: null;
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
  /** `sites.market` (D28): the market ReachKit concluded and keeps current,
   *  which a page is written for (issue 1248). Absent reads as none stored. */
  market?: StoredMarket;
  /** `sites.tracked_prompts` (D19): what a page's intent is matched
   *  against (D60, issue 1288). Absent reads as none tracked. */
  prompts?: readonly { id: string; text: string }[];
}

/** A page of the customer's own, as the near-duplicate gate compares it. */
export interface StoredPage {
  ref: string;
  title: string;
  markdown: string;
  /** Issue 1490: the report sentences its pack held where it is not a
   *  research page — what a refresh of it may no longer state. Absent reads
   *  as none. */
  reportPassages?: string[];
}

export interface GenerateStore {
  siteFacts(siteId: string): Promise<SiteFacts | null>;
  /** `sites.writing_voice` (issue 1390): the voice the customer fixed in
   *  Settings, or `null` where they left it to be chosen. A store that
   *  holds none leaves this out. */
  writingVoice?(siteId: string): Promise<WritingVoice | null>;
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
  /** SPEC §7 (issue 1507): the version live at an address — its row, and
   *  when it went live — or `null` where none is. A store that holds no
   *  publications leaves this out, and no page is mended. */
  liveVersionAt?(siteId: string, url: string): Promise<{ draft: DraftRow; publishedAt: Date } | null>;
  /** Issue 1509: each address of this site live now, with the Markdown of
   *  the version it serves. A store that holds no publications leaves this
   *  out, and no fact is offered later for having been said. */
  livePages?(siteId: string): Promise<{ url: string; markdown: string }[]>;
  queuedPages(siteId: string, exceptDraftId: string | null): Promise<StoredPage[]>;
  /** SPEC §7 (D13, issue 1144): the text of every draft and live page
   *  written for a site **other** than `siteId` since `since`, newest first,
   *  at most `limit`. The one read in this file that crosses sites, and it
   *  returns the Markdown alone — no id, title or site — so nothing that
   *  could name another customer's page leaves the store. */
  pagesElsewhere(siteId: string, since: Date, limit: number): Promise<string[]>;
  /** Drafts short of hand-off, for the claim sweep — never one already
   *  handed to a destination or already live. */
  draftsShortOfHandOff(siteId: string, limit: number): Promise<DraftRow[]>;
  /** How many of them there are, so a truncated sweep can report the rest
   *  as deferred rather than as finished. */
  countShortOfHandOff(siteId: string): Promise<number>;
  /** The site profile's page inventory for the domain — every page the
   *  last crawl read, with its purpose. Empty where no pass has built one. */
  siteInventory(domain: string): Promise<readonly InventoryRow[]>;
  /** SPEC §7 (2026-09-20, #928): every page this site already has — ours,
   *  a connected WordPress's and the crawl's — for the links a new page may
   *  carry. Empty where the index could not be read, which offers no link
   *  rather than a guessed one. */
  knownPages(siteId: string): Promise<readonly KnownPage[]>;
  /** This site's live pages written for opportunities in `clusterKey`:
   *  published, not unpublished, and not found gone by the day-after
   *  check (SPEC §7, 2026-09-12). */
  clusterPages(siteId: string, clusterKey: string): Promise<ClusterPage[]>;
  /** Whether the site already holds a draft for this calendar date, in any
   *  state. A date has at most one asset (SPEC §7), and both the first
   *  draft's kickoff and the evening tick can ask for the same date. A
   *  stopped draft the run moved on from carries no date (D26, issue 1179)
   *  and is not counted. */
  draftOnDate(siteId: string, date: string): Promise<boolean>;
  /** Drafts on these sites the customer restarted — `needs_attention →
   *  generating`, the last move on the row — that no run has regenerated
   *  yet (#788). A row the evening tick wrote straight into `generating`
   *  carries no move, so a first run in progress is never one of these. */
  restartedDrafts(siteIds: readonly string[]): Promise<readonly RestartedDraft[]>;
  /** The `meta` of the site's newest draft of one content type (D42), or
   *  `null` where it has none. Optional: a double that holds no rows of a
   *  type answers nothing. */
  lastMetaOfType?(siteId: string, type: string): Promise<unknown>;
}

export interface RestartedDraft {
  draftId: string;
  siteId: string;
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

/** A page on its way out or out: what "live" means to the cross-site check
 *  (issue 1144). A page taken down or skipped is neither a draft nor live. */
const LIVE = ["publishing", "published"] as const;

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
  error: { message: string; code?: string } | null;
}

/** Postgres's unique violation, as PostgREST hands it back. */
const UNIQUE_VIOLATION = "23505";

/**
 * The date already holds its draft, said by the database rather than by the
 * read `generateDayPage()` makes first (issue 886).
 *
 * `drafts_one_per_site_per_date` is SPEC §7's "a date holds at most one
 * asset" as an index, and it is what decides two evening ticks that both
 * read no row and both went on to write one. The loser's insert raises
 * this, and the engine answers `already_drafted` — the same outcome the
 * read gives the delivery that arrives after the first run has finished.
 */
export class DraftDateTaken extends Error {
  constructor(
    readonly siteId: string,
    readonly publishDate: string | null
  ) {
    super(`generate/store: ${siteId} already holds a draft for ${publishDate ?? "no date"}`);
    this.name = "DraftDateTaken";
  }
}

/** The page was stopped before its draft was saved, so no row was written. */
export class PageStopped extends Error {
  constructor(readonly opportunityId: string) {
    super(`generate/store: ${opportunityId} was stopped before its draft was saved`);
    this.name = "PageStopped";
  }
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string, options?: { count: "exact"; head: true }): MinimalQueryBuilder<T>;
  insert(rows: object): MinimalQueryBuilder<T>;
  update(values: object): MinimalQueryBuilder<T>;
  eq(column: string, value: string | number): MinimalQueryBuilder<T>;
  neq(column: string, value: string): MinimalQueryBuilder<T>;
  gte(column: string, value: string): MinimalQueryBuilder<T>;
  not(column: string, operator: string, value: unknown): MinimalQueryBuilder<T>;
  is(column: string, value: null): MinimalQueryBuilder<T>;
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
  "scheduled_for, veto_deadline, created_at, transitions";

function pageOf(row: DraftRow): StoredPage {
  const reportPassages = withheldReportPassages(row.meta);
  return { ref: row.id, title: row.title ?? "", markdown: row.body_md ?? "", ...(reportPassages.length === 0 ? {} : { reportPassages }) };
}

export function supabaseGenerateStore(): GenerateStore {
  return {
    // Read apart from `siteFacts`, and a failed read is "not chosen": a
    // deploy runs before its migration is applied (`docs/PROCESS.md`), and a
    // column that is not there yet must not stop a page.
    async writingVoice(siteId) {
      const result = await untyped().from<{ writing_voice: unknown }>("sites").select("writing_voice").eq("id", siteId).limit(1);
      if (result.error) {
        console.warn(JSON.stringify({ event: "writing_voice_unread", siteId, error: result.error.message.slice(0, 200) }));
        return null;
      }
      const voice = (result.data ?? [])[0]?.writing_voice;
      return isWritingVoice(voice) ? voice : null;
    },
    async siteFacts(siteId) {
      const result = await untyped()
        .from<{
          id: string;
          domain: string | null;
          category: string | null;
          voice_text: string | null;
          do_not_claim: unknown;
          competitors: unknown;
          market: unknown;
          tracked_prompts: unknown;
        }>("sites")
        .select("id, domain, category, voice_text, do_not_claim, competitors, market, tracked_prompts")
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
        market: parseStoredMarket(row.market),
        prompts: parsePromptSet(row.tracked_prompts ?? null).prompts,
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
      // Claimed as it is saved: a stop that came first drops the draft, and one that comes later is refused.
      const { claimForDraft } = await import("@/lib/opportunities");
      if (!(await claimForDraft(row.opportunity_id))) throw new PageStopped(row.opportunity_id);
      const result = await untyped()
        .from<{ id: string }>("drafts")
        .insert(row)
        .select("id");
      // The one unique rule an insert of a day's page can break is
      // `drafts_one_per_site_per_date` (issue 886) — the primary key is a
      // generated uuid. It is raised as itself so the caller can answer
      // `already_drafted` instead of failing the tick.
      if (result.error?.code === UNIQUE_VIOLATION) {
        throw new DraftDateTaken(row.site_id, row.scheduled_for);
      }
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

    async liveVersionAt(siteId, url) {
      const live = await untyped()
        .from<{ draft_id: string; live_url: string | null; published_at: string }>("publications")
        .select("draft_id, live_url, published_at")
        .eq("site_id", siteId)
        .not("published_at", "is", null)
        .is("unpublished_at", null)
        .order("published_at", { ascending: false });
      if (live.error) throw new Error(`generate/store: read from publications failed: ${live.error.message}`);
      // The address by its path: the host a page answers at may have moved
      // since it was recorded (issue 888).
      const pathOf = (address: string): string | null => {
        try {
          return new URL(address).pathname.replace(/\/+$/, "");
        } catch {
          return null;
        }
      };
      const wanted = pathOf(url);
      const newest = (live.data ?? []).find((row) => row.live_url !== null && wanted !== null && pathOf(row.live_url) === wanted);
      if (newest === undefined) return null;
      const draft = await this.draftById(newest.draft_id);
      return draft === null ? null : { draft, publishedAt: new Date(newest.published_at) };
    },

    async livePages(siteId) {
      const live = await untyped()
        .from<{ live_url: string | null; published_at: string; drafts: { body_md: string | null } | null }>("publications")
        .select("live_url, published_at, drafts(body_md)")
        .eq("site_id", siteId)
        .not("published_at", "is", null)
        .is("unpublished_at", null)
        .order("published_at", { ascending: false });
      if (live.error) throw new Error(`generate/store: read from publications failed: ${live.error.message}`);
      // Newest first, so an address's first row is the version it serves.
      const served = new Map<string, string>();
      for (const row of live.data ?? []) {
        if (row.live_url === null || served.has(row.live_url)) continue;
        served.set(row.live_url, row.drafts?.body_md ?? "");
      }
      return [...served].map(([url, markdown]) => ({ url, markdown })).filter((page) => page.markdown !== "");
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

    async pagesElsewhere(siteId, since, limit) {
      const result = await untyped()
        .from<{ body_md: string | null }>("drafts")
        .select("body_md")
        .neq("site_id", siteId)
        .in("state", [...SHORT_OF_HAND_OFF, ...LIVE])
        .gte("created_at", since.toISOString())
        .not("body_md", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (result.error) throw new Error(`generate/store: read from drafts failed: ${result.error.message}`);
      return (result.data ?? []).map((row) => row.body_md ?? "").filter((markdown) => markdown !== "");
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

    async siteInventory(domain) {
      return (await readSiteProfile(domain))?.inventory ?? [];
    },

    async draftOnDate(siteId, date) {
      const result = await untyped()
        .from<{ id: string }>("drafts")
        .select("id")
        .eq("site_id", siteId)
        .eq("scheduled_for", date)
        .limit(1);
      if (result.error) throw new Error(`generate/store: read from drafts failed: ${result.error.message}`);
      return (result.data ?? []).length > 0;
    },

    async lastMetaOfType(siteId, type) {
      const result = await untyped()
        .from<{ meta: unknown }>("drafts")
        .select("meta")
        .eq("site_id", siteId)
        .eq("meta->>contentType", type)
        .in("state", ["published", "publishing", "approved", "in_review"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (result.error) throw new Error(`generate/store: read from drafts failed: ${result.error.message}`);
      return (result.data ?? [])[0]?.meta ?? null;
    },

    async restartedDrafts(siteIds) {
      if (siteIds.length === 0) return [];
      const result = await untyped()
        .from<{ id: string; site_id: string; transitions: unknown }>("drafts")
        .select("id, site_id, transitions")
        .in("site_id", siteIds)
        .eq("state", "generating")
        .order("created_at", { ascending: true });
      if (result.error) throw new Error(`generate/store: read from drafts failed: ${result.error.message}`);
      return (result.data ?? [])
        .filter((row) => lastMoveIsRestart(row.transitions))
        .map((row) => ({ draftId: row.id, siteId: row.site_id }));
    },

    async knownPages(siteId) {
      try {
        const { knownContentFor } = await import("@/lib/known-content");
        return await knownContentFor(siteId);
      } catch {
        return [];
      }
    },

    async clusterPages(siteId, clusterKey) {
      const result = await untyped()
        .from<{
          live_url: string | null;
          destination: string | null;
          published_at: string | null;
          verify: unknown;
          drafts: { title: string | null; opportunities: { cluster_key: string | null } | null } | null;
        }>("publications")
        .select("live_url, destination, published_at, verify, drafts(title, opportunities(cluster_key))")
        .eq("site_id", siteId)
        .not("published_at", "is", null)
        .not("live_url", "is", null)
        .is("unpublished_at", null);
      if (result.error) throw new Error(`generate/store: read from publications failed: ${result.error.message}`);
      const rows = result.data ?? [];
      if (rows.length === 0) return [];
      // Issue 896: a cross-link names the address the page answers at
      // **now**. A hosted page follows its site's host (SPEC §7,
      // 2026-09-18), so a page written after a host move must link to the
      // new address — writing the stored one would put a 404 inside a page
      // this product publishes under the customer's own name. The host is
      // read once for the site; a WordPress page keeps its own address.
      // Lazily imported to leave this engine leaf's static graph alone.
      const { hostedAddressesNow } = await import("@/lib/publish/destinations/hosted/store");
      const addressNow = await hostedAddressesNow(siteId);
      const pages: ClusterPage[] = [];
      for (const row of rows) {
        if (row.live_url === null || row.published_at === null) continue;
        if (row.drafts?.opportunities?.cluster_key !== clusterKey) continue;
        if (readStoredCheck(row.verify)?.result.outcome === "page_not_found") continue;
        pages.push({
          liveUrl: addressNow({ destination: row.destination, liveUrl: row.live_url }),
          title: row.drafts.title ?? "",
          publishedAt: new Date(row.published_at),
        });
      }
      return pages;
    },
  };
}

/** Whether the row's last recorded move is the customer's restart. */
function lastMoveIsRestart(transitions: unknown): boolean {
  if (!Array.isArray(transitions) || transitions.length === 0) return false;
  const last = transitions[transitions.length - 1] as { from?: unknown; to?: unknown } | null;
  return last?.from === "needs_attention" && last?.to === "generating";
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
