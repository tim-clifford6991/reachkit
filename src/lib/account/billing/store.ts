// src/lib/account/billing/store.ts — BUILD §13
//
// Every row this module reads or writes, behind one interface, so the
// suites can supply a store instead of a database and so no file below
// holds a query of its own. The shape is `src/lib/account/store.ts`'s and
// `src/lib/mail/leads/store.ts`'s, deliberately: same three-answer
// discipline, same `dbAdmin()` cast at one boundary, same swap door.
//
// **Nothing here throws.** Every method says what it did or says it could
// not. A store that cannot be read is a different fact from a store that
// holds nothing, and the two failure directions this module needs —
// `hostedServingState` fails *closed* on deletion and *open* on retention —
// are only expressible if "we could not tell" survives as its own answer.
//
// It reads through `dbAdmin()` throughout. A tombstoned row is hidden from
// `db()` by BP-002's policy (ADR-051 point 3), and the one question this
// module must still answer about a deleted account is whether to keep
// serving its pages — a question a policy that hid the row would answer
// wrong by hiding it.
import { dbAdmin } from "@/lib/db";

/** The `users` row, as billing reads it. Narrow on purpose: a column not
 *  named here cannot be read by accident. `plan_status` is on the list
 *  because §4.7's card may state what Stripe last said — and for no other
 *  reason. **No gate reads it** (ADR-050). */
export interface BillingRow {
  readonly id: string;
  readonly email: string;
  readonly plan_status: string;
  readonly stripe_customer_id: string | null;
  readonly stripe_subscription_id: string | null;
  readonly paid_through: string;
  readonly cancelled_at: string | null;
  readonly last_subscription_event_id: string | null;
  readonly deleted_at: string | null;
}

/** What a subscription event writes. Every member is a value the vendor
 *  reported; nothing here is derived from another member. */
export interface SubscriptionFacts {
  readonly stripe_subscription_id: string;
  readonly paid_through: Date;
  readonly plan_status: string;
  /** The vendor event this write came from, or `null` where it came from
   *  something that is not an event (a resume the customer asked for). The
   *  column records the last *event* applied, so a write with no event id
   *  leaves whatever is there alone. */
  readonly eventId: string | null;
}

/** One site, as the hosted-retention clock reads it, with the one column of
 *  its owner that decides whether the window ever begins. */
export interface HostingRow {
  readonly id: string;
  readonly user_id: string;
  readonly hosted_serving_ends_at: string | null;
  readonly hosting_end_notice_at: string | null;
  readonly hosting_end_reminder_at: string | null;
  /** The site's own stated zone, or `null` where the customer has stated
   *  none (REQ-073 c1 forbids one they did not state). Every day this
   *  module tells a customer about is expressed in it. */
  readonly timezone: string | null;
  readonly owner_deleted_at: string | null;
  readonly owner_email: string;
  readonly owner_paid_through: string;
  /** Whether this site has a hosted destination — the `destinations` row of
   *  kind `hosted` (§10). Everything in this module about the end of
   *  hosting is about sites that have one: a customer publishing only to
   *  their own WordPress has no hosted page to lose, no day to be told and
   *  nothing for the stop to stop. */
  readonly hasHostedPages: boolean;
}

/** Which of the two notices REQ-076 c11 requires. Two names, never a
 *  count: which one is missing is what an operator needs to know. */
export type HostingNotice = "access_ended" | "seven_days";

export interface BillingStore {
  /** The one read the access gate makes: a site's owner's paid-through
   *  date. `null` where there is no such site. */
  paidThroughForSite(siteId: string): Promise<{ ok: true; paidThrough: Date | null } | { ok: false }>;

  account(userId: string): Promise<{ ok: true; account: BillingRow | null } | { ok: false }>;

  accountBySubscription(
    subscriptionId: string
  ): Promise<{ ok: true; account: BillingRow | null } | { ok: false }>;

  accountByStripeCustomer(
    customerId: string
  ): Promise<{ ok: true; account: BillingRow | null } | { ok: false }>;

  /** The subscription facts onto one account. Writes exactly the four
   *  columns `SubscriptionFacts` names and no other. */
  writeSubscriptionFacts(
    userId: string,
    facts: SubscriptionFacts
  ): Promise<{ ok: true } | { ok: false }>;

