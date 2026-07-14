import { describe, it, expect, beforeEach } from "vitest";
import { rateLimitAllow, __resetRateLimits, MAGIC_LINK_PER_EMAIL } from "./rate-limit";

describe("rateLimitAllow (auth sliding window)", () => {
  beforeEach(() => __resetRateLimits());

  it("allows up to `limit` in the window, then denies", () => {
    const t = 1_000_000;
    for (let i = 0; i < MAGIC_LINK_PER_EMAIL; i++) {
      expect(rateLimitAllow("email:a", MAGIC_LINK_PER_EMAIL, t)).toBe(true);
    }
    expect(rateLimitAllow("email:a", MAGIC_LINK_PER_EMAIL, t)).toBe(false);
  });

  it("keys are independent (one email/IP being limited doesn't block others)", () => {
    const t = 1_000_000;
    for (let i = 0; i < MAGIC_LINK_PER_EMAIL; i++) rateLimitAllow("email:a", MAGIC_LINK_PER_EMAIL, t);
    expect(rateLimitAllow("email:a", MAGIC_LINK_PER_EMAIL, t)).toBe(false);
    expect(rateLimitAllow("email:b", MAGIC_LINK_PER_EMAIL, t)).toBe(true);
  });

  it("the window drains — attempts older than an hour no longer count", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < MAGIC_LINK_PER_EMAIL; i++) rateLimitAllow("email:a", MAGIC_LINK_PER_EMAIL, t0);
    expect(rateLimitAllow("email:a", MAGIC_LINK_PER_EMAIL, t0)).toBe(false);
    // 61 minutes later the old hits have aged out.
    const later = t0 + 61 * 60 * 1000;
    expect(rateLimitAllow("email:a", MAGIC_LINK_PER_EMAIL, later)).toBe(true);
  });
});
