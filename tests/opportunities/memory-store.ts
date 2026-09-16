// tests/opportunities/memory-store.ts — the engine's store, in memory.
//
// Not a suite (vitest collects `*.test.ts`). The `node` project has no
// database, so every suite in this directory drives the real modules
// against this store: the derivation, the ranking, the depth count and the
// notice are all exercised for real, and only the rows are in a Map.
//
// It models the two schema invariants the engine relies on and does not
// restate: the partial unique index on
// `(site_id, type, coalesce(target_query,''), target_ref) where status in
// ('open','queued')`, and `status_changed_at` moving only when `status`
// does.
import "./env";
import type {
  InsertOutcome,
  OpportunityInsert,
  OpportunityRow,
  OpportunityStore,
} from "../../src/lib/opportunities/store";
import type { Profile } from "../../src/lib/market/questions/profile";
import type { EarnGrounding } from "../../src/lib/opportunities/earn-grounding";
import type { NotWorkingVerdict } from "../../src/lib/opportunities/suppression";
import type { StoredReport } from "../../src/lib/scan/report";
import type { InventoryRow } from "../../src/lib/site-profile/types";

export interface MemoryState {
  rows: OpportunityRow[];
  statusChangedAt: Map<string, Date>;
  profile: Profile | null;
  latestScanAt: Date | null;
  /** The host the site's hosted destination serves at, if any. */
  hostedHost: string | null;
  now: Date;
  nextId: number;
  /** `page_verdicts` rows judged `not_working`, already joined to their
   *  opportunity. */
  notWorking: NotWorkingVerdict[];
  /** The site's current stored report, where a suite gives one. */
  report: StoredReport | null;
  /** Whether the site's own pages ground a fact (SPEC §6, 2026-09-15). */
  grounded: boolean;
  /** Which Earn assets the site's own pages ground (issue 478). */
  earnGrounding: EarnGrounding;
  /** The pages the crawl read of the site's domain (#780). */
  inventory: InventoryRow[];
}

export function newMemoryState(over: Partial<MemoryState> = {}): MemoryState {
  return {
    rows: [],
    statusChangedAt: new Map(),
    profile: null,
    latestScanAt: null,
    hostedHost: null,
    now: new Date("2026-09-06T09:00:00.000Z"),
    nextId: 1,
    notWorking: [],
    report: null,
    grounded: true,
    earnGrounding: { comparison_table: true, integration_page: true, original_data_page: true },
    inventory: [],
    ...over,
  };
}

function dedupeKey(row: {
  site_id: string;
  type: string;
  target_query: string | null;
  target_ref: string;
}): string {
  return [row.site_id, row.type, row.target_query ?? "", row.target_ref].join(" ");
}

