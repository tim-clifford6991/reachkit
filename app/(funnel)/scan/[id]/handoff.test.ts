import { describe, it, expect } from "vitest";
import { shouldHandOffToResults } from "./handoff";

describe("shouldHandOffToResults", () => {
  it("free: hands off as soon as findings land (report never comes)", () => {
    expect(
      shouldHandOffToResults({ tier: "free", findingsReady: true, reportReady: false, failed: false }),
    ).toBe(true);
  });

  it("free: waits while findings are not ready", () => {
    expect(
      shouldHandOffToResults({ tier: "free", findingsReady: false, reportReady: false, failed: false }),
    ).toBe(false);
  });

  it("full: does NOT hand off on findings alone (the ~80s deep-pass bug)", () => {
    // Regression: findings land, but report_payload isn't persisted yet. Handing
    // off here is exactly what dropped the user on "Finalising your action plan…".
    expect(
      shouldHandOffToResults({ tier: "full", findingsReady: true, reportReady: false, failed: false }),
    ).toBe(false);
  });

  it("full: hands off once the report is ready", () => {
    expect(
      shouldHandOffToResults({ tier: "full", findingsReady: true, reportReady: true, failed: false }),
    ).toBe(true);
  });

  it("never hands off on a failed run — the live page shows the error inline", () => {
    expect(
      shouldHandOffToResults({ tier: "free", findingsReady: true, reportReady: true, failed: true }),
    ).toBe(false);
    expect(
      shouldHandOffToResults({ tier: "full", findingsReady: true, reportReady: true, failed: true }),
    ).toBe(false);
  });
});
