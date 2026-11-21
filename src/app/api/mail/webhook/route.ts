// The mail vendor's bounce and complaint webhook. It verifies nothing itself: the raw text and the three signature headers go to
// `handleMailWebhook`, where the signature is checked, so the trust decision lives in one place.
import { handleMailWebhook } from "@/lib/mail/leads";
import { adapter } from "../../_adapter";

export const runtime = "nodejs";

export const POST = adapter("/api/mail/webhook", async (request: Request) => {
  const payload = await request.text();
  const header = (name: string) => request.headers.get(name) ?? "";
  const result = await handleMailWebhook(payload, {
    id: header("svix-id"),
    timestamp: header("svix-timestamp"),
    signature: header("svix-signature"),
  });
  // A refusal is retried by the vendor; neither answer carries a body.
  return new Response(null, { status: result.handled ? 200 : 400 });
});
