// tests/account/stripe-double.ts — the vendor the payment suites drive.
//
// `setStripe()` takes the SDK's own type, so this double is cast at exactly
// one place and every call site is type-checked against Stripe's real
// signatures. What it records is what the assertions are about: which
// sessions were created, which subscriptions were cancelled, and whether a
// charge was ever made.
//
// **`chargesCreated` is asserted to stay zero on both backstop paths.**
// REQ-024 criterion 6 — "with no second charge" — is the property most
// easily broken by a well-meant fix, and a counter that no code path
// increments is the only way to see it did not happen.
import type Stripe from "stripe";

export interface StripeDoubleState {
  price: Record<string, unknown> | null;
  priceError: Error | null;
  sessions: Map<string, Record<string, unknown>>;
  sessionCreateError: Error | null;
  sessionRetrieveError: Error | null;
  listed: Record<string, unknown>[];
  listError: Error | null;
  verifies: boolean;
  event: Record<string, unknown> | null;
  created: Record<string, unknown>[];
  cancelled: string[];
  /** Set to make `subscriptions.cancel` throw — the vendor-refuses arm of
   *  REQ-079 c6's immediate end. */
  cancelError: Error | null;
  chargesCreated: number;
  pricesCreated: Record<string, unknown>[];
  nextSessionId: number;
  // ── Subscriptions and the billing portal (issue #34)
  subscriptions: Map<string, Record<string, unknown>>;
  subscriptionRetrieveError: Error | null;
  subscriptionUpdateError: Error | null;
  subscriptionCreateError: Error | null;
  /** Every `subscriptions.update` this double saw, in order. The
   *  `cancel_at_period_end` assertions read it. */
  subscriptionUpdates: { id: string; params: Record<string, unknown> }[];
  subscriptionsCreated: Record<string, unknown>[];
  portalConfigurations: Record<string, unknown>[];
  portalSessions: Record<string, unknown>[];
  portalError: Error | null;
  nextSubscriptionId: number;
}

export function newStripeDouble(): StripeDoubleState {
  return {
    price: null,
    priceError: null,
    sessions: new Map(),
    sessionCreateError: null,
    sessionRetrieveError: null,
    listed: [],
    listError: null,
    verifies: false,
    event: null,
    created: [],
    cancelled: [],
    cancelError: null,
    chargesCreated: 0,
    pricesCreated: [],
    nextSessionId: 1,
    subscriptions: new Map(),
    subscriptionRetrieveError: null,
    subscriptionUpdateError: null,
    subscriptionCreateError: null,
    subscriptionUpdates: [],
    subscriptionsCreated: [],
    portalConfigurations: [],
    portalSessions: [],
    portalError: null,
    nextSubscriptionId: 1,
  };
}

/** A period end a month out, in the vendor's own unit (seconds). Used by
 *  `subscriptions.create`, which is what a resume after the paid-through
 *  date calls. */
const MONTH_FROM_NOW = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

/** One subscription, in the shape the SDK returns it — `current_period_end`
 *  on the **items**, which is where it lives in this API version and the
 *  thing `paidThroughOf` exists to read in one place.
 *
 *  Exported so every billing suite builds the same shape: a double that
 *  put the period on the subscription itself would pass a test that the
 *  live API fails. */
export function subscriptionDouble(a: {
  id: string;
  customer: string;
  periodEnd: Date;
  status?: string;
  cancelAtPeriodEnd?: boolean;
}): Record<string, unknown> {
  return {
    id: a.id,
    customer: a.customer,
    status: a.status ?? "active",
    cancel_at_period_end: a.cancelAtPeriodEnd ?? false,
    items: { data: [{ current_period_end: Math.floor(a.periodEnd.getTime() / 1000) }] },
  };
}

/** Thrown where the real SDK would throw. */
function raise(error: Error | null): void {
  if (error !== null) throw error;
}

export function stripeDouble(state: StripeDoubleState): Stripe {
  const double = {
    prices: {
      retrieve: async () => {
        raise(state.priceError);
        if (state.price === null) throw new Error("no such price");
        return state.price;
      },
      create: async (params: Record<string, unknown>) => {
        state.pricesCreated.push(params);
        return { id: `price_created_${state.pricesCreated.length}` };
      },
    },
    charges: {
      create: async () => {
        state.chargesCreated += 1;
        return { id: "ch_should_never_happen" };
      },
    },
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          raise(state.sessionCreateError);
          const id = `cs_created_${state.nextSessionId++}`;
          state.created.push(params);
          const session = { id, url: `https://checkout.stripe.com/${id}`, ...params };
          state.sessions.set(id, session);
          return session;
        },
        retrieve: async (id: string) => {
          raise(state.sessionRetrieveError);
          const session = state.sessions.get(id);
          if (session === undefined) throw new Error("no such session");
          return session;
        },
        list: async () => {
          raise(state.listError);
          return { data: state.listed };
        },
      },
    },
    subscriptions: {
      cancel: async (id: string) => {
        raise(state.cancelError);
        state.cancelled.push(id);
        return { id, status: "canceled" };
      },
      retrieve: async (id: string) => {
        raise(state.subscriptionRetrieveError);
        const subscription = state.subscriptions.get(id);
        if (subscription === undefined) throw new Error("no such subscription");
        return subscription;
      },
      update: async (id: string, params: Record<string, unknown>) => {
        raise(state.subscriptionUpdateError);
        const subscription = state.subscriptions.get(id);
        if (subscription === undefined) throw new Error("no such subscription");
        state.subscriptionUpdates.push({ id, params });
        const updated = { ...subscription, ...params };
        state.subscriptions.set(id, updated);
        return updated;
      },
      create: async (params: Record<string, unknown>) => {
        raise(state.subscriptionCreateError);
        const id = `sub_created_${state.nextSubscriptionId++}`;
        state.subscriptionsCreated.push(params);
        // A created subscription carries a period, as the real one does —
        // one month, so a resume after the paid-through date has a date to
        // advance the gate to.
        const created = {
          id,
          status: "active",
          cancel_at_period_end: false,
          customer: params.customer,
          items: { data: [{ current_period_end: MONTH_FROM_NOW }] },
        };
        state.subscriptions.set(id, created);
        return created;
      },
    },
    billingPortal: {
      configurations: {
        create: async (params: Record<string, unknown>) => {
          raise(state.portalError);
          state.portalConfigurations.push(params);
          return { id: `bpc_${state.portalConfigurations.length}` };
        },
      },
      sessions: {
        create: async (params: Record<string, unknown>) => {
          raise(state.portalError);
          state.portalSessions.push(params);
          return {
            id: `bps_${state.portalSessions.length}`,
            url: `https://billing.stripe.com/p/session/${state.portalSessions.length}`,
          };
        },
      },
    },
    webhooks: {
      // The real `constructEvent` throws on a bad signature and returns the
      // parsed event on a good one. The double keeps both behaviours,
      // because "verification precedes parsing" is asserted by observing
      // which of the two fails first.
      constructEvent: (body: Buffer | string, signature: string, secret: string) => {
        if (!state.verifies || signature.length === 0 || secret.length === 0) {
          throw new Error("No signatures found matching the expected signature for payload");
        }
        if (state.event !== null) return state.event;
        return JSON.parse(typeof body === "string" ? body : body.toString("utf8"));
      },
    },
  };
  return double as unknown as Stripe;
}