export function memoryStore(state: MemoryState): OpportunityStore {
  return {
    async insert(insert: OpportunityInsert): Promise<InsertOutcome> {
      const clash = state.rows.some(
        (row) =>
          (row.status === "open" || row.status === "queued") &&
          dedupeKey(row) === dedupeKey(insert)
      );
      // `opportunities_open_cluster_uniq`: one open or queued non-Fix row
      // per cluster.
      const clusterClash =
        insert.family !== "fix" &&
        insert.cluster_key != null &&
        state.rows.some(
          (row) =>
            row.site_id === insert.site_id && row.family !== "fix" && row.cluster_key === insert.cluster_key &&
            (row.status === "open" || row.status === "queued")
        );
      if (clash || clusterClash) return { outcome: "duplicate" };

      const id = `opp-${String(state.nextId++).padStart(4, "0")}`;
      const row: OpportunityRow = {
        id,
        site_id: insert.site_id,
        scan_id: insert.scan_id,
        type: insert.type,
        family: insert.family,
        target_query: insert.target_query,
        target_ref: insert.target_ref,
        proposed_slug: insert.proposed_slug,
        title: insert.title,
        volume: insert.volume,
        // Round-tripped through JSON, exactly as `jsonb` would: a suite
        // that passed because a `Date` survived by reference would be
        // testing the fixture and not the reviver.
        evidence: JSON.parse(JSON.stringify(insert.evidence)) as unknown,
        acceptance: JSON.parse(JSON.stringify(insert.acceptance)) as unknown,
        fit_band: insert.fit_band,
        effort: insert.effort,
        // The readiness migration's defaults: nothing has clustered or
        // assessed a row at the moment it is written.
        cluster_key: insert.cluster_key ?? null,
        absorbed_queries: [...(insert.absorbed_queries ?? [])],
        ready: false,
        unready_reason: "not_assessed",
        status: "open",
        created_at: state.now.toISOString(),
      };
      state.rows.push(row);
      state.statusChangedAt.set(id, state.now);
      return { outcome: "created", row };
    },

    async openRankable(siteId) {
      return state.rows.filter(
        (row) => row.site_id === siteId && row.status === "open" && row.family !== "fix"
      );
    },

    async countUnused(siteId) {
      return state.rows.filter(
        (row) => row.site_id === siteId && row.status === "open" && row.family !== "fix" && row.ready
      ).length;
    },

    async clusterable(siteId) {
      return state.rows.filter(
        (row) => row.site_id === siteId && (row.status === "open" || row.status === "queued") && row.family !== "fix"
      );
    },

    async setCluster(opportunityId, clusterKey, absorbedQueries) {
      const row = state.rows.find((r) => r.id === opportunityId);
      if (row === undefined) return;
      const clash = state.rows.some(
        (r) => r.id !== opportunityId && r.site_id === row.site_id && r.cluster_key === clusterKey &&
          (r.status === "open" || r.status === "queued") && r.family !== "fix"
      );
      if (clash) throw new Error("memory store: opportunities_open_cluster_uniq");
      row.cluster_key = clusterKey;
      row.absorbed_queries = [...absorbedQueries];
    },

    async currentReport() {
      return state.report;
    },

    async hasGroundingFact() {
      return state.grounded;
    },

    async earnGrounding() {
      return state.earnGrounding;
    },

    async lastStatusChangeAt(siteId) {
      const dates = state.rows
        .filter((row) => row.site_id === siteId && row.family !== "fix")
        .map((row) => state.statusChangedAt.get(row.id))
        .filter((at): at is Date => at !== undefined)
        .sort((a, b) => b.getTime() - a.getTime());
      return dates[0] ?? null;
    },

    async latestCompletedScanAt() {
      return state.latestScanAt;
    },

    async byId(opportunityId) {
      return state.rows.find((row) => row.id === opportunityId) ?? null;
    },

    async profileForSite() {
      return state.profile;
    },

    async openFixPages(siteId) {
      return state.rows.filter(
        (row) => row.site_id === siteId && row.status === "open" && row.type === "fix_page"
      );
    },

    async setReadiness(opportunityId, reason) {
      const row = state.rows.find((r) => r.id === opportunityId);
      if (row === undefined) return;
      row.ready = reason === null;
      row.unready_reason = reason;
    },

    async notWorkingVerdicts() {
      return state.notWorking;
    },

    async markDone(opportunityId) {
      const row = state.rows.find((r) => r.id === opportunityId);
      if (row === undefined || row.status === "done") return;
      row.status = "done";
      state.statusChangedAt.set(row.id, state.now);
    },

    async markQueued(opportunityId) {
      const row = state.rows.find((r) => r.id === opportunityId);
      if (row === undefined || row.status !== "open") return;
      row.status = "queued";
      state.statusChangedAt.set(row.id, state.now);
    },

    async markDismissed(opportunityId) {
      const row = state.rows.find((r) => r.id === opportunityId);
      if (row === undefined || (row.status !== "open" && row.status !== "queued")) return;
      row.status = "dismissed";
      state.statusChangedAt.set(row.id, state.now);
    },

    async hostedHostFor() {
      return state.hostedHost;
    },

    async inventoryFor() {
      return state.inventory;
    },
  };
}

/** The status change the calendar makes when it queues a page, with the
 *  `status_changed_at` the trigger would write. */
export function setStatus(
  state: MemoryState,
  opportunityId: string,
  status: string,
  at: Date
): void {
  const row = state.rows.find((candidate) => candidate.id === opportunityId);
  if (row === undefined) throw new Error(`no such opportunity: ${opportunityId}`);
  if (row.status !== status) state.statusChangedAt.set(opportunityId, at);
  row.status = status;
}
