// tests/account/billing/memory-store.ts — the store the billing suites drive.
//
// `tests/setup.ts` refuses a real network call and the `node` project has no
// database, so `BillingStore` is filled in memory rather than by mocking a
// query builder. The shape mirrors `tests/account/memory-store.ts`'s, which
// the payment suites drive, for the same reason it exists at all.
//
// **Every failure direction is a switch, not a mock.** `hostedServingState`
// fails closed on deletion and open on retention (BP-060's NFR budget), and
// those two arms are only reachable if "the store could not answer" is a
// state a test can put the store into.
import type {
  BillingRow,
  BillingStore,
  HostingRow,
  SubscriptionFacts,
} from "../../../src/lib/account/billing";

/** The rows are `readonly` on the interface, which is right for a caller
 *  and wrong for a fake that has to write them. Stripped here and nowhere
 *  else. */
type Writable<T> = { -readonly [K in keyof T]: T[K] };

export interface MemoryBilling {
  users: BillingRow[];
  sites: HostingRow[];
  failAccountRead: boolean;
  failHostingRead: boolean;
  failWrite: boolean;
}

export function newMemoryBilling(): MemoryBilling {
  return {
    users: [],
    sites: [],
    failAccountRead: false,
    failHostingRead: false,
    failWrite: false,
  };
}

/** One `users` row, with every column this module reads. Defaults are a
 *  paid-up, never-cancelled account, so a test states only what it is
 *  about. */
export function account(a: Partial<BillingRow> & { id: string }): BillingRow {
  return {
    email: `${a.id}@example.com`,
    plan_status: "active",
    stripe_customer_id: `cus_${a.id}`,
    stripe_subscription_id: `sub_${a.id}`,
    paid_through: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    cancelled_at: null,
    last_subscription_event_id: null,
    deleted_at: null,
    ...a,
    id: a.id,
  };
}

/** One `sites` row as this module joins it, with its owner's three columns
 *  flattened. Defaults are a hosted site whose owner is paid up. */
export function site(a: Partial<HostingRow> & { id: string; user_id: string }): HostingRow {
  return {
    hosted_serving_ends_at: null,
    hosting_end_notice_at: null,
    hosting_end_reminder_at: null,
    timezone: "America/New_York",
    owner_deleted_at: null,
    owner_email: `${a.user_id}@example.com`,
    owner_paid_through: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    hasHostedPages: true,
    ...a,
    id: a.id,
    user_id: a.user_id,
  };
}

/** The nth `users` row the suite set up. It throws rather than returning
 *  `undefined`, so an assertion about a column is never quietly made about
 *  nothing — which is what an optional index access lets happen. */
export function storedUser(state: MemoryBilling, index = 0): BillingRow {
  const row = state.users[index];
  if (row === undefined) throw new Error(`no users[${index}] in this fixture`);
  return row;
}

/** The nth `sites` row, on the same footing. */
export function storedSite(state: MemoryBilling, index = 0): HostingRow {
  const row = state.sites[index];
  if (row === undefined) throw new Error(`no sites[${index}] in this fixture`);
  return row;
}

