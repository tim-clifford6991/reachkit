// src/lib/account/identity/store.ts — BUILD §13
//
// Every row identity reads or writes, behind one interface, so the suites
// can supply a store instead of a database and so no file beside this one
// holds a query. The shape is `src/lib/account/store.ts`'s, deliberately:
// same three-answer discipline, same `dbAdmin()` cast at one boundary,
// same swap door for the tests.
//
// **Nothing here throws.** Every method says what it did or says it could
// not. A store that cannot be read is a different fact from a store that
// holds nothing, and collapsing the two is what would tell a customer their
// link is dead when it is our database that is.
//
// **Every write that must not race is one statement.** `spendLink` is a
// conditional update — `where spent_at is null` — so two redemptions of one
// token cannot both win, whatever the caller does; `completeEmailChange` is
// one update of one row, so the address never moves without the pending
// columns clearing and the session stamp landing with it. That is what
// BP-061's "inside one transaction" is buying, and it is bought here by
// statement atomicity rather than by a `begin` this client cannot send.
// The one thing outside it — spending the account's *other* live links —
// follows the address change rather than preceding it, because a spare link
// that survives is a link to an address that no longer signs in, which
// redeems into nothing.
import { dbAdmin } from "@/lib/db";

/** BP-061 `## Public interface`. The two occasions a link exists for; the
 *  check constraint on `auth_links.purpose` is the same closed pair. */
export type LinkPurpose = "sign_in" | "email_change";

/** A `users` row, as identity reads it. Narrow on purpose: a column not
 *  named here cannot be read by accident. */
export interface IdentityAccountRow {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly pending_email: string | null;
  readonly pending_email_token_hash: string | null;
  readonly pending_email_sent_at: string | null;
  readonly sessions_valid_from: string | null;
  readonly first_signed_in_at: string | null;
  readonly deleted_at: string | null;
}

/** An `auth_links` row. Six columns, and the schema has no seventh. */
export interface AuthLinkRow {
  readonly token_hash: string;
  readonly user_id: string;
  readonly purpose: LinkPurpose;
  readonly sent_to: string;
  readonly expires_at: string;
  readonly spent_at: string | null;
}

export interface IdentityStore {
  account(userId: string): Promise<{ ok: true; account: IdentityAccountRow | null } | { ok: false }>;

  /** Whether **any** account holds this address, as its sign-in address or
   *  as a change it is waiting on — including a tombstoned one inside its
   *  30-day window (ADR-051 point 5: "the row is present but hidden"). Read
   *  through `dbAdmin()` for exactly that reason: an address that could
   *  still be restored to somebody is not free. */
  addressTaken(address: string): Promise<{ ok: true; taken: boolean } | { ok: false }>;

  link(tokenHash: string): Promise<{ ok: true; link: AuthLinkRow | null } | { ok: false }>;

  insertLink(a: {
    tokenHash: string;
    userId: string;
    purpose: LinkPurpose;
    sentTo: string;
    expiresAt: Date;
  }): Promise<{ ok: true } | { ok: false }>;

  /** Marks every unspent link for one `(user_id, purpose)` spent. The
   *  index `auth_links_one_live_idx` is what makes this a precondition of
   *  issuing rather than a tidy-up: without it the next insert is refused. */
  spendLive(userId: string, purpose: LinkPurpose, at: Date): Promise<{ ok: true } | { ok: false }>;

  /** Marks every unspent link for one user spent, whatever its purpose. */
  spendAll(userId: string, at: Date): Promise<{ ok: true } | { ok: false }>;

  /** The single-use gate, as one conditional statement. `spent: false`
   *  means somebody else got there first — never that the store failed. */
  spendLink(tokenHash: string, at: Date): Promise<{ ok: true; spent: boolean } | { ok: false }>;

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

  /** One statement: the address moves, the three pending columns clear and
   *  every session issued before `at` ends, or none of it happens. */
  completeChange(a: {
    userId: string;
    newEmail: string;
    at: Date;
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
  insert(rows: object): MinimalQueryBuilder<T>;
  update(patch: object): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  or(filter: string): MinimalQueryBuilder<T>;
  ilike(column: string, value: string): MinimalQueryBuilder<T>;
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
  "sessions_valid_from, first_signed_in_at, deleted_at";

const LINK_COLUMNS = "token_hash, user_id, purpose, sent_to, expires_at, spent_at";

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

    async link(tokenHash) {
      const { data, error } = await untyped()
        .from<AuthLinkRow>("auth_links")
        .select(LINK_COLUMNS)
        .eq("token_hash", tokenHash)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, link: data?.[0] ?? null };
    },

    async insertLink(a) {
      const { error } = await untyped()
        .from<AuthLinkRow>("auth_links")
        .insert({
          token_hash: a.tokenHash,
          user_id: a.userId,
          purpose: a.purpose,
          sent_to: a.sentTo,
          expires_at: a.expiresAt.toISOString(),
        });
      return error ? { ok: false } : { ok: true };
    },

    async spendLive(userId, purpose, at) {
      const { error } = await untyped()
        .from<AuthLinkRow>("auth_links")
        .update({ spent_at: at.toISOString() })
        .eq("user_id", userId)
        .eq("purpose", purpose)
        .is("spent_at", null);
      return error ? { ok: false } : { ok: true };
    },

    async spendAll(userId, at) {
      const { error } = await untyped()
        .from<AuthLinkRow>("auth_links")
        .update({ spent_at: at.toISOString() })
        .eq("user_id", userId)
        .is("spent_at", null);
      return error ? { ok: false } : { ok: true };
    },

    async spendLink(tokenHash, at) {
      const { data, error } = await untyped()
        .from<AuthLinkRow>("auth_links")
        .update({ spent_at: at.toISOString() })
        .eq("token_hash", tokenHash)
        .is("spent_at", null)
        .select("token_hash");
      if (error) return { ok: false };
      return { ok: true, spent: (data?.length ?? 0) > 0 };
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
          sessions_valid_from: a.at.toISOString(),
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
