// tests/scan/gallery/company.test.ts — issue #1380, SPEC §2 (2026-10-10)
//
// A name stored before the brand rule is a whole page title. The landing's
// strip and the gallery show its brand without the site being scanned again.
import { expect, it, vi } from "vitest";

const rows = [
  { domain: "paddle.com", company: "Paddle - Subscriptions, Payments & Tax Compliance for SaaS & Mobile Apps", has_logo: false },
  { domain: "linear.app", company: "The system for product development", has_logo: false },
  { domain: "stripe.com", company: "stripe.com", has_logo: false },
  { domain: "convertkit.com", company: "Kit", has_logo: true },
];

vi.mock("@/lib/db", () => {
  const query = { select: () => query, order: () => query, limit: () => Promise.resolve({ data: rows, error: null }) };
  return { dbAdmin: () => ({ from: () => query }) };
});

it("shows a stored page title as the company's brand", async () => {
  const { readRecent } = await import("../../../src/lib/scan/gallery");
  expect((await readRecent(4)).map((entry) => entry.company)).toEqual(["Paddle", "Linear", "Stripe", "Kit"]);
});
