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
  onboardingLinkSentAt = null,
}: {
  createUserResult: {
    data: { user: { id: string } } | null;
    error: { message: string } | null;
  };
  existingStripeCustomerId?: string | null;
  /** NULL = the onboarding link has never been sent (the send-and-stamp trigger). */
  onboardingLinkSentAt?: string | null;
}) {
  const createUser = vi.fn().mockResolvedValue(createUserResult);
  const generateLink = vi.fn().mockResolvedValue({
    data: { properties: { hashed_token: "tok_abc" } },
    error: null,
  });

  const selectMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      stripe_customer_id: existingStripeCustomerId,
      onboarding_link_sent_at: onboardingLinkSentAt,
    },
    error: null,
  });
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
// Webhook redelivery — the onboarding link was ALREADY SENT (recorded fact) →
// skip resending it, but still (idempotently) bind the ids again.
//
// The trigger is `onboarding_link_sent_at`, NOT `stripe_customer_id`. See the
// race test below for why the old proxy was wrong.
// ---------------------------------------------------------------------------
test("provisionCheckoutUser skips the magic-link resend once the link has already been sent", async () => {
  const db = makeServerDb({
    createUserResult: { data: null, error: { message: "User already registered" } },
    existingStripeCustomerId: "cus_existing",
    onboardingLinkSentAt: "2026-07-17T10:00:00.000Z", // already sent — this is a retry
  });
  const sendMagicLinkEmail = vi.fn().mockResolvedValue(undefined);

  // ensureAuthUser falls back to the existing-row lookup when createUser
  // reports "already registered". Reuse the same select/maybeSingle mock to
  // resolve { id: "user-1" } for that email lookup too.
  db.spies.selectMaybeSingle.mockImplementation(() =>
    Promise.resolve({
      data: {
        id: "user-1",
        stripe_customer_id: "cus_existing",
        onboarding_link_sent_at: "2026-07-17T10:00:00.000Z",
      },
      error: null,
    }),
  );

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
// THE RACE (regression guard). Stripe does not guarantee event ordering. When
// `customer.subscription.*` lands FIRST, its defensive create
// (resolveOrCreateUserForCustomer → ensureAuthUser) already made the account
// AND bound `stripe_customer_id` — while explicitly deferring the email:
// "No magic link is sent here — the checkout.session.completed handler owns
// that". The old idempotency proxy then read that bound column, concluded
// "redelivery", and sent nothing. Each half assumed the other would send it,
// so the user paid and could never log in.
//
// The link has NOT been sent (onboarding_link_sent_at IS NULL) — so it must go.
// ---------------------------------------------------------------------------
test("provisionCheckoutUser sends the magic link when a subscription-first race already bound the customer id", async () => {
  const db = makeServerDb({
    createUserResult: { data: null, error: { message: "User already registered" } },
    existingStripeCustomerId: "cus_raced", // bound by the defensive create, NOT by us
    onboardingLinkSentAt: null, // ...but nobody has ever sent the link
  });
  const sendMagicLinkEmail = vi.fn().mockResolvedValue(undefined);

  db.spies.selectMaybeSingle.mockImplementation(() =>
    Promise.resolve({
      data: { id: "user-1", stripe_customer_id: "cus_raced", onboarding_link_sent_at: null },
      error: null,
    }),
  );

  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  vi.doMock("@/lib/config/env", () => ({ env: { appUrl: "https://reachkit.app" } }));
  vi.doMock("@/lib/email/resend", () => ({ sendMagicLinkEmail }));

  const { provisionCheckoutUser } = await import("./provision");

  await provisionCheckoutUser({
    email: "founder@acme.com",
    stripeCustomerId: "cus_raced",
    stripeSubscriptionId: "sub_raced",
    sendMagicLink: true,
  });

  expect(sendMagicLinkEmail).toHaveBeenCalledOnce();
  // ...and the send is RECORDED, so the next redelivery skips it.
  expect(db.spies.update).toHaveBeenCalledWith(
    expect.objectContaining({ onboarding_link_sent_at: expect.any(String) }),
  );
});

// ---------------------------------------------------------------------------
// THE DEEPEN POLICY (regression guard). The legacy in-app upgrade carries NO
// scanId (metadata is { userId, plan, interval }), so a scanId-driven deepen
// silently never ran for it: a logged-in free user upgrading from the paywall
// kept a free report forever. Deepening by OWNERSHIP covers both shapes.
// ---------------------------------------------------------------------------
test("provisionCheckoutUser deepens the user's owned scans even with no scanId (legacy in-app upgrade)", async () => {
  const ensureDeepScan = vi.fn().mockResolvedValue(true);

  // users: select("app_ids") → one tracked app. scans: the latest completed
  // scan for it, plus an older one that must NOT be deepened.
  const usersMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: "user-1", app_ids: ["app-1"], onboarding_link_sent_at: null },
    error: null,
  });
  const usersSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: usersMaybeSingle }) });
  const usersUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

  const scansOrder = vi.fn().mockResolvedValue({
    data: [
      { id: "scan-new", app_id: "app-1", completed_at: "2026-07-17T00:00:00Z" },
      { id: "scan-old", app_id: "app-1", completed_at: "2026-07-01T00:00:00Z" },
    ],
    error: null,
  });
  const scansNot = vi.fn().mockReturnValue({ order: scansOrder });
  const scansIn = vi.fn().mockReturnValue({ not: scansNot });
  const scansSelect = vi.fn().mockReturnValue({ in: scansIn });

  const from = vi.fn((table: string) =>
    table === "scans" ? { select: scansSelect } : { select: usersSelect, update: usersUpdate },
  );
  const serverDb = vi.fn().mockReturnValue({ from, auth: { admin: { createUser: vi.fn(), generateLink: vi.fn() } } });

  vi.doMock("@/lib/db/client", () => ({ serverDb }));
  vi.doMock("@/lib/config/env", () => ({ env: { appUrl: "https://reachkit.app" } }));
  vi.doMock("@/lib/email/resend", () => ({ sendMagicLinkEmail: vi.fn() }));
  vi.doMock("@/lib/scan/deepen", () => ({ ensureDeepScan }));
  vi.doMock("@/lib/auth/profile", () => ({ linkScanToUser: vi.fn() }));

  const { provisionCheckoutUser } = await import("./provision");

  await provisionCheckoutUser({
    userId: "user-1", // legacy shape: pre-resolved, no email, no scanId
    stripeCustomerId: "cus_inapp",
    sendMagicLink: false,
  });

  // Only the LATEST completed scan per app — not every historical scan.
  expect(ensureDeepScan).toHaveBeenCalledOnce();
  expect(ensureDeepScan).toHaveBeenCalledWith("scan-new");
});

// ---------------------------------------------------------------------------
// The legacy in-app upgrade is already logged in — it must never be emailed a
// login link, regardless of the recorded state.
// ---------------------------------------------------------------------------
test("provisionCheckoutUser never sends a link when the caller opts out (legacy in-app upgrade)", async () => {
  const db = makeServerDb({
    createUserResult: { data: { user: { id: "user-1" } }, error: null },
    onboardingLinkSentAt: null,
  });
  const sendMagicLinkEmail = vi.fn().mockResolvedValue(undefined);

  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  vi.doMock("@/lib/config/env", () => ({ env: { appUrl: "https://reachkit.app" } }));
  vi.doMock("@/lib/email/resend", () => ({ sendMagicLinkEmail }));

  const { provisionCheckoutUser } = await import("./provision");

  await provisionCheckoutUser({
    email: "founder@acme.com",
    stripeCustomerId: "cus_inapp",
    sendMagicLink: false,
  });

  expect(sendMagicLinkEmail).not.toHaveBeenCalled();
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
