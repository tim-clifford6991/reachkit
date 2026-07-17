/**
 * fixture-seam.test.ts — the injected test seam's contract.
 *
 * Locks the two guarantees production depends on: `fixtures()` is null by default
 * (so prod, which never installs a provider, always makes real calls), and the
 * registry is globalThis-backed so it survives the module identity churn that
 * `vi.resetModules()` causes in the integration tests.
 */
import { describe, it, expect, afterEach } from "vitest";
import { installFixtures, resetFixtures, fixtures, type FixtureProvider } from "./fixture-seam";

// A minimal provider; only the methods a given test exercises need real bodies.
const provider = { serp: () => ({ competitors: [], serpResultCount: 0, raw: null }) } as unknown as FixtureProvider;

afterEach(() => resetFixtures());

describe("fixture seam", () => {
  it("is null by default — production never installs a provider, so adapters call real APIs", () => {
    expect(fixtures()).toBeNull();
  });

  it("returns the installed provider after installFixtures", () => {
    installFixtures(provider);
    expect(fixtures()).toBe(provider);
  });

  it("resetFixtures clears it back to null", () => {
    installFixtures(provider);
    resetFixtures();
    expect(fixtures()).toBeNull();
  });

  it("survives module identity churn (globalThis-backed) — a re-imported seam sees the same provider", async () => {
    installFixtures(provider);
    // A fresh import of the module (as resetModules would produce) reads the SAME
    // globalThis slot, so the provider is still visible — the property that lets an
    // integration test install once and every re-imported adapter see it.
    const fresh = await import("./fixture-seam");
    expect(fresh.fixtures()).toBe(provider);
  });
});
