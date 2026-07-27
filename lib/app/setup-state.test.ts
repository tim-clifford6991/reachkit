import { describe, it, expect } from "vitest";
import { shouldBlockSetup } from "./setup-state";

describe("shouldBlockSetup — onboarding blocks per-product, with escapes (2026-07-27)", () => {
  it("blocks a genuine first run (no profile yet)", () => {
    expect(shouldBlockSetup({ onboardedAt: null, setupState: "profile", appCount: 1 })).toBe(true);
  });
  it("blocks the competitor pick on the user's ONLY app (first run)", () => {
    expect(shouldBlockSetup({ onboardedAt: "2026-07-01", setupState: "competitors", appCount: 1 })).toBe(true);
  });
  it("ALSO blocks the competitor pick with 2+ apps — the overlay's switch-product escape keeps product #1 reachable", () => {
    expect(shouldBlockSetup({ onboardedAt: "2026-07-01", setupState: "competitors", appCount: 2 })).toBe(true);
  });
  it("never blocks when ready", () => {
    expect(shouldBlockSetup({ onboardedAt: "2026-07-01", setupState: "ready", appCount: 1 })).toBe(false);
  });
  it("still blocks profile even with many apps (profile is per-USER and mandatory)", () => {
    expect(shouldBlockSetup({ onboardedAt: null, setupState: "profile", appCount: 3 })).toBe(true);
  });
});
