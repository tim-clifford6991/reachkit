import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deepReleaseReady } from "@/lib/app/deep-scan-release";

/**
 * Guard for the two-loading-screens class (shipped TWICE, 2026-07-28): the
 * onboarding Build step must release the user ONLY when the DEEP pass is complete
 * (scans.deepened_at), never on a `done` event — a tier=full scan emits a `done`
 * for the free pass first, and the Build step can mount before it's even written.
 */
describe("deepReleaseReady — the race-free onboarding release signal", () => {
  it("does NOT release while the scan is in flight, even with a `done` already emitted", () => {
    // The exact bug state: the FREE pass has emitted its `done` (a scan_event
    // exists) but the DEEP pass is still running → deepened_at is null.
    expect(deepReleaseReady({ deepened_at: null, status: "active" })).toBe(false);
    expect(deepReleaseReady({ deepened_at: null, status: "running" })).toBe(false);
    expect(deepReleaseReady({ deepened_at: null, status: null })).toBe(false);
  });

  it("releases when the DEEP pass completes (deepened_at set — invariant #10)", () => {
    expect(deepReleaseReady({ deepened_at: "2026-07-28T16:00:49Z", status: "done" })).toBe(true);
  });

  it("releases on a terminal FAILURE so the user is never trapped (invariant #9)", () => {
    expect(deepReleaseReady({ deepened_at: null, status: "error" })).toBe(true);
    expect(deepReleaseReady({ deepened_at: null, status: "degraded" })).toBe(true);
  });
});

/**
 * Wiring tripwire: the Build step must gate navigation on `deepComplete`, and its
 * DashboardScanProgress `onDone` must be a NO-OP — never `onDone={onComplete}`,
 * which is exactly the SSE-`done` navigation that shipped the bug.
 */
describe("SetupCalculatingStep — navigates on deepComplete, not the SSE done", () => {
  const src = readFileSync(
    join(process.cwd(), "components/app/setup/setup-calculating-step.tsx"),
    "utf8",
  );
  it("references the deep-complete signal for navigation", () => {
    expect(src).toMatch(/deepComplete/);
    expect(src).toMatch(/onCompleteRef\.current\(\)/);
  });
  it("does NOT wire DashboardScanProgress.onDone to onComplete (the bug pattern)", () => {
    expect(src).not.toMatch(/onDone=\{\s*onComplete\s*\}/);
    // The checklist is visual-only → onDone is a no-op.
    expect(src).toMatch(/onDone=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/);
  });
});
