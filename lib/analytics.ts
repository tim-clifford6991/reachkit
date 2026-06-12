"use client";

// posthog-js is imported dynamically so it is excluded from the shared
// framework chunk and only pulled into pages that actually call capture().
// The dynamic import resolves synchronously after the first await, so event
// calls after initialisation are still cheap.
type PostHogInstance = import("posthog-js").PostHog;

let ph: PostHogInstance | null = null;

async function client(): Promise<PostHogInstance | null> {
  if (typeof window === "undefined") return null;                 // SSR: no-op
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;                                          // unconfigured (Cycle 0): no-op
  if (!ph) {
    const { default: posthog } = await import("posthog-js");
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: false,
    });
    ph = posthog;
  }
  return ph;
}

export function capture(event: string, props?: Record<string, unknown>) {
  void client().then((c) => c?.capture(event, props));
}

// ---------------------------------------------------------------------------
// Typed funnel helpers — Phase-0 funnel numbers (§14)
// ---------------------------------------------------------------------------

/** Fired when the user submits the landing scan input (moment 1). */
function scanStarted(props: { mode_hint: string }) {
  capture("scan_started", props);
}

/** Fired in ScanStream when the `facts` SSE event arrives (moment 2). */
function factsShown(props: { scan_id: string; mode: string }) {
  capture("scan_facts_shown", props);
}

/** Fired in ScanStream / FindingsReveal when the `findings` SSE event arrives (moment 3). */
function findingsShown(props: { scan_id: string; score: number }) {
  capture("scan_findings_shown", props);
}

/** Fired when the email gate mounts / becomes visible (moment 4). */
function gateViewed(props: { scan_id: string }) {
  capture("email_gate_viewed", props);
}

/** Fired in EmailGate on a successful POST /claim (moment 5). */
function emailSubmitted(props: { scan_id: string }) {
  capture("email_submitted", props);
}

export const funnel = {
  scanStarted,
  factsShown,
  findingsShown,
  gateViewed,
  emailSubmitted,
} as const;
