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

/**
 * Report a client-side error to PostHog error tracking (P4). Consent-gated like
 * capture() — only fires after the visitor accepts analytics — and best-effort:
 * it must never throw from inside an error boundary. The reliable backbone for
 * prod exceptions is the SERVER capture (`lib/analytics-server.ts`); this adds
 * browser-side render/runtime errors when consent allows.
 */
export function captureException(error: unknown, props?: Record<string, unknown>) {
  if (consentChoice() !== "granted") return;
  void client().then((c) => {
    try {
      const err = error instanceof Error ? error : new Error(String(error));
      c?.captureException?.(err, props);
    } catch {
      /* observability must never throw */
    }
  });
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

/** Fired when the paywall (CapturedUnlockButton, on the real rendered free
 *  report) becomes visible (moment 4). Deduped per scanId at the call site
 *  since the report renders more than one unlock-button instance per view. */
function paywallViewed(props: { scan_id?: string }) {
  capture("paywall_viewed", props);
}

/**
 * Fired when the user starts Stripe checkout — from the free-report paywall OR
 * the in-app upgrade CTA (moment 5). `subscription_activated` (the conversion)
 * is captured server-side from the Stripe webhook, so it can't be spoofed or
 * lost to a client redirect. (Replaces the old email-gate helpers, which the
 * payment-first funnel superseded — the email step is now Stripe's.)
 */
function checkoutStarted(props: { plan: string; scan_id?: string; source: "report" | "app" }) {
  capture("checkout_started", props);
}

export const funnel = {
  scanStarted,
  factsShown,
  findingsShown,
  paywallViewed,
  checkoutStarted,
} as const;
