import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Stub a browser env (window + localStorage) so the consent helpers are
// exercisable in the node test runner.
function installBrowserEnv() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  vi.stubGlobal("window", { localStorage } as unknown as Window & typeof globalThis);
  return store;
}

describe("analytics consent (launch P3)", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    vi.resetModules();
    store = installBrowserEnv();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("no choice by default; grant/revoke persist the decision under CONSENT_KEY", async () => {
    const { consentChoice, grantConsent, revokeConsent, CONSENT_KEY } = await import("./analytics");
    expect(consentChoice()).toBeNull();

    grantConsent();
    expect(store.get(CONSENT_KEY)).toBe("granted");
    expect(consentChoice()).toBe("granted");

    revokeConsent();
    expect(store.get(CONSENT_KEY)).toBe("denied");
    expect(consentChoice()).toBe("denied");
  });

  it("capture() is a no-op before consent is granted (never loads posthog)", async () => {
    // No NEXT_PUBLIC_POSTHOG_KEY / denied consent → capture must not throw and
    // must short-circuit before touching posthog.
    const { capture, revokeConsent } = await import("./analytics");
    revokeConsent();
    expect(() => capture("test_event", { a: 1 })).not.toThrow();
  });

  it("captureException (P4) is consent-gated and never throws from a boundary", async () => {
    const { captureException, revokeConsent } = await import("./analytics");
    revokeConsent();
    expect(() => captureException(new Error("boom"), { boundary: "root" })).not.toThrow();
    expect(() => captureException("string error")).not.toThrow();
  });

  it("trackPageview is a no-op before consent (never loads posthog)", async () => {
    const { trackPageview, revokeConsent } = await import("./analytics");
    revokeConsent();
    expect(() => trackPageview()).not.toThrow();
  });

  it("grantConsent captures the suppressed initial $pageview (live finding: zero pageviews ever)", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const optIn = vi.fn();
    const captureSpy = vi.fn();
    vi.doMock("posthog-js", () => ({
      default: { init: vi.fn(), opt_in_capturing: optIn, opt_out_capturing: vi.fn(), capture: captureSpy },
    }));
    const { grantConsent } = await import("./analytics");
    grantConsent();
    await vi.waitFor(() => expect(optIn).toHaveBeenCalled());
    expect(captureSpy).toHaveBeenCalledWith("$pageview");
    vi.doUnmock("posthog-js");
    vi.unstubAllEnvs();
  });

  it("funnel exposes the payment-first conversion helpers (P4), all no-op pre-consent", async () => {
    const { funnel, revokeConsent } = await import("./analytics");
    revokeConsent();
    expect(typeof funnel.paywallViewed).toBe("function");
    expect(typeof funnel.checkoutStarted).toBe("function");
    expect(() => funnel.paywallViewed({ scan_id: "s1" })).not.toThrow();
    expect(() => funnel.checkoutStarted({ plan: "solo", source: "report" })).not.toThrow();
  });
});
