"use client";

// posthog-js is imported dynamically so it is excluded from the shared
// framework chunk and only pulled into pages that actually call capture().
// The dynamic import resolves synchronously after the first await, so event
// calls after initialisation are still cheap.
type PostHogInstance = import("posthog-js").PostHog;

let ph: PostHogInstance | null = null;

/** localStorage key persisting the visitor's analytics-cookie choice. */
export const CONSENT_KEY = "rk_analytics_consent";

/** The stored consent decision, or null if the visitor hasn't chosen yet. */
export function consentChoice(): "granted" | "denied" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(CONSENT_KEY);
  return v === "granted" || v === "denied" ? v : null;
}

async function client(): Promise<PostHogInstance | null> {
  if (typeof window === "undefined") return null;                 // SSR: no-op
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;                                          // unconfigured (Cycle 0): no-op
  if (!ph) {
    const { default: posthog } = await import("posthog-js");
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: false,
      // GDPR/ePrivacy: capture NOTHING until the visitor accepts analytics
      // cookies. grantConsent() opts in; before that every capture() is a no-op.
      opt_out_capturing_by_default: true,
    });
    ph = posthog;
    // Re-apply a previously-granted choice across page loads.
    if (consentChoice() === "granted") ph.opt_in_capturing();
  }
  return ph;
}

export function capture(event: string, props?: Record<string, unknown>) {
  // Fast path: never even load posthog-js before consent is granted.
  if (consentChoice() !== "granted") return;
  void client().then((c) => c?.capture(event, props));
}

/** Accept analytics cookies: persist + opt in (starts capturing). */
export function grantConsent(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, "granted");
  void client().then((c) => c?.opt_in_capturing());
}

/** Reject analytics cookies: persist + opt out (stays silent). */
export function revokeConsent(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, "denied");
  void client().then((c) => c?.opt_out_capturing());
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
