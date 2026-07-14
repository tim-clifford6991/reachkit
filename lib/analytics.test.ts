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
});
