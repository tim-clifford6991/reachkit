import { describe, it, expect } from "vitest";
import { shouldBlockSetup } from "./setup-state";

describe("shouldBlockSetup — the overlay is FIRST-RUN only", () => {
  it("blocks a genuine first run (no profile yet)", () => {
    expect(shouldBlockSetup({ onboardedAt: null, setupState: "profile", appCount: 1 })).toBe(true);
  });
  it("blocks the competitor pick on the user's ONLY app (first run)", () => {
    expect(shouldBlockSetup({ onboardedAt: "2026-07-01", setupState: "competitors", appCount: 1 })).toBe(true);
  });
  it("NEVER blocks when the user has 2+ apps — product #2's setup must not inert product #1", () => {
    expect(shouldBlockSetup({ onboardedAt: "2026-07-01", setupState: "competitors", appCount: 2 })).toBe(false);
  });
  it("never blocks when ready", () => {
    expect(shouldBlockSetup({ onboardedAt: "2026-07-01", setupState: "ready", appCount: 1 })).toBe(false);
  });
  it("still blocks profile even with many apps (profile is per-USER and mandatory)", () => {
    expect(shouldBlockSetup({ onboardedAt: null, setupState: "profile", appCount: 3 })).toBe(true);
  });
});
