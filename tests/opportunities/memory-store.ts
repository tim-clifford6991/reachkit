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

export interface MemoryState {
  rows: OpportunityRow[];
  statusChangedAt: Map<string, Date>;
  profile: Profile | null;
  latestScanAt: Date | null;
  now: Date;
  nextId: number;
}

export function newMemoryState(over: Partial<MemoryState> = {}): MemoryState {
  return {
    rows: [],
    statusChangedAt: new Map(),
    profile: null,
    latestScanAt: null,
    now: new Date("2026-09-06T09:00:00.000Z"),
    nextId: 1,
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
      if (clash) return { outcome: "duplicate" };

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
        (row) => row.site_id === siteId && row.status === "open" && row.family !== "fix"
      ).length;
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
