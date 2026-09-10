// BUILD §4.7, §10, §14 — every row the two irreversible actions and the
// purge touch, behind one interface.
//
// The shape is `src/lib/account/store.ts`'s and `billing/store.ts`'s: three
// answers (`ok: false` for a store that could not be read, an empty list or
// a `null` for one that holds nothing), one `dbAdmin()` cast at one
// boundary, one swap door for the suites.
//
// **`dbAdmin()` throughout, and that is load-bearing rather than
// convenient** (ADR-051 point 3). Deletion stamps a tombstone, and every RLS
// policy in this schema carries `deleted_at is null` — so the moment
// `deleteAccount` has stamped it, the account's own rows are invisible to
// `db()`. The mail this path then composes, and the purge that comes thirty
// days later, would both find nothing at all through the request-scoped
// client. The admin client is the only way either reaches a tombstoned
// account, and that is precisely why unreachability is enforced by the row
// policy and never by a caller remembering to filter.
//
// **The purge is the only deleter.** `purgeStep` below is the one place in
// this product that issues a `DELETE` against a customer's rows; no foreign
// key in this schema carries a cascade that could do it by accident, and
// `tests/account/lifecycle/schema.test.ts` holds that true.
import { dbAdmin } from "@/lib/db";
import { identityAuth } from "../identity/auth";

/** The purge's last step: the account's Supabase Auth user (#468). Named
 *  as a table so `PURGE_ORDER` stays one list a reader can check. */
export const AUTH_USERS_TABLE = "auth.users";

export interface LifecycleSiteRow {
  readonly id: string;
  readonly user_id: string;
}

export interface LifecycleAccountRow {
  readonly id: string;
  readonly email: string;
  readonly deleted_at: string | null;
  readonly purge_due_at: string | null;
}

export interface DangerTicketRow {
  readonly ticket: string;
  readonly site_id: string;
  readonly action: string;
  readonly taken_at: string | null;
  readonly spent_at: string | null;
  readonly expires_at: string;
}

/** One page still live at a destination, as the take-down loop reads it. */
export interface LivePublicationRow {
  readonly draft_id: string;
  readonly destination: string;
  readonly live_url: string | null;
}

export interface DestinationIdRow {
  readonly id: string;
  readonly kind: string;
}

export type Ok = { ok: true } | { ok: false };

export interface PurgeScope {
  readonly siteIds: readonly string[];
  readonly scanIds: readonly string[];
  readonly draftIds: readonly string[];
  readonly publicationIds: readonly string[];
}

export interface LifecycleStore {
  site(siteId: string): Promise<{ ok: true; site: LifecycleSiteRow | null } | { ok: false }>;
  account(userId: string): Promise<{ ok: true; account: LifecycleAccountRow | null } | { ok: false }>;

  insertTicket(row: {
    ticket: string;
    siteId: string;
    action: string;
    expiresAt: Date;
  }): Promise<Ok>;
  ticket(ticket: string): Promise<{ ok: true; ticket: DangerTicketRow | null } | { ok: false }>;
  stampTicketTaken(ticket: string, at: Date): Promise<Ok>;
  stampTicketSpent(ticket: string, at: Date): Promise<Ok>;

  /** Every page of a site that is live at a destination right now:
   *  published, and not since taken down. */
  livePublications(
    siteId: string
  ): Promise<{ ok: true; publications: readonly LivePublicationRow[] } | { ok: false }>;

  /** The site's destination rows, so a still-live report can name the
   *  destination by its own id rather than by its kind. */
  destinations(
    siteId: string
  ): Promise<{ ok: true; destinations: readonly DestinationIdRow[] } | { ok: false }>;

  /** The tombstone and the promised date, written together. ADR-051: this
   *  writes two columns and issues no `DELETE` of any kind. */
  stampTombstone(userId: string, a: { deletedAt: Date; purgeDueAt: Date }): Promise<Ok>;

  /** Ends every session the account holds — Supabase Auth's
   *  `admin.signOut(token, "global")` with the asking session's own token
   *  (#468). */
  endSessions(userId: string, at: Date): Promise<Ok>;

  /** Tombstoned accounts whose promised date has arrived. */
  accountsDueForPurge(now: Date): Promise<{ ok: true; userIds: readonly string[] } | { ok: false }>;

  /** One delete, by one foreign key. `message` names what refused, so a
   *  purge that cannot remove a row is a fact rather than a silence. */
  purgeStep(a: {
    table: string;
    column: string;
    values: readonly string[];
  }): Promise<{ ok: true } | { ok: false; message: string }>;

  /** The ids a purge needs to reach the rows that hang off them. */
  purgeScope(userId: string): Promise<{ ok: true; scope: PurgeScope } | { ok: false }>;
}

// ── The Supabase implementation

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  insert(rows: object): MinimalQueryBuilder<T>;
  update(patch: object): MinimalQueryBuilder<T>;
  delete(): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
  is(column: string, value: null): MinimalQueryBuilder<T>;
  not(column: string, operator: string, value: null): MinimalQueryBuilder<T>;
  lte(column: string, value: string): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** The one cast boundary in this module, for the reason
 *  `src/lib/publish/db.ts` and `billing/store.ts` record at theirs: no
 *  column a later migration added appears in the generated `Database` type.
 *  The schema holds these columns to their shape instead
 *  (`tests/account/lifecycle/schema.test.ts`). */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

