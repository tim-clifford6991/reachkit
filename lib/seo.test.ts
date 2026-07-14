import { expect, test, vi } from "vitest";
import { softwareApplicationLd, buildMetadata, SITE } from "./seo";

test("softwareApplicationLd emits valid schema.org shape in EUR", () => {
  const ld = softwareApplicationLd({ name: "ReachKit", url: "https://reachkit.app", price: 59 });
  expect(ld["@type"]).toBe("SoftwareApplication");
  expect(ld.offers.price).toBe("59");
  expect(ld.offers.priceCurrency).toBe("EUR");
});
test("buildMetadata sets canonical + OG title", () => {
  const m = buildMetadata({ title: "Pricing", path: "/pricing" });
  // Assert against the resolved SITE.url so the test is deterministic regardless
  // of ambient NEXT_PUBLIC_SITE_URL — it verifies the path-joining logic, not a
  // hardcoded prod domain.
  expect(m.alternates?.canonical).toBe(`${SITE.url}/pricing`);
  expect(m.openGraph?.title).toContain("Pricing");
});

test("SEO guard: production NEVER falls back to a localhost canonical", async () => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("VERCEL_URL", "");
  try {
    const { SITE: prodSite } = await import("./seo");
    expect(prodSite.url).not.toContain("localhost");
    expect(prodSite.url).toMatch(/^https:\/\//);
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});

test("dev still resolves to localhost when nothing is configured", async () => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("VERCEL_URL", "");
  try {
    const { SITE: devSite } = await import("./seo");
    expect(devSite.url).toBe("http://localhost:3000");
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});
