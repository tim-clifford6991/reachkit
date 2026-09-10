// src/lib/account/store.ts — BUILD §13
//
// Every row the payment path reads or writes, behind one interface, so the
// suites can supply a store instead of a database and so no file below
// holds a query of its own. The shape is `src/lib/mail/leads/store.ts`'s,
// deliberately: same three-answer discipline, same `dbAdmin()` cast at one
// boundary, same swap door for the tests.
//
// **Nothing here throws.** Every method says what it did or says it could
// not. A store that cannot be read is a different fact from a store that
// holds nothing, and collapsing the two is what opens a second account for
// somebody who already has one.
//
// This module reads two tables it does not own — `scans` (BP-012's) and
// `leads` (BP-029's) — by exactly one narrow column each, on the same
// footing `leads/store.ts` reads `scans.domain`: the read is a fact this
// path needs and no index can reach through a foreign key to supply.
import { dbAdmin } from "@/lib/db";
import { identityAuth } from "./identity/auth";

/** The four statuses a scan row can carry. `running` is the row's own
 *  `status`; `failed` is not a stored status in this schema (the column's
 *  check constraint admits three) and is included because the offer rule is
 *  written over four and a fourth may arrive. */
export type ScanStatus = "running" | "done" | "degraded" | "failed";

/** A `users` row, as this path reads it. Narrow on purpose: a column not
 *  named here cannot be read by accident, and every one below is a fact
 *  §13 or REQ-024 names. */
export interface AccountRow {
  readonly id: string;
  readonly email: string;
  readonly checkout_session_id: string | null;
  readonly first_signed_in_at: string | null;
  readonly sign_in_chased_at: string | null;
  readonly stripe_customer_id: string | null;
  readonly billing_country: string | null;
  readonly vat_number: string | null;
  readonly created_at: string;
}

/** What `recordCheckoutFacts` writes, and the whole of what it writes. */
export interface BillingFacts {
  readonly stripe_customer_id: string;
  readonly billing_country: string | null;
  readonly vat_number: string | null;
}

/** Which uniqueness refused an insert. Both are legal outcomes of a second
 *  delivery or a second purchase, never errors to retry. */
export type AccountConflict = "checkout_session_id" | "email";

export interface AccountStore {
  /** One scan's status and domain, or `null` where there is no such row. */
  scan(
    scanId: string
  ): Promise<{ ok: true; scan: { status: ScanStatus; domain: string } | null } | { ok: false }>;

  accountByCheckoutSession(
    sessionId: string
  ): Promise<{ ok: true; account: AccountRow | null } | { ok: false }>;

  /** Case-insensitive, matching the functional unique index — a mixed-case
   *  address must never resolve to a second person. */
  accountByEmail(email: string): Promise<{ ok: true; account: AccountRow | null } | { ok: false }>;

  /** Opens one account. `conflict` names which uniqueness refused it, so
   *  the caller takes the replay branch or the second-purchase branch
   *  rather than guessing from an error string. */
  insertAccount(a: {
    email: string;
    checkoutSessionId: string;
    facts: BillingFacts;
  }): Promise<{ ok: true; id: string } | { ok: false; conflict?: AccountConflict }>;

  /** The billing facts onto an existing account, keyed by its checkout
   *  session. Writes these three columns and no other. */
  writeBillingFacts(
    sessionId: string,
    facts: BillingFacts
  ): Promise<{ ok: true } | { ok: false }>;

  /** One site for one account. `conflict` is `sites_one_per_user` refusing
   *  a second — §13's "one site", and a legal replay outcome. */
  insertSite(a: {
    userId: string;
    domain: string | null;
    provisionedFromScanId: string | null;
  }): Promise<{ ok: true; id: string } | { ok: false; conflict?: boolean }>;

  siteForAccount(userId: string): Promise<{ ok: true; siteId: string | null } | { ok: false }>;

  /** Every account with a completed payment, nobody signed in and no chase
   *  sent, whose row is older than `before`. Indexed by
   *  `users_awaiting_sign_in_idx`. */
  accountsAwaitingSignIn(before: Date): Promise<{ ok: true; accounts: readonly AccountRow[] } | { ok: false }>;

  stampSignInChased(userId: string, at: Date): Promise<{ ok: true } | { ok: false }>;

