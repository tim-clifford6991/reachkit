// tests/account/stripe/transient.test.ts — which Stripe failures the webhook
// answers 500 for, so Stripe redelivers, and which it accepts as final.
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { isTransient } from "@/lib/account/stripe/transient";
import { stripeErrors } from "../stripe-double";

describe("isTransient", () => {
  it.each([
    ["a connection error", stripeErrors.connection()],
    ["a 503 API error", stripeErrors.unavailable()],
    ["a 429 rate limit", stripeErrors.rateLimited()],
    ["any error carrying a 502", Object.assign(new Error("bad gateway"), { statusCode: 502 })],
  ])("%s will pass", (_, error) => {
    expect(isTransient(error)).toBe(true);
  });

  it.each([
    ["a card error", new Stripe.errors.StripeCardError({ message: "Your card was declined.", code: "card_declined", statusCode: 402 })],
    ["a disputed charge", stripeErrors.disputed()],
    ["a missing resource", new Stripe.errors.StripeInvalidRequestError({ message: "No such subscription", code: "resource_missing", statusCode: 404 })],
    ["a plain Error", new Error("stripe is down")],
    ["a thrown string", "boom"],
    ["nothing", null],
  ])("%s is final", (_, error) => {
    expect(isTransient(error)).toBe(false);
  });
});