export function supabaseLifecycleStore(): LifecycleStore {
  return {
    async site(siteId) {
      const { data, error } = await untyped()
        .from<LifecycleSiteRow>("sites")
        .select("id, user_id")
        .eq("id", siteId)
        .limit(1);
      if (error !== null || data === null) return { ok: false };
      return { ok: true, site: data[0] ?? null };
    },

    async account(userId) {
      const { data, error } = await untyped()
        .from<LifecycleAccountRow>("users")
        .select("id, email, deleted_at, purge_due_at")
        .eq("id", userId)
        .limit(1);
      if (error !== null || data === null) return { ok: false };
      return { ok: true, account: data[0] ?? null };
    },

    async insertTicket(row) {
      const { error } = await untyped()
        .from<DangerTicketRow>("danger_tickets")
        .insert({
          ticket: row.ticket,
          site_id: row.siteId,
          action: row.action,
          expires_at: row.expiresAt.toISOString(),
        });
      return error === null ? { ok: true } : { ok: false };
    },

    async ticket(ticket) {
      const { data, error } = await untyped()
        .from<DangerTicketRow>("danger_tickets")
        .select("ticket, site_id, action, taken_at, spent_at, expires_at")
        .eq("ticket", ticket)
        .limit(1);
      if (error !== null || data === null) return { ok: false };
      return { ok: true, ticket: data[0] ?? null };
    },

    async stampTicketTaken(ticket, at) {
      const { error } = await untyped()
        .from<DangerTicketRow>("danger_tickets")
        .update({ taken_at: at.toISOString() })
        .eq("ticket", ticket)
        // Idempotent: a second call after a complete response finds no row
        // with a null stamp and changes nothing, so the moment recorded is
        // the first one.
        .is("taken_at", null);
      return error === null ? { ok: true } : { ok: false };
    },

    async stampTicketSpent(ticket, at) {
      const { error } = await untyped()
        .from<DangerTicketRow>("danger_tickets")
        .update({ spent_at: at.toISOString() })
        .eq("ticket", ticket)
        .is("spent_at", null);
      return error === null ? { ok: true } : { ok: false };
    },

    async livePublications(siteId) {
      const { data, error } = await untyped()
        .from<LivePublicationRow>("publications")
        .select("draft_id, destination, live_url, published_at, unpublished_at")
        .eq("site_id", siteId)
        .not("published_at", "is", null)
        .is("unpublished_at", null);
      if (error !== null || data === null) return { ok: false };
      return { ok: true, publications: data };
    },

    async destinations(siteId) {
      const { data, error } = await untyped()
        .from<DestinationIdRow>("destinations")
        .select("id, kind")
        .eq("site_id", siteId);
      if (error !== null || data === null) return { ok: false };
      return { ok: true, destinations: data };
    },

    async stampTombstone(userId, a) {
      const { error } = await untyped()
        .from<LifecycleAccountRow>("users")
        .update({
          deleted_at: a.deletedAt.toISOString(),
          purge_due_at: a.purgeDueAt.toISOString(),
        })
        .eq("id", userId)
        // Stamped once. A second deletion of the same account does not move
        // a date already promised.
        .is("deleted_at", null);
      return error === null ? { ok: true } : { ok: false };
    },

    async endSessions(userId) {
      // Imported at the call: it reaches `next/headers`, which only a
      // request has, and this store is also the purge job's.
      const { signOutEverywhere } = await import("../identity/session");
      const ended = await signOutEverywhere(userId);
      return ended.ok ? { ok: true } : { ok: false };
    },

    async accountsDueForPurge(now) {
      const { data, error } = await untyped()
        .from<{ id: string }>("users")
        .select("id, deleted_at, purge_due_at")
        .not("deleted_at", "is", null)
        .not("purge_due_at", "is", null)
        .lte("purge_due_at", now.toISOString());
      if (error !== null || data === null) return { ok: false };
      return { ok: true, userIds: data.map((row) => row.id) };
    },

    async purgeStep(a) {
      if (a.values.length === 0) return { ok: true };
      // The account's `auth.users` row (#468): not a table this client can
      // reach, so it goes through the admin API, one user at a time. A user
      // already gone is done, which keeps the purge resumable.
      if (a.table === AUTH_USERS_TABLE) {
        for (const id of a.values) {
          const gone = await identityAuth().deleteUser(id);
          if (!gone.ok) return { ok: false, message: "the auth user could not be deleted" };
        }
        return { ok: true };
      }
      const { error } = await untyped()
        .from<{ id: string }>(a.table)
        .delete()
        .in(a.column, a.values);
      return error === null ? { ok: true } : { ok: false, message: error.message };
    },

    async purgeScope(userId) {
      const sites = await untyped()
        .from<{ id: string }>("sites")
        .select("id")
        .eq("user_id", userId);
      if (sites.error !== null || sites.data === null) return { ok: false };
      const siteIds = sites.data.map((row) => row.id);
      if (siteIds.length === 0) {
        return { ok: true, scope: { siteIds, scanIds: [], draftIds: [], publicationIds: [] } };
      }

      const scans = await untyped().from<{ id: string }>("scans").select("id").in("site_id", siteIds);
      if (scans.error !== null || scans.data === null) return { ok: false };
      const drafts = await untyped().from<{ id: string }>("drafts").select("id").in("site_id", siteIds);
      if (drafts.error !== null || drafts.data === null) return { ok: false };
      const publications = await untyped()
        .from<{ id: string }>("publications")
        .select("id")
        .in("site_id", siteIds);
      if (publications.error !== null || publications.data === null) return { ok: false };

      return {
        ok: true,
        scope: {
          siteIds,
          scanIds: scans.data.map((row) => row.id),
          draftIds: drafts.data.map((row) => row.id),
          publicationIds: publications.data.map((row) => row.id),
        },
      };
    },
  };
}

let store: LifecycleStore | null = null;

export function lifecycleStore(): LifecycleStore {
  store ??= supabaseLifecycleStore();
  return store;
}

/** The suites' door. `null` restores the Supabase store. */
export function setLifecycleStore(next: LifecycleStore | null): void {
  store = next;
}
