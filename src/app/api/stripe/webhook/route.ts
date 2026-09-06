// src/app/api/stripe/webhook/route.ts — BUILD §13
//
// **This route verifies nothing, and that is its whole correctness.** It
// reads the request body as bytes, reads one header, and hands both to
// `handleStripeWebhook`, which is where the signature — the whole trust
// boundary — is checked. There is no signing secret named here, no
// `constructEvent`, no event-type comparison, no provisioning and no mail.
//
// A route that checked the signature "as well" would make the real check
// look optional and put a security decision in an adapter, which is exactly
// the shape ARCHITECTURE rule 1 rules out.
//
// **The bytes handed over are the bytes received.** `arrayBuffer()`, once,
// into a `Buffer`. No `JSON.parse`, no `text()` round-trip, no line-ending
// normalisation, no re-encoding: a signature is computed over bytes, and any
// of those three turns a valid webhook into an invalid one in a way no test
// that stubs the verifier catches.
//
// **A missing signature header is passed on as an empty string.** The route
// makes no judgement about a signature, including the judgement that an
// absent one is invalid — that judgement belongs to the one function that
// makes every other judgement about signatures.
//
// The Node.js runtime is declared because the raw body and the vendor SDK's
// crypto both need it.
import { handleStripeWebhook } from "@/lib/account/provisioning/webhook";
import { adapter } from "../../_adapter";

export const runtime = "nodejs";

const ROUTE_ID = "/api/stripe/webhook";
const SIGNATURE_HEADER = "stripe-signature";
const ACCEPTED = 200;
const REFUSED = 400;

export const POST = adapter(ROUTE_ID, async (request: Request) => {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get(SIGNATURE_HEADER) ?? "";

  const result = await handleStripeWebhook(rawBody, signature);

  // Neither response carries the event, the reason's vendor text or any
  // payload: a vendor error never reaches a response body, and a webhook
  // sender needs a status, not a sentence.
  return result.handled
    ? new Response(null, { status: ACCEPTED })
    : new Response(null, { status: REFUSED });
});
