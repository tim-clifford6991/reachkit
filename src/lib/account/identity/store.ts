// src/lib/account/identity/store.ts — BUILD §13
//
// Every `public` row identity reads or writes, behind one interface, so the
// suites can supply a store instead of a database and so no file beside
// this one holds a query. The shape is `src/lib/account/store.ts`'s,
// deliberately: same three-answer discipline, same `dbAdmin()` cast at one
// boundary, same swap door for the tests.
//
// **No link and no session lives here any more** (#468). Supabase Auth
// holds both (`./auth.ts`); what is left is the account row itself — the
// address, the pending change beside it, the first-sign-in stamp — and the
// account's one site.
//
// **Nothing here throws.** Every method says what it did or says it could
// not. A store that cannot be read is a different fact from a store that
// holds nothing, and collapsing the two is what would tell a customer their
// link is dead when it is our database that is.
//
// **Every write that must not race is one statement.** `completeChange` is
// one update of one row, so the address never moves without the pending
// columns clearing with it.
import { dbAdmin } from "@/lib/db";

/** The two occasions a link exists for. */
export type LinkPurpose = "sign_in" | "email_change";

/** A `users` row, as identity reads it. Narrow on purpose: a column not
 *  named here cannot be read by accident. */
export interface IdentityAccountRow {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly pending_email: string | null;
  /** Supabase's `hashed_token` for the pending change's link (#468) — the
   *  hash Supabase verifies, never a token of ours. Which link the change
   *  is waiting on: a replaced or cancelled change no longer matches it. */
  readonly pending_email_token_hash: string | null;
  readonly pending_email_sent_at: string | null;
  readonly first_signed_in_at: string | null;
  readonly deleted_at: string | null;
}

export interface IdentityStore {
  account(userId: string): Promise<{ ok: true; account: IdentityAccountRow | null } | { ok: false }>;

  /** The account whose pending change is waiting on this token hash, or
   *  `null` — cancelled, replaced by a newer request, or never ours. */
  accountByPendingHash(
    tokenHash: string
  ): Promise<{ ok: true; account: IdentityAccountRow | null } | { ok: false }>;

  /** Whether **any** account holds this address, as its sign-in address or
   *  as a change it is waiting on — including a tombstoned one inside its
   *  30-day window (ADR-051 point 5: "the row is present but hidden"). Read
   *  through `dbAdmin()` for exactly that reason: an address that could
   *  still be restored to somebody is not free. */
  addressTaken(address: string): Promise<{ ok: true; taken: boolean } | { ok: false }>;

  /** REQ-024 c5's column: stamped on the first successful redemption and
   *  never re-stamped, which is what the 15-minute chase reads. `stamped`
   *  answers "was this the first time anybody signed in to this account?" —
   *  the fact REQ-024 c4 routes on, read from the write itself rather than
   *  from a second query that could disagree with it. */
  stampFirstSignedIn(
    userId: string,
    at: Date
  ): Promise<{ ok: true; stamped: boolean } | { ok: false }>;

  /** The three pending columns and nothing else — `users.email` is not in
   *  this statement (REQ-077 c2). `conflict` is
   *  `users_pending_email_lower_key` refusing a second customer the same
   *  pending address. */
  writePending(a: {
    userId: string;
    pendingEmail: string;
    tokenHash: string;
    sentAt: Date;
  }): Promise<{ ok: true } | { ok: false; conflict?: true }>;

  clearPending(userId: string): Promise<{ ok: true } | { ok: false }>;

  /** One statement: the address moves and the three pending columns clear,
   *  or none of it happens. Supabase has already moved `auth.users.email`
   *  by the time this runs; this is the mirror. */
  completeChange(a: {
    userId: string;
    newEmail: string;
  }): Promise<{ ok: true } | { ok: false; conflict?: true }>;

  siteForAccount(userId: string): Promise<{ ok: true; siteId: string | null } | { ok: false }>;
}

