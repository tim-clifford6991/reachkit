// The phone offer bar is a second entry to checkout: it must post the card's own action, so its session is the card's.
import { describe, expect, it } from "vitest";
import { PhoneOfferBar, PricingCard } from "../../../src/app/(public)/scan/[domain]/_modules/pricing";
import { barLine } from "../../../src/app/(public)/scan/[domain]/_modules/offer-bar";

describe("the phone offer bar", () => {
  it("starts the card's own checkout: both forms on the card post the one action, on Pricing and on the report", () => {
    const action = async (): Promise<void> => undefined;
    for (const close of [false, true]) {
      const forms: unknown[] = [];
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node === null || typeof node !== "object" || !("props" in node)) return;
        const el = node as { type: unknown; props: Record<string, unknown> };
        if (el.type === "form") forms.push(el.props.action);
        if (el.type === PhoneOfferBar) walk(PhoneOfferBar(el.props as Parameters<typeof PhoneOfferBar>[0]));
        Object.values(el.props).forEach(walk);
      };
      walk(PricingCard({ startAction: action, close }));
      expect(forms).toEqual([action, action]);
    }
  });
});

describe("the phone offer bar's line", () => {
  const words = { before: "before", left: "{left} left", promise: "promise" };
  it("from the end date makes no first-50 claim in any state, read or not", () => {
    for (const spots of [{ state: "open" }, { state: "few", left: 3 }, { state: "open", left: 37 }, { state: "unknown" }] as const) {
      expect(barLine(spots, true, words)).toBe("promise");
    }
    expect(barLine({ state: "unknown" }, false, words)).toBe("before");
    expect(barLine({ state: "few", left: 3 }, false, words)).toBe("3 left");
  });
});
