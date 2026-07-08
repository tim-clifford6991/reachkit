import { beforeEach, expect, test, vi } from "vitest";

/**
 * Mock factory for serverDb() as used by provisionCheckoutUser:
 *   - auth.admin.createUser(...)                              (ensureAuthUser)
 *   - auth.admin.generateLink(...)                             (sendOnboardingMagicLink)
 *   - from("users").select("stripe_customer_id").eq(...).maybeSingle()  (idempotency check)
 *   - from("users").update(...).eq(...)                        (bind Stripe ids / entitlement)
 */
function makeServerDb({
  createUserResult,
  existingStripeCustomerId = null,
}: {
  createUserResult: {
    data: { user: { id: string } } | null;
    error: { message: string } | null;
  };
  existingStripeCustomerId?: string | null;
}) {
  const createUser = vi.fn().mockResolvedValue(createUserResult);
  const generateLink = vi.fn().mockResolvedValue({
    data: { properties: { hashed_token: "tok_abc" } },
    error: null,
  });

  const selectMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { stripe_customer_id: existingStripeCustomerId }, error: null });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle: selectMaybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });

  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const from = vi.fn().mockReturnValue({ select, update });

  const serverDb = vi.fn().mockReturnValue({
    from,
    auth: { admin: { createUser, generateLink } },
  });

  return {
    serverDb,
    spies: { createUser, generateLink, from, select, selectEq, selectMaybeSingle, update, updateEq },
  };
}

beforeEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// First provisioning of a Stripe customer → the onboarding email goes out.
// ---------------------------------------------------------------------------
test("provisionCheckoutUser sends the onboarding magic link on first provisioning", async () => {
  const db = makeServerDb({
    createUserResult: { data: { user: { id: "user-1" } }, error: null },
    existingStripeCustomerId: null, // no prior binding — genuinely new
  });
  const sendMagicLinkEmail = vi.fn().mockResolvedValue(undefined);

  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  vi.doMock("@/lib/config/env", () => ({ env: { appUrl: "https://reachkit.app" } }));
  vi.doMock("@/lib/email/resend", () => ({ sendMagicLinkEmail }));

  const { provisionCheckoutUser } = await import("./provision");

  const userId = await provisionCheckoutUser({
    email: "founder@acme.com",
    stripeCustomerId: "cus_new",
    stripeSubscriptionId: "sub_new",
    sendMagicLink: true,
  });

  expect(userId).toBe("user-1");
  expect(sendMagicLinkEmail).toHaveBeenCalledOnce();
  expect(sendMagicLinkEmail).toHaveBeenCalledWith({
    to: "founder@acme.com",
    link: expect.stringContaining("tok_abc"),
  });
});

// ---------------------------------------------------------------------------
// Webhook redelivery — this exact Stripe customer is already bound to the
// resolved user → skip resending the magic link, but still (idempotently)
// bind the ids again.
// ---------------------------------------------------------------------------
test("provisionCheckoutUser skips the magic-link resend on a redelivered event for an already-bound customer", async () => {
  const db = makeServerDb({
    createUserResult: { data: null, error: { message: "User already registered" } },
    existingStripeCustomerId: "cus_existing", // already bound — this is a retry
  });
  const sendMagicLinkEmail = vi.fn().mockResolvedValue(undefined);

  // ensureAuthUser falls back to the existing-row lookup when createUser
  // reports "already registered". Reuse the same select/maybeSingle mock to
  // resolve { id: "user-1" } for that email lookup too.
  db.spies.selectMaybeSingle.mockImplementation(() => {
    // First call (inside ensureAuthUser's existing-row fallback) resolves the
    // user id by email; second call (the idempotency check) resolves the
    // currently-bound stripe_customer_id. Both share the same email->id shape
    // closely enough for this mock: return whichever fields the caller reads.
    return Promise.resolve({ data: { id: "user-1", stripe_customer_id: "cus_existing" }, error: null });
  });

  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  vi.doMock("@/lib/config/env", () => ({ env: { appUrl: "https://reachkit.app" } }));
  vi.doMock("@/lib/email/resend", () => ({ sendMagicLinkEmail }));

  const { provisionCheckoutUser } = await import("./provision");

  const userId = await provisionCheckoutUser({
    email: "founder@acme.com",
    stripeCustomerId: "cus_existing",
    stripeSubscriptionId: "sub_existing",
    sendMagicLink: true,
  });

  expect(userId).toBe("user-1");
  expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  // The id-binding update still runs on every call — that side effect is
  // naturally idempotent (last-write-wins), unlike the email send.
  expect(db.spies.update).toHaveBeenCalledWith(
    expect.objectContaining({ stripe_customer_id: "cus_existing", stripe_subscription_id: "sub_existing" }),
  );
});

// ---------------------------------------------------------------------------
// Fixtures path (no stripeCustomerId) — the idempotency check never applies;
// the email always sends when requested.
// ---------------------------------------------------------------------------
test("provisionCheckoutUser always sends the magic link when no stripeCustomerId is provided (fixtures path)", async () => {
  const db = makeServerDb({
    createUserResult: { data: { user: { id: "user-2" } }, error: null },
  });
  const sendMagicLinkEmail = vi.fn().mockResolvedValue(undefined);

  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  vi.doMock("@/lib/config/env", () => ({ env: { appUrl: "https://reachkit.app" } }));
  vi.doMock("@/lib/email/resend", () => ({ sendMagicLinkEmail }));

  const { provisionCheckoutUser } = await import("./provision");

  await provisionCheckoutUser({
    email: "fixture+direct@reachkit.dev",
    entitlement: { tier: "solo", status: "active" },
    sendMagicLink: true,
  });

  // No stripeCustomerId → the idempotency select is never consulted for this
  // decision, so the send always proceeds.
  expect(sendMagicLinkEmail).toHaveBeenCalledOnce();
});
