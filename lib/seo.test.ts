import { expect, test } from "vitest";
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
