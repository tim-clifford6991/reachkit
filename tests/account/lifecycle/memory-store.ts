// tests/account/lifecycle/memory-store.ts
//
// A store instead of a database, in the shape the billing and export suites
// use. It records every write it is asked to make, so a test can assert not
// only what changed but that **nothing else did** — which is what makes
// "nothing is destroyed before it is handed back" a test rather than a
// claim.
import type {
  DangerTicketRow,
  DestinationIdRow,
  LifecycleAccountRow,
  LifecycleSiteRow,
  LifecycleStore,
  LivePublicationRow,
} from "@/lib/account/lifecycle";

export interface MemoryLifecycle {
  sites: LifecycleSiteRow[];
  accounts: LifecycleAccountRow[];
  /** The accounts `endSessions` ended every session of (#468). */
  signedOutEverywhere: string[];
  tickets: DangerTicketRow[];
  publications: LivePublicationRow[];
  destinations: DestinationIdRow[];
  /** Every table a purge asked to delete from, in the order it asked. */
  deleted: { table: string; column: string; values: readonly string[] }[];
  /** Every write this store was asked to make, by name. A begin that
   *  changes anything but the ticket shows up here. */
  writes: string[];
  unreadable: boolean;
  refuseDelete: string | null;
}

export function newMemoryLifecycle(): MemoryLifecycle {
  return {
    sites: [],
    accounts: [],
    tickets: [],
    publications: [],
    destinations: [],
    deleted: [],
    writes: [],
    signedOutEverywhere: [],
    unreadable: false,
    refuseDelete: null,
  };
}

export function memoryLifecycleStore(state: MemoryLifecycle): LifecycleStore {
  const refuse = <T,>(value: T): T | { ok: false } => (state.unreadable ? { ok: false } : value);

  return {
    async site(siteId) {
      return refuse({ ok: true as const, site: state.sites.find((row) => row.id === siteId) ?? null });
    },
    async account(userId) {
      return refuse({
        ok: true as const,
        account: state.accounts.find((row) => row.id === userId) ?? null,
      });
    },
    async insertTicket(row) {
      state.writes.push("insertTicket");
      state.tickets.push({
        ticket: row.ticket,
        site_id: row.siteId,
        action: row.action,
        taken_at: null,
        spent_at: null,
        expires_at: row.expiresAt.toISOString(),
      });
      return { ok: true };
    },
    async ticket(ticket) {
      return refuse({
        ok: true as const,
        ticket: state.tickets.find((row) => row.ticket === ticket) ?? null,
      });
    },
    async stampTicketTaken(ticket, at) {
      state.writes.push("stampTicketTaken");
      const row = state.tickets.find((entry) => entry.ticket === ticket);
      if (row !== undefined && row.taken_at === null) {
        state.tickets = state.tickets.map((entry) =>
          entry.ticket === ticket ? { ...entry, taken_at: at.toISOString() } : entry
        );
      }
      return { ok: true };
    },
    async stampTicketSpent(ticket, at) {
      state.writes.push("stampTicketSpent");
      state.tickets = state.tickets.map((entry) =>
        entry.ticket === ticket && entry.spent_at === null
          ? { ...entry, spent_at: at.toISOString() }
          : entry
      );
      return { ok: true };
    },
    async livePublications() {
      return refuse({ ok: true as const, publications: [...state.publications] });
    },
    async destinations() {
      return refuse({ ok: true as const, destinations: [...state.destinations] });
    },
    async stampTombstone(userId, a) {
      state.writes.push("stampTombstone");
      state.accounts = state.accounts.map((row) =>
        row.id === userId && row.deleted_at === null
          ? {
              ...row,
              deleted_at: a.deletedAt.toISOString(),
              purge_due_at: a.purgeDueAt.toISOString(),
            }
          : row
      );
      return { ok: true };
    },
    async endSessions(userId) {
      // #468: Supabase Auth's `admin.signOut(token, "global")` — recorded
      // as the call it is, since no `users` column carries it any more.
      state.writes.push("endSessions");
      state.signedOutEverywhere.push(userId);
      return { ok: true };
    },
    async accountsDueForPurge(now) {
      if (state.unreadable) return { ok: false };
      return {
        ok: true,
        userIds: state.accounts
          .filter(
            (row) =>
              row.deleted_at !== null &&
              row.purge_due_at !== null &&
              new Date(row.purge_due_at).getTime() <= now.getTime()
          )
          .map((row) => row.id),
      };
    },
    async purgeStep(a) {
      if (a.values.length === 0) return { ok: true };
      if (state.refuseDelete === a.table) {
        return { ok: false, message: `${a.table} refused the delete` };
      }
      state.deleted.push({ table: a.table, column: a.column, values: a.values });
      if (a.table === "users") state.accounts = state.accounts.filter((row) => !a.values.includes(row.id));
      if (a.table === "sites") state.sites = state.sites.filter((row) => !a.values.includes(row.user_id));
      return { ok: true };
    },
    async purgeScope(userId) {
      if (state.unreadable) return { ok: false };
      const siteIds = state.sites.filter((row) => row.user_id === userId).map((row) => row.id);
      return {
        ok: true,
        scope: {
          siteIds,
          scanIds: siteIds.length === 0 ? [] : ["scan-1"],
          draftIds: siteIds.length === 0 ? [] : ["draft-1"],
          publicationIds: siteIds.length === 0 ? [] : ["pub-1"],
        },
      };
    },
  };
}

export function account(
  a: Partial<LifecycleAccountRow> & { id: string }
): LifecycleAccountRow {
  return {
    id: a.id,
    email: a.email ?? `${a.id}@example.com`,
    deleted_at: a.deleted_at ?? null,
    purge_due_at: a.purge_due_at ?? null,
  };
}
