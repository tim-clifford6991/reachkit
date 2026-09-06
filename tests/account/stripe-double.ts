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
  chargesCreated: number;
  pricesCreated: Record<string, unknown>[];
  nextSessionId: number;
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
    chargesCreated: 0,
    pricesCreated: [],
    nextSessionId: 1,
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
        state.cancelled.push(id);
        return { id, status: "canceled" };
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