// ── The Supabase implementation

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  update(patch: object): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  or(filter: string): MinimalQueryBuilder<T>;
  is(column: string, value: null): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** The one cast boundary in this module, on exactly the footing
 *  `src/lib/account/store.ts` states for its own: `Database` in
 *  `src/lib/db/types.generated.ts` is generated against the baseline and
 *  the RLS policies alone, so no column this directory's migrations add
 *  appears in it. `tests/account/columns.test.ts` holds the columns to the
 *  schema instead. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const ACCOUNT_COLUMNS =
  "id, email, name, pending_email, pending_email_token_hash, pending_email_sent_at, " +
  "first_signed_in_at, deleted_at";

/** Postgres' unique-violation class. */
const UNIQUE_VIOLATION = "23505";

export function supabaseIdentityStore(): IdentityStore {
  return {
    async account(userId) {
      const { data, error } = await untyped()
        .from<IdentityAccountRow>("users")
        .select(ACCOUNT_COLUMNS)
        .eq("id", userId)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, account: data?.[0] ?? null };
    },

    async accountByPendingHash(tokenHash) {
      const { data, error } = await untyped()
        .from<IdentityAccountRow>("users")
        .select(ACCOUNT_COLUMNS)
        .eq("pending_email_token_hash", tokenHash)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, account: data?.[0] ?? null };
    },

    async addressTaken(address) {
      // Both columns in one read, which is what makes two customers unable
      // to race onto one address through different columns — the partial
      // unique index only closes the pending-against-pending case.
      // `ilike` with no wildcard is an exact, case-insensitive match; a `%`
      // would make one address a prefix of another's.
      const { data, error } = await untyped()
        .from<{ id: string }>("users")
        .select("id")
        .or(`email.ilike.${address},pending_email.ilike.${address}`)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, taken: (data?.length ?? 0) > 0 };
    },

    async stampFirstSignedIn(userId, at) {
      const { data, error } = await untyped()
        .from<IdentityAccountRow>("users")
        .update({ first_signed_in_at: at.toISOString() })
        .eq("id", userId)
        .is("first_signed_in_at", null)
        .select("id");
      if (error) return { ok: false };
      return { ok: true, stamped: (data?.length ?? 0) > 0 };
    },

    async writePending(a) {
      const { error } = await untyped()
        .from<IdentityAccountRow>("users")
        .update({
          pending_email: a.pendingEmail,
          pending_email_token_hash: a.tokenHash,
          pending_email_sent_at: a.sentAt.toISOString(),
        })
        .eq("id", a.userId);
      if (error) {
        return error.code === UNIQUE_VIOLATION ? { ok: false, conflict: true } : { ok: false };
      }
      return { ok: true };
    },

    async clearPending(userId) {
      const { error } = await untyped()
        .from<IdentityAccountRow>("users")
        .update({
          pending_email: null,
          pending_email_token_hash: null,
          pending_email_sent_at: null,
        })
        .eq("id", userId);
      return error ? { ok: false } : { ok: true };
    },

    async completeChange(a) {
      const { error } = await untyped()
        .from<IdentityAccountRow>("users")
        .update({
          email: a.newEmail,
          pending_email: null,
          pending_email_token_hash: null,
          pending_email_sent_at: null,
        })
        .eq("id", a.userId);
      if (error) {
        return error.code === UNIQUE_VIOLATION ? { ok: false, conflict: true } : { ok: false };
      }
      return { ok: true };
    },

    async siteForAccount(userId) {
      const { data, error } = await untyped()
        .from<{ id: string }>("sites")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, siteId: data?.[0]?.id ?? null };
    },
  };
}

let store: IdentityStore | null = null;

/** The store every entry point in this directory reads. Lazily
 *  constructed, so importing this module does not construct a client. */
export function identityStore(): IdentityStore {
  if (store === null) store = supabaseIdentityStore();
  return store;
}

/** Swaps the store. The suites' one door in; `null` restores the real one. */
export function setIdentityStore(next: IdentityStore | null): void {
  store = next;
}
