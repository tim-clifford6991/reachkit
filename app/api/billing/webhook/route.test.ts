import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Signature verification failure → 400.
//
// constructEvent throws (bad/missing signature). The route must catch it and
// return 400 without invoking handleStripeEvent.
// ---------------------------------------------------------------------------
test("POST /api/billing/webhook returns 400 when signature verification fails", async () => {
  const constructEvent = vi.fn(() => {
    throw new Error("No signatures found matching the expected signature for payload");
  });
  const handleStripeEvent = vi.fn();

  vi.doMock("@/lib/billing/stripe", () => ({
    stripeClient: () => ({ webhooks: { constructEvent } }),
  }));
  vi.doMock("@/lib/billing/webhook", () => ({ handleStripeEvent }));
  vi.doMock("@/lib/config/env", () => ({ env: { stripeWebhookSecret: "whsec_test" } }));

  const { POST } = await import("./route");

  const req = new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
    body: JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" }),
  });

  const res = await POST(req);

  expect(res.status).toBe(400);
  expect(constructEvent).toHaveBeenCalledOnce();
  expect(handleStripeEvent).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Valid signature → constructEvent returns an event, route dispatches it, 200.
// ---------------------------------------------------------------------------
test("POST /api/billing/webhook returns { received: true } on a verified event", async () => {
  const event = { id: "evt_ok", type: "invoice.paid", data: { object: {} } };
  const constructEvent = vi.fn().mockReturnValue(event);
  const handleStripeEvent = vi.fn().mockResolvedValue(undefined);

  vi.doMock("@/lib/billing/stripe", () => ({
    stripeClient: () => ({ webhooks: { constructEvent } }),
  }));
  vi.doMock("@/lib/billing/webhook", () => ({ handleStripeEvent }));
  vi.doMock("@/lib/config/env", () => ({ env: { stripeWebhookSecret: "whsec_test" } }));

  const { POST } = await import("./route");

  const req = new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=valid" },
    body: JSON.stringify(event),
  });

  const res = await POST(req);

  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({ received: true });
  expect(handleStripeEvent).toHaveBeenCalledWith(event);
});
