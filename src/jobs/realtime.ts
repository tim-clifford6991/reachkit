// SPEC §5 (2026-09-20, #908, #923) — the pass's current step, pushed.
//
// **The only file besides `client.ts` that names the platform's realtime
// half, and it names it for the same reason.** `client.ts`'s header states
// the rule: everything platform-shaped lives beside the client, so swapping
// the platform is this file plus that one. A screen asks for "this site's
// setup channel" and learns nothing about what carries it.
//
// **Why it exists.** The founder's setup screen learned the pass's step by
// polling `GET /api/setup/progress` on a heartbeat — a request every few
// seconds, per open tab, to read a column that changes six times in ten
// minutes. `docs/DESIGN.md`'s library list admits `inngest/realtime` and
// `inngest/react` for exactly this ("the pass's current step, in place of
// polling"), and both are inside the Inngest 4 already pinned, so nothing
// new is installed.
//
// **One channel per site, one topic on it.** The site id is the whole of
// the channel name, so a subscription token minted for one founder cannot
// read another's pass — and the route that mints it reads the site from the
// session, never from the request. The topic carries a stage handle and
// nothing else: no address, no market, no page, no duration. A handle is an
// identifier the screen renders through its own copy key
// (`_setup/stages.ts`), never a sentence.
//
// **Publishing never throws and never blocks.** The pass's job is to
// measure a market, not to keep a browser informed. `publishSetupStage` is
// called for its effect and a failure is one logged line — the same shape
// `recordStage`'s own failed write already takes. A founder whose push
// never arrives reads the step the server rendered, which is exactly the
// screen they had before this file existed.
//
// **Non-durable, and that is the right half of the seam.** `client.realtime
// .publish` fires immediately and is not replayed on a step retry;
// `step.realtime.publish` would be durable and would need the function's
// own `step` plumbed through five layers of the pass to reach
// `recordStage`. A step re-announced on a retry is a message a browser
// would draw twice, and the stage row — which is what `GET /api/setup/
// progress` and the server render still read — remains the record either
// way. The push is a courtesy on top of a fact, never the fact.
import { z } from "zod";
import { channel } from "inngest/realtime";
import { setupChannelName } from "@/lib/scan/deep/channel";
import { client } from "./client";

/** What travels on the topic. A closed shape with one member, and that
 *  member is an identifier. */
export const setupStageMessage = z.object({
  /** The engine's own stage handle, or `null` where the pass has ended and
   *  the screen should stop naming a step. */
  stage: z.string().nullable(),
});

export type SetupStageMessage = z.infer<typeof setupStageMessage>;

/** One site's setup channel. The id is the only thing in the name, so a
 *  token is per-founder by construction. */
export const setupChannel = channel({
  name: (siteId: string) => setupChannelName(siteId),
  topics: { stage: { schema: setupStageMessage } },
});

/** The topics a browser may subscribe to. One, today — and the list is
 *  handed to the token, so a topic added here is not readable until it is
 *  added there too. */
export const SETUP_TOPICS = ["stage"] as const;

/**
 * Pushes the pass's current step to whoever is watching this site's setup.
 *
 * Never throws: the caller is the pass, mid-flight, and a browser that
 * cannot be reached is not a reason to fail a measurement.
 */
export async function publishSetupStage(siteId: string, stage: string | null): Promise<void> {
  try {
    await client.realtime.publish(setupChannel(siteId).stage, { stage });
  } catch (error) {
    // The class, never the message's contents — the same shape
    // `recordStage` logs its own failed write with.
    console.log(
      JSON.stringify({ event: "setup_stage_not_published", siteId, stage, detail: String(error) })
    );
  }
}

/**
 * A browser's token for one site's setup channel.
 *
 * Minted on the server from the site the *session* names. The browser never
 * states which channel it wants: it asks "mine", and this answers for the
 * founder the cookie identifies.
 */
export async function setupSubscriptionToken(siteId: string): Promise<unknown> {
  const { getSubscriptionToken } = await import("inngest/realtime");
  return getSubscriptionToken(client, {
    channel: setupChannel(siteId),
    topics: [...SETUP_TOPICS],
  });
}
