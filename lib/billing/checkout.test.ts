import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Guards for the two Stripe Checkout session creators (Task 6.4, EU CRD):
// BOTH must require explicit ToS consent at checkout — the Terms carry the
// immediate-performance / withdrawal-waiver clause, so without the consent
// checkbox the 14-day withdrawal right never lapses and any EU consumer could
// demand a full refund on day 13. Also pins the no-trial stance (launch P2):
// paid plans charge immediately, so no subscription_data/trial params.
//
// Idiom matches webhook.test.ts: vi.doMock the collaborators, dynamically
// import the module under test, capture the params passed to
// stripe.checkout.sessions.create and assert on them.
// ---------------------------------------------------------------------------

/** Fake Stripe client capturing every checkout.sessions.create params object. */
function makeStripe() {
  const created: Record<string, unknown>[] = [];
  const sessionsCreate = vi.fn(async (params: Record<string, unknown>) => {
    created.push(params);
    return { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" };
  });
  const customersCreate = vi.fn(async () => ({ id: "cus_new" }));
  const stripe = {
    checkout: { sessions: { create: sessionsCreate } },
    customers: { create: customersCreate },
  };
  return { stripe, created, sessionsCreate };
}

/** serverDb() mock for createCheckout's user lookup (select→eq→maybeSingle). */
function makeServerDb(userRow: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: userRow, error: null });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const from = vi.fn().mockReturnValue({ select, update });
  return { serverDb: vi.fn().mockReturnValue({ from }) };
}

function mockCollaborators(stripe: unknown) {
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
  vi.doMock("@/lib/config/env", () => ({ env: { appUrl: "https://reachkit.test" } }));
  vi.doMock("@/lib/billing/stripe", () => ({
    assertStripeConfigured: vi.fn(),
    stripeClient: () => stripe,
    priceIdFor: () => "price_test_123",
  }));
  vi.doMock("@/lib/billing/provision", () => ({ provisionCheckoutUser: vi.fn() }));
}

beforeEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Anonymous (payment-first funnel) creator.
// ---------------------------------------------------------------------------
test("createAnonymousCheckout: session requires ToS consent (EU withdrawal waiver) and stays trial-free", async () => {
  const s = makeStripe();
  mockCollaborators(s.stripe);
  vi.doMock("@/lib/db/client", () => makeServerDb(null));

  const { createAnonymousCheckout } = await import("./checkout");
  await createAnonymousCheckout({ scanId: "scan-1", plan: "solo" });

  expect(s.sessionsCreate).toHaveBeenCalledTimes(1);
  const sessionParams = s.created[0]!;
  // EU CRD: explicit ToS consent at checkout (the Terms carry the
  // immediate-performance / withdrawal-waiver clause).
  expect(sessionParams.consent_collection).toEqual({ terms_of_service: "required" });
  // Promotion-code field is offered at checkout (coupons/promo codes).
  expect(sessionParams.allow_promotion_codes).toBe(true);
  // No free trial — charged immediately at checkout (launch P2).
  expect(sessionParams.subscription_data).toBeUndefined();
  expect(sessionParams.mode).toBe("subscription");
});

// ---------------------------------------------------------------------------
// In-app (logged-in upgrade) creator.
// ---------------------------------------------------------------------------
test("createCheckout: session requires ToS consent (EU withdrawal waiver) and stays trial-free", async () => {
  const s = makeStripe();
  mockCollaborators(s.stripe);
  vi.doMock("@/lib/db/client", () =>
    makeServerDb({
      id: "user-1",
      email: "founder@example.com",
      stripe_customer_id: "cus_existing",
      subscription_status: null,
    }),
  );

  const { createCheckout } = await import("./checkout");
  await createCheckout({ userId: "user-1", plan: "growth" });

  expect(s.sessionsCreate).toHaveBeenCalledTimes(1);
  const sessionParams = s.created[0]!;
  expect(sessionParams.consent_collection).toEqual({ terms_of_service: "required" });
  // Promotion-code field is offered at checkout (coupons/promo codes).
  expect(sessionParams.allow_promotion_codes).toBe(true);
  expect(sessionParams.subscription_data).toBeUndefined();
  expect(sessionParams.mode).toBe("subscription");
});
