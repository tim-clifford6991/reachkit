// tests/mail/leads/memory-store.ts — the store the leads suites drive.
//
// `tests/setup.ts` refuses a real network call and the `node` project has
// no database, so the feature's one database seam (`LeadStore`) is filled
// with an in-memory implementation instead of mocking a query builder.
//
// **It mirrors the partial unique index on purpose.**
// `unique (lower(email), domain) where sequence_state is not null` is
// REQ-010 criterion 13's whole enforcement (ADR-041), so a fake that did
// not hold it would let these suites pass on behaviour Postgres rejects.
// `patchLead` reports a violation the same way the real store does —
// `{ ok: false, conflict: true }` — and `migration.test.ts` asserts the
// real index's predicate against the migration on disk, so the mirror and
// the schema cannot drift apart unnoticed.
import type {
  FirstPageState,
  LeadPatch,
  LeadRow,
  LeadStore,
  ScanFirstPage,
  SequenceState,
  SuppressionCause,
} from "../../../src/lib/mail/leads/store";

export interface MemoryState {
  leads: LeadRow[];
  suppressions: Map<string, SuppressionCause>;
  scans: Map<string, string>;
  reports: Map<string, unknown>;
  /** The scans' stored free pages (issue 826); absent reads as unclaimed. */
  firstPages: Map<string, ScanFirstPage>;
  failFirstPageRead: boolean;
  failInsert: boolean;
  failScanRead: boolean;
  failLeadRead: boolean;
  failSuppressionRead: boolean;
  failSuppressionWrite: boolean;
  failReportRead: boolean;
  nextId: number;
}

export function newMemoryState(): MemoryState {
  return {
    leads: [],
    suppressions: new Map(),
    scans: new Map(),
    reports: new Map(),
    firstPages: new Map(),
    failFirstPageRead: false,
    failInsert: false,
    failScanRead: false,
    failLeadRead: false,
    failSuppressionRead: false,
    failSuppressionWrite: false,
    failReportRead: false,
    nextId: 1,
  };
}

export function blankLead(
  a: Partial<LeadRow> & { id: string; email: string; domain: string }
): LeadRow {
  return {
    scan_id: "scan-1",
    converted_at: null,
    sequence_state: null,
    sequence_started_at: null,
    next_touch_at: null,
    touch_count: 0,
    dropped_at: null,
    page_delivered_at: null,
    first_page_state: "pending",
    first_page_first_attempt_at: null,
    first_page_attempts: 0,
    first_page_failure: null,
    first_page_title: null,
    first_page_markdown: null,
    ...a,
  };
}

/** The index predicate, written once: a row participates only while its
 *  `sequence_state` is not null. */
function sequenceKey(lead: { email: string; domain: string }): string {
  return `${lead.email.toLowerCase()} ${lead.domain}`;
}

export function memoryStore(state: MemoryState): LeadStore {
  const find = (id: string): LeadRow | undefined => state.leads.find((lead) => lead.id === id);

  return {
    async insertLead(a) {
      if (state.failInsert) return { ok: false };
      const id = `lead-${state.nextId++}`;
      state.leads.push(blankLead({ id, scan_id: a.scanId, email: a.email, domain: a.domain }));
      return { ok: true, id };
    },

    async readLead(id) {
      if (state.failLeadRead) return { ok: false };
      return { ok: true, lead: find(id) ?? null };
    },

    async patchLead(id: string, patch: LeadPatch) {
      const lead = find(id);
      if (lead === undefined) return { ok: false, conflict: false };

      const next = { ...lead, ...patch } as LeadRow;

      // The partial unique index. Only a row whose `sequence_state` is not
      // null participates, which is exactly why a second `leads` row for a
      // domain an address already has a sequence for may exist at all.
      if (next.sequence_state !== null) {
        const clash = state.leads.some(
          (other) =>
            other.id !== id &&
            other.sequence_state !== null &&
            sequenceKey(other) === sequenceKey(next)
        );
        if (clash) return { ok: false, conflict: true };
      }

      state.leads = state.leads.map((row) => (row.id === id ? next : row));
      return { ok: true };
    },

    async leadsInSequenceState(states: readonly (SequenceState | null)[]) {
      if (state.failLeadRead) return { ok: false };
      return { ok: true, leads: state.leads.filter((lead) => states.includes(lead.sequence_state)) };
    },

    async leadsInFirstPageState(states: readonly FirstPageState[]) {
      if (state.failLeadRead) return { ok: false };
      return {
        ok: true,
        leads: state.leads.filter((lead) => states.includes(lead.first_page_state)),
      };
    },

    async leadsForAddress(email) {
      if (state.failLeadRead) return { ok: false };
      const address = email.toLowerCase();
      return { ok: true, leads: state.leads.filter((lead) => lead.email.toLowerCase() === address) };
    },

    async isSuppressed(email) {
      if (state.failSuppressionRead) return { ok: false };
      return { ok: true, suppressed: state.suppressions.has(email.toLowerCase()) };
    },

    async addSuppression(email, cause) {
      if (state.failSuppressionWrite) return { ok: false };
      // Idempotent on the primary key: a second click writes nothing.
      const address = email.toLowerCase();
      if (!state.suppressions.has(address)) state.suppressions.set(address, cause);
      return { ok: true };
    },

    async scanDomain(scanId) {
      if (state.failScanRead) return { ok: false };
      return { ok: true, domain: state.scans.get(scanId) ?? null };
    },

    async scanReport(scanId) {
      if (state.failReportRead) return { ok: false };
      return { ok: true, report: state.reports.get(scanId) ?? null };
    },

    async scanFirstPage(scanId) {
      if (state.failFirstPageRead) return { ok: false };
      return { ok: true, page: state.firstPages.get(scanId) ?? null };
    },

    // The conditional update, mirrored: only an unclaimed scan, or one whose
    // writer's claim went stale, is taken.
    async claimScanFirstPage(scanId, now, staleBefore) {
      const held = state.firstPages.get(scanId);
      const free =
        held === undefined || (held.state === "writing" && held.claimedAt.getTime() < staleBefore.getTime());
      if (!free) return { ok: true, claimed: false };
      state.firstPages.set(scanId, { state: "writing", claimedAt: now });
      return { ok: true, claimed: true };
    },

    async settleScanFirstPage(scanId, settlement) {
      if (settlement.state === "released") state.firstPages.delete(scanId);
      else state.firstPages.set(scanId, settlement);
      return { ok: true };
    },
  };
}
