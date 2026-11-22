// The phone offer bar is a second entry to checkout: it must post the card's own action, so its session is the card's.
import { describe, expect, it } from "vitest";
import { PhoneOfferBar, PricingCard } from "../../../src/app/(public)/scan/[domain]/_modules/pricing";

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
