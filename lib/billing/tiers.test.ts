import { describe, it, expect } from "vitest";
import {
  TIER_LIMITS,
  isPaid,
  isTier,
  tierForPriceId,
} from "./tiers";

describe("TIER_LIMITS", () => {
  it("free tier has correct limits", () => {
    expect(TIER_LIMITS.free).toEqual({
      apps: 1,
      refreshCadence: "none",
      draftQuota: 0,
      rankDepth: 0,
    });
  });

  it("solo tier has correct limits", () => {
    expect(TIER_LIMITS.solo).toEqual({
      apps: 1,
      refreshCadence: "weekly",
      draftQuota: 20,
      rankDepth: 20,
    });
  });

  it("growth tier has correct limits", () => {
    expect(TIER_LIMITS.growth).toEqual({
      apps: 3,
      refreshCadence: "weekly",
      draftQuota: 100,
      rankDepth: 50,
    });
  });
});

describe("isPaid", () => {
  it("free → false", () => {
    expect(isPaid("free")).toBe(false);
  });

  it("solo → true", () => {
    expect(isPaid("solo")).toBe(true);
  });

  it("growth → true", () => {
    expect(isPaid("growth")).toBe(true);
  });
});

describe("isTier", () => {
  it("accepts valid tiers", () => {
    expect(isTier("free")).toBe(true);
    expect(isTier("solo")).toBe(true);
    expect(isTier("growth")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isTier("enterprise")).toBe(false);
    expect(isTier("")).toBe(false);
    expect(isTier("FREE")).toBe(false);
  });
});

describe("tierForPriceId", () => {
  const priceMap = { solo: "price_solo_123", growth: "price_growth_456" };

  it("maps solo price id → solo", () => {
    expect(tierForPriceId("price_solo_123", priceMap)).toBe("solo");
  });

  it("maps growth price id → growth", () => {
    expect(tierForPriceId("price_growth_456", priceMap)).toBe("growth");
  });

  it("maps unknown price id → free", () => {
    expect(tierForPriceId("price_unknown_999", priceMap)).toBe("free");
  });

  it("maps empty priceId with real priceMap → free", () => {
    expect(tierForPriceId("", priceMap)).toBe("free");
  });

  it("maps any priceId with empty priceMap entries → free", () => {
    const emptyMap = { solo: "", growth: "" };
    expect(tierForPriceId("", emptyMap)).toBe("free");
    expect(tierForPriceId("price_solo_123", emptyMap)).toBe("free");
  });
});