  /** Stamps or clears the cancellation. `at` of `null` clears it — resume
   *  and cancellation are one column written two ways, never two columns
   *  that could disagree about whether a plan is running. */
  stampCancelled(userId: string, at: Date | null): Promise<{ ok: true } | { ok: false }>;

  /** One site's hosting row. `null` where there is no such site. */
  hosting(siteId: string): Promise<{ ok: true; site: HostingRow | null } | { ok: false }>;

  /** Every site owned by one account. Resume clears the retention clock on
   *  all of them; cancellation reads them to answer "have you any hosted
   *  pages at all". */
  hostingForAccount(userId: string): Promise<{ ok: true; sites: readonly HostingRow[] } | { ok: false }>;

  /** Sites whose owner's access has ended and whose retention window has
   *  not been stamped yet — the moment REQ-076 c11's first notice falls
   *  due, and the moment `hosted_serving_ends_at` is set. */
  sitesWithEndedAccess(now: Date): Promise<{ ok: true; sites: readonly HostingRow[] } | { ok: false }>;

  /** Sites whose serving stops on or before `before` — the reminder's
   *  window, and, at `now`, the stop's own queue. */
  sitesServingEndingBy(before: Date): Promise<{ ok: true; sites: readonly HostingRow[] } | { ok: false }>;

  /** The retention window, stamped when access ends and cleared on resume
   *  (`at` of `null`). Clearing also clears both notice stamps: a customer
   *  who came back was never told a day, so there is no notice to have
   *  sent. */
  stampHostedServingEndsAt(siteId: string, at: Date | null): Promise<{ ok: true } | { ok: false }>;