  /** The lead conversion stamp. `leads` is BP-029's topic and this path
   *  writes no lead row of its own — it stamps the one column REQ-010
   *  criterion 10 names, through the seam that owns it. */
  stampLeadConverted(email: string, at: Date): Promise<{ ok: true; stamped: number } | { ok: false }>;
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
  ilike(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: null): MinimalQueryBuilder<T>;
  lte(column: string, value: string): MinimalQueryBuilder<T>;
  not(column: string, operator: string, value: null): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** The one cast boundary in this module.
 *
 *  `Database` in `src/lib/db/types.generated.ts` is generated against the
 *  baseline and the RLS policies alone — `tests/db/clients.test.ts`'s
 *  staleness row applies exactly those two files and diffs the result — so
 *  no column added by a later migration appears in it, this module's five
 *  included. The narrow builder below is what every other feature store
 *  does about that (`src/lib/mail/leads/store.ts`, `src/lib/scan/report.ts`),
 *  and the columns are held to the schema by
 *  `tests/account/columns.test.ts` instead. Widening the generated file to
 *  cover them fails that staleness row; it is not a fix. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const ACCOUNT_COLUMNS =
  "id, email, checkout_session_id, first_signed_in_at, sign_in_chased_at, " +
  "stripe_customer_id, billing_country, vat_number, created_at";

/** Postgres' unique-violation class. */
const UNIQUE_VIOLATION = "23505";

/** Maps a unique violation onto the constraint that raised it. The message
 *  carries the constraint name; matching on the name rather than on the
 *  column keeps the branch tied to the index that actually refused. */
function conflictOf(error: { message: string; code?: string }): AccountConflict | "id" | undefined {
  if (error.code !== UNIQUE_VIOLATION) return undefined;
  // #468: `users.id` is the address's `auth.users.id`, so a second row for
  // an address Supabase already knows collides here first.
  if (error.message.includes("users_pkey")) return "id";
  if (error.message.includes("users_checkout_session_id_key")) return "checkout_session_id";
  if (error.message.includes("users_email_lower_key") || error.message.includes("users_email_key")) {
    return "email";
  }
  return undefined;
}

export function supabaseAccountStore(): AccountStore {
  return {
    async scan(scanId) {
      const { data, error } = await untyped()
        .from<{ status: ScanStatus; domain: string }>("scans")
        .select("status, domain")
        .eq("id", scanId)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, scan: data?.[0] ?? null };
    },

    async accountByCheckoutSession(sessionId) {
      const { data, error } = await untyped()
        .from<AccountRow>("users")
        .select(ACCOUNT_COLUMNS)
        .eq("checkout_session_id", sessionId)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, account: data?.[0] ?? null };
    },

    async accountByEmail(email) {
      // `ilike` with no wildcard is an exact, case-insensitive match — the
      // read half of `users_email_lower_key`. A `%` would make an address
      // a prefix of another address's account.
      const { data, error } = await untyped()
        .from<AccountRow>("users")
        .select(ACCOUNT_COLUMNS)
        .ilike("email", email)
        .limit(1);
      if (error) return { ok: false };
      return { ok: true, account: data?.[0] ?? null };
    },

    async insertAccount(a) {
      // The account's `auth.users` row first (#468): `users.id` is its id,
      // and the foreign key refuses a `users` row Supabase does not know.
      // Created confirmed and mailed by nobody — the sign-in link is the
      // product's own mail. An address Supabase already knows answers with
      // that user's id, and the insert below then decides, as it always
      // has, whether this is a replay or a second purchase.
      const user = await identityAuth().ensureUser(a.email);
      if (!user.ok) return { ok: false };
      const { data, error } = await untyped()
        .from<{ id: string }>("users")
        .insert({
          id: user.userId,
          email: a.email,
          plan_status: "active",
          checkout_session_id: a.checkoutSessionId,
          stripe_customer_id: a.facts.stripe_customer_id,
          billing_country: a.facts.billing_country,
          vat_number: a.facts.vat_number,
        })
        .select("id");
      if (error) {
        const conflict = conflictOf(error);
        if (conflict === "id") {
          // The same person's row. Which of the two known cases it is, is
          // whether this payment is the one that row was opened by.
          const seen = await this.accountByCheckoutSession(a.checkoutSessionId);
          if (!seen.ok) return { ok: false };
          return { ok: false, conflict: seen.account === null ? "email" : "checkout_session_id" };
        }
        return conflict === undefined ? { ok: false } : { ok: false, conflict };
      }
      const row = data?.[0];
      return row === undefined ? { ok: false } : { ok: true, id: row.id };
    },

    async writeBillingFacts(sessionId, facts) {
      const { error } = await untyped()
        .from<AccountRow>("users")
        .update({
          stripe_customer_id: facts.stripe_customer_id,
          billing_country: facts.billing_country,
          vat_number: facts.vat_number,
        })
        .eq("checkout_session_id", sessionId);
      return error ? { ok: false } : { ok: true };
    },

    async insertSite(a) {
      const { data, error } = await untyped()
        .from<{ id: string }>("sites")
        .insert({
          user_id: a.userId,
          domain: a.domain,
          provisioned_from_scan_id: a.provisionedFromScanId,
        })
        .select("id");
      if (error) {
        return error.code === UNIQUE_VIOLATION ? { ok: false, conflict: true } : { ok: false };
      }
      const row = data?.[0];
      return row === undefined ? { ok: false } : { ok: true, id: row.id };
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

    async accountsAwaitingSignIn(before) {
      const { data, error } = await untyped()
        .from<AccountRow>("users")
        .select(ACCOUNT_COLUMNS)
        .not("checkout_session_id", "is", null)
        .is("first_signed_in_at", null)
        .is("sign_in_chased_at", null)
        .lte("created_at", before.toISOString());
      if (error) return { ok: false };
      return { ok: true, accounts: data ?? [] };
    },

    async stampSignInChased(userId, at) {
      const { error } = await untyped()
        .from<AccountRow>("users")
        .update({ sign_in_chased_at: at.toISOString() })
        .eq("id", userId);
      return error ? { ok: false } : { ok: true };
    },

    async stampLeadConverted(email, at) {
      const { data, error } = await untyped()
        .from<{ id: string }>("leads")
        .update({ converted_at: at.toISOString() })
        .ilike("email", email)
        .is("converted_at", null)
        .select("id");
      if (error) return { ok: false };
      return { ok: true, stamped: data?.length ?? 0 };
    },
  };
}

let store: AccountStore | null = null;

/** The store every entry point on the payment path reads. Lazily
 *  constructed, so importing this module does not construct a client. */
export function accountStore(): AccountStore {
  if (store === null) store = supabaseAccountStore();
  return store;
}

/** Swaps the store. The suites' one door in; `null` restores the real one. */
export function setAccountStore(next: AccountStore | null): void {
  store = next;
}
