/**
 * Action verification function (Cycle 4 Task 14) — the async side of the paid
 * loop. The /api/action/[id]/complete route sends an "action/verify" event after
 * marking the action pending; this function picks it up and runs the verification
 * → outcomes-moat → score-movement flow off the request path.
 *
 * runActionVerification is fail-closed (never throws, fixture-aware), so the
 * single step here can't fail the run; we keep retries low and log on failure.
 */

import { inngest, actionVerifyRequestedEvent } from "@/lib/inngest/client";
import { runActionVerification } from "@/lib/scan/verify";

export const actionVerifyRequested = inngest.createFunction(
  {
    id: "action-verify-requested",
    retries: 1,
    triggers: [actionVerifyRequestedEvent],
    onFailure: async ({ event, error }) => {
      const actionId = event.data.event.data.actionId;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[action-verify] run failed for action ${actionId}: ${message}`);
    },
  },
  async ({ event, step }) => {
    const { actionId } = event.data;
    const result = await step.run("verify-action", () => runActionVerification(actionId));
    return { actionId, ...result };
  },
);
