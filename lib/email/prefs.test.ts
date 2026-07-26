import { describe, it, expect } from "vitest";
import { shouldSendEmail, DEFAULT_ON } from "./prefs";

describe("email preferences", () => {
  it("applies the per-type default when the key is absent", () => {
    expect(shouldSendEmail({}, "weekly-digest")).toBe(true);
    expect(shouldSendEmail(null, "scan-ready")).toBe(true);
    expect(shouldSendEmail(undefined, "daily-focus")).toBe(false); // daily is opt-in
  });

  it("an explicit boolean overrides the default (both directions)", () => {
    expect(shouldSendEmail({ "weekly-digest": false }, "weekly-digest")).toBe(false);
    expect(shouldSendEmail({ "daily-focus": true }, "daily-focus")).toBe(true);
  });

  it("daily-focus is the only default-OFF type (opt-in)", () => {
    const off = Object.entries(DEFAULT_ON).filter(([, v]) => !v).map(([k]) => k);
    expect(off).toEqual(["daily-focus"]);
  });
});