export function memoryBillingStore(state: MemoryBilling): BillingStore {
  const find = (id: string) => state.users.find((u) => u.id === id) ?? null;

  /** The real store reads the owner's three columns through a join, so a
   *  write to `users` is visible on every one of that account's sites at
   *  once. The fake does the same rather than keeping a second copy: a
   *  denormalised fake would pass a test in which a renewal advanced
   *  `paid_through` and the gate stayed false. Where no `users` row was set
   *  up — the many cases that are only about a site — the row's own
   *  `owner_*` members stand in. */
  function joined(row: HostingRow): HostingRow {
    const owner = find(row.user_id);
    if (owner === null) return row;
    return {
      ...row,
      owner_deleted_at: owner.deleted_at,
      owner_email: owner.email,
      owner_paid_through: owner.paid_through,
    };
  }

  function patchUser(userId: string, patch: Partial<Writable<BillingRow>>): boolean {
    const index = state.users.findIndex((u) => u.id === userId);
    if (index === -1) return false;
    // `Partial<T>` admits an explicit `undefined`, which the spread would
    // widen every member to. The patches below never carry one.
    state.users[index] = { ...state.users[index], ...patch } as BillingRow;
    return true;
  }

  function patchSite(siteId: string, patch: Partial<Writable<HostingRow>>): boolean {
    const index = state.sites.findIndex((s) => s.id === siteId);
    if (index === -1) return false;
    state.sites[index] = { ...state.sites[index], ...patch } as HostingRow;
    return true;
  }

  return {
    async paidThroughForSite(siteId) {
      if (state.failHostingRead) return { ok: false };
      const found = state.sites.find((s) => s.id === siteId);
      return {
        ok: true,
        paidThrough: found === undefined ? null : new Date(joined(found).owner_paid_through),
      };
    },

    async account(userId) {
      if (state.failAccountRead) return { ok: false };
      return { ok: true, account: find(userId) };
    },

    async accountBySubscription(subscriptionId) {
      if (state.failAccountRead) return { ok: false };
      return {
        ok: true,
        account: state.users.find((u) => u.stripe_subscription_id === subscriptionId) ?? null,
      };
    },

    async accountByStripeCustomer(customerId) {
      if (state.failAccountRead) return { ok: false };
      return {
        ok: true,
        account: state.users.find((u) => u.stripe_customer_id === customerId) ?? null,
      };
    },

    async writeSubscriptionFacts(userId, facts: SubscriptionFacts) {
      if (state.failWrite) return { ok: false };
      const patch: Partial<Writable<BillingRow>> = {
        stripe_subscription_id: facts.stripe_subscription_id,
        paid_through: facts.paid_through.toISOString(),
        plan_status: facts.plan_status,
      };
      // The real store omits the column entirely when the write carries no
      // event id, so the mirror does too — a resume must not blank the id a
      // replayed event is recognised by.
      if (facts.eventId !== null) patch.last_subscription_event_id = facts.eventId;
      return patchUser(userId, patch) ? { ok: true } : { ok: false };
    },

    async stampCancelled(userId, at) {
      if (state.failWrite) return { ok: false };
      return patchUser(userId, { cancelled_at: at === null ? null : at.toISOString() })
        ? { ok: true }
        : { ok: false };
    },

    async hosting(siteId) {
      if (state.failHostingRead) return { ok: false };
      const found = state.sites.find((s) => s.id === siteId);
      return { ok: true, site: found === undefined ? null : joined(found) };
    },

    async hostingForAccount(userId) {
      if (state.failHostingRead) return { ok: false };
      return { ok: true, sites: state.sites.filter((s) => s.user_id === userId).map(joined) };
    },

    async sitesWithEndedAccess(now) {
      if (state.failHostingRead) return { ok: false };
      return {
        ok: true,
        sites: state.sites
          .map(joined)
          .filter(
            (s) =>
              s.hosted_serving_ends_at === null &&
              new Date(s.owner_paid_through).getTime() <= now.getTime()
          ),
      };
    },

    async sitesServingEndingBy(before) {
      if (state.failHostingRead) return { ok: false };
      return {
        ok: true,
        sites: state.sites
          .map(joined)
          .filter(
            (s) =>
              s.hosted_serving_ends_at !== null &&
              new Date(s.hosted_serving_ends_at).getTime() <= before.getTime()
          ),
      };
    },

    async stampHostedServingEndsAt(siteId, at) {
      if (state.failWrite) return { ok: false };
      const patch: Partial<Writable<HostingRow>> =
        at === null
          ? {
              hosted_serving_ends_at: null,
              hosting_end_notice_at: null,
              hosting_end_reminder_at: null,
            }
          : { hosted_serving_ends_at: at.toISOString() };
      return patchSite(siteId, patch) ? { ok: true } : { ok: false };
    },

    async stampHostingNotice(siteId, which, at) {
      if (state.failWrite) return { ok: false };
      const patch =
        which === "access_ended"
          ? { hosting_end_notice_at: at.toISOString() }
          : { hosting_end_reminder_at: at.toISOString() };
      return patchSite(siteId, patch) ? { ok: true } : { ok: false };
    },
  };
}
