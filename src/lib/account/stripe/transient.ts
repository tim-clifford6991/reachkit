// src/lib/account/stripe/transient.ts — BUILD §13
//
// Whether a thrown Stripe error will pass on its own. A transient one fails
// the webhook with a 500 so Stripe redelivers it; anything else is an answer
// that a redelivery would only repeat.
const TRANSIENT_TYPES: ReadonlySet<string> = new Set(["StripeConnectionError", "StripeAPIError", "StripeRateLimitError"]);

export function isTransient(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { type, statusCode } = error as { type?: unknown; statusCode?: unknown };
  if (typeof type === "string" && TRANSIENT_TYPES.has(type)) return true;
  return typeof statusCode === "number" && (statusCode >= 500 || statusCode === 429);
}

/** Fails the webhook so the route answers 500; `step` is logged, never sent. */
export function redeliver(step: string): never {
  console.warn(JSON.stringify({ event: "billing_redeliver", step }));
  throw new Error(`billing: ${step} will be redelivered`);
}
