// src/jobs/deep-pass-backstop.ts — SPEC §5, issue #782
//
// The onboarding pass's send, and `account/maintenance`'s obligation that
// re-sends it for a finished setup the queue never started a pass for. The
// rule (who is due, and why a re-send is harmless) is
// `src/lib/scan/deep/backstop.ts`'s; this file is the send and the hand-off.
//
// Everything reaching `@/lib/db` or the platform client is imported at the
// call, for the reason `engine.ts` gives: this module is on the setup
// store's graph, which a rendered screen reaches.
import type { EngineResult } from "./engine";

/** The `scan/run` payload for one site's onboarding pass. `scanId` is the
 *  delivery's idempotency key, the same for every send for the site, so a
 *  re-send never starts a second pass. */
export async function sendDeepPass(a: { siteId: string; domain: string }): Promise<void> {
  const { sendJobEvent } = await import("./client");
  await sendJobEvent("scan/run", {
    scanId: `setup-${a.siteId}`,
    domain: a.domain,
    tier: "deep",
    siteId: a.siteId,
  });
}

export const deepPassBackstop = Object.freeze({
  async due(): Promise<readonly string[]> {
    const { sitesWithoutDeepPass } = await import("@/lib/scan/deep/backstop");
    return sitesWithoutDeepPass(new Date());
  },
  async handOff(siteId: string): Promise<EngineResult> {
    const { deepPassDomain } = await import("@/lib/scan/deep/backstop");
    const domain = await deepPassDomain(siteId);
    if (domain === null) return { done: true };
    await sendDeepPass({ siteId, domain });
    console.log(JSON.stringify({ event: "deep_pass_re_enqueued", siteId }));
    return { done: true };
  },
});
