// src/app/api/setup/realtime/route.ts — SPEC §5 (2026-09-20, #923)
//
// The browser's way onto its own setup channel: a short-lived subscription
// token for the site the **session** names.
//
// **There is no parameter on this route**, which is the strongest form of
// the property the progress route beside it already has: the browser cannot
// ask for a channel, only for "mine". The site id is read from the signed
// cookie through the same `currentFounder` seam every other setup read
// uses, so a token can only ever be minted for the founder holding it.
//
// It performs no vendor call, no measurement and no write. A founder with
// no site row yet has no pass to watch: the answer is `null` and the screen
// keeps the step the server rendered, rather than a token for a channel
// nothing publishes to.
//
// **POST, not GET.** Minting a credential is not a safe, cacheable read: a
// `GET` would be prefetchable and cacheable by anything between here and
// the browser, and the token is a bearer of one founder's channel.
import { adapter } from "../../_adapter";
import { readSetupSiteId } from "@/app/(account)/setup/_setup/provider";

export const POST = adapter("POST /api/setup/realtime", async (): Promise<Response> => {
  const siteId = await readSetupSiteId();
  if (siteId === "") return Response.json({ token: null });

  const { setupSubscriptionToken } = await import("@/jobs/realtime");
  return Response.json({ token: await setupSubscriptionToken(siteId) });
});
