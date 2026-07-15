/**
 * Server-side observability (launch P4) — `posthog-node`.
 *
 * The backbone for seeing prod: server errors (API throws, Inngest failures,
 * RSC render errors) and operational events (cost alerts, conversion funnel)
 * that never reach the consent-gated CLIENT analytics (`lib/analytics.ts`).
 *
 * Uses the SERVER PostHog key (`POSTHOG_KEY`, not the `NEXT_PUBLIC_` one). This
 * is operational telemetry with a system distinct-id, not visitor tracking, so
 * it is NOT consent-gated — but it degrades to a silent no-op when PostHog is
 * unconfigured, and EVERY function is wrapped so observability can never itself
 * throw and break the path it is instrumenting.
 *
 * Serverless note: we use the `*Immediate` / `flush()` variants so events are
 * sent before the function instance freezes (no background flush timer to rely
 * on under Fluid Compute).
 */

import { PostHog } from "posthog-node";
import { env } from "@/lib/config/env";

let _client: PostHog | null = null;

function serverClient(): PostHog | null {
  if (!env.posthogKey) return null; // unconfigured → no-op
  if (!_client) {
    _client = new PostHog(env.posthogKey, {
      host: env.posthogHost || "https://us.i.posthog.com",
      // Send on every call (no batching window) — serverless instances freeze
      // between requests, so a deferred flush would drop events.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

/** For tests: reset the memoised client so a re-parsed env takes effect. */
export function __resetServerAnalytics(): void {
  _client = null;
}

/**
 * Report a server-side exception to PostHog error tracking. Best-effort and
 * never throws — a failure here must not mask or replace the original error.
 */
export async function captureServerException(
  error: unknown,
  context?: { distinctId?: string; source?: string; extra?: Record<string, unknown> },
): Promise<void> {
  try {
    const client = serverClient();
    if (!client) {
      // Still surface it in the log stream when PostHog is off.
      console.error(`[server-error]${context?.source ? ` ${context.source}` : ""}`, error);
      return;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    await client.captureExceptionImmediate(err, context?.distinctId ?? "server", {
      ...(context?.source ? { source: context.source } : {}),
      ...(context?.extra ?? {}),
    });
  } catch (e) {
    console.error("[analytics-server] captureException failed (best-effort)", e);
  }
}

/**
 * Emit a server-side product/operational event (funnel, billing, cost alert).
 * Best-effort; never throws.
 */
export async function captureServerEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    const client = serverClient();
    if (!client) return;
    client.capture({ distinctId, event, properties });
    await client.flush();
  } catch (e) {
    console.error("[analytics-server] capture failed (best-effort)", e);
  }
}
