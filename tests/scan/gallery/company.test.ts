// tests/scan/gallery/company.test.ts — issues #1380 and #1384, SPEC §2 (2026-10-10)
//
// A name stored before the brand rule is a whole page title. The landing's
// strip and the gallery show its brand without the site being scanned again.
// A stored call to action or category is no name, and the domain's brand is
// cased as the stored home title cases it.
import { expect, it, vi } from "vitest";

const rows = [
  { domain: "paddle.com", company: "Paddle - Subscriptions, Payments & Tax Compliance for SaaS & Mobile Apps", has_logo: false },
  { domain: "linear.app", company: "The system for product development", has_logo: false },
  { domain: "stripe.com", company: "stripe.com", has_logo: false },
  { domain: "convertkit.com", company: "Kit", has_logo: true },
  { domain: "hotjar.com", company: "Sign up for free", has_logo: false },
  { domain: "deel.com", company: "HRIS", has_logo: false },
  { domain: "hubspot.com", company: "Software & Tools for your Business - Homepage", has_logo: false },
];
const titles = [{ domain: "hubspot.com", home_title: "HubSpot | Software & Tools for your Business - Homepage" }];

vi.mock("@/lib/db", () => {
  const query = { select: () => query, order: () => query, limit: () => Promise.resolve({ data: rows, error: null }) };
  const profiles = { select: () => profiles, in: () => Promise.resolve({ data: titles, error: null }) };
  return { dbAdmin: () => ({ from: (table: string) => (table === "site_profiles" ? profiles : query) }) };
});

it("shows a stored page title as the company's brand", async () => {
  const { readRecent } = await import("../../../src/lib/scan/gallery");
  expect((await readRecent(7)).map((entry) => entry.company)).toEqual(["Paddle", "Linear", "Stripe", "Kit", "Hotjar", "Deel", "HubSpot"]);
});
