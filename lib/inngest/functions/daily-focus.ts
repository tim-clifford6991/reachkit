/**
 * daily-focus (intake 2026-07-26-email-system) — a light daily nudge for the ONE
 * action scheduled for today. Fans out over active paid apps and calls
 * `notifyDailyFocus`, which is BOTH preference-gated (daily-focus defaults OFF —
 * opt-in) AND conditional (sends only when an open action is due today). So for
 * most users this cron is a cheap no-op; only opted-in users with work due today
 * get an email. No scan spend — a pure DB read + send.
 */
import { inngest } from "@/lib/inngest/client";
import { env } from "@/lib/config/env";
import { captureServerException } from "@/lib/analytics-server";
import { activePaidAppIds } from "@/lib/inngest/functions/active-paid-apps";
import { notifyDailyFocus } from "@/lib/email/notify";

export const dailyFocus = inngest.createFunction(
  {
    id: "daily-focus",
    retries: 1,
    triggers: [{ cron: "0 13 * * *" }], // daily 13:00 UTC (~morning across US/EU)
    onFailure: async ({ error }) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[daily-focus] run failed:", message);
      await captureServerException(error, { source: "inngest:daily-focus" });
    },
  },
  async ({ step }) => {
    if (!env.scanningEnabled) return { paused: true, apps: 0, sent: 0 };

    const appIds = await step.run("collect-active-paid-apps", activePaidAppIds);
    // The founder's "today" varies by timezone; the server date is the honest
    // anchor for a 13:00-UTC send (close enough for a same-day nudge).
    const today = await step.run("today", async () => new Date().toISOString().slice(0, 10));

    // One isolated step per app so a single failure can't abort the fleet.
    for (const appId of appIds) {
      await step.run(`daily-${appId}`, async () => {
        await notifyDailyFocus(appId, today);
        return { appId };
      });
    }
    return { apps: appIds.length };
  },
);