  /** One notice's stamp. Written only after the mail seam reports a send
   *  (BP-060 decision 3). */
  stampHostingNotice(
    siteId: string,
    which: HostingNotice,
    at: Date
  ): Promise<{ ok: true } | { ok: false }>;
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
  is(column: string, value: null): MinimalQueryBuilder<T>;
  not(column: string, operator: string, value: null): MinimalQueryBuilder<T>;
  lte(column: string, value: string): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** The one cast boundary in this module, for the reason
 *  `src/lib/account/store.ts` records at its own: `Database` in
 *  `src/lib/db/types.generated.ts` is generated against the baseline and the
 *  RLS policies alone, so no column added by a later migration appears in
 *  it — this module's seven included. The columns are held to the schema by
 *  `tests/account/billing/schema.test.ts` instead. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const BILLING_COLUMNS =
  "id, email, plan_status, stripe_customer_id, stripe_subscription_id, " +
  "paid_through, cancelled_at, last_subscription_event_id, deleted_at";

/** The join `sites` needs to answer both hosting questions in one read.
 *  PostgREST spells an embedded parent this way; the two owner columns are
 *  flattened by `toHostingRow` so no caller below meets the nesting. */
const HOSTING_COLUMNS =
  "id, user_id, hosted_serving_ends_at, hosting_end_notice_at, " +
  "hosting_end_reminder_at, timezone, users!inner(deleted_at, email, paid_through), " +
  // A left join, deliberately: a site with no destination at all must still
  // come back, as a site with no hosted pages. An `!inner` here would drop
  // it from every query in this module.
  "destinations(kind)";

interface HostingJoinRow {
  id: string;
  user_id: string;
  hosted_serving_ends_at: string | null;
  hosting_end_notice_at: string | null;
  hosting_end_reminder_at: string | null;
  timezone: string | null;
  users: { deleted_at: string | null; email: string; paid_through: string };
  destinations: { kind: string }[] | null;
}

function toHostingRow(row: HostingJoinRow): HostingRow {
  return {
    id: row.id,
    user_id: row.user_id,
    hosted_serving_ends_at: row.hosted_serving_ends_at,
    hosting_end_notice_at: row.hosting_end_notice_at,
    hosting_end_reminder_at: row.hosting_end_reminder_at,
    timezone: row.timezone,
    owner_deleted_at: row.users.deleted_at,
    owner_email: row.users.email,
    owner_paid_through: row.users.paid_through,
    hasHostedPages: (row.destinations ?? []).some((d) => d.kind === "hosted"),
  };
}

const NOTICE_COLUMN: Readonly<Record<HostingNotice, string>> = Object.freeze({
  access_ended: "hosting_end_notice_at",
  seven_days: "hosting_end_reminder_at",
});

export function supabaseBillingStore(): BillingStore {
  async function oneAccount(
    column: string,
    value: string
  ): Promise<{ ok: true; account: BillingRow | null } | { ok: false }> {
    const { data, error } = await untyped()
      .from<BillingRow>("users")
      .select(BILLING_COLUMNS)
      .eq(column, value)
      .limit(1);
    if (error) return { ok: false };
    return { ok: true, account: data?.[0] ?? null };
  }

  return {
    async paidThroughForSite(siteId) {
      const { data, error } = await untyped()
        .from<{ users: { paid_through: string } }>("sites")
        .select("users!inner(paid_through)")
        .eq("id", siteId)
        .limit(1);
      if (error) return { ok: false };
      const row = data?.[0];
      return { ok: true, paidThrough: row === undefined ? null : new Date(row.users.paid_through) };
    },

    account: (userId) => oneAccount("id", userId),
    accountBySubscription: (subscriptionId) => oneAccount("stripe_subscription_id", subscriptionId),
    accountByStripeCustomer: (customerId) => oneAccount("stripe_customer_id", customerId),

    async writeSubscriptionFacts(userId, facts) {
      const { error } = await untyped()
        .from<BillingRow>("users")
        .update({
          stripe_subscription_id: facts.stripe_subscription_id,
          paid_through: facts.paid_through.toISOString(),
          plan_status: facts.plan_status,
          ...(facts.eventId === null ? {} : { last_subscription_event_id: facts.eventId }),
        })
        .eq("id", userId);
      return error ? { ok: false } : { ok: true };
    },

    async stampCancelled(userId, at) {
      const { error } = await untyped()
        .from<BillingRow>("users")
        .update({ cancelled_at: at === null ? null : at.toISOString() })
        .eq("id", userId);
      return error ? { ok: false } : { ok: true };
    },

    async hosting(siteId) {
      const { data, error } = await untyped()
        .from<HostingJoinRow>("sites")
        .select(HOSTING_COLUMNS)
        .eq("id", siteId)
        .limit(1);
      if (error) return { ok: false };
      const row = data?.[0];
      return { ok: true, site: row === undefined ? null : toHostingRow(row) };
    },

    async hostingForAccount(userId) {
      const { data, error } = await untyped()
        .from<HostingJoinRow>("sites")
        .select(HOSTING_COLUMNS)
        .eq("user_id", userId);
      if (error) return { ok: false };
      return { ok: true, sites: (data ?? []).map(toHostingRow) };
    },

    async sitesWithEndedAccess(now) {
      const { data, error } = await untyped()
        .from<HostingJoinRow>("sites")
        .select(HOSTING_COLUMNS)
        .is("hosted_serving_ends_at", null)
        .lte("users.paid_through", now.toISOString());
      if (error) return { ok: false };
      return { ok: true, sites: (data ?? []).map(toHostingRow) };
    },

    async sitesServingEndingBy(before) {
      const { data, error } = await untyped()
        .from<HostingJoinRow>("sites")
        .select(HOSTING_COLUMNS)
        .not("hosted_serving_ends_at", "is", null)
        .lte("hosted_serving_ends_at", before.toISOString());
      if (error) return { ok: false };
      return { ok: true, sites: (data ?? []).map(toHostingRow) };
    },

    async stampHostedServingEndsAt(siteId, at) {
      const patch =
        at === null
          ? {
              hosted_serving_ends_at: null,
              hosting_end_notice_at: null,
              hosting_end_reminder_at: null,
            }
          : { hosted_serving_ends_at: at.toISOString() };
      const { error } = await untyped().from<HostingJoinRow>("sites").update(patch).eq("id", siteId);
      return error ? { ok: false } : { ok: true };
    },

    async stampHostingNotice(siteId, which, at) {
      const { error } = await untyped()
        .from<HostingJoinRow>("sites")
        .update({ [NOTICE_COLUMN[which]]: at.toISOString() })
        .eq("id", siteId);
      return error ? { ok: false } : { ok: true };
    },
  };
}

let store: BillingStore | null = null;

/** The store every function in this module reads. Lazily constructed, so
 *  importing this module does not construct a client. */
export function billingStore(): BillingStore {
  if (store === null) store = supabaseBillingStore();
  return store;
}

/** Swaps the store. The suites' one door in; `null` restores the real one. */
export function setBillingStore(next: BillingStore | null): void {
  store = next;
}
